const crypto = require("node:crypto");
const { query } = require("../config/db");
const env = require("../config/env");

const acknowledgement =
  "Thank you for contacting NCR Wheelz. We’ve received your request. Our team will review the details and get back to you shortly.";
const kinds = {
  contact: { title: "Contact message", prefix: "NCR", path: "/admin/leads" },
  enquiry: { title: "Vehicle enquiry", prefix: "NCR", path: "/admin/leads" },
  test_drive: {
    title: "Test-drive request",
    prefix: "TD",
    path: "/admin/test-drives",
  },
  seller_submission: {
    title: "Seller submission",
    prefix: "SELL",
    path: "/admin/submissions",
  },
};
const escapeHtml = (value) =>
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
function emailBody(title, paragraphs, details, link) {
  const lines = details.map(([label, value]) => `${label}: ${value}`);
  return {
    text: [
      title,
      ...paragraphs,
      ...lines,
      ...(link ? [link] : []),
      "NCR Wheelz",
    ].join("\n\n"),
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f3f6f5;color:#182b35;font:16px/1.6 Arial,sans-serif"><div style="max-width:620px;margin:24px auto;background:#fff;border-radius:16px;padding:28px"><p style="color:#28585e;font-weight:bold;letter-spacing:2px">NCR WHEELZ</p><h1 style="font-size:24px;line-height:1.3">${escapeHtml(title)}</h1>${paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}<table role="presentation" style="width:100%;border-collapse:collapse">${details.map(([label, value]) => `<tr><th style="padding:10px 8px;text-align:left;vertical-align:top;border-bottom:1px solid #e4ebe7">${escapeHtml(label)}</th><td style="padding:10px 8px;white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px solid #e4ebe7">${escapeHtml(value)}</td></tr>`).join("")}</table>${link ? `<p><a href="${escapeHtml(link)}" style="color:#28585e">Open in the admin panel</a></p>` : ""}<p style="color:#697a7a">NCR Wheelz · Drive your next chapter</p></div></body></html>`,
  };
}
function messages(event, config = env.email) {
  const kind = kinds[event.kind];
  if (!kind || !Number.isSafeInteger(Number(event.id)) || Number(event.id) < 1)
    throw new Error("Invalid notification event");
  const reference = `${kind.prefix}-${event.id}`;
  const vehicle = event.vehicle;
  const details = [
    ["Reference", reference],
    ["Name", event.contact.name],
    ["Email", event.contact.email],
    ["Phone", event.contact.phone],
    ...(vehicle
      ? [
          [
            "Vehicle",
            `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? " " + vehicle.variant : ""}`,
          ],
        ]
      : []),
    ...(event.vehicleId ? [["Vehicle listing ID", event.vehicleId]] : []),
    ...(event.source ? [["Page", event.source]] : []),
    ...(event.message ? [["Message", event.message]] : []),
    ...(event.preferredAt
      ? [
          [
            "Requested time (India)",
            new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(event.preferredAt)),
          ],
        ]
      : []),
    ...(event.kind === "seller_submission"
      ? [
          [
            "Expected price",
            new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(vehicle.price),
          ],
          [
            "Kilometres driven",
            Number(vehicle.mileage).toLocaleString("en-IN") + " km",
          ],
          [
            "Category",
            vehicle.type === "commercial"
              ? "Commercial cab (yellow plate)"
              : "Passenger car",
          ],
        ]
      : []),
  ];
  const note =
    event.kind === "test_drive"
      ? "This is a request. The appointment still needs staff confirmation."
      : event.kind === "seller_submission"
        ? "The seller submitted this vehicle for review. It remains private until the normal review and publication steps are complete."
        : "A customer has contacted NCR Wheelz through the website.";
  const staff = emailBody(
    `New ${kind.title.toLowerCase()}`,
    [note],
    details,
    env.siteUrl +
      kind.path +
      (event.kind === "seller_submission" ? "/" + event.id : ""),
  );
  const customer = emailBody(
    "We’ve received your request",
    [
      acknowledgement,
      ...(event.kind === "test_drive"
        ? ["Your requested appointment is awaiting confirmation."]
        : []),
    ],
    [
      ["Reference", reference],
      ["Request", kind.title],
    ],
  );
  return [
    ...config.recipients.map((to) => ({
      to,
      audience: "staff",
      subject: `[NCR Wheelz] New ${kind.title.toLowerCase()} · ${reference}`,
      replyTo: event.contact.email,
      ...staff,
    })),
    {
      to: event.contact.email,
      audience: "customer",
      subject: `NCR Wheelz · We’ve received your request · ${reference}`,
      replyTo: config.from,
      ...customer,
    },
  ];
}

// Called inside the business transaction. No SMTP runs before a successful commit.
async function enqueueNotification(event, db) {
  if (!env.email.enabled) return;
  if (!db) throw new Error("Notifications require the request transaction");
  for (const { to, audience, ...data } of messages(event)) {
    const key = crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          event.kind,
          event.id,
          event.revision || "created",
          audience,
          to.toLowerCase(),
        ]),
      )
      .digest("hex");
    await query(
      "INSERT INTO nw_email_outbox(event_key,kind,entity_id,recipient,data) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE event_key=event_key",
      [key, event.kind, event.id, to, JSON.stringify(data)],
      db,
    );
  }
}
module.exports = { enqueueNotification, messages, acknowledgement };
