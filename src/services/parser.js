// Extract {"vm-tool": ...} objects from LLM output. Accepts:
//   - fenced ```json blocks
//   - bare single-line JSON objects
//   - multi-line JSON objects (balanced braces)
export function parseVMCommands(response) {
  if (typeof response !== "string") return [];
  const commands = [];

  // 1) Fenced ```json ... ``` blocks
  const fenceRe = /```(?:json)?\s*\n([\s\S]*?)\n```/gi;
  for (const m of response.matchAll(fenceRe)) {
    const obj = tryParseToolObject(m[1]);
    if (obj) commands.push(normalizeCommand(obj));
  }

  // 2) Bare balanced-brace JSON objects containing "vm-tool"
  for (const obj of scanForObjects(response)) {
    if (!commands.some(c => JSON.stringify(c) === JSON.stringify(normalizeCommand(obj)))) {
      commands.push(normalizeCommand(obj));
    }
  }

  return commands;
}

function tryParseToolObject(text) {
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === "object" && "vm-tool" in obj ? obj : null;
  } catch { return null; }
}

// Greedy scan for balanced { ... } regions containing "vm-tool"
function scanForObjects(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") { i++; continue; }
    let depth = 0, inStr = false, esc = false, start = i;
    for (; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            const candidate = text.slice(start, i + 1);
            if (candidate.includes('"vm-tool"')) {
              const obj = tryParseToolObject(candidate);
              if (obj) out.push(obj);
            }
            i++;
            break;
          }
        }
      }
    }
    if (depth !== 0) break; // malformed; stop
  }
  return out;
}

function normalizeCommand(obj) {
  return {
    tool:      obj["vm-tool"],
    reasoning: obj.reasoning ?? "",
    command:   obj["command-sent"] ?? obj.command ?? "",
    path:      obj.path ?? "",
    text:      obj.text ?? "",
    key:       obj.key ?? "",
  };
}
