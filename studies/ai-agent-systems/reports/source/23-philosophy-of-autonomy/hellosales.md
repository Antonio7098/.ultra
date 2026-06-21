# Repo Analysis: hellosales

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | hellosales |
| Path | `repos/hellosales` |
| Language / Stack | Python 3.12, FastAPI, SQLAlchemy, Pydantic, Stageflow |
| Analyzed | 2026-05-17 |

## Summary

HelloSales implements a **constrained autonomy / guided autonomy hybrid** model. The system has two agent profiles (generic agent and observer agent), each with a distinct tool catalog. Write operations (create/edit entities) and governed SQL analytics queries **always** require human approval. Web search approval is configurable per deployment. The observer agent's read-only tools execute autonomously without approval gates. The autonomy model is hard-coded at the tool-definition level rather than configured per workflow, with clear boundaries between what the agent can decide independently and what requires a human decision.

## Rating

**7/10** — Configurable autonomy with clear boundaries and safeguards. The tool-level `requires_approval` flag provides a crisp binary model. Write operations always gate on human approval. The observer agent runs fully autonomously. Per-tool permission checks (RBAC via `required_permissions`) add a second access control layer. However, autonomy is not configurable per workflow within an agent (it's hard-coded at tool definition time), and there is no graduated autonomy — the model is binary (approval required or not) with no intermediate levels (e.g., auto-approve under thresholds, human-in-the-loop sampling).

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Agent definition split | Two agent profiles with different tool catalogs and autonomy profiles | `src/hello_sales_backend/application/agents/bootstrap.py:33-42` |
| Generic agent tools | 4 tools: query_analytics_data (requires_approval=True), create_entity (True), edit_entity (True), search_web (configurable) | `src/hello_sales_backend/application/agents/definitions/generic_agent/tools.py:31-39` |
| Observer agent tools | 3 tools: get_runtime_status, list_recent_tasks, get_task — none require approval | `src/hello_sales_backend/application/agents/definitions/observer_agent/tools.py:22-27` |
| Tool-level approval flag | `requires_approval: bool = False` on AgentToolDefinition | `src/hello_sales_backend/platform/agents/tools.py:91` |
| Approval state machine | ToolCallStatus has QUEUED → PENDING_APPROVAL → APPROVED/REJECTED → RUNNING → COMPLETED/FAILED | `src/hello_sales_backend/platform/agents/models.py:40-50` |
| Approval pause mechanism | When tool requires approval, status is set to PENDING_APPROVAL, turn pauses | `src/hello_sales_backend/platform/agents/runtime.py:631-635` |
| Approval resume | When approved, turn status reset to PENDING and rescheduled | `src/hello_sales_backend/modules/agent_runs/use_cases/agent_run_service.py:270-281` |
| Approval rejection | When rejected, turn completed with canned rejection message | `src/hello_sales_backend/modules/agent_runs/use_cases/agent_run_service.py:283-290` |
| Web search approval configurable | `settings.web_search_requires_approval` controls whether search_web needs approval | `src/hello_sales_backend/platform/config/settings.py:79` |
| Approval timeout config | `approval_timeout_seconds: int = 3600` (1 hour) | `src/hello_sales_backend/platform/agents/config.py:13` |
| Hard-coded write approval | create_entity and edit_entity have `requires_approval=True` hard-coded | `src/hello_sales_backend/application/tools/entity_operations.py:77,104` |
| Hard-coded analytics approval | query_analytics_data has `requires_approval=True` hard-coded | `src/hello_sales_backend/application/tools/analytics_query.py:58` |
| Deterministic fallback | When LLM provider is unconfigured, returns hard-coded fallback response | `src/hello_sales_backend/platform/agents/runtime.py:247-253` |
| Permission-based access | Each tool specifies `required_permissions`, checked at execution time | `src/hello_sales_backend/platform/agents/tools.py:183-204` |
| Run access control | Run can only be modified by owning actor or users with SESSIONS_WRITE_ANY | `src/hello_sales_backend/modules/agent_runs/use_cases/agent_run_service.py:309-327` |
| Retry budgets | max_tool_iterations=8, max_llm_completion_retries=2, max_tool_execution_retries=2 | `src/hello_sales_backend/platform/agents/config.py:15-17` |
| Orphaned run recovery | Detects runs stuck in RUNNING state without active background task | `src/hello_sales_backend/modules/agent_runs/use_cases/agent_run_service.py:432-476` |
| Observer agent prompt | Explicitly restricted to read-only tools | `src/hello_sales_backend/application/agents/definitions/observer_agent/prompts.py:26-28` |
| Generic agent prompt | Instructs agent to expect approval before write tools execute | `src/hello_sales_backend/application/agents/definitions/generic_agent/prompts.py:39` |
| Event stream auditing | Full SSE event stream for agent turns, tool calls, approval requests | `src/hello_sales_backend/entrypoints/http/routes/agent_runs.py:98-131` |
| Architecture philosophy doc | Explicitly lists "approval boundaries" as a first-class concern | `docs/architecture-philosophy.md:158` |

## Answers to Protocol Questions

**1. Where on the autonomy spectrum does the system sit?**

The system is a **constrained autonomy / guided autonomy hybrid** — between 4 (constrained autonomy) and 5 (guided autonomy with approval) on the protocol's spectrum. The observer agent runs fully autonomously (constrained autonomy — all decisions coded into read-only tools). The generic agent operates in guided autonomy mode: it proposes tool calls (analytics queries, entity mutations), but those proposals are paused for human approval before execution. The generic agent can generate text responses autonomously (no approval needed for the response itself), but any tool-mediated action gates on approval.

**2. Is autonomy configurable per workflow or agent?**

Yes, at the **agent level** — each agent definition (`AgentDefinition` in `application/agents/contracts.py:34`) has its own tool catalog with independent `requires_approval` settings. The generic agent (`application/agents/definitions/generic_agent/tools.py:31-39`) has approval-required tools for analytics, entity operations, and optionally web search. The observer agent (`application/agents/definitions/observer_agent/tools.py:22-27`) has no approval gates on any tool. However, autonomy is **not configurable per workflow within an agent** — the `requires_approval` flag is hard-coded at tool-definition time. The only runtime-configurable autonomy setting is `web_search_requires_approval` (`platform/config/settings.py:79`).

**3. What decisions are reserved for humans?**

Write operations (creating and editing semantic entities), governed analytics SQL queries, and optionally web search. Specifically:
- `create_entity` — always requires approval (`application/tools/entity_operations.py:77`)
- `edit_entity` — always requires approval (`application/tools/entity_operations.py:104`)
- `query_analytics_data` — always requires approval (`application/tools/analytics_query.py:58`)
- `search_web` — approval depends on `HELLO_SALES_WEB_SEARCH_REQUIRES_APPROVAL` env var (`platform/config/settings.py:79`), default false

The observer agent's read-only tools (get_runtime_status, list_recent_tasks, get_task) require no human approval.

**4. What is the default when AI confidence is low?**

When the LLM provider is not configured (API key missing or provider not set), the agent returns a hard-coded deterministic fallback response (`platform/agents/runtime.py:247-253`): *"LLM provider is not configured, so the dashboard analyst agent recorded the turn but could not use governed SQL tool calling for..."*

When the LLM returns an empty completion (no tool calls and no content), the system injects a retry-prompt message (`platform/agents/runtime.py:500-504`) telling the LLM to retry, and if the retry budget is exhausted, raises a structured error (`agent.provider.empty_completion`). When tool execution fails repeatedly (exceeding `max_tool_execution_retries=2` at `platform/agents/config.py:17`), the system injects a retry-budget-exhausted message (`platform/agents/runtime.py:944-961`) telling the LLM to stop calling tools and explain the limitation.

**5. How is appropriate autonomy level determined?**

Autonomy levels are **design-time decisions** encoded in tool definitions, not runtime decisions. Each tool's `requires_approval` flag is set during tool construction (`application/tools/analytics_query.py:58`, `application/tools/entity_operations.py:77,104`, `application/tools/web_search.py:73`). The design rationale:
- Write tools always require approval (data integrity boundary)
- Read analytics tools always require approval (data access governance)
- Web search approval is configurable (organizational policy decision)
- Observer tools never require approval (operational visibility only, can't cause damage)

The `AgentRuntimeConfig` (`platform/agents/config.py:8-17`) configures operational parameters (retries, timeouts, iterations) but not autonomy level per se. There is no mechanism for graduated autonomy (e.g., confidence thresholds that skip approval, or role-based autonomy levels).

**6. What safeguards exist against autonomous mistakes?**

Multiple layered safeguards:
- **Approval gates**: Write and analytics tools pause for human approval before execution (`platform/agents/runtime.py:631-635`)
- **Tool argument validation**: Every tool validates arguments through Pydantic models (`platform/agents/tools.py:101-115`), rejecting malformed inputs before execution
- **Permission checks**: Tools check actor permissions against `required_permissions` before execution (`platform/agents/tools.py:183-204`), with defined permission constants (`shared/auth.py:22-24`)
- **Retry budgets**: Hard limits on tool iterations (8), LLM retries (2), and tool execution retries (2) (`platform/agents/config.py:15-17`)
- **Orphaned run recovery**: Detects runs stuck in RUNNING without an active background task (`modules/agent_runs/use_cases/agent_run_service.py:432-476`)
- **Event auditing**: Every operation emits structured events persisted to the agent store and streamable via SSE (`platform/agents/runtime.py:1188-1210`)
- **Cancellation**: Runs in progress can be cancelled by the user (`modules/agent_runs/use_cases/agent_run_service.py:329-404`)
- **Provider schema validation**: Provider tool call names and arguments are validated against the registered tool definition (`platform/agents/runtime.py:605-624`, `platform/agents/tools.py:117-146`)
- **Approval timeout**: Configurable timeout of 3600s (`platform/agents/config.py:13`)

**7. How does the system handle edge cases?**

- **Orphaned turns**: Detects runs in RUNNING status without an active background task and marks them FAILED (`modules/agent_runs/use_cases/agent_run_service.py:432-476`)
- **Cancellation during tool execution**: Cancels queued/running/pending-approval tool calls, marks run and turn as CANCELLED (`platform/agents/runtime.py:1107-1134`)
- **Concurrent turn submission**: Prevents appending a new turn while the previous turn is RUNNING or AWAITING_APPROVAL, returning 409 Conflict (`modules/agent_runs/use_cases/agent_run_service.py:109-118`)
- **Approval on completed/expired run**: Returns 404 for unknown approval IDs (`modules/agent_runs/use_cases/agent_run_service.py:228-237`)
- **Provider argument schema violations**: Validates and rejects provider arguments against the tool's Pydantic schema, returning structured 502 errors (`platform/agents/runtime.py:727-735`)
- **Empty LLM completions**: Detects and retries with an injected prompt, exhausts retry budget with clear error (`platform/agents/runtime.py:485-565`)
- **Rejected tool access**: Provides tool result with rejected status and continues the turn (`platform/agents/runtime.py:694-700`)
- **LLM retry exhaustion**: After max retries, converts retryable errors to permanent 502 errors (`platform/agents/runtime.py:461-482`)

**8. What is the philosophy: "AI-first" or "human-first"?**

**Human-first.** The system explicitly places human approval between the agent's proposal and any action that affects data (analytics queries, entity mutations). The architecture philosophy document (`docs/architecture-philosophy.md:158`) lists "approval boundaries" as a first-class operational concern. The generic agent prompt (`application/agents/definitions/generic_agent/prompts.py:39`) tells the agent to "expect approval before write tools execute." The `AUDIT.md` review notes the system deliberately invests in operational visibility over product domain behavior (`AUDIT.md:152-163`).

The system is not "AI-first" in the sense of trusting the agent to act unilaterally. It is "human-first scaffold with agent augmentation" — the agent can propose, research, and draft responses autonomously, but anything with side effects requires a human decision. The observer agent is the exception (read-only, fully autonomous), which reinforces the philosophy: look but don't touch.

## Architectural Decisions

- **Tool-level approval as the autonomy primitive** (`platform/agents/tools.py:91`): Autonomy is expressed as a per-tool boolean flag rather than a workflow-level or role-based policy. This is simple and auditable but limits nuanced control (no graduated approval, no confidence thresholds).

- **Two distinct agent profiles** (`application/agents/bootstrap.py:33-42`): Separating the generic agent (write+read with approval) from the observer agent (read-only, no approval) encodes different trust levels at the agent identity level. This means autonomy is a function of which agent you invoke, not the context of the request.

- **Hard-coded write protection** (`application/tools/entity_operations.py:77,104`): Write tools always require approval regardless of settings. There is no mechanism to bypass this — it is a deliberate architectural invariant. This is a strong safety choice: data integrity cannot be configured away.

- **Configurable web search boundary** (`platform/config/settings.py:79`): Web search is the only tool with configurable approval. This reflects a design judgment that external data access is a policy decision (varies by deployment) while internal data access (analytics, entity operations) is always governed.

- **Background task execution** (`modules/agent_runs/use_cases/agent_run_service.py:406-416`): Agent turns run as background tasks, not in the HTTP request-response cycle. This means the human user submits a turn, gets an immediate response with the run status, and must poll/stream events to see the result. This is an operational decision that reinforces the human-in-the-loop pattern — the human is never blocked waiting for an agent decision.

## Notable Patterns

- **Binary approval model**: Every tool that requires approval uses the same pattern: `requires_approval=True` on `AgentToolDefinition` (`platform/agents/tools.py:91`), status transition to `PENDING_APPROVAL` (`platform/agents/runtime.py:631-635`), and separate HTTP endpoint for approval decisions (`entrypoints/http/routes/agent_runs.py:143-159`). No graduated or conditional approval exists.

- **Fallback chain**: LLM unavailable → deterministic fallback response. LLM returns empty → retry with injected prompt. Tool fails → retry with budget. All failure modes produce structured errors with codes, categories, and details — no silent failures.

- **Trust boundary at the tool, not the prompt**: Rather than instructing the agent via prompt not to do dangerous things, the system enforces boundaries at the tool execution layer. The prompt tells the agent to expect approval (`application/agents/definitions/generic_agent/prompts.py:39`), but the actual enforcement is in the tool-persistence layer (`platform/agents/runtime.py:631-635`). This is defense-in-depth.

- **Per-tool permission scoping**: Each tool specifies its own `required_permissions` (`platform/agents/tools.py:92`), and the tool catalog enforces permission checks before execution (`platform/agents/tools.py:183-204`). This means autonomy is further constrained by the actor's RBAC role — even if approval were granted, a user without `entity_operations.write` permission cannot create entities through the agent.

## Tradeoffs

- **Simple binary model vs. nuanced autonomy**: The `requires_approval` boolean is easy to reason about and audit but cannot express intermediate states (approve for 24 hours, approve only for certain entities, auto-approve below confidence threshold). This is a pragmatic tradeoff for a scaffold-stage backend but would limit more sophisticated agent workflows.

- **Tool-level vs. workflow-level autonomy**: Autonomy is attached to individual tools, not to workflows or stages. This means the system cannot express patterns like "approve the first mutation of a session, auto-approve subsequent ones" or "approve in production but not staging." The current model is simpler but less expressive.

- **Hard-coded approval for analytics**: `query_analytics_data` always requires approval (`application/tools/analytics_query.py:58`). For read-only queries against governed catalogs, this may be too conservative — it forces a human to approve every SQL query even when the user explicitly asked the agent to "run the query." The prompt instructs the agent to treat "run the query" as permission (`application/agents/definitions/generic_agent/prompts.py:51-52`), but the tool layer still requires approval, creating a tension between the prompt's intent and the tool's enforcement.

- **No default-autonomous except observer**: The generic agent cannot make any tool-aided decision without human approval (except generating text). If the goal is to offload repetitive analytical questions, this approval requirement may reduce the agent's utility. The alternative — allowing autonomous read queries with audit trails — would trade safety for efficiency.

- **Per-agent autonomy is not per-user**: The system has no mechanism to vary autonomy by user role, tenant, or deployment environment. The same agent profile behaves identically regardless of context. This is acceptable for a scaffold but would need RBAC-extended autonomy in production.

## Failure Modes / Edge Cases

- **Approval staleness**: There is no approval expiration enforced at the tool level. `AgentRuntimeConfig.approval_timeout_seconds` is defined (`platform/agents/config.py:13`) but not referenced in the tool execution path — approved tool calls resume regardless of how long approval took. An approval granted after hours could execute against stale context.

- **No negative autonomy**: The system has no mechanism for "the agent should decide NOT to do something." If approval is granted for a tool call that no longer makes sense (stale context), the tool executes anyway. There is no pre-flight check that re-validates the tool call's assumptions before execution.

- **Orphaned approval runs**: If a user rejects approval, the run is marked COMPLETED with a canned rejection message (`modules/agent_runs/use_cases/agent_run_service.py:283-290`). The user cannot resume the same run after rejection — they must start a new run. This means a single rejection ends a conversation, which may be frustrating in practice.

- **No bulk approval**: Each tool call generates a separate approval request. If the agent needs to make 3 tool calls (query analytics, create entity, search web), each requires a separate human approval decision. There is no mechanism to approve a batch or sequence of tool calls.

- **Approval race condition**: If a human approves a tool call and simultaneously the agent's turn is running (e.g., processing earlier tool results), the system does not appear to serialize approval decisions against active tool processing.

## Future Considerations

- **Graduated autonomy**: Adding confidence thresholds, auto-approve for low-risk tools, or role-based autonomy levels would make the system more efficient without reducing safety.

- **Workflow-level autonomy**: Integrating autonomy configuration with the Stageflow workflow runtime would allow autonomy to vary by workflow stage, not just by tool.

- **Approval expiration**: Enforcing the `approval_timeout_seconds` config value would prevent stale approvals from executing.

- **Session-scoped autonomy**: Allowing users to set an autonomy level for a session (e.g., "auto-approve all analytics queries in this session") would reduce friction for power users.

- **Rejection recovery**: Allowing a rejected turn to continue with a modified request (rather than terminating the run) would improve user experience.

- **Observability for autonomy**: Adding metrics for approval rates, approval latency, and autonomy utilization would help operators tune the autonomy model.

## Questions / Gaps

- No clear evidence found for how the `ApprovalDecisionCommand` (`modules/agent_runs/use_cases/commands.py:19-22`) enforces that only the run's owning actor can approve. The `_ensure_run_access` method (`modules/agent_runs/use_cases/agent_run_service.py:309-327`) is called for `decide_approval`, so access control exists — but approval delegation or co-approval patterns are not implemented.

- No clear evidence found for how the system handles the case where a turn is in `AWAITING_APPROVAL` status and the HTTP request submitting the turn times out. The SSE event stream (`entrypoints/http/routes/agent_runs.py:98-131`) solves the polling UX issue, but the recovery path for an orphaned awaiting-approval status is not explicitly handled (only RUNNING status is recovered in `_recover_orphaned_run`).

- No evidence found for approval notifications (the system does not appear to push notifications when a tool call is awaiting approval). The SSE stream provides the event, but external notification (email, Slack) is not implemented.

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `hellosales`.
