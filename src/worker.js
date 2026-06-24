import { connect } from "cloudflare:sockets";

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var sessions = /* @__PURE__ */ new Map();
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Main Chat/LLM WebSocket
    if (url.pathname === "/ws" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return handleWebSocket(env);
    }
    
    // Wisp Network Relay for v86 Internet Access
    if (url.pathname === "/wisp" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return handleWispRelay(request, env);
    }
    
    if (url.pathname === "/upload" && request.method === "POST") {
      return handleUpload(request);
    }
    
    // GitHub Proxy Handler for v86 Image
    if (url.pathname === "/api/proxy-vm-image") {
      const targetUrl = "https://raw.githubusercontent.com/sriail/Iris-Devbox/main/public/vm/iris-ai-vm.img.zst";
      
      const response = await fetch(targetUrl);
      if (!response.ok) return new Response("Failed to fetch image", { status: 500 });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      
      return new Response(response.body, {
        status: 200,
        headers: newHeaders
      });
    }
    
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    
    return new Response("Not Found", { status: 404 });
  }
};

// --- Wisp Relay Implementation ---
// Allows the v86 VM to route TCP traffic over the WebSocket
async function handleWispRelay(request, env) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  
  const sockets = new Map();
  let nextSocketId = 1;
  
  server.addEventListener("message", async (event) => {
    let buffer = event.data;
    if (buffer instanceof Blob) buffer = await buffer.arrayBuffer();
    const data = new Uint8Array(buffer);
    if (data.length === 0) return;
    
    const type = data[0];
    
    if (type === 0x01) { // CONNECT
      const port = (data[1] << 8) | data[2];
      const socketType = data[3]; // 1 = TCP, 3 = UDP
      const hostname = new TextDecoder().decode(data.slice(4));
      
      if (socketType === 1) { // TCP Only for now
        const socketId = nextSocketId++;
        try {
          const tcpSocket = connect({ hostname, port });
          const writer = tcpSocket.writable.getWriter();
          const reader = tcpSocket.readable.getReader();
          
          sockets.set(socketId, { writer, reader, closed: false });
          
          // Send CONTINUE
          const continueMsg = new Uint8Array(7);
          const view = new DataView(continueMsg.buffer);
          view.setUint8(0, 0x02);
          view.setUint32(1, socketId, false);
          view.setUint16(5, 65535, false);
          server.send(continueMsg);
          
          // Read loop
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const msg = new Uint8Array(5 + value.length);
                const dv = new DataView(msg.buffer);
                dv.setUint8(0, 0x03); // DATA
                dv.setUint32(1, socketId, false);
                msg.set(value, 5);
                server.send(msg);
              }
            } catch (e) {}
            
            const sock = sockets.get(socketId);
            if (sock && !sock.closed) {
              sock.closed = true;
              const closeMsg = new Uint8Array(6);
              const dv = new DataView(closeMsg.buffer);
              dv.setUint8(0, 0x04); // CLOSE
              dv.setUint32(1, socketId, false);
              dv.setUint8(5, 0x02); 
              server.send(closeMsg);
            }
            sockets.delete(socketId);
          })();
        } catch (err) {
          const closeMsg = new Uint8Array(6);
          const dv = new DataView(closeMsg.buffer);
          dv.setUint8(0, 0x04); // CLOSE
          dv.setUint32(1, socketId, false);
          dv.setUint8(5, 0x03); 
          server.send(closeMsg);
        }
      }
    } else if (type === 0x03) { // DATA
      const view = new DataView(data.buffer);
      const socketId = view.getUint32(1, false);
      const payload = data.slice(5);
      const sock = sockets.get(socketId);
      if (sock && !sock.closed) {
        try {
          await sock.writer.write(payload);
        } catch(e) {}
      }
    } else if (type === 0x04) { // CLOSE
      const view = new DataView(data.buffer);
      const socketId = view.getUint32(1, false);
      const sock = sockets.get(socketId);
      if (sock) {
        sock.closed = true;
        try { await sock.writer.close(); } catch(e) {}
        sockets.delete(socketId);
      }
    }
  });
  
  server.addEventListener("close", () => {
    for (const [, sock] of sockets) {
      sock.closed = true;
      try { sock.writer.close(); } catch(e) {}
    }
    sockets.clear();
  });
  
  return new Response(null, { status: 101, webSocket: client });
}
__name(handleWispRelay, "handleWispRelay");

