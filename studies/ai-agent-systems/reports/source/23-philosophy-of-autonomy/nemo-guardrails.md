# Repo Analysis: nemo-guardrails

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | nemo-guardrails |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/nemo-guardrails` |
| Language / Stack | Python |
| Analyzed | 2026-05-17 |

## Summary

nemo-guardrails implements a **guided autonomy** model where configurable "rails" intercept and validate content at trust boundaries (user input, LLM output, tool calls, retrieval). The system is primarily **deterministic** in its flow execution, with LLM generation being the main autonomous decision-maker. Rails provide **constrained autonomy** - they can allow, block, or transform content but do not implement human approval gates.

## Rating

**7/10** - Configurable autonomy with clear boundaries and safeguards. The system provides per-rail configuration, threshold-based decisions, and fail-open/fail-closed options for external API failures. However, lacks explicit human-in-the-loop approval mechanisms and per-workflow autonomy adjustment.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Input Rails | `run input rails` flow invokes configured input rails before user input processing | `nemoguardrails/colang/v2_x/library/guardrails.co:21` |
| Output Rails | `run output rails` flow invokes configured output rails before bot response | `nemoguardrails/colang/v2_x/library/guardrails.co:66` |
| Content Safety | `content safety check input` flow blocks disallowed content with `abort` | `nemoguardrails/library/content_safety/flows.co:9-19` |
| Jailbreak Detection | `jailbreak detection heuristics` flow detects and blocks jailbreak attempts | `nemoguardrails/library/jailbreak_detection/flows.co:6-13` |
| Fact Checking | `self check facts` flow blocks responses below 0.5 accuracy threshold | `nemoguardrails/library/self_check/facts/flows.co:13` |
| Fail Open Config | `fail_open` option controls behavior when AI Defense API fails | `nemoguardrails/library/ai_defense/actions.py:59` |
| Rail Config | `InputRails`, `OutputRails`, `RetrievalRails` configuration classes | `nemoguardrails/rails/llm/config.py:561-628` |
| Tool Output Rails | Tool output rails validate tool results before processing | `nemoguardrails/rails/llm/config.py:647-661` |
| Tool Input Rails | Tool input rails validate tool parameters before execution | `nemoguardrails/rails/llm/config.py:664-678` |
| Single Call Mode | `single_call` config for topical rails controls LLM call patterns | `nemoguardrails/rails/llm/config.py:681-688` |
| Passthrough Mode | `passthrough` mode allows bypassing tool call interception | `nemoguardrails/rails/llm/llmrails.py:375-380` |
| Colang Runtime | Event-driven state machine processes flows deterministically | `nemoguardrails/colang/v2_x/runtime/statemachine.py:244-399` |
| Flow Priority | Loop priority system resolves conflicting flow heads via matching scores | `nemoguardrails/colang/v2_x/runtime/statemachine.py:691-797` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Guided Autonomy / Constrained Autonomy** (score 4-6 range)

nemo-guardrails enforces strict boundaries through rails but trusts the LLM within those boundaries. The system:
- Trusts LLM to generate appropriate responses within rail constraints
- Uses deterministic flow execution for control logic
- Provides no mechanism for human approval during generation

Evidence: Rails check content but do not wait for human confirmation (`nemoguardrails/colang/v2_x/library/guardrails.co:21,66`). The `_bot_say` flow outputs directly after rails pass.

### 2. Is autonomy configurable per workflow or agent?

**Partially configurable** (per-rail, not per-workflow)

Configuration is at the rail level, not the workflow level:
- Input/output/retrieval rails are configured per rails configuration
- Tool input/output rails are configured separately
- Single call mode can be enabled/disabled for dialog rails
- Passthrough mode can bypass tool call interception entirely

Evidence: `RailsConfig` class with separate `InputRails`, `OutputRails`, `RetrievalRails`, `ToolInputRails`, `ToolOutputRails` configuration objects (`nemoguardrails/rails/llm/config.py:561-678`).

### 3. What decisions are reserved for humans?

**No explicit human-reserved decisions found**

The system does not implement human-in-the-loop approval mechanisms. All decisions are:
- Automated through rails (deterministic)
- Delegated to LLM generation (autonomous within rails)
- Controlled by threshold configurations

No evidence of approval gates, confirmation dialogs, or human override mechanisms in the core codebase.

### 4. What is the default when AI confidence is low?

**Depends on the specific rail implementation**

For fact-checking:
- Threshold is 0.5 accuracy - below this, content is blocked
- Configurable via `$check_facts` context variable

Evidence: `nemoguardrails/library/self_check/facts/flows.co:13` - `if $accuracy < 0.5`

For external API-based rails (AI Defense):
- Default is **fail closed** (`fail_open=False`)
- When API fails or returns malformed response, content is blocked

Evidence: `nemoguardrails/library/ai_defense/actions.py:59,109-122`

### 5. How is appropriate autonomy level determined?

**Through rail configuration at system initialization**

The autonomy constraints are:
- Defined in YAML config (`config.yml`)
- Loaded via `RailsConfig` class
- Hardcoded into flow definitions in the library

No dynamic adjustment mechanism found. Once configured, autonomy levels remain static.

### 6. What safeguards exist against autonomous mistakes?

**Multiple safeguard layers:**

1. **Input Rails**: Validate user input before processing
2. **Output Rails**: Validate LLM responses before delivery
3. **Tool Rails**: Validate tool parameters and outputs
4. **Retrieval Rails**: Validate retrieved knowledge base content
5. **Content Safety Models**: External API checks with configurable thresholds
6. **Jailbreak Detection**: Heuristic and model-based detection
7. **Fact Checking**: Accuracy validation against knowledge base

Evidence: `nemoguardrails/library/jailbreak_detection/flows.co:6-26`, `nemoguardrails/library/content_safety/flows.co:1-38`

### 7. How does the system handle edge cases?

**Through configurable fallback behavior:**

1. **External API failures**: `fail_open` vs `fail_closed` configuration
2. **Malformed responses**: Default to blocking (fail closed)
3. **Unhandled events**: `_user_said_something_unexpected` flow handles unexpected input
4. **Flow conflicts**: Matching score-based resolution with random tie-breaking

Evidence: `nemoguardrails/colang/v2_x/runtime/statemachine.py:691-797` (conflict resolution), `nemoguardrails/library/ai_defense/actions.py:126-139` (malformed response handling)

### 8. What is the philosophy: "AI-first" or "human-first"?

**AI-first within guardrails**

The system architecture reveals:
- LLM generates content autonomously by default
- Rails act as gatekeepers, not assistants
- No human approval required for LLM decisions
- Safety is enforced through pre-configured constraints

The phrase "Below is a conversation between a helpful AI assistant and a user" in default instructions (`nemoguardrails/rails/llm/default_config_v2.yml:4`) reinforces AI-first positioning.

## Architectural Decisions

### Event-Driven Flow Execution
The Colang runtime uses an event-driven state machine (`statemachine.py:244-399`) that processes events deterministically. Flow heads advance based on event matching, with no autonomous LLM decision-making in the flow logic itself.

### Rail Boundary Enforcement
Rails are enforced at trust boundaries through the `_user_said` and `_bot_say` flow overrides (`guardrails.co:8-76`). These hooks ensure all content passes through configured rails before processing.

### Parallel Rail Execution
Input and output rails can run in parallel (`config.py:564-567`, `606-609`), but once a rail blocks content, execution short-circuits (`runtime.py:530-550`).

### Threshold-Based Decisions
Most rail decisions are threshold-based (e.g., 0.5 for fact-checking, configurable per API). No learning or adaptation mechanism found.

## Notable Patterns

1. **Override Pattern**: Core flows like `_user_said` and `_bot_say` are overridable, allowing custom rail injection (`guardrails.co:7-8`)

2. **Flow Priority Resolution**: When multiple flows match, matching scores determine precedence, with random tie-breaking (`statemachine.py:718-723`)

3. **Abort on Block**: Rails terminate flow execution on block rather than falling back (`flows.co:13,19,26`)

4. **External API Integration**: Rails delegate safety decisions to external services with explicit fail behavior configuration

5. **Deterministic Matching**: Event matching uses computed scores rather than probabilistic decisions (`statemachine.py:305-310`)

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| Safety vs Latency | Multiple rails add latency; speculative execution option exists but limited to non-streaming |
| Configurability vs Complexity | Extensive configuration options create complexity; 10+ rail types with overlapping concerns |
| Determinism vs Flexibility | Event-driven determinism provides reliability but limits adaptive behavior |
| Fail Open vs Fail Closed | External APIs require explicit choice; default is conservative (fail closed) |
| Pass-through vs Control | Passthrough mode sacrifices safety for tool compatibility |

## Failure Modes / Edge Cases

1. **Rail Short-Circuit**: First failing rail stops all subsequent rails; no graceful degradation
2. **API Timeout**: External safety APIs (AI Defense, content safety) have 30s default timeout; fail_closed blocks on timeout
3. **Flow Conflicts**: Random tie-breaking for equal matching scores can lead to non-deterministic behavior
4. **Passthrough Mode**: Bypasses all tool rails; dangerous tools may execute without validation
5. **Streaming Mode Limitations**: Speculative rail execution only works for non-streaming; streaming falls back to sequential
6. **Rail Exception Handling**: Rails either abort or send exceptions; no recovery mechanism within flows

## Future Considerations

1. **Human-in-the-Loop**: No current mechanism for real-time human approval during generation
2. **Per-Workflow Autonomy**: Cannot adjust autonomy level dynamically per conversation context
3. **Adaptive Thresholds**: No learning from user feedback or historical patterns
4. **Recovery Mechanisms**: Blocked content cannot be recovered or re-reviewed
5. **Multi-Modal Rails**: Current rails designed primarily for text; no audio/image safety rails

## Questions / Gaps

1. **No evidence of audit logging for rail decisions** - It is unclear how rail blocks are logged for compliance
2. **No mechanism for user override of rail decisions** - Users cannot request review of blocked content
3. **No circuit breaker pattern** - Repeated failures in external APIs don't trigger circuit breaker
4. **No rate limiting on rail retries** - Misconfigured rails could cause infinite retry loops
5. **No graceful degradation for cascading failures** - Single rail failure stops entire pipeline

---
Generated by `study-areas/23-philosophy-of-autonomy.md` against `nemo-guardrails`.