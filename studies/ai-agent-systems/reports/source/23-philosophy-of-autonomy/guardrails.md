# Repo Analysis: guardrails

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | guardrails |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/guardrails` |
| Language / Stack | Python |
| Analyzed | 2026-05-17 |

## Summary

Guardrails is a validation-focused framework that sits at **constrained autonomy** on the spectrum. It does not make autonomous decisions for the agent; rather, it provides structured validation, reasking mechanisms, and fail-action policies that constrain AI outputs. The human defines the schema and validation rules; the LLM generates; Guardrails validates and corrects within those bounds. Autonomy is zero by default for output quality — the system does not "trust the agent more than it should."

## Rating

**7/10** — Guardrails has a well-defined, configurable autonomy model with clear boundaries (schema validation, OnFailAction policies, reask budgets). It provides multiple safeguards, but it is not fully autonomous in any dimension — it is fundamentally a reactive validation layer rather than an agentic system.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| OnFailAction enum | Defines 8 fail actions: REASK, FIX, FILTER, REFRAIN, NOOP, EXCEPTION, FIX_REASK, CUSTOM | `guardrails/types/on_fail.py:24-31` |
| OnFailAction.get | Static method to resolve fail action from string or enum | `guardrails/types/on_fail.py:33-44` |
| Reask loop | Runner loops with `num_reasks` budget (default 1) | `guardrails/run/runner.py:168` |
| Reask termination | `do_loop` checks `attempt_number < num_reasks` to continue | `guardrails/run/runner.py:493-497` |
| Schema validation | JSON Schema validation before validator execution | `guardrails/schema/validator.py:92-113` |
| Validator run | Sequential validation with per-validator fail handling | `guardrails/validator_service/sequential_validator_service.py:315-401` |
| perform_correction | Dispatches to FIX, REASK, FILTER, REFRAIN, NOOP, EXCEPTION, CUSTOM based on on_fail_descriptor | `guardrails/validator_service/validator_service_base.py:73-120` |
| Stream validation restrictions | REASK, FIX, FIX_REASK, FILTER, REFRAIN not supported for streaming | `guardrails/validator_service/sequential_validator_service.py:330-354` |
| Guard.configure | `num_reasks` configurable via `configure()` | `guardrails/guard.py:198-217` |
| Guard.__call__ | `num_reasks` defaults to 1, passed to execution | `guardrails/guard.py:685` |
| ValidationOutcome | Stores raw LLM output, validated output, pass/fail status | `guardrails/classes/validation_outcome.py` |
| GuardExecutionOptions | Stores messages, reask_messages, num_reasks for execution | `guardrails/classes/execution/guard_execution_options.py:5-9` |
| No LLM trust | Guard never assumes LLM output is correct without validation | `guardrails/run/runner.py:454-480` |
| Prompt validation | Input validation on messages before LLM call | `guardrails/run/runner.py:287-326` |
| Metadata requirements | Validators can require metadata keys, verified before execution | `guardrails/guard.py:509-514` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Constrained autonomy — bounded choices.** Guardrails does not make open-ended decisions. It validates LLM output against pre-defined schemas and validators, and applies pre-defined fail actions. The LLM's output is only accepted if it passes validation. The system does not "decide" anything autonomously — it enforces constraints.

Evidence: `guardrails/run/runner.py:265-276` — output is only accepted after validation; `guardrails/types/on_fail.py:24-31` — OnFailAction enum defines all possible responses to failure.

### 2. Is autonomy configurable per workflow or agent?

**Partially configurable.** The `Guard` instance is created per workflow, with per-instance configuration for `num_reasks`, validators, and `OnFailAction` policies. However, the autonomy model itself (the fact that validation always happens, and output is always checked) is not configurable — it is baked in.

Evidence: `guardrails/guard.py:834-856` — `Guard.use()` applies validators to specific properties with specific OnFailAction per validator; `guardrails/guard.py:198-217` — `Guard.configure()` sets `num_reasks`.

### 3. What decisions are reserved for humans?

- **Schema definition** — the output structure is defined by the human (via Pydantic, JSON Schema, or `.rail` files).
- **Validator selection** — which validators to apply, on which fields.
- **OnFailAction policy** — human chooses what happens on failure: REASK, EXCEPTION, FILTER, REFRAIN, FIX, NOOP, or CUSTOM.
- **Reask budget** — human sets `num_reasks` to control how many reasking cycles occur.
- **Metadata requirements** — validators can require metadata that only a human can provide.

Evidence: `guardrails/guard.py:383-438` — `Guard.for_pydantic()`, `Guard.for_rail()`, `Guard.for_string()` all require human-provided schema/validators; `guardrails/guard.py:509-514` — metadata requirements checked at runtime.

### 4. What is the default when AI confidence is low?

Guardrails does not have an AI confidence concept. The system treats all LLM outputs as untrusted until validation passes. If validation fails:

1. If `on_fail=EXCEPTION`: raise immediately.
2. If `on_fail=REASK`: reask the LLM with the error context (up to `num_reasks` times).
3. If `on_fail=FIX`: attempt a static fix (no LLM involved).
4. If `on_fail=FILTER`: remove the invalid value.
5. If `on_fail=REFRAIN`: return empty.
6. If `on_fail=CUSTOM`: invoke human-provided callback.

There is no "low confidence" fallback to human escalation — the human defines the policy upfront.

Evidence: `guardrails/validator_service/validator_service_base.py:73-120` — `perform_correction()` dispatches based on `on_fail_descriptor`; `guardrails/run/runner.py:181` — loop breaks only when validation passes or reask budget exhausted.

### 5. How is appropriate autonomy level determined?

Not applicable — Guardrails is not an agentic system. It does not determine autonomy levels; it enforces human-defined constraints. The autonomy is entirely determined by the human's configuration at setup time.

Evidence: No evidence of dynamic autonomy level determination — all behavior is configured upfront.

### 6. What safeguards exist against autonomous mistakes?

- **Schema enforcement** — output must match JSON Schema before any validator runs (`guardrails/schema/validator.py:92-113`).
- **Validator-level fail actions** — each validator has its own `on_fail` policy (`guardrails/types/on_fail.py:24-31`).
- **Reask budget** — `num_reasks` caps the number of self-correction attempts (`guardrails/run/runner.py:168`).
- **Streaming restrictions** — dangerous fail actions (REASK, FIX, FILTER, REFRAIN) are prohibited in streaming mode (`guardrails/validator_service/sequential_validator_service.py:330-354`).
- **Required metadata** — validators can declare required metadata, preventing execution without it (`guardrails/guard.py:509-514`).
- **No-op default** — `OnFailAction.NOOP` exists but must be explicitly chosen.

Evidence: `guardrails/schema/validator.py:92-113` — skeleton validation before validator execution; `guardrails/validator_service/sequential_validator_service.py:330-354` — stream guard restrictions.

### 7. How does the system handle edge cases?

- **Non-parseable JSON**: `NonParseableReAsk` triggers a reask prompt that includes the raw non-parseable output (`guardrails/actions/reask.py:43-65`, `guardrails/actions/reask.py:318-332`).
- **Schema mismatch**: `SkeletonReAsk` triggers a reask with the full invalid JSON (`guardrails/actions/reask.py:33-40`, `guardrails/actions/reask.py:333-358`).
- **Partial failures**: `FieldReAsk` allows selective reasking of only failed fields (`guardrails/actions/reask.py:19-30`, `guardrails/actions/reask.py:361-391`).
- **Streaming edge cases**: `remainder` flag used when LLM doesn't signal end-of-chunk (`guardrails/validator_base.py:307-309`).

Evidence: `guardrails/actions/reask.py:304-392` — reask prompt selection logic based on reask type; `guardrails/schema/validator.py:92-113` — SkeletonReAsk returned on schema validation failure.

### 8. What is the philosophy: "AI-first" or "human-first"?

**Human-first, with heavy constraint.** Guardrails assumes the LLM is untrustworthy by default. Every output must be validated against human-defined constraints. The human defines what correct looks like; the system enforces it. The system never "decides" to trust the LLM — it only checks whether the output fits the pre-approved mold.

The closest to AI-first behavior is the reask mechanism, where the LLM gets a chance to self-correct. But even this is human-configured (budget, prompt, instructions), and the LLM does not choose when to reask — it only responds when asked.

## Architectural Decisions

1. **Validation-before-acceptance**: Output is never trusted without passing schema + validator checks. This is core to the architecture — `Runner.step()` calls `validate()` before accepting output.
2. **OnFailAction as first-class policy**: Every validator has a declared `on_fail` policy, not just a pass/fail boolean. This makes the autonomy boundary explicit per-validator.
3. **Reask as loop, not recursion**: The reasking pattern is implemented as an explicit iteration loop with a budget cap, not recursion or exception-based control flow.
4. **No implicit trust**: There is no confidence threshold, no "probably correct" state, no partial acceptance. Either validation passes or a defined fail action triggers.
5. **Streaming has reduced autonomy**: Streaming mode strips away REASK, FIX, FILTER, REFRAIN fail actions because they require look-ahead that streaming doesn't have. This is a deliberate safety constraint.

## Notable Patterns

1. **Validator registration via decorator** (`@register_validator`) — validators are discovered and registered by name, supporting the Hub model.
2. **Context-var based chunk accumulation** — streaming validators accumulate text chunks using context variables for cross-iteration state (`validator_base.py:266-341`).
3. **Deep-first validation** — validators recurse into nested structures before applying validators to parent values (`sequential_validator_service.py:428-470`).
4. **Reask prompt templating** — reasking uses a separate prompt template with error messages and schema context, not the original prompt.
5. **Per-property validator maps** — validators are registered against JSONPath-like property paths, allowing fine-grained application.

## Tradeoffs

1. **Safety vs. flexibility**: The strict validation-first model means Guardrails cannot handle "best effort" output. If the LLM produces non-compliant output and the fail action is NOOP, the system still returns non-compliant output — there is no graceful degradation.
2. **Reask budget as blunt instrument**: `num_reasks` is a single global budget. There is no per-field budget, no per-error-type budget, no adaptive budget based on error severity.
3. **No confidence-based routing**: Guardrails makes no attempt to assess "how confident" the LLM is. A low-confidence output that happens to pass validation is treated identically to a high-confidence one.
4. **Streaming constraints are conservative**: The elimination of REASK/FIX/FILTER/REFRAIN in streaming mode is safe but limits the system's ability to self-correct in streaming scenarios.
5. **No human-in-the-loop escalation path**: There is no built-in mechanism to route to a human when the system fails. The human must pre-configure the fail action policy.

## Failure Modes / Edge Cases

1. **Malformed JSON that passes schema but fails validators**: JSON Schema validation passes (the structure is valid), but semantic validation fails (e.g., a number is out of range). The system handles this correctly via the reask loop.
2. **All reasks exhausted**: If `num_reasks` is exhausted and validation still fails, the loop terminates. The final output may be a `ReAsk` object, `Filter`, `Refrain`, or whatever the last `on_fail` action produced. No exception is raised unless `on_fail=EXCEPTION`.
3. **Validator requires missing metadata**: If a validator declares `required_metadata_keys` and the metadata doesn't provide them, `Guard.__call__` raises a `ValueError` before any LLM call (`guardrails/guard.py:509-514`).
4. **Conflicting validators on same path**: The system applies validators in registration order. If two validators conflict, the later one "wins" — there is no conflict resolution.
5. **No LLM API provided**: `Runner.call()` raises `ValueError("API or output must be provided.")` — the system does not attempt to proceed without an API.
6. **Reask prompt injection**: Reask prompts include the original user prompt, LLM output, and error messages. The system does not sanitize these for injection risks.

## Future Considerations

1. **Per-field reask budgets**: Currently `num_reasks` is global. Per-field budgets would allow finer-grained self-correction.
2. **Adaptive reask based on error type**: Currently all errors trigger the same reask prompt strategy. Differentiating between "malformed JSON" and "value out of range" could improve reask quality.
3. **Human escalation action**: An `on_fail=HUMAN_ESCALATE` action that suspends execution and routes to a human reviewer would address the current gap in escalation.
4. **Streaming REASK**: The streaming restrictions on REASK/FIX/FILTER/REFRAIN are conservative. A more sophisticated streaming-aware reask mechanism could be developed.
5. **Validator provenance**: Currently validators are assumed to be correct. A mechanism to audit/inspect validator behavior would improve debuggability.

## Questions / Gaps

1. **How does the system determine if autonomy is appropriate for a given workflow?** — No evidence. Autonomy level is entirely human-configured, not system-determined.
2. **Is there any mechanism for the system to request additional permissions before taking an action?** — No evidence. The system acts within its configured bounds or halts.
3. **How does Guardrails handle cases where multiple validators disagree?** — Validators are applied sequentially; no voting or consensus mechanism.
4. **Is there any telemetry or audit trail for autonomous decisions (reasks, fixes)?** — Telemetry exists for tracing but not specifically for autonomy decision auditing.
5. **No evidence found** for any dynamic autonomy routing, confidence-based paths, or runtime permission escalation. Guardrails is a deterministic constraint enforcement system.

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `guardrails`.