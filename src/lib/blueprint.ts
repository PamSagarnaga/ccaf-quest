// ============================================================
//  Reference blueprint — authored verbatim from the official
//  CCAF exam guide (Exam Guide CCAF.pdf v1.0 / 00-official-exam-guide.md).
//  This is the SOURCE OF TRUTH. Everything else tags back to it.
// ============================================================

export const domains = [
  {
    number: 1,
    name: "Agentic Architecture & Orchestration",
    weight: 27,
    accent: "d1",
    blurb:
      "Agentic loops, multi-agent coordination, subagent context passing, workflow enforcement, hooks, decomposition, and session resumption.",
  },
  {
    number: 2,
    name: "Tool Design & MCP Integration",
    weight: 18,
    accent: "d2",
    blurb:
      "Tool interface design, structured error responses, tool distribution & tool_choice, MCP server integration, and built-in tools.",
  },
  {
    number: 3,
    name: "Claude Code Configuration & Workflows",
    weight: 20,
    accent: "d3",
    blurb:
      "CLAUDE.md hierarchy, slash commands & skills, path-specific rules, plan mode, iterative refinement, and CI/CD integration.",
  },
  {
    number: 4,
    name: "Prompt Engineering & Structured Output",
    weight: 20,
    accent: "d4",
    blurb:
      "Explicit criteria, few-shot prompting, structured output via tool_use, validation/retry loops, batch processing, and multi-pass review.",
  },
  {
    number: 5,
    name: "Context Management & Reliability",
    weight: 15,
    accent: "d5",
    blurb:
      "Long-conversation context, escalation & ambiguity, error propagation, large-codebase exploration, human review, and provenance.",
  },
] as const;

export const tasks = [
  // Domain 1
  { code: "1.1", domain: 1, statement: "Design and implement agentic loops (stop_reason \"tool_use\"/\"end_turn\", model-driven vs. pre-configured decisions).", video_ref: "02-master-agentic-loops" },
  { code: "1.2", domain: 1, statement: "Orchestrate multi-agent systems: coordinator-subagent, hub-and-spoke, isolated context, dynamic subagent selection, iterative refinement.", video_ref: "03-multi-agent-coordinator" },
  { code: "1.3", domain: 1, statement: "Configure subagent invocation, context passing, spawning (Task tool, allowedTools must include \"Task\", AgentDefinition, fork-based session mgmt).", video_ref: "04-subagent-config-and-context" },
  { code: "1.4", domain: 1, statement: "Design multi-step workflows with enforcement/handoff patterns (programmatic prerequisites, structured handoff protocols).", video_ref: "05-multi-step-workflows" },
  { code: "1.5", domain: 1, statement: "Use Agent SDK hooks for tool call interception and data normalization (PostToolUse, deterministic vs. probabilistic).", video_ref: "06-sdk-hooks-and-normalization" },
  { code: "1.6", domain: 1, statement: "Apply task decomposition strategies (prompt chaining vs. dynamic decomposition, attention dilution).", video_ref: "07-decomposition-strategies" },
  { code: "1.7", domain: 1, statement: "Manage session state, resumption, and forking (--resume <session-name>, fork_session).", video_ref: "08-session-state-and-resumption" },

  // Domain 2
  { code: "2.1", domain: 2, statement: "Design effective tool interfaces with clear descriptions and boundaries.", video_ref: "09-tool-design" },
  { code: "2.2", domain: 2, statement: "Implement structured error responses for MCP tools (isError flag, errorCategory, isRetryable).", video_ref: "10-structured-errors" },
  { code: "2.3", domain: 2, statement: "Distribute tools across agents and configure tool_choice (\"auto\"/\"any\"/forced).", video_ref: "11-tool-distribution" },
  { code: "2.4", domain: 2, statement: "Integrate MCP servers (.mcp.json project vs. ~/.claude.json user scope, env var expansion, MCP resources).", video_ref: "12-mcp-servers" },
  { code: "2.5", domain: 2, statement: "Select and apply built-in tools (Read, Write, Edit, Bash, Grep, Glob).", video_ref: "13-built-in-tools" },

  // Domain 3
  { code: "3.1", domain: 3, statement: "Structure CLAUDE.md hierarchy, scoping, and modular organization (@import, .claude/rules/).", video_ref: "14-claude-md-config" },
  { code: "3.2", domain: 3, statement: "Build custom slash commands and skills (.claude/commands/, .claude/skills/, SKILL.md frontmatter: context:fork, allowed-tools, argument-hint).", video_ref: "15-commands-and-skills" },
  { code: "3.3", domain: 3, statement: "Apply path-specific rules for conditional convention loading (YAML paths glob patterns).", video_ref: "16-path-specific-rules" },
  { code: "3.4", domain: 3, statement: "Choose between plan mode and direct execution.", video_ref: "17-plan-mode-vs-execution" },
  { code: "3.5", domain: 3, statement: "Apply iterative refinement techniques (concrete I/O examples, test-driven iteration, interview pattern, interacting vs. independent issues).", video_ref: "18-iterative-refinement" },
  { code: "3.6", domain: 3, statement: "Integrate Claude Code into CI/CD pipelines (-p/--print, --output-format json, --json-schema, session isolation).", video_ref: "19-cicd-integration" },

  // Domain 4
  { code: "4.1", domain: 4, statement: "Use explicit criteria to improve precision and reduce false positives.", video_ref: "20-prompt-design-criteria" },
  { code: "4.2", domain: 4, statement: "Apply few-shot prompting for output consistency.", video_ref: "21-few-shot-prompting" },
  { code: "4.3", domain: 4, statement: "Enforce structured output via tool_use + JSON schemas.", video_ref: "22-structured-output-patterns" },
  { code: "4.4", domain: 4, statement: "Build validation, retry, and feedback loops for extraction quality.", video_ref: "23-validation-and-retry-loops" },
  { code: "4.5", domain: 4, statement: "Apply efficient batch processing strategies (Message Batches API).", video_ref: "24-batch-processing-strategies" },
  { code: "4.6", domain: 4, statement: "Design multi-instance and multi-pass review architectures.", video_ref: "25-multi-instance-review-architectures" },

  // Domain 5
  { code: "5.1", domain: 5, statement: "Manage conversation context across long interactions (\"case facts\" block, lost-in-the-middle, tool output trimming).", video_ref: "26-context-management" },
  { code: "5.2", domain: 5, statement: "Apply effective escalation and ambiguity resolution patterns.", video_ref: "27-escalation-and-ambiguity-resolution" },
  { code: "5.3", domain: 5, statement: "Design error propagation strategies across multi-agent systems.", video_ref: "28-error-propagation-multi-agents" },
  { code: "5.4", domain: 5, statement: "Manage context effectively in large codebase exploration (scratchpads, /compact, manifests).", video_ref: "29-large-codebase-context" },
  { code: "5.5", domain: 5, statement: "Design human review workflows and confidence calibration (stratified sampling, field-level confidence).", video_ref: "30-human-review-workflows" },
  { code: "5.6", domain: 5, statement: "Preserve information provenance and handle uncertainty in multi-source synthesis.", video_ref: "31-information-provenance-and-uncertainty" },
] as const;

