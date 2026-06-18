# Iris Devbox Tools

Iris is a minimal, resource-conscious devbox hosted locally on the client using v86. It provides an open, sandboxed Linux environment where the LLM can write, run, and debug code in real time. The following documentation defines the available tools, their contracts, and the ground rules for using them safely and effectively.

## Environment Overview

- **Runtime**: v86 emulated x86 Linux environment, booted into a TTY on `tty:s0`, you will be running as the root user.
- **Persistence**: The filesystem is mutable during the session but is **not** persistent across sessions unless the user explicitly saves state. Treat each session as ephemeral.
- **Resources**: CPU and memory are constrained. Avoid long-running background processes, large compiles, or unbounded loops. Prefer minimal, single-purpose commands.
- **Network**: Available but may be slow or intermittent. Prefer local tooling over fetching remote assets when possible.
- **Shell**: POSIX-compatible shell (BusyBox-style). Some GNU coreutils flags may differ; verify behavior before assuming GNU semantics.

---

# Tool Catalog

## 1. COMMAND TOOL (`command-tool`)

**Purpose**: Send a single command line to the devbox terminal as if typed at the prompt, then executed by pressing Enter.

**Use for**:
- Running shell commands (`ls`, `cd`, `cat`, `make`, `python`, etc.)
- Navigating directories
- Sending payloads or piped input to interactive console programs that read from stdin
- Installing packages via `apk`, `apt`, `pip`, etc.

**Do NOT use for**:
- Editing files (use `send-text` with `nano`, or heredocs via this tool)
- Pressing bare keybinds like `Ctrl+C` (use `send-keypress`)
- Reading the screen (use `view-console`)

**Sent JSON**:
```json
{
  "vm-tool": "command-tool",
  "reasoning": "Brief explanation of why this command is being run and what result is expected.",
  "command-sent": "ls -la /root"
}
```

**Response JSON**:
```json
{
  "request-sucess": true,
  "vm-tool": "command-tool",
  "response": "drwx------  3 root root 4096 ..."
}
```

**Ground rules**:
- One command per call. Do not chain unrelated commands with `;` unless they form a single logical unit.
- Prefer absolute paths over `cd` chains to avoid losing working-directory context.
- Never run destructive commands (`rm -rf /`, `dd of=/dev/sda`, `mkfs`, etc.) without explicitly warning the user in `reasoning` first.
- For long-running commands, append `&` or redirect output to a file, then poll with `view-console` or `cat`.

---

## 2. LIST FILES TOOL (`list-files`)

**Purpose**: Return a structured listing of files and folders in a directory. Lightweight alternative to running `ls` via `command-tool` when you only need a directory snapshot.

**Use for**:
- Exploring unfamiliar directories
- Inspecting pulled GitHub repos before reading files
- Confirming that a file was created or deleted

**Do NOT use for**:
- Reading file contents (use `view-console` after `cat`, or `send-text` into `nano`)
- Recursive tree views (use `command-tool` with `find` or `tree`)

**Sent JSON**:
```json
{
  "vm-tool": "list-files",
  "reasoning": "Need to inspect the project layout before editing entrypoint files.",
  "path": "/root/project"
}
```

**Response JSON**:
```json
{
  "request-sucess": true,
  "vm-tool": "list-files",
  "response": ["src/", "package.json", "README.md"]
}
```

**Ground rules**:
- Always pass an absolute `path`. Relative paths resolve against the shell's last known cwd and may be stale.
- If the directory is empty, `response` will be `[]` — not an error.

---

## 3. WRITE TEXT TOOL (`send-text`)

**Purpose**: Send arbitrary text to the terminal as raw keystrokes, **without** appending a trailing Enter. This is the foundational tool for writing code and content into interactive editors.

**Use for**:
- Writing code into `nano`, `vi`, `ed`, or REPLs
- Pasting multi-line content into prompts
- Composing files in editors where `command-tool`'s Enter-terminating behavior is undesirable

**Do NOT use for**:
- Executing commands (use `command-tool` — `send-text` will not press Enter)
- Sending keybinds like `Ctrl+O` (use `send-keypress`)

