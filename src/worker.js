import { handleWsSession } from "./handlers/session.js";
import { handleWispRelay } from "./handlers/wisp.js";
import { handleUpload } from "./handlers/upload.js";
import { handleVmImageProxy } from "./handlers/proxy.js";
import { serveAsset, jsonError, cors } from "./utils/http.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade")?.toLowerCase();

    // ── WebSocket routes ───────────────────────────────────────────────
    if (upgrade === "websocket") {
      if (url.pathname === "/ws")   return handleWsSession(env);
      if (url.pathname === "/wisp") return handleWispRelay(request, env);
      return jsonError("WebSocket endpoint not found", 404);
    }

    // ── HTTP routes ───────────────────────────────────────────────────
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }

    if (url.pathname.startsWith("/api/proxy-vm-image")) {
      return handleVmImageProxy(request);
    }

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    // ── Static assets ────────────────────────────────────────────────
    return serveAsset(request, env);
  }
};
