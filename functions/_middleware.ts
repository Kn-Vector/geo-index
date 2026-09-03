/**
 * Cloudflare Pages Function (Workers runtime) — edge headers for every response.
 */
type PagesContext = { next: () => Promise<Response> };

export async function onRequest(context: PagesContext): Promise<Response> {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  headers.set("X-Geo-Index-Edge", "pages-worker");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
