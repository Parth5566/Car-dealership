// IndexNow ownership proof. The backend's notifications reference this file as
// keyLocation; it must return exactly the same INDEXNOW_KEY as the backend.
export const dynamic = "force-dynamic";
export function GET() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key))
    return new Response("Not found", { status: 404 });
  return new Response(key, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
