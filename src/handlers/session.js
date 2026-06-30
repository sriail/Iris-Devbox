import { sessions, touchSession } from "../state/sessions.js";
import { queryLLM } from "../services/llm.js";
import { parseVMCommands } from "../services/parser.js";
import { buildSystemPrompt } from "../services/prompt.js";
import { jsonError } from "../utils/http.js";

const MAX_CHAT_TURNS = 24;       // keep chatHistory bounded
const IDLE_TTL_MS  = 1000 * 60 * 30; // 30 min

export async function handleWsSession(env) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    ws: server,
    files: new Map(),
    chatHistory: [],
    lastActivity: Date.now(),
  });

  // Sweeper: kill idle sessions
  const sweeper = setInterval(() => {
    const s = sessions.get(sessionId);
    if (!s) return clearInterval(sweeper);
    if (Date.now() - s.lastActivity > IDLE_TTL_MS) {
      try { s.ws.close(4000, "idle timeout"); } catch {}
      sessions.delete(sessionId);
      clearInterval(sweeper);
    }
  }, 60_000);

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
    clearInterval(sweeper);
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

    case "llm_query": {
      const prompt = String(data.payload?.prompt ?? "").slice(0, 16_000);
      const vmOutput = String(data.payload?.vmOutput ?? "").slice(0, 32_000);
      const fileList = [...session.files.keys()];

      session.chatHistory.push({ role: "user", content: prompt });
      trimHistory(session);

      const systemPrompt = buildSystemPrompt({ fileList, vmOutput });
      const response = await queryLLM({
        systemPrompt,
        history: session.chatHistory,
        env,
      });

      session.chatHistory.push({ role: "assistant", content: response });
      trimHistory(session);

      session.ws.send(JSON.stringify({
        type: "llm_response",
        response,
        commands: parseVMCommands(response),
      }));
      break;
    }

    default:
      session.ws.send(JSON.stringify({
        type: "error",
        error: `Unknown message type: ${data.type}`,
      }));
  }
}

function trimHistory(session) {
  // Keep last N turns (1 turn = user + assistant)
  while (session.chatHistory.length > MAX_CHAT_TURNS * 2) {
    session.chatHistory.shift();
  }
}
