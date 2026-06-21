# Philosophy of Autonomy Analysis - Combined Study Report

## Study Parameters

| Field | Value |
|-------|-------|
| Protocol | `study-areas/23-philosophy-of-autonomy.md` |
| Repositories | 13 reference repos |
| Date | 2026-05-17 |

## Repositories Studied

| # | Repo | Path |
|---|------|------|
| 1 | aider | `repos/aider` |
| 2 | autogen | `repos/autogen` |
| 3 | guardrails | `repos/guardrails` |
| 4 | hellosales | `repos/hellosales` |
| 5 | langfuse | `repos/langfuse` |
| 6 | langgraph | `repos/langgraph` |
| 7 | mastra | `repos/mastra` |
| 8 | nemo-guardrails | `repos/nemo-guardrails` |
| 9 | opa | `repos/opa` |
| 10 | openai-agents-python | `repos/openai-agents-python` |
| 11 | opencode | `repos/opencode` |
| 12 | openhands | `repos/openhands` |
| 13 | temporal | `repos/temporal` |

## Executive Summary

This study analyzed how 13 reference systems approach agent autonomy — the degree to which AI agents are trusted to make decisions independently versus requiring human approval or deterministic constraints. The systems span a wide range: from fully deterministic policy engines (OPA, Temporal) to AI-first agent frameworks with opt-in guardrails (Mastra, OpenHands) to human-first constrained systems (HelloSales, Guardrails).

**Key finding:** Across this diverse set of systems, the dominant pattern is **"AI-first with human-in-the-loop as opt-in"** — systems default to trusting the agent to act autonomously, with safety mechanisms requiring explicit opt-in rather than opt-out. Only a few systems (HelloSales, Guardrails, Langfuse, OPA) default to conservative "human-first" postures where approval is required by default.

**Second major finding:** There is near-universal absence of **confidence-based autonomy** — virtually no system implements the pattern "when AI confidence is low, escalate to human." Instead, systems rely on static permission rules, retry loops, or hard iteration limits.

**Third finding:** Autonomy configuration is almost always **per-tool or per-agent**, not **per-workflow or per-context**. Once an agent or tool is configured, its autonomy level does not dynamically adjust based on task content, user role, or runtime behavior.

## Core Thesis

Agent autonomy in these systems is shaped by three forces:

1. **Product shape** — CLI coding tools (aider, opencode) default to high autonomy because users want productivity; enterprise backends (HelloSales, Langfuse) default to conservative because data access requires governance.

2. **Safety mechanism philosophy** — Some systems use **prevention** (guardrails block before action), others use **detection + recovery** (aider auto-commits with undo). Prevention feels safer but reduces flexibility; recovery feels riskier but enables faster iteration.

3. **Trust establishment** — Trust is established either through **code/policy authorship** (OPA, Guardrails: "humans write the rules"), **runtime configuration** (Mastra, OpenHands: "operators configure limits"), or **learning from feedback** (none of the systems studied use this pattern).

## Rating Summary

