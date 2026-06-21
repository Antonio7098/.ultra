# Repo Analysis: openai-agents-python

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | openai-agents-python |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/openai-agents-python` |
| Language / Stack | Python / OpenAI Agents SDK |
| Analyzed | 2026-05-17 |

## Summary

The openai-agents-python SDK implements a layered autonomy model. The system defaults to **guided autonomy**: agents execute tool calls and handoffs deterministically unless an approval requirement is triggered. Human oversight is enforced through explicit per-tool approval gates and input/output guardrails. The system sits toward the **configurable constrained autonomy** end of the spectrum — autonomy is tunable per-tool and per-agent, with clear escalation points, but the default behavior trusts the agent to execute non-sensitive tools without intervention.

## Rating

**7/10** — Configurable autonomy with clear boundaries and safeguards. The SDK provides rich approval mechanisms (per-tool `needs_approval`, callable approval predicates, sticky rejections), guardrails (input/output), and a full HITL pause/resume flow via serialized `RunState`. Autonomy is configurable per workflow via `handoffs`, tool-level `needs_approval`, and `RunConfig` settings. However, there is no explicit AI confidence-lowering mechanism; the system does not have a built-in "pause when uncertain" policy.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Tool approval mechanism | `needs_approval` field on `FunctionTool`, `ShellTool`, `ApplyPatchTool`, `ComputerTool`, and `CustomTool` — accepts `bool` or `Callable[..., bool]` | `src/agents/tool.py:328-337`, `src/agents/tool.py:505`, `src/agents/tool.py:1107-1115` |
| Approval evaluation helper | `evaluate_needs_approval_setting()` resolves bool/callable to bool | `src/agents/util/_approvals.py:13-30` |
| Per-tool approval predicates | Dynamic approval functions receive `context, params, call_id` — example `_needs_temperature_approval` checks params | `examples/agent_patterns/human_in_the_loop.py:31-34` |
| Approval record tracking | `_ApprovalRecord` stores `approved`, `rejected`, `rejection_messages`, `sticky_rejection_message` | `src/agents/run_context.py:29-39` |
| Approval/rejection API | `RunContextWrapper.approve_tool()`, `reject_tool()` with `always_approve`/`always_reject` flag and rejection message | `src/agents/run_context.py:346-366` |
| HITL interruption | `ToolApprovalItem` emitted as `NextStepInterruption`; run suspends until `state.approve()` or `state.reject()` called | `src/agents/run_state.py:322-329`, `src/agents/run_state.py:331-356` |
| Input guardrails | `InputGuardrail` runs before agent starts; tripwire halts execution | `src/agents/guardrail.py:72-130` |
| Output guardrails | `OutputGuardrail` runs on final output; tripwire halts execution | `src/agents/guardrail.py:134-185` |
| Tool input guardrails | `ToolInputGuardrail`, `ToolOutputGuardrail` per-tool guards | `src/agents/tool_guardrails.py` |
| Handoff autonomy | `Handoff` objects with `on_invoke_handoff` callable; handoff is deterministic tool call | `src/agents/handoffs/__init__.py:93-166` |
| `is_enabled` guard on handoffs | `Handoff.is_enabled` accepts `bool` or `Callable` to dynamically disable handoff | `src/agents/handoffs/__init__.py:153-161` |
| `is_enabled` guard on tools | `FunctionTool.is_enabled` accepts `bool` or `Callable` | `src/agents/agent.py:250-260` |
| Run loop max turns | `DEFAULT_MAX_TURNS = 10`; configurable per `Runner.run()` call | `src/agents/run_config.py:33`, `src/agents/run.py:203` |
| Error handler for max turns | `RunErrorHandlers` keyed by `kind: Literal["max_turns"]` — allows graceful handling vs raising | `src/agents/run_config.py:300-303`, `src/agents/run_error_handlers.py` |
| RunState serialization | Full pause/resume boundary for HITL flows; encodes approvals, context, step state | `src/agents/run_state.py:184-320` |
| MaxTurnsExceeded exception | Raised and optionally handled; preserves run state for resumption | `src/agents/run.py:1055-1070` |
| InputGuardrailTripwireTriggered | Exception type for guardrail tripwire; caught and optionally handled | `src/agents/run.py:779-790` |
| `tool_use_behavior` control | Agent-level `tool_use_behavior`: `"run_llm_again"`, `"stop_on_first_tool"`, `StopAtTools`, or custom callable | `src/agents/agent.py:345-365` |
| Agent as tool callable | `Agent.as_tool()` exposes agent as tool with `needs_approval`, `on_stream`, `is_enabled` | `src/agents/agent.py:508-936` |
| Approval auto-handler | `ShellApprovalFunction`, `ApplyPatchApprovalFunction`, `CustomToolApprovalFunction` for auto-approve/reject | `src/agents/tool.py:772-831` |
| `max_turns` nullable | `max_turns` can be set to `None` to disable the limit | `src/agents/run_config.py:330-331` |
| Agent hooks (lifecycle) | `on_start`, `on_end` hooks for agent lifecycle events | `src/agents/lifecycle.py` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Constrained-to-guided autonomy** with default lean toward AI execution. The system defaults to running tools without human approval. Human oversight is opt-in per-tool via `needs_approval` or opt-in globally via guardrails. The system does not have a built-in "pause on low confidence" mechanism. The autonomy posture is better characterized as **"human-defined boundaries, AI within them"** rather than "AI-first with human override."

Evidence: `FunctionTool.needs_approval` defaults to `False` (`src/agents/tool.py:328`). Agent run loops execute tool calls in sequence until final output with no mandatory human gate (`src/agents/run.py:215-221`).

### 2. Is autonomy configurable per workflow or agent?

**Yes, at multiple levels:**

- **Per-tool**: `FunctionTool(needs_approval=bool_or_callable)` — `src/agents/tool.py:328`
- **Per-agent**: `Agent(input_guardrails, output_guardrails)` — `src/agents/agent.py:322-329`
- **Per-handoff**: `Handoff(is_enabled=bool_or_callable)` — `src/agents/handoffs/__init__.py:153`
- **Global per-run**: `RunConfig(input_guardrails, output_guardrails, max_turns)` — `src/agents/run_config.py:242-246`, `src/agents/run_config.py:330`
- **Per-tool-type**: `ShellTool`, `ComputerTool`, `ApplyPatchTool` each have `needs_approval` and `on_approval` handlers — `src/agents/tool.py:1107-1183`

### 3. What decisions are reserved for humans?

- **Tool execution on sensitive operations**: Shell commands, file modifications, apply_patch operations default to higher-sensitivity handling; human can require approval per-call or permanently.
- **Guardrail tripwire triggers**: When `InputGuardrailResult.tripwire_triggered` or `OutputGuardrailResult.tripwire_triggered` is `True`, execution halts and raises `InputGuardrailTripwireTriggered` or `OutputGuardrailTripwireTriggered`.
- **Max turns exceeded**: Configurable via `RunErrorHandlers` — human can define fallback behavior.
- **Rejection messages**: Humans can supply rejection messages that are fed back to the model (`src/agents/run_state.py:337-356`).
- **Workflow branching at handoffs**: While handoffs are tool calls, the handoff target and `input_filter` are controlled by human-authored code.

### 4. What is the default when AI confidence is low?

**No explicit mechanism.** The SDK has no confidence scoring, uncertainty signals, or adaptive pausing based on model confidence. There is no evidence of a `confidence_threshold`, `uncertainty_handler`, or similar pattern in the codebase. If the model produces a tool call, it executes unless blocked by guardrails or approvals.

### 5. How is appropriate autonomy level determined?

Through **developer configuration** at coding time:

- Tool authors set `needs_approval` on tools based on their risk assessment.
- Application authors set `input_guardrails`/`output_guardrails` on agents based on use case.
- `Handoff.is_enabled` callable allows context-dependent handoff enabling.

The system does not self-assess or auto-tune autonomy levels based on runtime behavior.

### 6. What safeguards exist against autonomous mistakes?

1. **Per-tool approval gates** (`needs_approval`) — `src/agents/tool.py:328`
2. **Approval predicates** (`Callable` for conditional approval) — `src/agents/util/_approvals.py:13-30`
3. **Tool input/output guardrails** — `src/agents/tool_guardrails.py:170-199`
4. **Input guardrails** (run before agent starts, optionally blocking) — `src/agents/guardrail.py:72-130`
5. **Output guardrails** (run on final output, optionally blocking) — `src/agents/guardrail.py:134-185`
6. **Max turns limit** (default 10) — `src/agents/run_config.py:33`
7. **Rejection messages** fed back to model — `src/agents/run_state.py:347-349`
8. **Always-approve/always-reject** for sticky permissions — `src/agents/run_context.py:346-366`
9. **HITL pause/resume via RunState** — `src/agents/run_state.py:184-320`

### 7. How does the system handle edge cases?

- **No model response in interrupted state**: Raises `UserError("No model response found in previous state")` — `src/agents/run.py:836`
- **Interrupted turn continuation**: Uses `resolve_interrupted_turn()` with `NextStepInterruption` type — `src/agents/run.py:830-935`
- **Empty tool result**: `ToolCallOutputItem` with empty string output — handled in `run_item_to_input_item` — `src/agents/run_internal/items.py`
- **Schema version mismatch on deserialization**: Forward-compatibility is fail-fast; older SDKs reject newer versions — `src/agents/run_state.py:129`
- **Missing context serializer**: Warns and falls back to empty dict — `src/agents/run_state.py:522-527`
- **Duplicate Codex tool names**: Raises `UserError` — `src/agents/agent.py:95-118`
- **MCP server lifecycle**: Developer must call `server.connect()` and `server.cleanup()` — `src/agents/agent.py:193-196`

### 8. What is the philosophy: "AI-first" or "human-first"?

**Neither pure AI-first nor human-first; the philosophy is "developer-defined boundaries with AI execution within them."**

The SDK is architected for developers to define the trust boundary explicitly. The default is permissive (AI executes tools freely), but the system provides comprehensive controls to lock down any boundary. The framing is closer to **"human-first for sensitive operations, AI-first for routine operations"** — but the human must actively configure those boundaries rather than the system defaulting to conservative posture.

## Architectural Decisions

- **HITL via RunState serialization**: The system uses a durable `RunState` snapshot as the pause/resume boundary, not a live in-process continuation. This is a deliberate design that supports cross-process, cross-machine resumption of agent runs. Evidence: `src/agents/run_state.py:184-196`
- **Approval is per-call, not global**: Each tool invocation that has `needs_approval=True` creates an individual `ToolApprovalItem` interruption. Approval records can be scoped to specific `call_id`s or be sticky (all future calls). Evidence: `src/agents/run_context.py:29-39`
- **Handoffs are tool calls, not magic**: Handoffs are modeled as tools with an `on_invoke_handoff` callable. This is a deliberate design choice — handoffs follow the same tool call flow so they benefit from the same approval/guardrail machinery. Evidence: `src/agents/handoffs/__init__.py:93-166`
- **Guardrails run in parallel by default**: Input guardrails with `run_in_parallel=True` run concurrently with agent execution (not blocking). Only non-parallel guardrails block before agent starts. Evidence: `src/agents/guardrail.py:100-103`
- **`tool_use_behavior` as agent-level policy**: Instead of a global setting, each `Agent` defines its own tool-use termination policy, including custom callables for final-output detection. Evidence: `src/agents/agent.py:345-365`
- **No built-in confidence mechanism**: The SDK deliberately does not expose model confidence scores. The assumption is that tool-level approval gates are sufficient for sensitive operations. Evidence: grep for "confidence" returned no results.

## Notable Patterns

- **Approval predicates**: Tools can specify `needs_approval` as a callable `(context, params, call_id) -> bool`, enabling conditional approval based on parameter values. Example: only require approval for "Oakland" weather queries (`examples/agent_patterns/human_in_the_loop.py:31-34`).
- **Sticky approvals/rejections**: Using `always_approve=True` or `always_reject=True` makes the decision permanent for the run, avoiding repeated interruptions for the same tool. Evidence: `src/agents/run_context.py:346-366`
- **Tool-level guardrails**: Each tool can have `tool_input_guardrails` and `tool_output_guardrails` that wrap the tool invocation, separate from agent-level guardrails. Evidence: `src/agents/tool.py:321-326`
- **Forked context for nested agent-as-tool**: When an agent is invoked as a tool (`Agent.as_tool()`), a fresh `ToolContext` is created to isolate approval state between parent and nested runs. Evidence: `src/agents/agent.py:631-644`
- **`is_enabled` callable for dynamic enable/disable**: Both tools and handoffs support `Callable` enable functions that are evaluated at runtime, enabling context-sensitive autonomy. Evidence: `src/agents/agent.py:250-260`

## Tradeoffs

- **HITL reliability vs. simplicity**: The serialized `RunState` approach is robust and supports cross-process resumption, but requires the developer to manage the serialization/deserialization loop manually (as shown in `examples/agent_patterns/human_in_the_loop.py:86-128`).
- **Approval granularity vs. boilerplate**: Per-call approval with `call_id` scoping is precise but requires careful key management. The fallback to tool-name-level approval when `call_id` is absent can lead to over-approvals. Evidence: `src/agents/run_context.py:312-338`
- **Guardrail parallelism vs. latency**: Parallel guardrails (`run_in_parallel=True`) run concurrently with the agent, but this means a tripwire may trigger after the agent has already started emitting items. Non-parallel guardrails block, adding latency but ensuring the agent does not proceed if the guardrail fails. Evidence: `src/agents/guardrail.py:100-103`, `src/agents/run.py:768-792`
- **No confidence-based fallback**: The absence of a built-in confidence mechanism means developers must implement their own "is the model sure enough?" logic outside the SDK, typically as an input guardrail.
- **max_turns as blunt instrument**: The turn limit (`DEFAULT_MAX_TURNS = 10`) is a coarse safeguard. It cannot distinguish between productive and unproductive turns, so a looping agent can exhaust turns doing repetitive work.

## Failure Modes / Edge Cases

1. **Resumed state with stale approvals**: If a `RunState` is deserialized in a different process and the human approves tools there, the original process cannot receive those approvals unless the state is re-serialized and passed back. The system supports this via `to_json()`/`from_json()` but requires developer orchestration.
2. **Approving after turns exhausted**: If `max_turns` is hit before approvals are processed, the run raises `MaxTurnsExceeded` and the error handler must decide whether to continue. Evidence: `src/agents/run.py:1047-1070`
3. **Guardrail tripwire on first turn only**: Input guardrails only run on the first turn of the starting agent. A resumed interrupted run does not re-run input guardrails even if the resumption point was pre-guardrail. Evidence: `src/agents/run.py:759-763`
4. **Sticky rejection without message**: If `state.reject(interruption)` is called without a `rejection_message`, the model receives the default tool error message. Evidence: `src/agents/run_state.py:337-356`
5. **Approval predicate raising exception**: If a `needs_approval` callable raises, the error propagates and the tool call fails — there is no fallback to requiring human approval in that case.
6. **`nest_handoff_history` disabled for server-managed conversations**: When `conversation_id`, `previous_response_id`, or `auto_previous_response_id` is set, `nest_handoff_history` is automatically disabled with a warning. Evidence: `src/agents/run_config.py:229-233`

## Future Considerations

- **Confidence-based autonomy**: A built-in mechanism to pause when model confidence is below a threshold would fill the current gap identified in question 4.
- **Per-turn rather than per-tool approval scoping**: Currently approvals can be per-call (granular) or tool-wide (coarse). A mid-grained "per-conversation-segment" scope could reduce repetitive approvals for related operations.
- **Visibility into nested agent approvals**: When an agent-as-tool runs a nested agent that itself has `needs_approval` tools, the outer context's approval records are mirrored into the nested run (`_apply_nested_approvals`), but this mirroring is implicit. Making it more explicit could help debugging.
- **Built-in escalation policy**: Rather than requiring developers to implement `RunErrorHandlers` manually for every escalation scenario, a higher-level escalation API could simplify common patterns.

## Questions / Gaps

1. **No evidence of AI confidence handling**: Despite searching for "confidence", "low confidence", "uncertain" patterns, no confidence-based mechanism was found. This is a deliberate design choice but worth noting as a gap relative to more conservative autonomy models.
2. **No evidence of automatic safety rollback**: There is no mechanism that automatically rolls back agent state if a tool fails beyond a threshold. Retries are per-tool (`retry.py`) but there is no "abort run after N failures" global policy.
3. **Approval record key resolution complexity**: The `_resolve_approval_key` / `_resolve_approval_keys` logic in `RunContextWrapper` handles multiple lookup strategies (bare name, namespace, lookup key, legacy aliases). This complexity is a consequence of supporting diverse tool types but makes the approval model harder to reason about.
4. **Input guardrails run_in_parallel semantics**: When `run_in_parallel=True`, a tripwire triggers after some agent-side progress has been made. The behavior in this case (session items already saved, turn counter incremented) means guardrail tripwires are not true "before" gates. Evidence: `src/agents/run.py:769-792`
5. **Tool input guardrails blocking behavior**: Unlike input/output agent guardrails (which can halt via tripwire), tool input guardrails run inline with tool execution and do not appear to support halting the run. They return `ToolInputGuardrailResult` but the run continues regardless. Evidence: `src/agents/tool_guardrails.py:170-199`

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `openai-agents-python`.