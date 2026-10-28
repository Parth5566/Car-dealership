type Named = { year: number; make: string; model: string; variant?: string };

export const vehicleTitle = (v: Named) =>
  `${v.year} ${v.make} ${v.model}${v.variant?.trim() ? " " + v.variant.trim() : ""}`;

// New uploads store blank alt text, meaning "describe from the vehicle".
// Older uploads stored "<make> <model>" or "<make> <model> vehicle photo";
// treat those defaults as automatic too, so corrected details flow through.
export function isAutomaticAlt(alt: string | undefined, v: Named) {
  const text = (alt || "").trim().toLowerCase().replace(/\s+/g, " ");
  const name = `${v.make} ${v.model}`.toLowerCase().replace(/\s+/g, " ");
  return (
    !text ||
    text === name ||
    text === "vehicle photo" ||
    / vehicle photo$/.test(text)
  );
}

// Staff-written alt text wins; otherwise "2019 Kia Sonet HTX — photo 2 of 5".
export function photoAlt(
  alt: string | undefined,
  v: Named,
  index = 0,
  total = 1,
) {
  if (!isAutomaticAlt(alt, v)) return alt!.trim();
  const name = vehicleTitle(v);
  return total > 1 ? `${name} — photo ${index + 1} of ${total}` : name;
}
