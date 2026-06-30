// Skill + prompt docs (resolved at bundle time)
import promptSystem            from "../../public/system-docs/system-prompts/prompt-system.md";
import promptAgentLongCodeScan from "../../public/system-docs/system-prompts/agent-long-code-scan.md";
import promptAgentShortCodeScan from "../../public/system-docs/system-prompts/prompt-agent-short-code-scan.md";

// Skills Ripped from Claude lol, to lazy rn to add my owen
import skillApiAndInfrenceDesign      from "../../public/system-docs/skills/skill-api-and-infrence-design.md";
import skillCodeReviewAndQuality     from "../../public/system-docs/skills/skill-code-review-and-quality.md";
import skillCodeSimplification       from "../../public/system-docs/skills/skill-code-simplification.md";
import skillContextEngineering       from "../../public/system-docs/skills/skill-context-engineering.md";
import skillDebugingAndErrorRecovery from "../../public/system-docs/skills/skill-debuging-and-error-recovery.md";
import skillDeprecationAndMigration from "../../public/system-docs/skills/skill-deprecation-and-migration.md";
import skillDocxCreation            from "../../public/system-docs/skills/skill-docx-creation-and-data-extraction.md";
import skillDoubleDrivenDevelopment  from "../../public/system-docs/skills/skill-double-driven-development.md";
import skillDoubtDrivenDevelopment  from "../../public/system-docs/skills/skill-doubt-driven-development.md";
import skillFrontendDesign          from "../../public/system-docs/skills/skill-frontend-design.md";
import skillFrontendUiEngineering   from "../../public/system-docs/skills/skill-frontend-ui-engineering.md";
import skillGitWorkflowAndVersioning from "../../public/system-docs/skills/skill-git-workflow-and-versioning.md";
import skillIdeaRefine              from "../../public/system-docs/skills/skill-idea-refine.md";
import skillObservability           from "../../public/system-docs/skills/skill-observability-and-instrumentation.md";
import skillPdfCreationAndEditing  from "../../public/system-docs/skills/skill-pdf-creation-and-editing.md";
import skillPerformanceOptimization from "../../public/system-docs/skills/skill-performance-optimization.md";
import skillPlanningAndTaskBreakdown from "../../public/system-docs/skills/skill-planning-and-task-breakdown.md";
import skillSecurityAndHardening   from "../../public/system-docs/skills/skill-security-and-hardening.md";
import skillShippingAndLaunch      from "../../public/system-docs/skills/skill-shipping-and-launch.md";
import skillSpecDrivenDevelopment  from "../../public/system-docs/skills/skill-spec-driven-development.md";
import skillTestDrivenDevelopment  from "../../public/system-docs/skills/skill-test-driven-development.md";
import skillTestingWebsites        from "../../public/system-docs/skills/skill-testing-websites-and-frameworks.md";
import skillXlsxAndDataExtraction from "../../public/system-docs/skills/skill-xlsx-and-data-extraction.md";
import instructions                from "../../public/system-docs/instructions/instructions.md";

// ... (keep existing imports)

const TOOL_SPEC = `
You are an autonomous agent. Use tools to accomplish the user's task.
Emit ONE tool call per response as a fenced JSON block.

Available tools:
1. Shell command:
   \`\`\`json
   {"vm-tool":"command-tool","reasoning":"why","command-sent":"ls -la"}
   \`\`\`
2. Read file from VM:
   \`\`\`json
   {"vm-tool":"read-file","reasoning":"why","path":"/root/file.txt"}
   \`\`\`
3. Complete task and present files to user:
   \`\`\`json
   {"vm-tool":"task-complete","reasoning":"why","files":["/root/out.txt"]}
   \`\`\`

Rules:
- Execute commands one by one. After each command, you will receive the output.
- When the task is fully complete, call "task-complete" with a list of generated file paths.
- User files are in /root/uploads/. Put your generated files in /root/outputs/.
- Never run interactive processes. Commands must execute and return control.
- Use heredocs for file creation: cat << 'EOF' > file.txt ... EOF
- Observe -> Act -> Observe. Call view-console if you need to see the screen.
`.trim();

export function buildSystemPrompt({ fileList = [] } = {}) {
  return [
    promptSystem,
    "",
    "## Available Skills",
    // ... (keep existing skills array)
    "",
    "## VM Operating Instructions",
    instructions,
    "",
    "## Tool Protocol",
    TOOL_SPEC,
    "",
    fileList.length ? `User has uploaded files to /root/uploads/: ${fileList.join(", ")}` : "",
    "",
    "## Current Task",
    "Awaiting user request..."
  ].filter(Boolean).join("\n");
}
