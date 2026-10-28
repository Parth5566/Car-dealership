// Retry a safe read once after a transport reset or transient gateway failure.
// Never replay writes or token rotation: their first outcome may be committed.
export async function fetchRead(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const retryable =
    ["GET", "HEAD"].includes((options.method || "GET").toUpperCase()) &&
    !options.body;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, options);
      if (
        retryable &&
        attempt === 0 &&
        !options.signal?.aborted &&
        [502, 503, 504].includes(response.status)
      ) {
        await response.body?.cancel().catch(() => {});
        continue;
      }
      return response;
    } catch (error) {
      if (!retryable || attempt > 0 || options.signal?.aborted) throw error;
    }
  }
}
