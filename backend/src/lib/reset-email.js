const env = require("../config/env");
const { createMailTransport } = require("./mail-transport");

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

// Password reset mail. Sent directly over SMTP rather than through the
// notification outbox, so the raw reset link is never stored in the database.
function resetEmail({ name, link }) {
  const greeting = name ? `Hi ${name},` : "Hello,";
  return {
    subject: "Reset your NCR Wheelz password",
    text: [
      greeting,
      "",
      "We received a request to reset the password for your NCR Wheelz account.",
      "Use this link within 30 minutes to choose a new password:",
      link,
      "",
      "If you didn't ask for this, you can ignore this email. Your password won't change.",
      "",
      "NCR Wheelz",
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#172638">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:16px;margin:0 0 16px">${escape(greeting)}</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">We received a request to reset the password for your NCR Wheelz account. Use the button below within 30 minutes to choose a new password.</p>
<p style="margin:0 0 24px"><a href="${escape(link)}" style="display:inline-block;background:#245b66;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">Reset my password</a></p>
<p style="font-size:13px;line-height:1.6;color:#5b6876;margin:0 0 8px">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${escape(link)}</span></p>
<p style="font-size:13px;line-height:1.6;color:#5b6876;margin:16px 0 0">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
<p style="font-size:14px;margin:24px 0 0"><strong>NCR Wheelz</strong></p>
</div></body></html>`,
  };
}

async function sendResetEmail(user, link, transport = createMailTransport()) {
  const message = resetEmail({ name: user.name, link });
  await transport.sendMail({
    from: { name: "NCR Wheelz", address: env.email.from },
    to: user.email,
    ...message,
  });
}

module.exports = { resetEmail, sendResetEmail };
