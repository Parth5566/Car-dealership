import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
import { setTimeout as pause } from "node:timers/promises";
import net from "node:net";
const browserTests = process.argv.includes("--browser");
let browserCli;
let browserExecutable;
let chromium;
let browserChannel;
const browserArguments = [
  "test",
  "--config=frontend/playwright.config.mjs",
  ...process.argv
    .slice(2)
    .filter((argument) => !["--browser", "--list"].includes(argument)),
];
function exitCode(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
if (browserTests) {
  try {
    ({
      playwrightCli: browserCli,
      browserExecutable,
      chromium,
      browserChannel,
    } = await import("./playwright.mjs"));
  } catch {
    console.error(
      "Browser tests need optional tooling: npm install --no-save --package-lock=false @playwright/test@1.64.1 && node node_modules/@playwright/test/cli.js install chromium --no-shell",
    );
    process.exit(1);
  }
  // Fail before provisioning a database if the config/specs cannot be loaded.
  const discovery = spawn(
    process.execPath,
    [browserCli, ...browserArguments, "--list"],
    {
      stdio: "inherit",
      cwd: projectRoot,
    },
  );
  const code = await exitCode(discovery);
  if (code !== 0 || process.argv.includes("--list")) process.exit(code);
  // An executable can exist in a partial installation with missing frameworks.
  // Launch the same channel as the tests before provisioning the QA database.
  try {
    const browser = await chromium.launch({
      channel: browserChannel,
      headless: true,
      timeout: 15000,
    });
    await browser.close();
  } catch (error) {
    const diagnostic = String(error.message)
      .split("\n")
      .filter(
        (line, index) =>
          index === 0 || /\[err\]|Executable doesn't exist/.test(line),
      )
      .slice(0, 12)
      .join("\n");
    console.error(
      `Chromium startup check failed (${browserExecutable}).\n${diagnostic}\nRepair the tooling and browser installation with:\nnpm install --no-save --package-lock=false @playwright/test@1.64.1\nnode node_modules/@playwright/test/cli.js install --force chromium --no-shell\nOlder Playwright versions can hang during browser extraction on Node 26 and Node 24.16+.`,
    );
    process.exit(1);
  }
}
for (const port of [3100, 5101])
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) =>
      reject(
        new Error(
          `Cannot bind test port ${port}: ${error.code}. Check permissions and stop any existing QA environment.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
const environment = spawn(
  process.execPath,
  [
    "backend/scripts/e2e-environment.js",
    ...(browserTests ? ["--production"] : []),
  ],
  { stdio: "inherit", cwd: projectRoot },
);
let stopped = false;
environment.on("exit", () => {
  stopped = true;
});
async function stop() {
  if (stopped) return;
  const exited = new Promise((resolve) => environment.once("exit", resolve));
  environment.kill("SIGTERM");
  await exited;
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await stop();
    process.exit(1);
  });
try {
  let ready = false;
  // Browser QA builds its isolated frontend before starting Next. This startup
  // budget is separate from the per-test limits and includes that build.
  const startupDeadline = Date.now() + (browserTests ? 300000 : 90000);
  while (Date.now() < startupDeadline) {
    if (stopped)
      throw new Error("Isolated test environment stopped before readiness");
    try {
      const r = await fetch("http://localhost:3100/api/v1/health", {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(500);
  }
  if (!ready)
    throw new Error(
      "Isolated test environment did not become ready within its startup budget",
    );
  const test = spawn(
    process.execPath,
    browserTests
      ? [browserCli, ...browserArguments]
      : ["--test", "frontend/tests/http-e2e.test.mjs"],
    { stdio: "inherit", cwd: projectRoot },
  );
  process.exitCode = await exitCode(test);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await stop();
}
