export function parseCompareIds(raw: string | null): number[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is number =>
                typeof id === "number" && Number.isSafeInteger(id) && id > 0,
            ),
          ),
        ].slice(0, 3)
      : [];
  } catch {
    return [];
  }
}
export function toggleCompareId(ids: number[], id: number): number[] {
  if (!Number.isSafeInteger(id) || id <= 0) return ids;
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  return ids.length < 3 ? [...ids, id] : ids;
}