| Repo | Score | Approach | Main Strength | Main Concern |
|------|-------|----------|---------------|--------------|
| opencode | 8/10 | Constrained autonomy with sophisticated ruleset | Permission ruleset with session lineage, subagent inheritance, and auto-accept | Default allow-all requires explicit lock-down |
| aider | 7/10 | Guided autonomy lean semi-autonomous | Git-centric safety (auto-commits + undo) | No confidence-based fallback, session-only config |
| autogen | 7/10 | Layered autonomy across full spectrum | Team strategies (RoundRobin→MagenticOne) as autonomy dial | No confidence handling, safety opt-in |
| guardrails | 7/10 | Constrained autonomy (validation-focused) | Schema validation + OnFailAction policies per validator | No human escalation path, reask budget blunt |
| hellosales | 7/10 | Constrained/guided hybrid | Binary approval model with hard-coded write protection | No graduated autonomy, approval staleness risk |
| langfuse | 7/10 | Human-first with guided autonomy | Score source hierarchy (API/EVAL/ANNOTATION) separates trust levels | No confidence scoring, evaluator blocking requires manual unblock |
| langgraph | 7/10 | Configurable per-node at compile-time | Interrupt mechanisms + checkpoint persistence | Human oversight advisory not enforced |
| mastra | 7/10 | AI-first with opt-in human intervention | TripWire + scorer-based verification + suspend/resume | Default maxSteps=50 trusts agent too much |
| nemo-guardrails | 7/10 | Guided/constrained autonomy | Parallel rail execution with fail-open/fail-closed options | No human approval mechanism |
| openai-agents-python | 7/10 | Configurable constrained autonomy | HITL via RunState serialization, per-tool approval predicates | No built-in confidence mechanism |
| opa | 4/10 | Fully deterministic (no AI) | Policy-as-code with formal verification | No AI autonomy, no uncertainty handling |
| openhands | 6/10 | Hybrid with default to fully autonomous | Risk-based confirmation with multi-analyzer ensemble | Default NeverConfirm, opt-in safety |
| temporal | 6/10 | Fully deterministic (event-sourcing) | Deterministic replay with signal-based human input | No structured approval, global limits only |

## Approach Models

### Model 1: AI-First with Opt-In Human Oversight
**Repos:** mastra, openhands, autogen (default), langgraph (default), openai-agents-python

These systems trust the agent to execute autonomously by default. Human oversight is implemented as optional layers that developers must explicitly add.

- **Default behavior:** Full autonomous execution with no mandatory gates
- **Safety mechanism:** Developers opt into approval gates, guardrails, or interrupts
- **Risk:** Users may not understand the safety implications of the default posture

Evidence: `openhands/sdk/conversation/state.py:121` — `NeverConfirm()` is the default. `mastral/packages/core/src/mastra/index.ts:232` — "Agents are autonomous systems that can make decisions."

### Model 2: Human-First with Opt-In Autonomy
**Repos:** helloSales, guardrails, langfuse, opa

These systems assume the agent is untrustworthy by default. All operations require human authorization or are constrained by human-defined policies.

- **Default behavior:** Require approval or validate against human-defined rules
- **Safety mechanism:** Humans define what correct looks like; system enforces it
- **Risk:** May reduce agent utility for legitimate use cases

Evidence: `hellosales/src/hello_sales_backend/application/agents/definitions/generic_agent/tools.py:31-39` — `requires_approval=True` on write tools. `guardrails/run/runner.py:265-276` — output only accepted after validation.

### Model 3: Permission Ruleset
**Repos:** opencode, nemo-guardrails

Autonomy is expressed as a ruleset of allow/ask/deny actions checked before every tool execution.

- **Default behavior:** Allow with selective restrictions (opencode) or block with selective allow (nemo-guardrails)
- **Safety mechanism:** Pattern-based rules evaluated before tool execution
- **Risk:** Complex rule interactions may be hard to reason about

Evidence: `opencode/packages/opencode/src/agent/agent.ts:100-119` — `Permission.fromConfig({ "*": "allow" })`. `nemo-guardrails/rails/llm/config.py:561-678` — Input/Output/Tool rails configuration.

### Model 4: Fully Deterministic
**Repos:** opa, temporal

No AI autonomy exists; all decisions are derived from human-authored policy or history events.

- **Default behavior:** Deterministic execution of authored logic
- **Safety mechanism:** Formal verification, replay logging, deterministic replay
- **Risk:** Cannot handle situations requiring probabilistic reasoning or adaptation

Evidence: `opa/topdown/eval.go:76-131` — deterministic evaluation with seeded PRNG. `temporal/service/history/workflow_rebuilder.go:64-104` — workflow state reconstructed from history events.

### Model 5: Hybrid Safety Layers
**Repos:** autogen, langgraph, openai-agents-python

Implements both autonomous execution and structured human intervention points, with configurable per-agent/per-team policies.

