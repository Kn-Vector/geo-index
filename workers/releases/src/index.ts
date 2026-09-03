/**
 * Edge Worker that points at GitHub Releases for versioned source/data zips.
 * Production Pages stays on geo-index.pages.dev; this Worker is geo-index-releases.
 */
export interface Env {
  GITHUB_REPO: string;
}

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "geo-index-releases-worker",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const repo = env.GITHUB_REPO || "Kn-Vector/geo-index";

    if (url.pathname === "/" || url.pathname === "/latest") {
      const upstream = await fetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        { headers: GH_HEADERS },
      );
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
          "access-control-allow-origin": "*",
        },
      });
    }

    const download = url.pathname.match(/^\/download\/([^/]+)\/?$/);
    if (download) {
      const wanted = decodeURIComponent(download[1]).toLowerCase();
      const upstream = await fetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        { headers: GH_HEADERS },
      );
      if (!upstream.ok) {
        return new Response("Release metadata unavailable", {
          status: upstream.status,
        });
      }
      const release = (await upstream.json()) as {
        assets?: { name: string; browser_download_url: string }[];
      };
      const asset = (release.assets ?? []).find((item) =>
        item.name.toLowerCase().includes(wanted),
      );
      if (!asset) {
        return new Response(`No release asset matching "${wanted}"`, {
          status: 404,
        });
      }
      return Response.redirect(asset.browser_download_url, 302);
    }

    return new Response(
      [
        "Geo Index release worker",
        "GET /latest — latest GitHub Release JSON",
        "GET /download/generated — redirect to generated-data zip",
        "GET /download/geo — redirect to globe/geometry zip",
        "GET /download/catalog — redirect to catalog/checksums zip",
        "GET /download/media — redirect to media zip",
        "GET /download/sources — redirect to source snapshot zip",
      ].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },
} satisfies ExportedHandler<Env>;
