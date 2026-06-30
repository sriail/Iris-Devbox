import { sessions } from "../state/sessions.js";
import { cors, jsonError } from "../utils/http.js";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function handleUpload(request) {
  const url = new URL(request.url);
  const sid = url.searchParams.get("sid");
  const session = sessions.get(sid);
  
  if (!session) return jsonError("Invalid Session", 400);

  // Handle GET (VM downloading the file via wget)
  if (request.method === "GET") {
    const name = url.searchParams.get("name");
    if (!name) return jsonError("Missing File Name", 400);
    
    const file = session.files.get(name);
    if (!file) return jsonError("File Not Found", 404);
    
    return new Response(file, {
      headers: { 
        "Content-Type": "application/octet-stream",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Handle POST (User uploading the file)
  if (request.method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return jsonError("Missing File", 400);

    const buf = await file.arrayBuffer();
    if (buf.byteLength > MAX_FILE_BYTES) {
      return jsonError(`File too large (max ${MAX_FILE_BYTES} bytes)`, 413);
    }

    session.files.set(file.name, buf);
    session.ws.send(JSON.stringify({ 
      type: "file_added", 
      name: file.name, 
      size: buf.byteLength 
    }));

    return cors(Response.json({ 
      success: true, 
      file: file.name, 
      size: buf.byteLength 
    }));
  }

  return jsonError("Method Not Allowed", 405);
}
