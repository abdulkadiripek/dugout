import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "scripts/**/*.test.mjs"],
    passWithNoTests: true,
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
