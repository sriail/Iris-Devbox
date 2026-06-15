var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var sessions = /* @__PURE__ */ new Map();
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return handleWebSocket(env);
    }
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request);
    }
    
    // FIX: Safely fall back if the static assets binding is undefined
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    
    return new Response("Not Found", { status: 404 });
  }
};
async function handleWebSocket(env) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    ws: server,
    files: /* @__PURE__ */ new Map(),
    started: Date.now()
  });
  server.send(JSON.stringify({
    type: "session_created",
    sessionId
  }));
  server.addEventListener("message", async (event) => {
    try {
      const data = JSON.parse(event.data);
      await handleMessage(
        data,
        sessionId,
        env
      );
    } catch (err) {
      console.error(err);
    }
  });
  server.addEventListener("close", () => {
    sessions.delete(sessionId);
  });
  return new Response(null, {
    status: 101,
    webSocket: client
  });
}
__name(handleWebSocket, "handleWebSocket");
async function handleUpload(request) {
  const url = new URL(request.url);
  const sid = url.searchParams.get("sid");
  const session = sessions.get(sid);
  if (!session) {
    return new Response(
      "Invalid Session",
      { status: 400 }
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!file) {
    return new Response(
      "Missing File",
      { status: 400 }
    );
  }
  const buffer = await file.arrayBuffer();
  session.files.set(
    file.name,
    buffer
  );
  session.ws.send(JSON.stringify({
    type: "file_added",
    name: file.name
  }));
  return Response.json({
    success: true,
    file: file.name
  });
}
__name(handleUpload, "handleUpload");
async function handleMessage(data, sessionId, env) {
  const session = sessions.get(sessionId);
  if (!session) return;
  switch (data.type) {
    case "vm_booted":
      session.ws.send(JSON.stringify({
        type: "boot_confirm",
        sessionId
      }));
      break;
    case "llm_query":
      const answer = await queryGroq(
        data.payload.prompt,
        env
      );
      session.ws.send(JSON.stringify({
        type: "llm_response",
        response: answer
      }));
      break;
    case "file_list":
      session.ws.send(JSON.stringify({
        type: "file_list",
        files: [
          ...session.files.keys()
        ]
      }));
      break;
  }
}
__name(handleMessage, "handleMessage");
async function queryGroq(prompt, env) {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are an assistant inside a Linux VM."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    );
    const json = await response.json();
    return json?.choices?.[0]?.message?.content || "No response.";
  } catch (err) {
    return err.message;
  }
}
__name(queryGroq, "queryGroq");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