- **Default behavior:** Autonomous with configurable interrupt points
- **Safety mechanism:** InterventionHandler, approval_func, guardrails as layered safeguards
- **Risk:** Autonomy features spread across multiple layers, hard to visualize overall posture

Evidence: `autogen-core/src/autogen_core/_intervention.py:20-66` — InterventionHandler protocol. `langgraph/libs/langgraph/langgraph/types.py:801-924` — `interrupt()` function.

## Pattern Catalog

### Pattern 1: Git-Centric Safety Net
**Problem:** How to recover from autonomous mistakes without manual backup?
**Solution:** Auto-commit every AI action to git, provide undo capability
**Repos:** aider (primary demonstration), also visible in opencode
**Evidence:** `aider/aider/repo.py:131-314` — auto-commit after every edit. `aider/aider/commands.py:553-655` — `/undo` command reverts commits.
**When to use:** CLI tools where file-level recovery is sufficient and users expect version control
**When overkill:** Read-only systems, short-lived processes, non-git workflows

### Pattern 2: Binary Approval Gate
**Problem:** How to enforce human approval for high-stakes operations without complex configuration?
**Solution:** Per-tool boolean `requires_approval` flag; system pauses and awaits human decision before proceeding
**Repos:** helloSales (primary), openai-agents-python, mastra
**Evidence:** `hellosales/src/hello_sales_backend/platform/agents/tools.py:91` — `requires_approval: bool = False`. `mastral/packages/core/src/agent/agent.types.ts:634` — `requireToolApproval?: boolean`
**When to use:** Enterprise backends where data integrity is paramount
**When overkill:** High-volume automated workflows where human approval would become a bottleneck

### Pattern 3: Reflection Loop (Retry-on-Failure)
**Problem:** What to do when AI produces invalid output?
**Solution:** Retry up to N times with error context; if all fail, report failure
**Repos:** aider (primary), guardrails (reask loop)
**Evidence:** `aider/aider/coders/base_coder.py:101` — `max_reflections = 3`. `guardrails/run/runner.py:168` — `num_reasks` budget.
**When to use:** Code generation where invalid output is detectable (malformed edit blocks, schema violations)
**When not to use:** When failures are semantic not syntactic, or when retrying wastes significant resources

### Pattern 4: Permission Ruleset
**Problem:** How to express complex, context-dependent autonomy boundaries?
**Solution:** `<permission, pattern, action>` rules evaluated before tool execution
**Repos:** opencode (primary), nemo-guardrails (rails)
**Evidence:** `opencode/packages/opencode/src/permission/index.ts:22-27` — `Rule` schema with `permission`, `pattern`, `action`. `opencode/packages/opencode/src/permission/evaluate.ts:11` — `findLast()` for last-match-wins.
**When to use:** Tools with diverse risk profiles where simple allow/deny is insufficient
**When overkill:** Systems with homogeneous tool risk profiles

### Pattern 5: Checkpoint + Interrupt
**Problem:** How to pause autonomous execution for human review while preserving state?
**Solution:** Persist state to checkpoint, raise interrupt, resume from checkpoint on human decision
**Repos:** langgraph (primary), openai-agents-python (RunState), mastra (suspend/resume)
**Evidence:** `langgraph/libs/langgraph/langgraph/pregel/main.py:766-767` — `interrupt_before_nodes` / `interrupt_after_nodes`. `openai-agents-python/src/agents/run_state.py:184-320` — full pause/resume boundary via RunState serialization.
**When to use:** Long-running agents where state must be preserved across human review
**When overkill:** Short-lived operations where checkpoint overhead exceeds cost

### Pattern 6: Dual Model / Architect Pattern
**Problem:** How to add review layer without separate human reviewer?
**Solution:** One model plans, another implements; human approves plan before implementation
**Repos:** aider (architect mode), autogen (MagenticOne orchestrator)
**Evidence:** `aider/aider/coders/architect_coder.py:37-44` — `ArchitectCoder` plans, creates editor coder. `autogen/autogen-agentchat/teams/_magentic_one_group_chat.py:36` — orchestrator-driven task delegation.
**When to use:** Complex tasks where planning/implementation separation improves quality
**When overkill:** Simple tasks where two-model overhead exceeds benefit

