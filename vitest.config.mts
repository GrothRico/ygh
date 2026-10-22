import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fsModuleCachePath: "node_modules/.vitest-cache",
  },
});
