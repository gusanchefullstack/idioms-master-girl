import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Opt-in live-model quality checks (SC-005, SC-006). Needs Ollama running.
export default defineConfig({
  resolve: { alias: { "@": root } },
  test: { environment: "node", include: ["tests/tutor/**/*.test.ts"], testTimeout: 600_000 },
});