### Pattern 7: Structured Fail Action Policy
**Problem:** How to define consistent behavior when validation fails?
**Solution:** Per-validator `OnFailAction` enum (REASK, FIX, FILTER, REFRAIN, NOOP, EXCEPTION) dispatched by a central validator service
**Repos:** guardrails (primary), nemo-guardrails (fail-open/fail-closed)
**Evidence:** `guardrails/guardrails/types/on_fail.py:24-31` — OnFailAction enum with 8 options. `nemo-guardrails/library/ai_defense/actions.py:59` — `fail_open` option.
**When to use:** Output validation layers where multiple failure response strategies are needed
**When not to use:** Systems with single failure response or where human escalation is preferred

### Pattern 8: Risk-Based Confirmation Thresholds
**Problem:** How to scale human oversight for diverse action risk levels?
**Solution:** Classify actions by risk (LOW, MEDIUM, HIGH), apply confirmation policy based on risk vs threshold
**Repos:** openhands (primary), also visible in mastra (stopWhen)
**Evidence:** `openhands/openhands/sdk/security/risk.py:13-100` — SecurityRisk enum with comparator logic. `openhands/openhands/sdk/security/confirmation_policy.py:43-61` — `ConfirmRisky(threshold=SecurityRisk.HIGH)`.
**When to use:** Systems with diverse action risk profiles requiring graduated oversight
**When not to use:** Homogeneous action risk profiles where binary approval suffices

## Key Differences

### Autonomy Philosophy by Product Category

| Category | Example Systems | Philosophy |
|----------|-----------------|------------|
| CLI coding tools | aider, opencode | AI-first, trust to productivity |
| Enterprise backends | helloSales, langfuse | Human-first, data governance |
| Agent frameworks | autogen, langgraph, mastra | Configurable, trust-but-verify |
| Validation layers | guardrails, nemo-guardrails | Constrain without approving |
| Policy engines | opa, temporal | Deterministic, no AI |

### The Confidence Gap

Every system studied lacks an explicit mechanism for "when AI confidence is low, escalate to human." The approaches used instead:

- **Retry loops** (aider, guardrails): Retry until success or budget exhausted
- **Iteration limits** (langgraph, mastra): Hard cap on autonomous steps
- **Blocking** (langfuse, opa): Refuse to proceed without valid input
- **Risk classification** (openhands): Classify by action risk not model confidence

This represents a significant gap: none of these systems attempt to assess whether the AI "knows what it's doing" before proceeding.

### Approval Granularity

| System | Approval Granularity |
|--------|---------------------|
| helloSales | Per-tool binary |
| openai-agents-python | Per-tool with callable predicates, sticky approvals |
| opencode | Per-permission with pattern matching |
| aider | Per-action-type via confirm_ask |
| autogen | Per-code-execution via approval_func callback |
| mastra | Per-tool via requireToolApproval |

No system implements **per-parameter approval** (approve a tool call but restrict specific parameters) or **confidence-gated approval** (approve if confidence > X%).

## Tradeoffs

### Autonomy vs. Safety

| Choice | Benefit | Cost | Failure Mode |
|--------|---------|------|--------------|
| AI-first default (openhands, mastra) | Faster iteration, higher utility | Risk of autonomous mistakes before safety configured | HIGH risk actions execute without confirmation |
| Human-first default (helloSales, guardrails) | Data integrity, compliance | Lower agent utility, human bottleneck | Legitimate operations require human approval |
| Permission ruleset (opencode) | Fine-grained, context-aware | Configuration complexity, rule interaction surprises | Subtle misconfigurations allow dangerous operations |

### Recovery vs. Prevention