**Sent JSON**:
```json
{
  "vm-tool": "send-text",
  "reasoning": "Writing the main module into nano after opening it.",
  "text": "def main():\n    print('hello iris')"
}
```

**Response JSON**:
```json
{
  "request-sucess": true,
  "vm-tool": "send-text",
  "text": "def main():\n    print('hello iris')"
}
```

**Ground rules**:
- Open the target editor (`nano file.py`) via `command-tool` **first**, then call `send-text`. Calling `send-text` while a shell prompt is active will type the content into the prompt without saving it anywhere.
- For large files (over ~4 KB), split into multiple `send-text` calls to avoid truncation and to keep diffs reviewable.
- Always follow with `send-keypress` for save/quit sequences (e.g. `Ctrl+O`, `Enter`, `Ctrl+X` in nano).
- Verify the write with `view-console` before assuming success.

---

## 4. SEND KEYPRESS TOOL (`send-keypress`)

**Purpose**: Send keyboard shortcuts and bare key combos that `send-text` cannot represent.

**Use for**:
- Editor keybinds (`Ctrl+O` save, `Ctrl+X` exit, `Ctrl+K` cut line)
- Interrupting runaway processes (`Ctrl+C`)
- End-of-file signals (`Ctrl+D`)
- Tab completion (`Tab`)
- Arrow-key navigation in menus and REPLs

**Do NOT use for**:
- Typing regular characters (use `send-text`)
- Submitting a shell command (use `command-tool`, which sends Enter)

**Sent JSON**:
```json
{
  "vm-tool": "send-keypress",
  "reasoning": "Saving the file in nano before exiting.",
  "key": "Ctrl, O"
}
```

**Response JSON**:
```json
{
  "request-sucess": true,
  "vm-tool": "send-keypress",
  "sent-keypress": "Ctrl, O"
}
```

**Ground rules**:
- Use a **comma** to combine modifier + key: `"Ctrl, C"`, `"Alt, F4"`, `"Ctrl, Shift, /"`.
- For sequences (e.g. save then quit in nano), issue **separate** `send-keypress` calls in order — do not comma-chain separate shortcuts in one call.
- Common sequences:
  - **nano save + exit**: `Ctrl, O` → `Enter` → `Ctrl, X`
  - **vi save + exit**: `:`, then `send-text` "wq", then `send-keypress` `Enter`
  - **Interrupt process**: `Ctrl, C`
  - **EOF on stdin**: `Ctrl, D`

---

## 5. SCREEN VIEWER TOOL (`view-console`)

**Purpose**: Capture the current visible contents of the terminal screen, including editor buffers, REPL output, and shell prompt state. This is the primary read-back mechanism.

**Use for**:
- Verifying that a command succeeded
- Reading file contents displayed by `cat`, `less`, or an editor
- Inspecting error messages and stack traces
- Confirming editor state before/after writes
- Checking whether a process is still running or has returned to the prompt

**Do NOT use for**:
- Fetching output that has scrolled off-screen (use `command-tool` to re-run with output redirected to a file, then `cat` it)
- Listing directories (use `list-files`)

**Sent JSON**:
```json
{
  "vm-tool": "view-console",
  "reasoning": "Verifying the file was saved correctly and the shell prompt returned."
}
```

**Response JSON**:
```json
{
  "request-sucess": true,
  "vm-tool": "view-console",
  "Console-contents": "root@iris:~# "
}
```

**Ground rules**:
- Call `view-console` after **every** non-trivial `command-tool` or `send-text` call. Treat the screen as the source of truth — do not assume a command succeeded based on intent alone.
- The returned `Console-contents` is a snapshot of the visible terminal, **not** the full scrollback. If output is missing, redirect to a file and re-read.
- Note: the tool name is spelled `view-console` in the request and `veiw-console` in some legacy responses due to a typo in the gateway. Treat both spellings as the same tool.

---

# Ground Rules

## A. JSON Discipline
1. Always emit valid JSON. No trailing commas, no unescaped quotes, no comments.
2. Never omit required fields. Every tool call must include `vm-tool` and `reasoning`.
3. `reasoning` must be a human-readable explanation of intent — not a restatement of the command. Write it as if a developer were pair-programming with you.
4. Prefer minimal, single-intent commands. Complex pipelines are harder to debug and harder to interrupt.

