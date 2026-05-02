import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
  async redirects() {
    return [
      { source: "/performance", destination: "/analytics?tab=curve", permanent: true },
      { source: "/stats", destination: "/analytics?tab=risk", permanent: true },
      { source: "/backtest", destination: "/analytics?tab=backtest", permanent: true },
      { source: "/sectors", destination: "/trades?tab=sectors", permanent: true },
      { source: "/research", destination: "/journal?tab=research", permanent: true },
      { source: "/weekly", destination: "/journal?tab=weekly", permanent: true },
    ];
  },
};

export default config;
