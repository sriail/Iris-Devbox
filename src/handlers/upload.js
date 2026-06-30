import { sessions } from "../state/sessions.js";
import { cors, jsonError } from "../utils/http.js";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function handleUpload(request) {
  const sid = new URL(request.url).searchParams.get("sid");
  const session = sessions.get(sid);
  if (!session) return jsonError("Invalid Session", 400);

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return jsonError("Missing File", 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_FILE_BYTES) {
    return jsonError(`File too large (max ${MAX_FILE_BYTES} bytes)`, 413);
  }

  session.files.set(file.name, buf);
  session.ws.send(JSON.stringify({ type: "file_added", name: file.name, size: buf.byteLength }));

  return cors(Response.json({ success: true, file: file.name, size: buf.byteLength }));
}
