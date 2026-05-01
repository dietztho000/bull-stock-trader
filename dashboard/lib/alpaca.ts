import { spawn } from "node:child_process";
import path from "node:path";
import { BOT_ROOT } from "./memoryPath";

export type AlpacaCmd =
  | "account"
  | "positions"
  | "orders"
  | "clock"
  | "portfolio-history";

const ALLOWED: AlpacaCmd[] = [
  "account",
  "positions",
  "orders",
  "clock",
  "portfolio-history",
];

export function isAllowedAlpacaCmd(cmd: string): cmd is AlpacaCmd {
  return (ALLOWED as string[]).includes(cmd);
}

export type AlpacaMode = "paper" | "live";

export async function runAlpaca(
  cmd: AlpacaCmd,
  args: string[] = [],
  opts: { mode?: AlpacaMode } = {}
): Promise<unknown> {
  const script = path.join(BOT_ROOT, "scripts", "alpaca.sh");
  const modeFlag = opts.mode ? [`--mode=${opts.mode}`] : [];
  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [script, ...modeFlag, cmd, ...args], {
      cwd: BOT_ROOT,
      env: process.env,
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
      } catch (err) {
        reject(new Error(`alpaca.sh ${cmd}: invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on("error", reject);
  });
}
