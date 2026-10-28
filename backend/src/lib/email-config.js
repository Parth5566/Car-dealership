const { z } = require("zod");

function emailConfig(source = process.env) {
  const enabled = source.EMAIL_NOTIFICATIONS_ENABLED === "true";
  const user = source.SMTP_USER || "ncrwheelz@gmail.com";
  const host = source.SMTP_HOST || "smtp.gmail.com";
  const config = {
    enabled,
    host,
    port: Number(source.SMTP_PORT || 465),
    secure:
      source.SMTP_SECURE == null
        ? Number(source.SMTP_PORT || 465) === 465
        : source.SMTP_SECURE === "true",
    user,
    pass:
      host === "smtp.gmail.com"
        ? (source.SMTP_PASS || "").replace(/\s/g, "")
        : source.SMTP_PASS || "",
    from: source.SMTP_FROM || user,
    recipients: [
      ...new Set(
        (
          source.EMAIL_RECIPIENTS ||
          "ncrwheelz@gmail.com,shivamchaudhary2667@gmail.com"
        )
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    dailyLimit: Number(source.EMAIL_DAILY_LIMIT || 400),
  };
  if (enabled) {
    const result = z
      .object({
        host: z
          .string()
          .min(1)
          .max(253)
          .regex(/^[a-zA-Z0-9.-]+$/),
        port: z.number().int().min(1).max(65535),
        user: z.email(),
        from: z.email(),
        recipients: z.array(z.email()).min(1).max(10),
        dailyLimit: z.number().int().min(1).max(10000),
      })
      .safeParse(config);
    if (!result.success)
      throw new Error(
        "Invalid email settings. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, EMAIL_RECIPIENTS and EMAIL_DAILY_LIMIT.",
      );
  }
  return config;
}
module.exports = { emailConfig };
