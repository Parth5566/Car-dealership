const crypto = require("node:crypto");
const { z } = require("zod");
class HttpError extends Error {
  constructor(status, message, code = "REQUEST_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
};
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const token = () => crypto.randomBytes(32).toString("hex");
const id = z.coerce.number().int().positive();
const text = (max = 200) => z.string().trim().min(1).max(max);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number")
  .refine(
    (value) => /^\d{8,15}$/.test(value.replace(/\D/g, "")),
    "Enter a phone number with 8 to 15 digits",
  );
const consentVersion = "contact-2026-10-21";
const requestConsent = {
  consent: z.literal(true),
  consent_version: z.literal(consentVersion),
};
const email = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const password = z
  .string()
  .min(6, "Use at least 6 characters")
  .max(72, "Use at most 72 characters")
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "This password is too long. Please use a shorter password.",
  );
const contact = z.object({
  name: text(100),
  email,
  phone,
  message: text(3000),
});
const vehicleSchema = z
  .object({
    type: z.enum(["passenger", "commercial"]),
    make: text(80),
    model: text(100),
    variant: z.string().trim().max(120).default(""),
    year: z.coerce
      .number()
      .int()
      .min(1950)
      .max(new Date().getUTCFullYear() + 1),
    price: z.coerce.number().positive().max(1000000000),
    // Legacy API/database name: mileage is the odometer distance in kilometres.
    mileage: z.coerce.number().int().min(0).max(5000000),
    fuel_economy: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value.trim() === ""
            ? null
            : Number(value)
          : value,
      z
        .number()
        .positive("Enter fuel economy greater than zero")
        .max(1000, "Fuel economy must be 1000 or less")
        .nullable()
        .optional(),
    ),
    fuel: z.enum(["Petrol", "Diesel", "CNG", "Electric", "Hybrid"]),
    transmission: z.enum(["Manual", "Automatic"]),
    location: text(120),
    body_type: text(80),
    owners: z.coerce.number().int().min(1).max(20),
    description: text(10000),
    payload_kg: z.coerce
      .number()
      .nonnegative()
      .max(100000)
      .nullable()
      .optional(),
    seats: z.coerce.number().int().positive().max(100).nullable().optional(),
    features: z.array(text(100)).max(50).default([]),
    seo_title: z.string().trim().max(160).default(""),
    seo_description: z.string().trim().max(320).default(""),
    featured: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.type === "passenger" && v.payload_kg != null)
      ctx.addIssue({
        code: "custom",
        path: ["payload_kg"],
        message: "Payload is a commercial vehicle field",
      });
  });
const submissionTransitions = {
  draft: ["submitted"],
  submitted: ["under_review", "information_required", "approved", "rejected"],
  under_review: ["information_required", "approved", "rejected"],
  information_required: ["submitted"],
  approved: ["published"],
  published: ["sold", "archived"],
  sold: ["archived"],
  rejected: [],
  archived: [],
};
const vehicleTransitions = {
  draft: ["published", "archived"],
  published: ["draft", "reserved", "sold", "archived"],
  reserved: ["draft", "published", "sold", "archived"],
  sold: ["archived"],
  archived: ["draft"],
};
function transition(map, from, to) {
  if (!map[from]?.includes(to))
    fail(409, `Cannot change ${from} to ${to}`, "INVALID_TRANSITION");
}
function emi(principal, rate, months) {
  if (
    ![principal, rate, months].every(Number.isFinite) ||
    principal < 0 ||
    rate < 0 ||
    months < 1 ||
    !Number.isInteger(months)
  )
    throw new Error("Invalid EMI inputs");
  const r = rate / 1200;
  const monthly = r
    ? (principal * r) / (1 - Math.pow(1 + r, -months))
    : principal / months;
  return {
    monthly,
    total: monthly * months,
    interest: monthly * months - principal,
  };
}
const documentTypes = [
  "rc",
  "ownership_authority",
  "insurance",
  "puc",
  "loan_status",
  "challans",
  "fitness",
  "permit",
  "tax",
];
function requirements(type) {
  if (process.env.DOCUMENT_REQUIREMENTS_JSON) {
    const cfg = z
      .object({
        passenger: z.array(z.enum(documentTypes)).min(1),
        commercial: z.array(z.enum(documentTypes)).min(1),
      })
      .strict()
      .parse(JSON.parse(process.env.DOCUMENT_REQUIREMENTS_JSON));
    return [...new Set(cfg[type])];
  }
  return [
    "rc",
    "ownership_authority",
    "insurance",
    "puc",
    ...(type === "commercial" ? ["fitness", "permit", "tax"] : []),
  ];
}
const slug = (v) =>
  `${v.year}-${v.make}-${v.model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
module.exports = {
  z,
  HttpError,
  fail,
  wrap,
  hash,
  token,
  id,
  text,
  phone,
  consentVersion,
  requestConsent,
  email,
  password,
  contact,
  vehicleSchema,
  transition,
  submissionTransitions,
  vehicleTransitions,
  emi,
  requirements,
  slug,
};
