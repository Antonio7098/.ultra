# Repo Analysis: mastra

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | mastra |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/mastra` |
| Language / Stack | TypeScript |
| Analyzed | 2026-05-17 |

## Summary

Mastra is an AI-first agent framework that defaults to autonomous execution with opt-in human intervention. The system provides configurable guardrails (`maxSteps`, `stopWhen`, `requireToolApproval`) but defaults to autonomous operation, placing it in the "guided autonomy" to "semi-autonomous" range of the spectrum. Human approval is an exceptional safeguard, not the default mode. Trust is established through explicit tool/agent configuration, Zod schema validation, and scorer-based verification, with suspension/resume as the fallback mechanism for trust violations.

## Rating

**7/10** — Mastra has a well-defined autonomy model with configurable boundaries (`maxSteps`, `stopWhen`, `requireToolApproval`) and clear safeguards (TripWire, error processors, scorers). Autonomy is adjustable per workflow/agent/execution via `AgentExecutionOptionsBase`. However, the system lacks explicit confidence scoring, built-in approval workflows beyond tool-level, and per-workflow autonomy policies that would elevate it to a 9.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Agent autonomy definition | "Agents are autonomous systems that can make decisions and take actions" | `packages/core/src/mastra/index.ts:232` |
| Tool approval flag | `requireToolApproval?: boolean` | `packages/core/src/agent/agent.types.ts:634` |
| Tool approval endpoints | `/approve-tool-call` and `/decline-tool-call` | `packages/server/src/server/handlers/agents.ts:1952-2027` |
| Workflow suspension | `suspend: (suspendPayload: any, suspendOptions?: SuspendOptions)` | `packages/core/src/workflows/workflow.ts:2495` |
| Max steps control | `maxSteps?: number` | `packages/core/src/loop/types.ts:144` |
| Stop conditions | `stopWhen?: StopCondition \| Array<StopCondition>` | `packages/core/src/loop/types.ts:143` |
| Active tools allowlist | `activeTools` | `packages/core/src/loop/types.ts:134` |
| Tool choice strategy | `toolChoice` | `packages/core/src/loop/types.ts:133` |
| Auto resume flag | `autoResumeSuspendedTools?: boolean` | `packages/core/src/agent/agent.types.ts:637` |
| Tool execution options | `requireToolApproval`, `autoResumeSuspendedTools`, `toolCallConcurrency` | `packages/core/src/loop/types.ts:151-153` |
| Step creation | `createStep()` validates input types for workflow composition | `packages/core/src/workflows/workflow.ts:330-356` |
| TripWire mechanism | `TripWire` class halts execution with retry capability | `packages/core/src/agent/trip-wire.ts:35-45` |
| Scorer result interface | `score: number` (0=failed, 1=passed), `passed: boolean` | `packages/core/src/loop/network/validation.ts:80-95` |
| Scorer feedback | When scorers fail, feedback is added to message list | `packages/core/src/loop/network/validation.ts:609` |
| Completion checking | Autonomous completion check with feedback loop | `packages/core/src/loop/network/validation.ts:326-356` |
| Default maxSteps | `streamMaxSteps = definition.maxSteps ?? (definition.stopWhen ? undefined : 50)` | `packages/core/src/harness/tools.ts:1046` |
| Tool input validation | Input/output schemas validated via Zod | `packages/core/src/workflows/step.ts:588-591` |
| Workflow status | `status: 'failed' | 'tripwire'` with tripwire info | `packages/core/src/workflows/types.ts:428-435` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Guided Autonomy to Semi-Autonomous.** Mastra defaults to autonomous AI execution, treating human intervention as opt-in via `requireToolApproval` and `suspend()`. The default `maxSteps` of 50 (or 5 for streaming) allows autonomous iteration without prompting. The framework's own documentation states "Agents reason about goals, decide which tools to use, and iterate internally until the model emits a final answer" (`packages/core/src/mastra/index.ts:232`), indicating AI-first philosophy.

### 2. Is autonomy configurable per workflow or agent?

**Yes.** Autonomy is configurable at three levels: (1) Per-agent via `AgentConfig` options, (2) Per-workflow-step via `createStep(agent, agentOptions?)` (`packages/core/src/workflows/workflow.ts:407-581`), and (3) Per-execution via `AgentExecutionOptionsBase` which provides 40+ configurable options including `maxSteps`, `stopWhen`, `activeTools`, `toolChoice`, `requireToolApproval`, and `autoResumeSuspendedTools` (`packages/core/src/agent/agent.types.ts:516-714`).

### 3. What decisions are reserved for humans?

- **Tool execution** when `requireToolApproval: true` — tools are suspended until approved via `/approve-tool-call` endpoint (`packages/server/src/server/handlers/agents.ts:1952-2027`)
- **Workflow continuation** after `suspend()` call — workflow pauses at checkpoint, awaiting manual resume (`packages/core/src/workflows/workflow.ts:2495`)
- **Delegation decisions** — `onDelegationStart` hook can intercept and reject sub-agent calls
- **Completion validation** — scorers can be configured for human review on high-stakes tasks

### 4. What is the default when AI confidence is low?

**No explicit confidence threshold exists.** The system relies on: (1) `stopWhen` conditions — users implement custom confidence checks via declarative scorers (`packages/core/src/loop/types.ts:143`), (2) Scorer-based feedback — when `isTaskComplete` scorers fail, feedback is generated and added to the message list (`packages/core/src/loop/network/validation.ts:609`), (3) Iteration limits — `maxSteps` provides a natural boundary preventing unbounded execution (`packages/core/src/loop/types.ts:144`). There is no built-in model confidence score usage.

### 5. How is appropriate autonomy level determined?

**Developer configuration at development time.** The framework determines autonomy level through: (1) Tool risk assessment — developers set `requireApproval` on high-risk tools, (2) Workflow type — deterministic workflows (`.then()`) vs agentic loops, (3) Environment — production vs development via explicit config, (4) Model provider — model selection implicitly affects reasoning reliability. The framework provides no automated mechanism for determining appropriate autonomy; it is entirely developer-driven.

### 6. What safeguards exist against autonomous mistakes?

- **`maxSteps`** — Prevents infinite loops; defaults to 50 for standard execution, 5 for streaming (`packages/core/src/harness/tools.ts:1046`)
- **`stopWhen`** — Declarative conditions to halt based on accumulated state (`packages/core/src/loop/types.ts:143`)
- **`TripWire`** — Processor-initiated halt with retry capability and metadata (`packages/core/src/agent/trip-wire.ts:35-45`)
- **Tool schemas** — Zod input validation prevents malformed tool calls (`packages/core/src/workflows/step.ts:588-591`)
- **Observability** — Tracing and metrics for monitoring agent behavior
- **Error processors** — Custom error recovery workflows

### 7. How does the system handle edge cases?

- **Error processors** — Configured handlers recover from failures via processor chains
- **Workflow suspension** — State persisted for async continuation with `suspend()`/`resume()` (`packages/core/src/workflows/workflow.ts:2495`)
- **Abort signals** — Cancellable execution contexts via `AbortSignal`
- **Background tasks** — Async execution with retry logic
- **Tool fallbacks** — Model fallbacks via `modelFallbacks` array in agent config

### 8. What is the philosophy: "AI-first" or "human-first"?

**AI-first with Human-in-the-Loop Guards.** Evidence:
- `requireToolApproval` defaults to `false` — tools execute automatically
- Default `maxSteps` of 5-50 allows autonomous iteration
- `suspend()` is explicitly invoked — human input is a special case, not default
- Documentation explicitly describes agents as "autonomous systems" (`packages/core/src/mastra/index.ts:232`)
- Completion checking happens autonomously with feedback loop (`packages/core/src/loop/network/validation.ts:326-356`)

## Architectural Decisions

1. **Autonomous by default** — Mastra's agent loop (`packages/core/src/loop/`) runs without prompting by default; human approval is opt-in
2. **Step composition over imperative control** — Workflows use `.then()`, `.branch()`, `.parallel()` for deterministic control flow, with agents used for non-deterministic tasks
3. **Tool-as-first-class primitive** — Tools are explicitly defined with Zod schemas and registered; agents reason over the tool list
4. **Suspension over termination** — When trust is violated, workflows suspend rather than fail, allowing later human review
5. **Scorer-based verification** — Rather than hard-coded validation, Mastra uses pluggable scorers for output quality

## Notable Patterns

- **Agent loop with iteration guard** — `maxSteps` and `stopWhen` provide boundaries to autonomous iteration
- **Tool suspension** — Tools can be suspended mid-execution awaiting approval; workflow continues after resolution
- **Processor chain** — Input/output processors transform data and can halt execution via TripWire
- **Durable execution** — Workflow state persisted, enabling suspension and resume across process boundaries

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| AI-first default | Faster execution but higher risk of autonomous mistakes |
| Configuration complexity | 40+ execution options require careful tuning per use case |
| No built-in confidence | Developers must implement confidence handling via scorers |
| Approval granularity | Tool-level approval can be coarse; no per-parameter approval |
| Silent failures | `stopWhen` conditions may silently terminate if misconfigured |

## Failure Modes / Edge Cases

1. **Infinite loops** — If `maxSteps` is misconfigured or `stopWhen` conditions are never met, agent may loop indefinitely
2. **Stuck workflows** — Suspended workflows awaiting human input can remain stuck if approver never acts
3. **Approval bypass** — `autoResumeSuspendedTools: true` bypasses human approval, negating safety intent
4. **Misconfigured scorers** — Scorers returning false negatives can cause premature termination; false positives can allow bad outputs
5. **Tool schema bypass** — Malformed tool definitions may pass schema validation but cause runtime errors
6. **Model hallucination** — Agents may call non-existent tools or misunderstand tool purpose; no runtime guard beyond schemas

## Future Considerations

1. **Confidence scoring** — Built-in model confidence integration would enable automatic autonomy reduction
2. **Per-parameter approval** — Granular approval for specific tool parameters rather than entire tool calls
3. **Runtime autonomy policies** — System-wide autonomy policies adjustable without redeployment
4. **Approval escalation** — Multi-level approval chains (e.g., approve if < $100, escalate if higher)
5. **Autonomy metrics** — Telemetry on autonomous decisions vs human interventions to tune defaults

## Questions / Gaps

1. **No evidence found** for automatic autonomy adjustment based on task complexity — autonomy appears static per execution
2. **No evidence found** for audit logging of human interventions — approval events may not be persistently logged
3. **No evidence found** for rate limiting on autonomous operations — agents could overwhelm external systems
4. **No evidence found** for multi-agent consensus mechanisms — delegation is unidirectional, not collaborative

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `mastra`.