| Approach | Systems | Behavior |
|----------|---------|----------|
| Prevention | guardrails, nemo-guardrails, langfuse | Block invalid actions before they occur; safe but inflexible |
| Detection + Recovery | aider (git undo), langgraph (checkpoint replay) | Allow actions, detect problems, recover; flexible but riskier |
| Hybrid | autogen (intervention handler), openai-agents-python (guardrails + approval) | Combine both approaches; most robust but most complex |

### Autonomy Configuration Scope

| Scope | Systems | Limitation |
|-------|---------|------------|
| Per-session | aider | Cannot vary by workflow within session |
| Per-agent | autogen, openai-agents-python, mastra | Cannot vary by task within agent |
| Per-tool | helloSales, opencode | Cannot vary by context within tool |
| Per-workflow | None found | Gap in all systems |

## Decision Guide

**Q: Should I default to AI-first or human-first?**
- Choose AI-first if: users are power users, tasks are high-volume, mistakes are recoverable
- Choose human-first if: data integrity matters, compliance required, mistakes are costly

**Q: Should I use approval gates or validation?**
- Use approval gates (helloSales, openai-agents-python) when: humans should decide, actions are irreversible
- Use validation (guardrails, nemo-guardrails) when: outputs can be corrected, humans should review not decide

**Q: Should I use rulesets or simple flags?**
- Use rulesets (opencode) when: diverse tool risk profiles, context matters
- Use simple flags when: uniform tool risk profile

**Q: Should I use checkpoint/interrupt or polling?**
- Use checkpoint/interrupt when: long-running agents, state preservation critical
- Use polling when: short operations, simpler implementation preferred

**Q: How should I handle low AI confidence?**
- Implement retry budgets (aider, guardrails) for syntactic failures
- Implement iteration limits (langgraph, mastra) for unbounded loops
- Consider confidence-gated escalation if available (none of the systems studied implement this)

## Practical Tips

1. **Default-deny for write operations** — helloSales hard-codes `requires_approval=True` for create_entity and edit_entity as an architectural invariant. This is the safest pattern for data-access systems.

2. **Git-centric safety for code tools** — aider's pattern of auto-committing every edit with undo capability is the most developer-friendly recovery mechanism for CLI coding tools.

3. **Permission rulesets for diverse tool risk** — opencode's `<permission, pattern, action>` ruleset handles the widest range of autonomy scenarios, from file-type-specific rules to doom-loop detection.

4. **Binary approval is sufficient for most backends** — helloSales' simple `requires_approval` boolean keeps the model auditable. Graduated autonomy (confidence thresholds, per-parameter approval) adds complexity without proportional benefit in most cases.

5. **Structured fail actions improve debuggability** — guardrails' OnFailAction enum makes failure handling explicit and configurable. The cost is higher configuration complexity.

6. **Avoid default-high-autonomy without safety net** — openhands' `NeverConfirm()` default is the riskiest pattern studied. The system trusts the agent completely unless explicitly configured otherwise.

7. **Use session lineage for auto-accept scope** — opencode's `sessionLineage()` pattern prevents auto-accept permissions from propagating across unrelated sessions.

8. **Checkpoint persistence enables graceful recovery** — langgraph's interrupt/checkpoint model and openai-agents-python's RunState serialization both enable robust pause/resume, but at the cost of implementation complexity.

## Anti-Patterns / Caution Signs

1. **No confidence handling** — If a system has no mechanism to assess AI confidence, it will proceed with high uncertainty actions identically to low uncertainty ones. This is the most common gap.

2. **Default-allow without permission audit** — opencode's default `Permission.fromConfig({ "*": "allow" })` is the most permissive pattern. Without explicit permission auditing, it's unclear what the agent can do.

3. **Approval without expiration** — helloSales defines `approval_timeout_seconds` (`platform/agents/config.py:13`) but never enforces it. Stale approvals can execute against outdated context.

4. **Safety opt-in by default** — openhands' `NeverConfirm()` and mastra's `requireToolApproval=False` default mean safety features are only enabled when developers know to configure them.

