import { sessions, touchSession } from "../state/sessions.js";
import { queryLLM } from "../services/llm.js";
import { parseVMCommands } from "../services/parser.js";
import { buildSystemPrompt } from "../services/prompt.js";

const MAX_CHAT_TURNS = 24;

export async function handleWsSession(env) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    ws: server,
    files: new Set(), // Track file names
    chatHistory: [],
    lastActivity: Date.now(),
  });

  server.send(JSON.stringify({ type: "session_created", sessionId }));

  server.addEventListener("message", async (event) => {
    touchSession(sessionId);
    let data;
    try { data = JSON.parse(event.data); }
    catch { return server.send(JSON.stringify({ type: "error", error: "Invalid JSON" })); }

    try {
      await routeMessage(data, sessionId, env);
    } catch (err) {
      console.error("message handler", err);
      server.send(JSON.stringify({ type: "error", error: err.message }));
    }
  });

  server.addEventListener("close", () => {
    sessions.delete(sessionId);
  });

  return new Response(null, { status: 101, webSocket: client });
}

async function routeMessage(data, sessionId, env) {
  const session = sessions.get(sessionId);
  if (!session) return;

  switch (data.type) {
    case "vm_booted":
      session.ws.send(JSON.stringify({ type: "boot_confirm", sessionId }));
      break;

    case "file_uploaded":
      session.files.add(data.payload.name);
      break;

    case "llm_query": {
      const prompt = String(data.payload?.prompt ?? "").slice(0, 16_000);
      const vmOutput = String(data.payload?.vmOutput ?? "").slice(0, 32_000);
      const fileList = [...session.files];

      // Agentic Loop Logic: 
      // If there's a prompt, it's a new user request.
      // If there's only vmOutput, it's an observation from the previous tool call.
      if (prompt) {
        session.chatHistory.push({ role: "user", content: prompt });
      } else if (vmOutput) {
        session.chatHistory.push({ role: "user", content: `Observation:\n${vmOutput}` });
      } else {
        break; // Ignore empty requests
      }

      trimHistory(session);

      const systemPrompt = buildSystemPrompt({ fileList });
      const response = await queryLLM({ systemPrompt, history: session.chatHistory, env });

      session.chatHistory.push({ role: "assistant", content: response });
      trimHistory(session);

      session.ws.send(JSON.stringify({
        type: "llm_response",
        response,
        commands: parseVMCommands(response),
      }));
      break;
    }
  }
}

function trimHistory(session) {
  while (session.chatHistory.length > MAX_CHAT_TURNS * 2) {
    session.chatHistory.shift();
  }
}
