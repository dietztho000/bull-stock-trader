import { detectMode } from "@/lib/mode";

export async function ModeBadge() {
  const info = await detectMode();

  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    live: {
      bg: "bg-red-600",
      text: "text-white",
      border: "border-red-700",
      label: "LIVE TRADING",
    },
    paper: {
      bg: "bg-amber-400",
      text: "text-black",
      border: "border-amber-500",
      label: "PAPER MODE",
    },
    unknown: {
      bg: "bg-zinc-600",
      text: "text-white",
      border: "border-zinc-700",
      label: "MODE UNKNOWN",
    },
  };
  const s = styles[info.mode];

  return (
    <div className={`mb-4 rounded border-2 ${s.border} ${s.bg} ${s.text} px-3 py-2`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
        {info.mode === "live" ? "DANGER — REAL MONEY" : info.mode === "paper" ? "SIMULATED" : "Status"}
      </div>
      <div className="text-base font-bold">{s.label}</div>
      <div className="mt-1 text-[10px] font-mono leading-tight opacity-80">
        {info.accountNumber ? <>acct: {info.accountNumber}</> : null}
        {info.accountNumber && info.endpoint ? <br /> : null}
        {info.endpoint ? <>endpoint: {info.endpoint.replace(/^https?:\/\//, "")}</> : null}
        {!info.accountNumber && !info.endpoint ? <>source: {info.source}</> : null}
      </div>
      {info.error ? (
        <div className="mt-1 text-[10px] font-mono leading-tight opacity-90 break-all">
          probe failed: {info.error.slice(0, 120)}
        </div>
      ) : null}
    </div>
  );
}
