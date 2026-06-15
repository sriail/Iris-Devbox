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
    
    // --- ADDED: GitHub Proxy Handler for v86 Image ---
    if (url.pathname === "/api/proxy-vm-image") {
      const targetUrl = "https://raw.githubusercontent.com/sriail/Iris-Devbox/main/public/vm/iris-ai-vm.img.zst";
      
      const response = await fetch(targetUrl, {
        headers: {
          "Range": request.headers.get("Range") || ""
        }
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
      newHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }
    // --- END OF PROXY HANDLER ---
    
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
      
      // Add user message to history
      session.chatHistory.push({
        role: "user",
        content: prompt
      });
      
      const response = await queryGroq(prompt, vmOutput, fileList, session.chatHistory, env);
      
      // Add assistant response to history
      session.chatHistory.push({
        role: "assistant",
        content: response
      });
      
      // Parse for vm-tool commands
      const commands = parseVMCommands(response);
      
      session.ws.send(JSON.stringify({
        type: "llm_response",
        response: response,
        commands: commands
      }));
      break;
      
    case "file_list":
      session.ws.send(JSON.stringify({
        type: "file_list",
        files: [...session.files.keys()]
      }));
      break;
      
    case "export_files":
      const homeFiles = data.payload.files || [];
      session.ws.send(JSON.stringify({
        type: "files_exported",
        files: homeFiles
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
      // Try to parse JSON from the line
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const obj = JSON.parse(trimmed);
        if (obj["vm-tool"]) {
          commands.push({
            tool: obj["vm-tool"],
            reasoning: obj.reasoning || "",
            command: obj["command-sent"] || obj.command || ""
          });
        }
      }
    } catch (e) {
      // Skip lines that aren't valid JSON
    }
  }
  
  return commands;
}
__name(parseVMCommands, "parseVMCommands");

async function queryGroq(prompt, vmOutput, fileList, chatHistory, env) {
  try {
    const systemPrompt = `You are a helpful AI assistant running inside a Linux VM development environment. You have access to a terminal and can help the user with development tasks.

You can use the following tools by responding with JSON objects on separate lines:
1. To execute shell commands, include: {"vm-tool": "command", "reasoning": "explanation", "command-sent": "your command"}
2. To list files: {"vm-tool": "list-files", "reasoning": "explanation"}
3. To show help: {"vm-tool": "help", "reasoning": "explanation"}

Always explain your reasoning before providing commands. Be concise and helpful.
${fileList.length > 0 ? `\nUser has uploaded files: ${fileList.join(", ")}` : ""}

Current VM state:
${vmOutput ? `Last command output:\n${vmOutput}` : "VM just booted, waiting for first command."}`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
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
