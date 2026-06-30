const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.1-8b-instant";
const TIMEOUT_MS = 25_000;

// probly want to update above later, groq weak as shit

export async function queryLLM({ systemPrompt, history, env }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = JSON.stringify({
    model: MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...history],
    max_tokens: 1500,
    temperature: 0.4,
    top_p: 0.9,
  });

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("groq error", res.status, errText);
      return `Error: LLM returned ${res.status}. ${errText.slice(0, 200)}`;
    }

    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || "No response.";
  } catch (err) {
    if (err.name === "AbortError") return "Error: LLM request timed out.";
    console.error("llm fetch", err);
    return `Error: ${err.message}`;
  } finally {
    clearTimeout(timer);
  }
}
