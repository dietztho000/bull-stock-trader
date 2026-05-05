import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Pin the workspace root so Next stops auto-detecting the parent
  // /Users/dietz/Desktop/Apps/ as the root just because there's an
  // unrelated package.json + pnpm-lock.yaml up there. Without this, file
  // tracing resolves modules against the wrong node_modules and runtime
  // requests can fail with "Could not find the module … in the React Client
  // Manifest" for Next-internal paths like next-devtools/userspace/...
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
  async redirects() {
    return [
      { source: "/performance", destination: "/analytics?tab=curve", permanent: false },
      { source: "/stats", destination: "/analytics?tab=risk", permanent: false },
      { source: "/backtest", destination: "/analytics?tab=backtest", permanent: false },
      { source: "/sectors", destination: "/trades?tab=sectors", permanent: false },
      { source: "/research", destination: "/journal?tab=research", permanent: false },
      { source: "/weekly", destination: "/journal?tab=weekly", permanent: false },
      // Stale client bundles can land on /journal?tab=calendar (no such tab exists);
      // bounce to the real /calendar route.
      {
        source: "/journal",
        has: [{ type: "query", key: "tab", value: "calendar" }],
        destination: "/calendar",
        permanent: false,
      },
    ];
  },
};

export default config;
