import type { NextConfig } from "next";

const config: NextConfig = {
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
    ];
  },
};

export default config;
