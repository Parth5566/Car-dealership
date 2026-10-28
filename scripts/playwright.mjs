import { createRequire } from "node:module";

// Next.js can install another Playwright peer inside frontend/node_modules.
// The CLI, config and specs must share one physical test runner instance.
const rootRequire = createRequire(new URL("../package.json", import.meta.url));
const playwright = rootRequire("@playwright/test");
export const test = playwright.test;
export const expect = playwright.expect;
export const defineConfig = playwright.defineConfig;
export const playwrightCli = rootRequire.resolve("@playwright/test/cli");
export const chromium = playwright.chromium;
export const browserChannel = "chromium";
export const browserExecutable = chromium.executablePath();
