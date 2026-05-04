import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { loadSettings } from "./settings";
import type { Account } from "./settings.schema";

/** Crypto envelope: "v1.<iv-b64>.<tag-b64>.<ct-b64>".
 *  - v1: format version (lets us rotate algorithm later without losing
 *    decryption ability for older blobs).
 *  - AES-256-GCM (auth-tag protects against tampering).
 *  - 12-byte random IV per ciphertext (NIST recommended for GCM). */
const FORMAT = "v1";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export class VaultMisconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultMisconfiguredError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account "${accountId}" not found in settings`);
    this.name = "AccountNotFoundError";
  }
}

/** Returns the master key as a 32-byte buffer.
 *  Source: BULL_VAULT_KEY env var (base64). If missing, we derive a
 *  deterministic key from the machine's hostname + Node arch + a constant
 *  salt — this is intentionally weak (no actual secret protection) but
 *  prevents the dashboard from crashing on first run. The UI surfaces a
 *  banner urging the user to set a real key. */
function getMasterKey(): Buffer {
  const fromEnv = process.env.BULL_VAULT_KEY;
  if (fromEnv) return parseKey(fromEnv);
  const fingerprint = `${process.platform}|${process.arch}|bull-stock-trader-dev-fallback-key`;
  return createHash("sha256").update(fingerprint).digest();
}

/** Decode a base64-encoded 32-byte key, validating the length. Used by the
 *  vault-rekey flow (audit F6) to accept a candidate new key without
 *  routing it through process.env. */
export function parseKey(b64: string): Buffer {
  const raw = Buffer.from(b64, "base64");
  if (raw.length !== 32) {
    throw new VaultMisconfiguredError(
      `Vault key must decode to exactly 32 bytes; got ${raw.length}. ` +
        `Generate a fresh key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }
  return raw;
}

export function isVaultUsingFallback(): boolean {
  return !process.env.BULL_VAULT_KEY;
}

export function generateVaultKey(): string {
  return randomBytes(32).toString("base64");
}

/** Low-level encrypt with an explicit 32-byte key. Used by the rekey flow
 *  (audit F6) to re-encrypt under a candidate new key without routing it
 *  through process.env. */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  if (!plaintext) {
    throw new Error("encryptWithKey: refusing to encrypt empty string");
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

/** Low-level decrypt with an explicit 32-byte key. */
export function decryptWithKey(envelope: string, key: Buffer): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new VaultMisconfiguredError(
      `Credential envelope format invalid (expected "${FORMAT}.iv.tag.ct"); got ${parts.length} segments starting with "${parts[0]}"`
    );
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  try {
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch (err) {
    throw new VaultMisconfiguredError(
      `Failed to decrypt credential — vault key likely changed since this credential was stored. ` +
        `Re-add the account from the dashboard. Underlying: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function encryptCredential(plaintext: string): string {
  return encryptWithKey(plaintext, getMasterKey());
}

export function decryptCredential(envelope: string): string {
  return decryptWithKey(envelope, getMasterKey());
}

/** Returns the current vault's master key — used by the rekey flow to read
 *  existing ciphertext before re-encrypting under a new key. */
export function currentMasterKey(): Buffer {
  return getMasterKey();
}

/** SHA-256 fingerprint of a key. Used by the rekey-drift detector to
 *  compare the boot-time key against an on-disk marker WITHOUT needing
 *  to keep the key itself anywhere persistent. Pre-image resistance
 *  means knowing the fingerprint doesn't reveal the key. */
export function keyFingerprint(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Frozen at module load — captures the master key's fingerprint at the
 *  process's startup, so a later rekey writing a new fingerprint to disk
 *  can be detected as drift even though `currentMasterKey()` still
 *  returns this old key. */
let BOOT_FINGERPRINT: string | null = null;
export function bootKeyFingerprint(): string {
  if (BOOT_FINGERPRINT == null) {
    BOOT_FINGERPRINT = keyFingerprint(getMasterKey());
  }
  return BOOT_FINGERPRINT;
}

/** Last-4 hint for displaying "set / not set" in the UI without ever
 *  revealing the cleartext key. */
export function credentialHint(envelope: string | null | undefined): string | null {
  if (!envelope) return null;
  try {
    const pt = decryptCredential(envelope);
    return pt.length <= 4 ? "…" + pt : "…" + pt.slice(-4);
  } catch {
    return "…?";
  }
}

export type ResolvedCreds = {
  apiKey: string;
  secretKey: string;
  endpoint: string;
  mode: "live" | "paper";
  account: Account;
};

/** Server-only — returns decrypted credentials for the named account.
 *  Used by `runAlpaca({ accountId })` to inject creds into the alpaca.sh
 *  child process via env vars. NEVER call from a route that returns the
 *  result to a client. */
export async function resolveAccountCreds(accountId: string): Promise<ResolvedCreds> {
  const settings = await loadSettings();
  const account = settings.accounts.find((a) => a.id === accountId);
  if (!account) throw new AccountNotFoundError(accountId);
  return {
    apiKey: decryptCredential(account.apiKeyEnc),
    secretKey: decryptCredential(account.secretKeyEnc),
    endpoint: account.endpoint,
    mode: account.mode,
    account,
  };
}
