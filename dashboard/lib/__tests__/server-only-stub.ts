// Replaces the `server-only` package under vitest. The real module throws
// when imported on the client; in unit tests we want to import server-side
// modules (settings.ts, etc.) directly from a Node test runner.
export {};
