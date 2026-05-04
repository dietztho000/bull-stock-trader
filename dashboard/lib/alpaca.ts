import { spawn } from "node:child_process";
import path from "node:path";
import { BOT_ROOT } from "./memoryPath";
import { resolveAccountCreds, AccountNotFoundError } from "./accountVault";

export type AlpacaCmd =
  | "account"
  | "positions"
  | "orders"
  | "clock"
  | "portfolio-history"
  | "bars";

const ALLOWED: AlpacaCmd[] = [
  "account",
  "positions",
  "orders",
  "clock",
  "portfolio-history",
  "bars",
];

/** Write subcommands. Kept on a separate whitelist from `AlpacaCmd` (which
 *  the public `/api/alpaca/[cmd]` GET route exposes) so a typo in a UI
 *  consumer can never accidentally hit `submit-order`. */
export type AlpacaWriteCmd =
  | "submit-order"
  | "replace-order"
  | "cancel"
  | "cancel-all"
  | "close"
  | "close-all";

const ALLOWED_WRITES: AlpacaWriteCmd[] = [
  "submit-order",
  "replace-order",
  "cancel",
  "cancel-all",
  "close",
  "close-all",
];

export function isAllowedAlpacaCmd(cmd: string): cmd is AlpacaCmd {
  return (ALLOWED as string[]).includes(cmd);
}

export function isAllowedAlpacaWriteCmd(cmd: string): cmd is AlpacaWriteCmd {
  return (ALLOWED_WRITES as string[]).includes(cmd);
}

export type AlpacaMode = "paper" | "live";

/** Direct credentials passed in-memory — used by the credential-test
 *  endpoint to validate keys WITHOUT round-tripping through the encrypted
 *  vault (which would require staging a settings record). Never persisted;
 *  lives only in the spawned process's env for one shell-out. */
export type RawAlpacaCreds = {
  apiKey: string;
  secretKey: string;
  endpoint: string;
  mode: AlpacaMode;
};

export type RunAlpacaOpts = {
  /** Legacy: pick the active credential set from .env (`ALPACA_*` for live,
   *  `ALPACA_PAPER_*` for paper). Used by code paths that haven't migrated
   *  to the multi-account registry. */
  mode?: AlpacaMode;
  /** Multi-account: resolve credentials from the encrypted vault and inject
   *  them via the spawned process's env, overriding whatever's in .env. */
  accountId?: string;
  /** In-memory credentials — bypasses the vault entirely. Used by the
   *  credential-test endpoint to validate proposed keys without persisting
   *  them. Mutually exclusive with `accountId`. */
  rawCreds?: RawAlpacaCreds;
  /** Optional bot id — when set, `submit-order` prefixes the generated
   *  `client_order_id` with `${botId}-` so we can later attribute fills
   *  back to a bot for soft-allocation P&L. Ignored for non-write cmds. */
  botId?: string;
};

export async function runAlpaca(
  cmd: AlpacaCmd,
  args: string[] = [],
  opts: RunAlpacaOpts = {}
): Promise<unknown> {
  return runAlpacaUnsafe(cmd as string, args, opts);
}

/** Mutating helper. Same shell-out pattern as `runAlpaca`, but on the write
 *  whitelist. Callers MUST validate inputs (symbol/qty/side) before invoking;
 *  we do not parse JSON args here — they go straight to bash. */
export async function runAlpacaWrite(
  cmd: AlpacaWriteCmd,
  args: string[] = [],
  opts: RunAlpacaOpts = {}
): Promise<unknown> {
  return runAlpacaUnsafe(cmd, args, opts);
}

/** Inject credentials into the spawned process's env. Strategy:
 *
 *   - alpaca.sh reads ONE credential slot per invocation, picked by `--mode=`
 *     (or `BOT_MODE` env if no flag): live → `ALPACA_*`, paper → `ALPACA_PAPER_*`.
 *   - We always pass `--mode=` here, so we only need to populate the matching
 *     slot. Aliasing both slots (the previous behavior) was defensive but
 *     opaque, and risked masking a missing `--mode` flag with stale .env data.
 *   - The unused slot is intentionally left as-is from `process.env`.
 *
 *  Audit A2 (single-slot injection) and A8 (in-memory rawCreds path).
 */
function buildSlotEnv(creds: {
  apiKey: string;
  secretKey: string;
  endpoint: string;
  mode: AlpacaMode;
}): NodeJS.ProcessEnv {
  const isPaper = creds.mode === "paper";
  return {
    ...process.env,
    ...(isPaper
      ? {
          ALPACA_PAPER_API_KEY: creds.apiKey,
          ALPACA_PAPER_SECRET_KEY: creds.secretKey,
          ALPACA_PAPER_ENDPOINT: creds.endpoint,
        }
      : {
          ALPACA_API_KEY: creds.apiKey,
          ALPACA_SECRET_KEY: creds.secretKey,
          ALPACA_ENDPOINT: creds.endpoint,
        }),
  };
}

async function buildEnvForOpts(
  opts: RunAlpacaOpts
): Promise<{ env: NodeJS.ProcessEnv; modeFlag: string[] }> {
  if (opts.rawCreds) {
    return {
      env: buildSlotEnv(opts.rawCreds),
      modeFlag: [`--mode=${opts.rawCreds.mode}`],
    };
  }
  if (!opts.accountId) {
    return {
      env: process.env,
      modeFlag: opts.mode ? [`--mode=${opts.mode}`] : [],
    };
  }
  let creds;
  try {
    creds = await resolveAccountCreds(opts.accountId);
  } catch (err) {
    if (err instanceof AccountNotFoundError) throw err;
    throw new Error(
      `runAlpaca: failed to resolve credentials for accountId="${opts.accountId}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
  return { env: buildSlotEnv(creds), modeFlag: [`--mode=${creds.mode}`] };
}

async function runAlpacaUnsafe(
  cmd: string,
  args: string[],
  opts: RunAlpacaOpts
): Promise<unknown> {
  const script = path.join(BOT_ROOT, "scripts", "alpaca.sh");
  const { env, modeFlag } = await buildEnvForOpts(opts);
  const botFlag = opts.botId ? [`--bot-id=${opts.botId}`] : [];
  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [script, ...modeFlag, ...botFlag, cmd, ...args], {
      cwd: BOT_ROOT,
      env,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`alpaca.sh ${cmd} exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        // close-all + cancel-all sometimes return non-JSON empty bodies; treat
        // empty stdout as a success signal.
        if (stdout.trim().length === 0) {
          resolve({ ok: true });
          return;
        }
        reject(new Error(`alpaca.sh ${cmd}: invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on("error", reject);
  });
}