## B. Tool Sequencing
1. **Observe → Act → Observe.** Before issuing a destructive or state-changing command, capture current state with `view-console` or `list-files`. After acting, observe again.
2. **Editor workflow**: open (`command-tool`) → write (`send-text`) → save/exit (`send-keypress`) → verify (`view-console`).
3. **Never assume** a command succeeded. The terminal is authoritative.
4. After any multi-step operation, summarize what changed for the user.

## C. Error Handling
1. If `request-sucess` is `false`, the response will include an `error-thrown` field describing the failure.
2. **Retry policy**: retry the **same** tool call up to **5 times** with brief adjustments (e.g. shorter payload, corrected path). Between retries, inspect `view-console` to confirm the devbox is responsive.
3. If the same error persists after 5 retries:
   - Send the user the current files (via `view-console` snapshots or `cat` output),
   - Explain the error in plain language,
   - Recommend that the user start a new session, **or** — if the error message indicates a network/gateway issue — check their internet connection.
4. Do **not** retry destructive commands automatically. Surface the error to the user first.
5. If the devbox appears frozen (no response after a command, prompt not returning), send `send-keypress` with `Ctrl, C` once, then re-observe. If still frozen, notify the user.

## D. Resource Stewardship
1. Avoid background daemons, `&`-spawned jobs, and infinite loops unless explicitly required.
2. Clean up temp files and stopped processes before completing a task.
3. Prefer interpreted languages (Python, Node) over compiled ones when startup latency matters.
4. Do not download large datasets or binaries unless the user requests it.

## E. Security & Safety
1. Never run commands that affect the host or non-devbox systems (`ssh` into external hosts, `curl | sh` from untrusted sources, etc.) without explicit user request.
2. Never exfiltrate user data. Treat all filesystem contents as private to the user.
3. Warn the user in `reasoning` before any destructive operation (`rm`, `mv` overwrite, `>`, `dd`).
4. Do not install packages the user did not ask for. Pin versions when installing.

## F. Communication
1. After every meaningful action, briefly tell the user what you did and what you observed.
2. When a task is complete, summarize the final state of the filesystem and any processes left running.
3. When blocked, ask the user a concrete question — do not silently retry indefinitely.

---

# Timing Guidelines

| Situation | Recommended Action |
|---|---|
| Command finishes quickly (< 2s) | Issue `command-tool`, then immediately `view-console`. |
| Command may take 2–10s | Run via `command-tool`, then poll with `view-console` once. If incomplete, poll again. |
| Command may take > 10s | Redirect output to a file (`cmd > /tmp/out.log 2>&1 &`), then poll the file with `cat` via `command-tool` + `view-console`. |
| Editor hangs after `send-text` | Send `Ctrl, C` once via `send-keypress`; re-observe. |
| Tool call returns `request-sucess: false` | Wait 1 second mentally, retry with adjustment. Max 5 attempts. |
| Tool call times out (no response) | Do **not** spam. Notify the user after 2 consecutive timeouts. |
| Long compile/build | Use `make -j2` or lower; v86 CPU is limited. |
| Network fetch (`curl`, `pip install`) | Expect slowness. Set expectations with the user before running. |

---

# Quick Reference: Typical Workflows

**Create and run a Python script**:
1. `command-tool` → `nano /root/hello.py`
2. `send-text` → `print("hello iris")`
3. `send-keypress` → `Ctrl, O`
4. `send-keypress` → `Enter`
5. `send-keypress` → `Ctrl, X`
6. `view-console` → confirm prompt returned
7. `command-tool` → `python /root/hello.py`
8. `view-console` → read output

**Debug a failing command**:
1. `command-tool` → run the failing command
2. `view-console` → capture error
3. `command-tool` → `echo $?` to check exit code
4. Adjust and retry, or escalate to user after 5 attempts.

---

This documentation is the source of truth for tool behavior. When in doubt, observe the console, reason out loud, and ask the user before destructive actions.

---
