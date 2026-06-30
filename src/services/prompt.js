// Skill + prompt docs (resolved at bundle time)
import promptSystem            from "../../public/system-docs/system-prompts/prompt-system.md";
import promptAgentLongCodeScan from "../../public/system-docs/system-prompts/agent-long-code-scan.md";
import promptAgentShortCodeScan from "../../public/system-docs/system-prompts/prompt-agent-short-code-scan.md";

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

const TOOL_SPEC = `
You have tools. Emit them as fenced JSON blocks (\`\`\`json … \`\`\`) on their own lines:

- Shell command:
  \`\`\`json
  {"vm-tool":"command-tool","reasoning":"why","command-sent":"ls -la"}
  \`\`\`
- List files:    {"vm-tool":"list-files","reasoning":"...","path":"/abs"}
- Type text:     {"vm-tool":"send-text","reasoning":"...","text":"hello"}
- Send keys:     {"vm-tool":"send-keypress","reasoning":"...","key":"Ctrl, C"}
- View console:  {"vm-tool":"view-console","reasoning":"..."}

Ground rules:
- Never run interactive processes (nano, top, python3 REPL). Use \`-c\` or a script file.
- Use heredocs for file creation.
- Observe → Act → Observe. Call view-console after each command to verify.
- One command per call.
`.trim();

const GROUND_RULES = `
Ground Rules:
- Never run interactive processes (e.g., nano, top without -b -n 1, python3 without -c or a script file).
  Commands must execute and return control to the shell.
- Use heredocs for file creation: cat << 'EOF' > file.txt ... EOF
- Observe -> Act -> Observe. Call view-console after commands to verify state.
- One command per call. Do not chain unrelated commands with ; unless they form a single logical unit.
`.trim();

export function buildSystemPrompt({ fileList = [], vmOutput = "" } = {}) {
  return [
    promptSystem,
    "",
    "## Available Skills",
    skillContextEngineering,
    skillPlanningAndTaskBreakdown,
    skillIdeaRefine,
    skillSpecDrivenDevelopment,
    skillTestDrivenDevelopment,
    skillDoubtDrivenDevelopment,
    skillDoubleDrivenDevelopment,
    skillCodeReviewAndQuality,
    skillCodeSimplification,
    skillDebugingAndErrorRecovery,
    skillPerformanceOptimization,
    skillSecurityAndHardening,
    skillObservability,
    skillGitWorkflowAndVersioning,
    skillShippingAndLaunch,
    skillDeprecationAndMigration,
    skillApiAndInfrenceDesign,
    skillFrontendDesign,
    skillFrontendUiEngineering,
    skillTestingWebsites,
    skillPdfCreationAndEditing,
    skillDocxCreation,
    skillXlsxAndDataExtraction,
    skillAgentLongCodeScan,
    promptAgentShortCodeScan,
    "",
    "## VM Operating Instructions",
    instructions,
    "",
    "## Tool Protocol",
    TOOL_SPEC,
    "",
    GROUND_RULES,
    "",
    fileList.length ? `User has uploaded files: ${fileList.join(", ")}` : "",
    "",
    "## Current VM State",
    vmOutput ? `Last command output:\n${vmOutput}` : "VM just booted, waiting for first command.",
  ].filter(Boolean).join("\n");
}
