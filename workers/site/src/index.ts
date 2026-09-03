/**
 * Cloudflare Worker that serves the static atlas and sets edge headers.
 * Production: https://geo-index.goldenegg.workers.dev
 */
export interface Env {
  ASSETS: Fetcher;
}

const LONG_CACHE = /^\/(geo|silhouettes|flags|media|og)\//;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    headers.set("X-Geo-Index-Edge", "worker");
    if (LONG_CACHE.test(url.pathname)) {
      headers.set(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800",
      );
    } else if (url.pathname.startsWith("/pagefind/")) {
      headers.set("Cache-Control", "public, max-age=3600");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