async function handleWebSocket(env) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    ws: server,
    files: /* @__PURE__ */ new Map(),
    chatHistory: [],
    started: Date.now()
  });
  server.send(JSON.stringify({
    type: "session_created",
    sessionId
  }));
  server.addEventListener("message", async (event) => {
    try {
      const data = JSON.parse(event.data);
      await handleMessage(data, sessionId, env);
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
    return new Response("Invalid Session", { status: 400 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!file) {
    return new Response("Missing File", { status: 400 });
  }
  const buffer = await file.arrayBuffer();
  session.files.set(file.name, buffer);
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
      const prompt = data.payload.prompt;
      const vmOutput = data.payload.vmOutput || "";
      const fileList = [...session.files.keys()];
      
      session.chatHistory.push({
        role: "user",
        content: prompt
      });
      
      const response = await queryGroq(prompt, vmOutput, fileList, session.chatHistory, env);
      
      session.chatHistory.push({
        role: "assistant",
        content: response
      });
      
      const commands = parseVMCommands(response);
      
      session.ws.send(JSON.stringify({
        type: "llm_response",
        response: response,
        commands: commands
      }));
      break;
  }
}
__name(handleMessage, "handleMessage");

function parseVMCommands(response) {
  const commands = [];
  const lines = response.split('\n');
  
  for (const line of lines) {
    try {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const obj = JSON.parse(trimmed);
        if (obj["vm-tool"]) {
          commands.push({
            tool: obj["vm-tool"],
            reasoning: obj.reasoning || "",
            command: obj["command-sent"] || obj.command || "",
            path: obj.path || "",
            text: obj.text || "",
            key: obj.key || ""
          });
        }
      }
    } catch (e) { }
  }
  return commands;
}
__name(parseVMCommands, "parseVMCommands");

async function queryGroq(prompt, vmOutput, fileList, chatHistory, env) {
  try {
    const systemPrompt = `You are a helpful AI assistant running inside a Linux VM development environment. You have access to a terminal and can help the user with development tasks.

You can use the following tools by responding with JSON objects on separate lines:
1. To execute shell commands: {"vm-tool": "command-tool", "reasoning": "explanation", "command-sent": "your command"}
2. To list files: {"vm-tool": "list-files", "reasoning": "explanation", "path": "/absolute/path"}
3. To write text (e.g. into an editor, no Enter): {"vm-tool": "send-text", "reasoning": "explanation", "text": "your text"}
4. To send keypresses (e.g. Ctrl+C, Enter): {"vm-tool": "send-keypress", "reasoning": "explanation", "key": "Ctrl, C"}
5. To view the console screen: {"vm-tool": "view-console", "reasoning": "explanation"}

Always explain your reasoning before providing commands. Be concise and helpful.
 ${fileList.length > 0 ? `\nUser has uploaded files: ${fileList.join(", ")}` : ""}

Ground Rules:
- Never run interactive processes (e.g., nano, top without -b -n 1, python3 without -c or a script file). Commands must execute and return control to the shell.
- Use heredocs for file creation: cat << 'EOF' > file.txt ... EOF
- Observe -> Act -> Observe. Call view-console after commands to verify state.
- One command per call. Do not chain unrelated commands with ; unless they form a single logical unit.

Current VM state:
 ${vmOutput ? `Last command output:\n${vmOutput}` : "VM just booted, waiting for first command."}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Groq API error:", error);
      return `Error: Failed to get response from LLM (${response.status})`;
    }
    
    const json = await response.json();
    return json?.choices?.[0]?.message?.content || "No response.";
  } catch (err) {
    console.error("Query error:", err);
    return `Error: ${err.message}`;
  }
}
__name(queryGroq, "queryGroq");

export {
  worker_default as default
};
