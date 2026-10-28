const { spawn } = require("node:child_process");

// Register the active child during both build and serving so the QA environment
// can stop its own process before deleting its temporary database/source tree.
async function startQaWeb(
  { cwd, env, production, onChild, isStopping, onFailure },
  spawnProcess = spawn,
) {
  const options = {
    cwd,
    env: { ...env, NODE_ENV: production ? "production" : "development" },
    stdio: "inherit",
  };
  const next = "node_modules/next/dist/bin/next";
  if (production) {
    console.log("Building the isolated QA website before browser tests…");
    await new Promise((resolve, reject) => {
      const build = spawnProcess(
        process.execPath,
        [next, "build", "--webpack"],
        options,
      );
      onChild(build);
      build.once("error", reject);
      build.once("exit", (code, signal) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `Isolated QA build failed (${signal || code || "unknown exit"})`,
            ),
          );
      });
    });
  }
  if (isStopping()) return null;
  const server = spawnProcess(
    process.execPath,
    [
      next,
      production ? "start" : "dev",
      ...(production ? [] : ["--webpack"]),
      "-p",
      "3100",
    ],
    options,
  );
  onChild(server);
  server.once("error", onFailure);
  server.once("exit", (code) => {
    if (!isStopping())
      onFailure(new Error(`QA website stopped (${code ?? 1})`));
  });
  return server;
}

module.exports = { startQaWeb };
