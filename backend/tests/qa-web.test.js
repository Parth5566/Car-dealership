const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { startQaWeb } = require("../scripts/qa-web");

function harness(production = true) {
  const calls = [],
    children = [],
    failures = [];
  let stopping = false;
  const startup = startQaWeb(
    {
      cwd: "/isolated-qa",
      env: { API_URL: "http://127.0.0.1:5101", NODE_ENV: "development" },
      production,
      onChild: (child) => children.push(child),
      isStopping: () => stopping,
      onFailure: (error) => failures.push(error),
    },
    (command, args, options) => {
      const child = new EventEmitter();
      calls.push({ command, args, options, child });
      return child;
    },
  );
  return {
    calls,
    children,
    failures,
    startup,
    stop() {
      stopping = true;
    },
  };
}

test("browser QA waits for a successful isolated production build before serving", async () => {
  const state = harness();
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0].args.slice(1), ["build", "--webpack"]);
  assert.equal(state.children[0], state.calls[0].child);
  state.calls[0].child.emit("exit", 0, null);
  const server = await state.startup;
  assert.equal(state.calls.length, 2);
  assert.equal(state.children[1], server);
  assert.deepEqual(state.calls[1].args.slice(1), ["start", "-p", "3100"]);
  for (const call of state.calls) {
    assert.equal(call.command, process.execPath);
    assert.equal(call.options.cwd, "/isolated-qa");
    assert.equal(call.options.env.NODE_ENV, "production");
    assert.equal(call.options.env.API_URL, "http://127.0.0.1:5101");
  }
  server.emit("exit", 1, null);
  assert.match(state.failures[0].message, /QA website stopped/);
});

test("failed or interrupted QA builds never start a server", async () => {
  for (const outcome of ["failure", "spawn-error", "interrupted"]) {
    const state = harness();
    const rejected = assert.rejects(
      state.startup,
      outcome === "spawn-error" ? /Cannot spawn/ : /QA build failed/,
    );
    if (outcome === "spawn-error")
      state.calls[0].child.emit("error", new Error("Cannot spawn"));
    else
      state.calls[0].child.emit(
        "exit",
        outcome === "failure" ? 1 : null,
        outcome === "interrupted" ? "SIGTERM" : null,
      );
    await rejected;
    assert.equal(state.calls.length, 1);
    assert.equal(state.children.length, 1);
  }
  const stopping = harness();
  stopping.stop();
  stopping.calls[0].child.emit("exit", 0, null);
  assert.equal(await stopping.startup, null);
  assert.equal(stopping.calls.length, 1);
});

test("interactive QA keeps development mode and reports startup failures without treating shutdown as failure", async () => {
  const state = harness(false);
  const server = await state.startup;
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0].args.slice(1), [
    "dev",
    "--webpack",
    "-p",
    "3100",
  ]);
  assert.equal(state.calls[0].options.env.NODE_ENV, "development");
  const error = new Error("Port is unavailable");
  server.emit("error", error);
  assert.equal(state.failures[0], error);
  state.stop();
  server.emit("exit", null, "SIGTERM");
  assert.equal(state.failures.length, 1);
});
