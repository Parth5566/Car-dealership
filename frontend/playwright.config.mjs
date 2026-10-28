import { defineConfig, browserChannel } from "../scripts/playwright.mjs";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    channel: browserChannel,
    trace: "retain-on-failure",
  },
  outputDir: "../test-results/browser",
});
