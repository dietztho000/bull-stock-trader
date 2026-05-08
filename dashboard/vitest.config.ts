import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default to node — most lib tests don't need a DOM and starting one
    // costs real wall time. Component tests under components/**/__tests__
    // opt into happy-dom via the per-file pragma:
    //
    //   // @vitest-environment happy-dom
    //
    // at the top of the test file. (vitest 4 dropped environmentMatchGlobs.)
    environment: "node",
    include: [
      "**/__tests__/**/*.test.ts",
      "**/__tests__/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/.next/**"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The real `server-only` package throws on import outside an RSC
      // context. Tests run on plain Node, so we route the import to a
      // no-op stub. Lets us unit-test settings.ts, etc., without booting
      // Next.js.
      "server-only": path.resolve(__dirname, "lib/__tests__/server-only-stub.ts"),
    },
  },
});
