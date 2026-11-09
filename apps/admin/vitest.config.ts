import { defineConfig } from "vitest/config";

// Unit tests only. Browser tests in e2e/ are run by Playwright (npm run test:e2e).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
