const env = require("./src/config/env");
const { app } = require("./src/app");
const { pool } = require("./src/config/db");
const worker = require("./src/lib/email-worker").createEmailWorker();
const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`NCR Wheelz API: http://localhost:${env.port}`);
  worker.start();
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await worker.stop();
      await pool.end();
      process.exit(0);
    }),
  );
