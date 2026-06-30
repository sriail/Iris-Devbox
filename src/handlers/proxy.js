import { cors, jsonError } from "../utils/http.js";

const TARGET = "https://raw.githubusercontent.com/sriailail/Iris-Devbox/main/public/vm/iris-llm-vm-devbox.img.zst";

export async function handleVmImageProxy(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Expose-Headers":
          "Content-Length, Content-Range, Accept-Ranges, Content-Type",
      },
    });
  }

  const upstreamReq = new Request(TARGET, { method: request.method });
  const range = request.headers.get("Range");
  if (range) upstreamReq.headers.set("Range", range);

  const upstream = await fetch(upstreamReq);
  if (!upstream.ok && upstream.status !== 206) {
    return jsonError(`Upstream error: ${upstream.status}`, 502);
  }

  const headers = new Headers(upstream.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type");
  headers.set("Accept-Ranges", "bytes");
  headers.delete("Content-Encoding"); // payload is .zst, not transport encoding
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/octet-stream");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
