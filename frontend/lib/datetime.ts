// MySQL DATETIME values are UTC; datetime-local inputs must use local fields.
export function localDateTime(value: Date | string | number): string {
  const date =
    value instanceof Date
      ? value
      : new Date(
          typeof value === "string" && /^\d{4}-\d{2}-\d{2} /.test(value)
            ? value.replace(" ", "T") + "Z"
            : value,
        );
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
