import { withSessionLock } from "./session-lock";
import { fetchRead } from "./fetch-read";
let refreshPromise: Promise<boolean> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
async function request(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("X-NCR-Request", "1");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetchRead("/api/v1" + path, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      signal:
        options.signal ||
        AbortSignal.timeout(options.body instanceof FormData ? 120000 : 15000),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again.", 503);
  }
  let data: any;
  if (!res.ok) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  if (
    res.status === 401 &&
    data?.error?.code !== "AUTH_REQUIRED" &&
    retry &&
    path !== "/auth/login" &&
    path !== "/auth/register" &&
    path !== "/auth/refresh"
  ) {
    if (!refreshPromise)
      refreshPromise = withSessionLock(async () => {
        // Another tab may have rotated the shared cookies while this tab waited.
        const current = await fetchRead("/api/v1/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (current.ok) return true;
        if (current.status !== 401) return false;
        const state = await current.json().catch(() => null);
        if (state?.error?.code === "AUTH_REQUIRED") return false;
        await api(
          "/auth/refresh",
          { method: "POST", signal: AbortSignal.timeout(10000) },
          false,
        );
        return true;
      })
        .catch((error) => {
          if ([401, 403].includes(error?.status)) return false;
          throw error instanceof ApiError
            ? error
            : new ApiError(
                "We couldn’t restore your session. Please try again.",
                503,
              );
        })
        .finally(() => {
          refreshPromise = null;
        });
    if (await refreshPromise) return request(path, options, false);
  }
  if (!res.ok)
    throw new ApiError(
      data?.error?.code === "DELIVERY_UNAVAILABLE"
        ? "Email delivery is not configured. Contact the site operator for account recovery."
        : String(data?.error?.code || "").startsWith("MARKET_") &&
            data?.error?.message
          ? data.error.message
          : res.status === 502 || res.status === 503 || res.status === 504
            ? "We can’t connect to the account service right now. Please try again shortly."
            : data?.error?.message || "Something went wrong. Please try again.",
      res.status,
      data?.error?.code,
    );
  return res;
}
const invalidResponse = () =>
  new ApiError(
    "The server returned an invalid response. Please try again.",
    502,
    "INVALID_RESPONSE",
  );
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await request(path, options, retry);
  if (
    res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw invalidResponse();
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw invalidResponse();
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.error)
    throw invalidResponse();
  const method = (options.method || "GET").toUpperCase();
  if (
    ["/auth/me", "/auth/login", "/auth/register", "/auth/profile"].includes(
      path,
    ) &&
    (!Number.isInteger(data.user?.id) ||
      !["customer", "sales", "reviewer", "admin"].includes(data.user?.role))
  )
    throw invalidResponse();
  if (
    ["/auth/forgot-password", "/auth/reset-password"].includes(path) &&
    typeof data.message !== "string"
  )
    throw invalidResponse();
  if (method === "POST") {
    if (
      [
        "/enquiries",
        "/account/test-drives",
        "/account/submissions",
        "/admin/vehicles",
      ].includes(path) &&
      (!Number.isInteger(data.id) || data.id <= 0)
    )
      throw invalidResponse();
    if (
      ["/enquiries", "/account/test-drives"].includes(path) &&
      typeof data.message !== "string"
    )
      throw invalidResponse();
  }
  return data as T;
}
export async function download(path: string, filename: string): Promise<void> {
  const res = await request(path, {});
  const type = res.headers.get("content-type")?.split(";")[0];
  if (!["application/pdf", "image/webp", "text/csv"].includes(type || ""))
    throw invalidResponse();
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export const send = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});
