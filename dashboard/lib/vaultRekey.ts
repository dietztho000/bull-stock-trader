import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveMemoryFile } from "./memoryPath";
import {
  bootKeyFingerprint,
  currentMasterKey,
  decryptWithKey,
  encryptWithKey,
  keyFingerprint,
  parseKey,
  VaultMisconfiguredError,
} from "./accountVault";
import { settingsSchema, type DashboardSettings } from "./settings.schema";

const SETTINGS_FILE = resolveMemoryFile("dashboard-settings.json");
const FINGERPRINT_FILE = path.join(
  path.dirname(SETTINGS_FILE),
  ".vault-fingerprint.json"
);

/** Audit F6 — vault-key rotation.
 *
 *  Re-encrypts every account's credentials under a new master key, writes
 *  a timestamped backup of the previous settings.json, then atomically
 *  swaps in the rekeyed file. The currently-running process still has
 *  the OLD key in `process.env.BULL_VAULT_KEY`, so credentials become
 *  unreadable until the user updates their .env and restarts — the route
 *  surfaces this in the response.
 *
 *  Does NOT modify accounts list or bot list, only the credential blobs.
 *  Does NOT touch process.env (we can't safely mutate that mid-process). */

const BACKUP_RETENTION = 5;

export type RekeyReport = {
  reencrypted: number;
  skipped: number;
  backupPath: string;
};

export async function rekeyAllAccounts(newKeyB64: string): Promise<RekeyReport> {
  // Validate the new key shape upfront so we never write a half-rotated file.
  const newKey = parseKey(newKeyB64);
  const oldKey = currentMasterKey();

  const raw = await fs.readFile(SETTINGS_FILE, "utf8").catch((err) => {
    throw new Error(
      `vault-rekey: settings.json missing or unreadable (${
        err instanceof Error ? err.message : String(err)
      }). Refusing to write a fresh file under a new key — that would lose any existing accounts.`
    );
  });
  const parsed = settingsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `vault-rekey: settings.json failed schema validation; refuse to rotate. ` +
        `${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const current: DashboardSettings = parsed.data;

  // Decrypt everything with the OLD key first. If any account fails, abort
  // before touching disk — partial rotation is the worst-case outcome.
  const reencrypted: DashboardSettings["accounts"] = [];
  let reencryptedCount = 0;
  let skippedCount = 0;
  for (const account of current.accounts) {
    try {
      const apiKey = decryptWithKey(account.apiKeyEnc, oldKey);
      const secretKey = decryptWithKey(account.secretKeyEnc, oldKey);
      reencrypted.push({
        ...account,
        apiKeyEnc: encryptWithKey(apiKey, newKey),
        secretKeyEnc: encryptWithKey(secretKey, newKey),
      });
      reencryptedCount += 1;
    } catch (err) {
      // Defensive: if some account got into the file via an import path that
      // used a different key, surface it but don't proceed silently. The
      // user has to re-add it post-rotation anyway.
      if (err instanceof VaultMisconfiguredError) {
        throw new Error(
          `vault-rekey: account "${account.id}" failed to decrypt with the current key — ` +
            `it was likely encrypted under a different key (e.g. a previous fallback). ` +
            `Delete or re-add it from the dashboard before rotating.`
        );
      }
      throw err;
    }
  }

  // Identity-check the new key by round-tripping a sentinel string. Catches
  // the (unlikely) case of an asymmetry in encryptWithKey/decryptWithKey.
  const probe = encryptWithKey("vault-rekey-probe", newKey);
  if (decryptWithKey(probe, newKey) !== "vault-rekey-probe") {
    throw new Error("vault-rekey: round-trip self-check failed; aborting.");
  }

  const next: DashboardSettings = { ...current, accounts: reencrypted };

  // Write a timestamped backup BEFORE the swap. Keeps the last N copies
  // so a user who rotates a few times doesn't accumulate years of backups.
  const settingsDir = path.dirname(SETTINGS_FILE);
  const backupName = `dashboard-settings.backup.${Date.now()}.json`;
  const backupPath = path.join(settingsDir, backupName);
  await fs.copyFile(SETTINGS_FILE, backupPath);
  await pruneOldBackups(settingsDir);

  // Atomic swap: write to a temp file, then rename. Avoids a torn write on
  // crash. fs.rename is atomic on the same filesystem on Linux/macOS.
  const tmpPath = `${SETTINGS_FILE}.rekey.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(next, null, 2) + "\n", "utf8");
  await fs.rename(tmpPath, SETTINGS_FILE);

  // Persist the new key's fingerprint so a process started before this
  // rotation can detect it on its next health check and tell the user to
  // restart instead of silently failing every credential read.
  await writeFingerprintMarker(keyFingerprint(newKey));

  return {
    reencrypted: reencryptedCount,
    skipped: skippedCount,
    backupPath,
  };
}

type FingerprintMarker = {
  fingerprint: string;
  rekeyedAt: string;
};

async function writeFingerprintMarker(fingerprint: string): Promise<void> {
  const marker: FingerprintMarker = {
    fingerprint,
    rekeyedAt: new Date().toISOString(),
  };
  await fs.writeFile(FINGERPRINT_FILE, JSON.stringify(marker, null, 2) + "\n", "utf8");
}

async function readFingerprintMarker(): Promise<FingerprintMarker | null> {
  try {
    const raw = await fs.readFile(FINGERPRINT_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<FingerprintMarker>;
    if (typeof parsed.fingerprint !== "string") return null;
    if (typeof parsed.rekeyedAt !== "string") return null;
    return { fingerprint: parsed.fingerprint, rekeyedAt: parsed.rekeyedAt };
  } catch {
    return null;
  }
}

export type RekeyDrift =
  | { drifted: false }
  | { drifted: true; rekeyedAt: string };

/** Detects whether the running process holds a stale master key — i.e. the
 *  on-disk fingerprint marker disagrees with the key the process booted
 *  with. Returns `drifted: false` whenever there's no marker or the marker
 *  matches. Used by `/api/vault/health` to surface a "restart required"
 *  banner without the user having to discover broken credential reads. */
export async function detectRekeyDrift(): Promise<RekeyDrift> {
  const marker = await readFingerprintMarker();
  if (!marker) return { drifted: false };
  if (marker.fingerprint === bootKeyFingerprint()) return { drifted: false };
  return { drifted: true, rekeyedAt: marker.rekeyedAt };
}

async function pruneOldBackups(dir: string): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  const backups = names
    .filter((n) => n.startsWith("dashboard-settings.backup.") && n.endsWith(".json"))
    .sort(); // lexicographic = chronological since timestamps are zero-padded ms
  if (backups.length <= BACKUP_RETENTION) return;
  const toRemove = backups.slice(0, backups.length - BACKUP_RETENTION);
  await Promise.all(
    toRemove.map((n) => fs.unlink(path.join(dir, n)).catch(() => {}))
  );
}
