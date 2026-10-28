const fs = require("node:fs/promises");
const crypto = require("node:crypto");

async function setupNotifications({ file, transport, migrate }) {
  await transport.verify();
  await migrate();
  const contents = await fs.readFile(file, "utf8");
  const flag =
    /^[ \t]*(?:export[ \t]+)?EMAIL_NOTIFICATIONS_ENABLED[ \t]*=.*$/gm;
  const updated = flag.test(contents)
    ? contents.replace(flag, "EMAIL_NOTIFICATIONS_ENABLED=true")
    : contents + "\nEMAIL_NOTIFICATIONS_ENABLED=true\n";
  const temporary = file + ".email-setup-" + crypto.randomUUID();
  try {
    await fs.writeFile(temporary, updated, { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
module.exports = { setupNotifications };
