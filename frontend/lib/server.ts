import "server-only";
export const base = process.env.API_URL || "http://127.0.0.1:5001";
export { site } from "./site";
export async function serverApi<T = any>(
  path: string,
): Promise<{ data: T | null; error: string | null; status?: number }> {
  try {
    const r = await fetch(base + "/api/v1" + path, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => null);
      return {
        data: null,
        status: r.status,
        error:
          r.status === 404
            ? "Listing unavailable"
            : r.status === 400 || r.status === 422
              ? payload?.error?.message ||
                "Some filters are invalid. Reset the filters and try again."
              : "Inventory is temporarily unavailable. Please try again.",
      };
    }
    return { data: await r.json(), error: null };
  } catch {
    return {
      data: null,
      error:
        "We could not connect to the inventory service. Please try again shortly.",
    };
  }
}
