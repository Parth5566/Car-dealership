import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import { fileURLToPath } from "node:url";

const requireBackend = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
let configuredPort;
try {
  // Read only the port into the launcher; do not pass backend secrets to Next.
  configuredPort = requireBackend("dotenv").parse(
    await readFile(new URL("../backend/.env", import.meta.url)),
  ).PORT;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const apiPort = Number(process.env.PORT || configuredPort || 5001);
const frontendPort = 3000;
try {
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535)
    throw new Error("The backend PORT must be a number between 1 and 65535.");
  if (apiPort === frontendPort)
    throw new Error(
      "The API and website cannot both use port 3000. Set the backend PORT to 5001.",
    );
  for (const [name, port] of [
    ["API", apiPort],
    ["website", frontendPort],
  ]) {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", (error) =>
        reject(
          new Error(
            error.code === "EADDRINUSE"
              ? `Cannot start the ${name}: port ${port} is already in use.\nStop the previous development server with Ctrl+C, then retry npm run dev.\nIdentify the process with: lsof -nP -iTCP:${port} -sTCP:LISTEN`
              : `Cannot check ${name} port ${port}: ${error.code}. Check local network permissions.`,
          ),
        ),
      );
      probe.listen(port, "127.0.0.1", () => probe.close(resolve));
    });
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const grouped = process.platform !== "win32";
const children = ["backend", "frontend"].map((name) => ({
  name,
  child: spawn(
    "npm",
    [
      "run",
      "dev",
      ...(name === "frontend" ? ["--", "--port", String(frontendPort)] : []),
    ],
    {
      cwd: fileURLToPath(new URL(`../${name}/`, import.meta.url)),
      stdio: "inherit",
      shell: !grouped,
      detached: grouped,
    },
  ),
}));
let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (!child.pid) continue;
    try {
      // npm owns watchers and server children; stopping only npm can orphan them.
      if (grouped) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (error.code !== "ESRCH")
        console.error(`Could not stop a development process: ${error.code}`);
    }
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => stop(signal));
for (const { name, child } of children) {
  child.once("error", (error) => {
    console.error(`Could not start ${name}: ${error.message}`);
    process.exitCode = 1;
    stop();
  });
  child.once("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
