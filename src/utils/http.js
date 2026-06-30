const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

export function cors(response) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  return response;
}

export function jsonError(message, status = 500) {
  return cors(new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

// Add this new export:
export function serveAsset(request, env) {
  if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
  return jsonError("Not Found", 404);
}