5. **No rollback on rejection** — When a human rejects an approval in helloSales, the run is terminated. There's no mechanism to resume with modified input.

6. **Tool-level guardrails don't halt execution** — openai-agents-python's tool input guardrails (`src/agents/tool_guardrails.py:170-199`) return results but don't halt the run. This creates a false sense of safety.

7. **Auto-accept is boolean, not time-limited** — opencode's auto-accept persists until app shutdown. There's no way to say "auto-accept for 30 minutes only."

8. **Reask budget is global** — guardrails' `num_reasks` applies to all validators; there is no per-field or per-error-type budget.

## Notable Absences

1. **No confidence-based autonomy** — Across all 13 systems, no mechanism exists for "escalate to human when confidence < X%." This is the single largest gap.

2. **No per-workflow autonomy configuration** — Autonomy is fixed at agent or tool definition time; no system varies autonomy based on workflow stage or context.

3. **No built-in audit trail for autonomous decisions** — Most systems log events but not specifically which decisions were autonomous vs. human-approved.

4. **No automatic rollback on human rejection** — When humans reject at approval gates, systems terminate rather than return to prior state with modified input.

5. **No escalation chains** — None of the agent frameworks implement "agent → supervisor agent → human" escalation paths.

6. **No autonomy metrics** — No system tracks "autonomy utilization" (how often does the agent act autonomously vs. waiting for human) to help operators tune policies.

7. **No multi-human workflows** — All human-in-the-loop systems represent a single human; no support for approver + reviewer + observer roles.

## Per-Repo Notes

| Repo | Key Autonomy Characteristic |
|------|----------------------------|
| **aider** | Git-centric safety net with auto-commits and undo; reflection loop for self-correction |
| **autogen** | Team strategy as autonomy dial (RoundRobin → MagenticOne); default opt-in safety |
| **guardrails** | Validation-first with structured OnFailAction policies; no human escalation |
| **hellosales** | Hard-coded write protection; binary approval model; observer agent is read-only autonomous |
| **langfuse** | Score source hierarchy (API/EVAL/ANNOTATION); evaluator blocking requires manual unblock |
| **langgraph** | Interrupt/checkpoint model; human oversight advisory not enforced |
| **mastral** | TripWire mechanism; AI-first with opt-in human intervention via requireToolApproval |
| **nemo-guardrails** | Parallel rail execution; fail-open/fail-closed for external API failures |
| **opa** | Fully deterministic policy engine; no AI autonomy; formal verification |
| **openai-agents-python** | HITL via RunState serialization; per-tool approval predicates with sticky approvals |
| **opencode** | Sophisticated permission ruleset; session lineage auto-accept; default-allow |
| **openhands** | Risk-based confirmation (LOW/MEDIUM/HIGH); default NeverConfirm is risky |
| **temporal** | Fully deterministic event-sourcing; signal-based human input; no structured approval |

## Open Questions

1. **Should autonomy be dynamic?** — None of the systems studied adjust autonomy level based on runtime behavior. Would a system that "learns" to trust an agent over time (after successful operations) be beneficial or dangerous?

2. **How should multiple humans participate?** — All HITL systems assume a single human approver. How should systems handle approval from multiple reviewers (e.g., require both security + business approval)?

3. **What is the right granularity for approval scopes?** — Per-call (openai-agents-python), per-tool (helloSales), per-session (openhands), per-directory (opencode). Which is most appropriate for which use case?

4. **Should approval have time limits?** — helloSales defines timeout config but doesn't enforce it. What happens when approval takes hours? Should stale approvals be rejected?

5. **How to handle "confidence" in non-LLM systems?** — OPA and temporal have no AI confidence concept; they use deterministic evaluation. Should confidence-based patterns be applied to non-LLM autonomous systems?

6. **What's the right balance for CLI tools?** — aider defaults to high autonomy (AI-first) while opencode defaults to allow-all. Which is more appropriate for developer tooling?