export const scenarios = [
  {
    slug: "customer-support",
    name: "Customer Support Resolution Agent",
    description:
      "Claude Agent SDK agent handling returns/billing/account issues via custom MCP tools (get_customer, lookup_order, process_refund, escalate_to_human); target 80%+ first-contact resolution.",
    primary_domains: [1, 2, 5],
  },
  {
    slug: "code-generation",
    name: "Code Generation with Claude Code",
    description:
      "Team uses Claude Code for generation/refactoring/debugging/docs; custom slash commands, CLAUDE.md, plan mode vs. direct execution.",
    primary_domains: [3, 5],
  },
  {
    slug: "multi-agent-research",
    name: "Multi-Agent Research System",
    description:
      "Coordinator + specialized subagents (web search, document analysis, synthesis, report generation) producing cited reports.",
    primary_domains: [1, 2, 5],
  },
  {
    slug: "developer-productivity",
    name: "Developer Productivity with Claude",
    description:
      "Agent helps explore codebases/legacy systems/boilerplate using built-in tools (Read, Write, Bash, Grep, Glob) + MCP servers.",
    primary_domains: [2, 3, 1],
  },
  {
    slug: "cicd",
    name: "Claude Code for Continuous Integration",
    description:
      "Automated code review, test generation, PR feedback; minimize false positives.",
    primary_domains: [3, 4],
  },
  {
    slug: "structured-extraction",
    name: "Structured Data Extraction",
    description:
      "Extracts from unstructured documents, validates via JSON schemas, handles edge cases, integrates downstream.",
    primary_domains: [4, 5],
  },
] as const;

// ── Derived helpers ────────────────────────────────────────
export type Domain = (typeof domains)[number];
export type Task = (typeof tasks)[number];
export type Scenario = (typeof scenarios)[number];

export const domainByNumber = (n: number) =>
  domains.find((d) => d.number === n)!;

export const tasksForDomain = (n: number) =>
  tasks.filter((t) => t.domain === n);

export const scenariosForDomain = (n: number) =>
  scenarios.filter((s) => (s.primary_domains as readonly number[]).includes(n));

/** Exam logistics — from the official guide. */
export const examMeta = {
  credential: "Claude Certified Architect – Foundations",
  code: "CCAR-F",
  items: 60,
  scenariosPerExam: 4,
  scenarioBank: 6,
  timeLimitMin: 120,
  passingScore: 720,
  scaleMax: 1000,
  feeUsd: 125,
  validityMonths: 12,
} as const;
