// Cloudflare Worker — StreamVision IPTV Proxy
// Deploys to: streamvision-proxy.your-worker-subdomain.workers.dev
// Free tier: 100,000 requests/day — more than enough for personal use

const XTREAM_HOST = "http://smarters2026.sbs:8080";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Proxy endpoint: /api/xtream?username=...&password=...&action=...
    if (url.pathname === "/api/xtream") {
      const username = url.searchParams.get("username");
      const password = url.searchParams.get("password");
      const action = url.searchParams.get("action");
      const categoryId = url.searchParams.get("category_id") || "";
      const streamId = url.searchParams.get("stream_id") || "";
      const seriesId = url.searchParams.get("series_id") || "";

      if (!username || !password || !action) {
        return new Response(
          JSON.stringify({ error: "Missing username, password, or action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      let xtreamUrl = `${XTREAM_HOST}/player_api.php?username=${username}&password=${password}&action=${action}`;
      if (categoryId) xtreamUrl += `&category_id=${categoryId}`;
      if (streamId) xtreamUrl += `&stream_id=${streamId}`;
      if (seriesId) xtreamUrl += `&series_id=${seriesId}`;

      try {
        const response = await fetch(xtreamUrl, {
          headers: { "User-Agent": "StreamVision/1.0" },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: `Xtream server returned ${response.status}` }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = await response.text();
        return new Response(data, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `Proxy error: ${err.message}` }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "streamvision-proxy" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("StreamVision IPTV Proxy — Use /api/xtream?username=...&password=...&action=...", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