7. **How to audit autonomous decisions?** — Most systems emit events but don't provide structured audit logs of which decisions were autonomous vs. human-approved. Is this needed for compliance?

## Evidence Index

| Evidence | Source |
|----------|--------|
| `aider/aider/coders/base_coder.py:101` | max_reflections = 3 |
| `aider/aider/repo.py:131-314` | auto-commit after edits |
| `autogen-core/src/autogen_core/_intervention.py:20-66` | InterventionHandler protocol |
| `autogen/autogen-agentchat/teams/_magentic_one_group_chat.py:36` | MagenticOne orchestrator |
| `guardrails/guardrails/types/on_fail.py:24-31` | OnFailAction enum |
| `guardrails/run/runner.py:168` | reask loop with num_reasks budget |
| `hellosales/src/hello_sales_backend/platform/agents/tools.py:91` | requires_approval flag |
| `hellosales/src/hello_sales_backend/platform/agents/config.py:13` | approval_timeout_seconds |
| `langfuse/packages/shared/src/domain/scores.ts:4-11` | Score source hierarchy |
| `langfuse/worker/src/features/evaluation/evalService.ts:729` | LLM-as-judge evaluation |
| `langgraph/libs/langgraph/langgraph/types.py:801-924` | interrupt() function |
| `langgraph/libs/langgraph/langgraph/pregel/main.py:766-767` | interrupt_before_nodes/after |
| `mastral/packages/core/src/mastra/index.ts:232` | agent definition |
| `mastral/packages/core/src/agent/trip-wire.ts:35-45` | TripWire mechanism |
| `nemo-guardrails/rails/llm/config.py:561-678` | Rails configuration |
| `opa/topdown/eval.go:76-131` | deterministic evaluation |
| `openai-agents-python/src/agents/tool.py:328` | needs_approval on FunctionTool |
| `openai-agents-python/src/agents/run_state.py:184-320` | RunState serialization |
| `opencode/packages/opencode/src/agent/agent.ts:100-119` | default allow permission |
| `opencode/packages/opencode/src/permission/index.ts:22-27` | Rule schema |
| `openhands/sdk/conversation/state.py:121` | NeverConfirm default |
| `openhands/sdk/security/risk.py:13-100` | SecurityRisk enum |
| `temporal/service/history/workflow_rebuilder.go:64-104` | workflow rebuild |

---

## HelloSales — Improvement Recommendations

Based on analysis of all 13 reference systems, the following improvements are recommended for HelloSales, prioritized by impact.

### Quick Wins (Low Effort, High Impact)

**1. Enforce approval timeout**
- **Current state:** `approval_timeout_seconds` is defined but not enforced
- **Fix:** In `agent_run_service.py:270-281` (approval resume), check elapsed time against `approval_timeout_seconds` and reject if exceeded
- **Evidence:** `hellosales/src/hello_sales_backend/platform/agents/config.py:13` defines the value; `hellosales/repos/hellosales/src/hello_sales_backend/modules/agent_runs/use_cases/agent_run_service.py:270-281` handles approval resume
- **Risk:** None — this is a safety improvement

**2. Add rejection recovery (allow resume after rejection)**
- **Current state:** When approval is rejected, run completes with canned message; user must start new run
- **Fix:** When `AgentRunApprovalDecision.REJECTED` is received, instead of completing the run, inject the rejection message and allow the agent to propose an alternative
- **Evidence:** `hellosales/src/hello_sales_backend/modules/agent_runs/use_cases/agent_run_service.py:283-290` handles rejection
- **Risk:** Medium — must ensure agent doesn't loop on repeated rejection

**3. Bulk approval for related tool calls**
- **Current state:** Each tool call generates a separate approval request
- **Fix:** Add optional `group_id` to `ToolCallStatus` so related tool calls (e.g., query + create) can be batch-approved together
- **Evidence:** `hellosales/src/hello_sales_backend/platform/agents/models.py:40-50` shows ToolCallStatus
- **Risk:** Low — new optional field

### Long-Term Improvements (High Effort, Architectural)

**4. Graduate autonomy with confidence thresholds**
- **Current state:** Binary approval model — either requires approval or doesn't
- **Improvement:** Add optional `confidence_threshold` to `AgentToolDefinition`; when LLM confidence is above threshold, skip approval
- **Implementation:** Would require integrating with LLM provider's confidence scores or implementing a heuristic
- **Evidence:** No system studied implements this — it would be a novel contribution
- **Risk:** High — confidence scoring is unreliable in current models

**5. Per-workflow autonomy via Stageflow integration**
- **Current state:** `requires_approval` is hard-coded at tool definition time
- **Improvement:** Allow workflow stages to override tool-level autonomy settings (e.g., "in drafting stage, auto-approve entity edits under $1000")
- **Implementation:** Integrate autonomy configuration with the Stageflow workflow runtime
- **Evidence:** `hellosales/docs/architecture-philosophy.md:158` mentions approval boundaries as first-class concern
- **Risk:** Medium — requires Stageflow modification

**6. Session-scoped auto-approve**
- **Current state:** Auto-accept is not implemented; all approvals are manual
- **Improvement:** Allow users to set session-level auto-approve for specific tool patterns (e.g., "auto-approve all analytics queries in this session")
- **Implementation:** Similar to opencode's auto-accept pattern (`opencode/packages/app/src/context/permission.tsx:80`)
- **Evidence:** `opencode/packages/opencode/src/permission/index.ts:190-191` shows ask blocking via Deferred
- **Risk:** Medium — requires permission UI and persistence

**7. Observability for autonomy utilization**
- **Current state:** No metrics on approval rates, approval latency, or autonomy utilization
- **Improvement:** Emit metrics for: (a) approval required vs auto-approved tool calls, (b) approval latency (time from request to decision), (c) rejection rate by tool type
- **Implementation:** Add instrumentation to `agent_run_service.py` and `platform/agents/runtime.py`
- **Evidence:** `hellosales/src/hello_sales_backend/platform/agents/runtime.py:1188-1210` shows event stream already exists
- **Risk:** Low — leverages existing event infrastructure

### Risks (What Could Go Wrong If Not Addressed)

**Risk 1: Approval staleness leading to stale context execution**
- Scenario: User approves a tool call, then context changes (data modified, permissions revoked), but the approved call executes anyway hours later
- Current safeguard: None — `approval_timeout_seconds` is defined but not enforced
- Worst case: Approved analytics query executes against stale data, leading to wrong business decisions
- Mitigation: Enforce approval timeout (Quick Win #1)

**Risk 2: Generic agent approval fatigue**
- Scenario: All generic agent tool calls require approval; users approve reflexively without reviewing
- Current safeguard: None — approval is binary, no confidence-gating
- Worst case: Users become conditioned to approve, defeating the purpose of human-in-the-loop
- Mitigation: Graduate autonomy with confidence thresholds (Long-Term #4) or session-scoped auto-approve (Long-Term #6)

**Risk 3: Observer agent used as exfiltration channel**
- Scenario: Observer agent has no approval gates; if compromised, could exfiltrate data via its read-only tools
- Current safeguard: Permission checks (`platform/agents/tools.py:183-204`) restrict to authorized users
- Worst case: Authorized but malicious user invokes observer agent for data outside their normal access scope
- Mitigation: Add approval for observer agent tools that access sensitive runtime state

**Risk 4: No audit trail for approval decisions**
- Scenario: Compliance review requires knowing who approved what and when
- Current safeguard: SSE event stream exists but is not structured for compliance audit
- Worst case: Cannot satisfy compliance requirements for data access audit
- Mitigation: Add structured audit events for approval decisions (Quick Win #7 leverages existing event infrastructure)

---

Generated by protocol `study-areas/23-philosophy-of-autonomy.md`.