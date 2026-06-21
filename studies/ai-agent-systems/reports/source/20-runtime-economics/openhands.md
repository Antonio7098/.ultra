# Repo Analysis: openhands

## Runtime Economics Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | openhands |
| Path | `repos/openhands` |
| Language / Stack | Python SDK with React frontend |
| Analyzed | 2026-05-17 |

## Summary

OpenHands implements a comprehensive runtime economics layer spanning token counting, prompt caching, model routing (with fallback chains), detailed cost tracking via `Metrics` accumulators, parallel tool-call batching, rate limiting at both the HTTP server and LLM client levels, and configurable token budgets. The system is production-grade for cost visibility and prompt caching, but lacks cost-aware/adaptive routing, response caching, execution budgeting, and speculative execution. Cost tracking is the standout: every LLM call records prompt/completion/cache/reasoning tokens, response latency, and computed cost — persisted per-conversation and aggregated via PostHog in SaaS mode.

## Rating

**Score: 7/10**

Strong cost tracking (every call accounted), prompt caching (Anthropic-style breakpoints), configurable token budgets, and fallback chains. Missing: response caching, cost-aware/adaptive routing, execution budgeting, speculative execution. The `max_budget_per_task` config exists but defaults to 0 (unlimited). Would feel comfortable running unattended with a budget cap set and caching enabled.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Token Counting | `get_token_count()` calls `litellm.utils.token_counter()` via `format_messages_for_llm()` | `openhands/sdk/llm/llm.py:1495-1518` |
| Min Context Window | `MIN_CONTEXT_WINDOW_TOKENS = 16384` enforced in `_validate_context_window_size()` | `openhands/sdk/llm/llm.py:120-127`, `1302-1320` |
| Token Budget Config | `max_budget_per_task = 0.0` in config (disabled by default) | `config.template.toml:52-53` |
| Extended Thinking Budget | `extended_thinking_budget: int = 200_000` for Anthropic | `openhands/sdk/llm/llm.py:385-389` |
| Prompt Caching | `caching_prompt: bool = True` master switch, `_apply_prompt_caching()` marks cache breakpoints on system + last user/tool message | `openhands/sdk/llm/llm.py:328-331`, `1380-1407` |
| Cache Retention Policy | `prompt_cache_retention: str = "24h"` configurable | `openhands/sdk/llm/llm.py:377-383` |
| Cache Model Registry | `PROMPT_CACHE_MODELS` list (Claude 3.5+, Sonnet 4, Opus 4, Gemini 2.5/3) | `openhands/sdk/llm/utils/model_features.py:98-119` |
| Cache Retention Models | `PROMPT_CACHE_RETENTION_MODELS` (GPT-5+, GPT-4.1) | `openhands/sdk/llm/utils/model_features.py:121-145` |
| Model Routing Base | `RouterLLM` abstract base, holds `llms_for_routing: dict[str, LLM]` | `openhands/sdk/llm/router/base.py:21-129` |
| Multimodal Router | Routes to primary if images present OR token count exceeds secondary context window | `openhands/sdk/llm/router/impl/multimodal.py:29-61` |
| Fallback Strategy | `FallbackStrategy` iterates `fallback_llms` on transient errors, merges metrics | `openhands/sdk/llm/fallback_strategy.py:39-149` |
| Fallback Exceptions | `_LLM_FALLBACK_EXCEPTIONS` includes RateLimitError, APIConnectionError, ServiceUnavailableError, etc. | `openhands/sdk/llm/fallback_strategy.py:28-36` |
| Cost Tracking - Metrics | `Metrics` accumulator: costs, latencies, token_usages lists per call | `openhands/sdk/llm/utils/metrics.py:94-312` |
| Cost Snapshot | `MetricsSnapshot` with accumulated_cost, max_budget_per_task, accumulated_token_usage | `openhands/sdk/llm/utils/metrics.py:76-91` |
| Cost Calculation | `_compute_cost()` — tries provider header first, falls back to `litellm_completion_cost()`, supports custom cost per token | `openhands/sdk/llm/utils/telemetry.py:248-286` |
| Per-Call Token Recording | `TokenUsage` model tracks prompt, completion, cache_read, cache_write, reasoning, context_window | `openhands/sdk/llm/utils/metrics.py:34-73` |
| Analytics (PostHog) | `track_conversation_finished()` sends accumulated_cost_usd, prompt_tokens, completion_tokens | `openhands/analytics/analytics_service.py:221-253` |
| Tool-Call Batching | `_ActionBatch` partitions and executes multiple tool calls from single LLM response | `openhands/sdk/agent/agent.py:112-238` |
| Parallel Execution | `ParallelToolExecutor` uses `ThreadPoolExecutor` with resource locking | `openhands/sdk/agent/parallel_executor.py:38-162` |
| Event Batch Atomicity | `BatchAtomicityProperty` ensures batch events share llm_response_id are atomic | `openhands/sdk/context/view/properties/batch_atomicity.py:11-88` |
| HTTP Rate Limiting | `InMemoryRateLimiter` sliding window (10 req/s per IP with optional sleep) | `openhands/app_server/middleware.py:75-136` |
| LLM Retry Logic | `RetryMixin` with exponential backoff: 5 retries, multiplier 8.0, min 8s, max 64s | `openhands/sdk/llm/utils/retry_mixin.py:22-128` |
| LLM Retry Exceptions | RateLimitError included in `LLM_RETRY_EXCEPTIONS` | `openhands/sdk/llm/llm.py:110-118` |
| Max Iterations | `max_iterations = 500` global loop limit | `config.template.toml:54-55` |
| Max Conversations | `max_concurrent_conversations = 3` | `config.template.toml:90-91` |
| Conversation Max Age | `conversation_max_age_seconds = 864000` (10 days) | `config.template.toml:93-94` |
| Max Output Tokens Cap | `DEFAULT_MAX_OUTPUT_TOKENS_CAP = 16384` safe default | `openhands/sdk/llm/llm.py:132` |
| Model Routing Config | `router_name = "noop_router"` default, or `multimodal_router` | `config.template.toml:389-394` |
| Verified Models | `VERIFIED_MODELS` dict mapping provider -> model list (OpenAI, Anthropic, etc.) | `openhands/sdk/llm/utils/verified_models.py:1-144` |

## Answers to Protocol Questions

**1. How are token counts tracked?**
Every LLM call records token usage via `telemetry.py:on_response()` at `openhands/sdk/llm/utils/telemetry.py:77-122`. The `TokenUsage` model at `openhands/sdk/llm/utils/metrics.py:34-73` captures prompt, completion, cache_read, cache_write, reasoning tokens, and context window. A separate `get_token_count()` method at `openhands/sdk/llm/llm.py:1495-1518` uses `litellm.utils.token_counter()` for proactive counting (e.g., in the MultimodalRouter's routing decision). Accumulated tokens are persisted in `Metrics.accumulated_token_usage`.

**2. Is there a cost budget per execution?**
Yes — `max_budget_per_task` is a configurable float field on `MetricsSnapshot` (`openhands/sdk/llm/utils/metrics.py:86-87`), set from config `config.template.toml:52-53` (default 0.0 = unlimited). It is persisted in settings (`openhands/app_server/settings/settings_models.py:126`) and the SQL database (`openhands/app_server/app_conversation/sql_app_conversation_info_service.py:94,368,424-451`). However, there is **no enforcement logic** that halts execution when the budget is exceeded — the field is tracked and reported but not actively gated.

**3. Are responses cached?**
Prompt caching is implemented (Anthropic-style prefix caching with `cache_prompt` markers), enabled by default (`caching_prompt: bool = True` at `openhands/sdk/llm/llm.py:328-331`). The `_apply_prompt_caching()` method at `openhands/sdk/llm/llm.py:1380-1407` marks the system message block and the last user/tool content block. A model feature registry at `openhands/sdk/llm/utils/model_features.py:98-145` controls which models support caching and retention policies. **Response caching (deduplication of identical LLM requests) is NOT implemented.**

**4. Is there model fallback (cheaper model for simple tasks)?**
Yes, but not for cost optimization. The `FallbackStrategy` at `openhands/sdk/llm/fallback_strategy.py:39-149` provides fallback to alternate LLM profiles on **transient errors only** (RateLimitError, APIConnectionError, ServiceUnavailableError, etc. — see `_LLM_FALLBACK_EXCEPTIONS` at lines 28-36). The `MultimodalRouter` at `openhands/sdk/llm/router/impl/multimodal.py:29-61` routes to a secondary (presumably cheaper) model when messages contain no images AND fit within the secondary's context window — this is the closest to "cheaper model for simple tasks." There is no cost-optimized routing that selects models based on remaining budget or task complexity metrics.

**5. How is latency managed?**
Latency is tracked via `ResponseLatency` at `openhands/sdk/llm/utils/metrics.py:21-31` — recorded per call in `telemetry.py:on_response()` at `openhands/sdk/llm/utils/telemetry.py:77-122`. The `RetryMixin` at `openhands/sdk/llm/utils/retry_mixin.py:22-128` uses exponential backoff (8s initial, 64s max, 2x multiplier, 5 retries) to manage transient latency spikes. Parallel tool execution via `ParallelToolExecutor` at `openhands/sdk/agent/parallel_executor.py:38-162` reduces wall-clock time for multi-tool responses. There is **no adaptive latency optimization** (e.g., switching models based on observed latency).

**6. Are tool calls batched?**
Yes. `_ActionBatch` at `openhands/sdk/agent/agent.py:112-238` handles the full lifecycle of a batch of tool calls from a single LLM response. It truncates at `FinishTool`, partitions blocked vs non-blocked actions, and delegates execution to `ParallelToolExecutor` at `openhands/sdk/agent/parallel_executor.py:38-162`. Batch atomicity is enforced by `BatchAtomicityProperty` at `openhands/sdk/context/view/properties/batch_atomicity.py:11-88` to prevent partial event removal during condensation.

**7. Is there adaptive model selection?**
No. The existing routers are static/policy-based: `MultimodalRouter` decides per-call based solely on current message content (images + token count), not on historical performance or cost metrics. `FallbackStrategy` switches only on transient errors. There is no reinforcement learning, cost-history tracking, or performance-based model switching.

**8. How are expensive operations (e.g., large context) gated?**
A hard minimum context window of 16384 tokens (`MIN_CONTEXT_WINDOW_TOKENS` at `openhands/sdk/llm/llm.py:120-127`) is enforced in `_validate_context_window_size()` at lines 1302-1320. The `LLMSummarizingCondenser` at `openhands/sdk/context/condenser/llm_summarizing_condenser.py:226-241` handles context window exceeded by computing tokens to reduce and triggering condensation. The `LLMContextWindowExceedError` at `openhands/sdk/llm/exceptions/types.py:57-65` triggers `CondensationRequest` in the agent loop (`openhands/sdk/agent/agent.py:567-580`). Max iterations (`max_iterations: 500` at `config.template.toml:54-55`) and max concurrent conversations (`config.template.toml:90-91`) provide additional guardrails. The `max_budget_per_task` exists but is **not enforced** as a hard gate.

## Architectural Decisions

- **LiteLLM integration for token counting and cost calculation**: The system delegates to `litellm.utils.token_counter()` and `litellm_completion_cost()` rather than implementing its own. Custom cost per token is supported via `CostPerToken` (`telemetry.py:34-39`, `telemetry.py:248-286`).
- **Prompt caching as an opt-out feature**: `caching_prompt` defaults to `True` (`llm.py:328-331`), with model-specific feature gating via `model_features.py:98-145`. This design prioritizes cost savings by default.
- **Plugin-style router architecture**: `RouterLLM` base class (`router/base.py:21-129`) with `select_llm()` abstract method enables drop-in routing strategies. Current implementations: `MultimodalRouter`, `RandomRouter`.
- **Fallback with nested-fallback prevention**: `FallbackStrategy.try_fallback()` disables nested fallbacks to prevent recursion (`fallback_strategy.py:63-118`).
- **Metrics isolation per-LLM instance**: `LLMRegistry._ensure_independent_metrics()` at `llm_registry.py:80-106` detects shared Metrics objects (from Pydantic `model_copy()`) and resets them to prevent cross-conversation cost leakage.
- **Event batch atomicity**: `BatchAtomicityProperty` (`batch_atomicity.py:11-88`) ensures all events sharing an `llm_response_id` are treated as atomic units during condensation, preventing orphaned tool results.

## Notable Patterns

- **Anthropic-style cache markers adapted for multi-provider**: `_apply_prompt_caching()` at `llm.py:1380-1407` uses a two-block system message pattern — marks only the first (static) block for cross-conversation cache sharing, leaves the second (dynamic) block unmarked. Gemini also supports these markers via LiteLLM translation.
- **Metrics snapshots per response**: Every `LLMResponse` carries a `MetricsSnapshot` (`llm.py:848-853`) enabling per-turn cost attribution and delta computation (`Metrics.diff()` at `metrics.py:251-309`).
- **Tools with `ParallelToolExecutor`**: Thread-level parallelism with `ResourceLockManager` mutex, configurable via `tool_concurrency_limit: int = 1` on the agent (`agent/base.py:338-347`).
- **Token-based condensation**: `LLMSummarizingCondenser` (`llm_summarizing_condenser.py:47-48`, `226-241`) uses `max_size=240` events and optional `max_tokens` limit, computing `tokens_to_reduce = total_tokens - (max_tokens // 2)` when over the limit.

## Tradeoffs

- **Rich cost tracking vs. no budget enforcement**: While `Metrics` captures every dollar spent with per-call granularity, `max_budget_per_task` defaults to 0 (unlimited) and there is no code path that stops execution when the budget is exceeded. The visibility is there but the guardrail is missing.
- **Prompt caching enabled by default**: Saves costs for supported models but adds cache-marker overhead for unsupported models (gated by `model_features.py`). The `is_caching_prompt_active()` check at `llm.py:1350-1364` prevents sending cache markers to non-supporting models.
- **ThreadPoolExecutor for tool batching vs. async**: Uses threads rather than asyncio for parallel tool execution (`parallel_executor.py:54-91`). This is simpler but may have GIL contention for CPU-bound tools.
- **In-memory rate limiter vs. distributed**: `InMemoryRateLimiter` (`middleware.py:75-136`) is per-process and not shared across replicas. For multi-instance deployments, a Redis-backed limiter would be needed.
- **Fallback only on transient errors**: `FallbackStrategy` does not switch models based on cost or quality — only on connectivity/availability failures. This avoids unexpected model switches but misses cost optimization opportunities.

## Failure Modes / Edge Cases

- **No budget enforcement**: If `max_budget_per_task` is set but exceeded, execution continues unchecked — the budget field is tracked and reported only. A runaway agent could burn through the budget without being stopped.
- **Context window exceeded recovery**: `LLMContextWindowExceedError` triggers `CondensationRequest` (`agent.py:567-580`), but if the condenser cannot reduce enough, there is no hard stop — the agent logs a warning (`_log_context_window_exceeded_warning()` at `agent.py:978-1053`).
- **Retry exhaustion**: After 5 exponential-backoff retries, transient errors propagate up and may trigger fallback. If all fallbacks also fail, the exception reaches the agent loop unhandled.
- **Shared Metrics via Pydantic copy**: `LLMRegistry._ensure_independent_metrics()` (`llm_registry.py:80-106`) mitigates this, but Pydantic's `model_copy()` can silently share Metrics objects, causing cost to be double-counted across conversations if the fix fails.
- **No response caching**: Identical LLM requests (e.g., same prompt for different users in the same time window) are re-fetched from the provider every time, incurring full cost.

## Future Considerations

- **Cost-aware routing**: The `RouterLLM` base class and `Metrics` infrastructure already support this — a router that selects models based on remaining budget or per-model cost-per-token would be straightforward.
- **Response caching layer**: A key-value cache (Redis or in-memory) for LLM responses keyed on prompt hash would save cost on repeated queries. No infrastructure exists today.
- **Budget enforcement hooks**: Adding a budget check before each LLM call in the agent loop (`agent.py` or `LLM.completion()`) would make `max_budget_per_task` actionable.
- **Adaptive routing with latency feedback**: `ResponseLatency` data is already collected — a router that switches models based on observed latency percentile would be a natural extension.
- **Execution budgeting**: No mechanism exists for limiting wall-clock time, CPU, or tool-call rounds beyond `max_iterations`. Adding per-step or per-tool timeouts would improve safety.
- **Speculative execution**: Running a cheaper model in parallel with a primary model and using its output if the primary is slow could reduce p95 latency. No framework exists.
- **Distributed rate limiting**: The current `InMemoryRateLimiter` does not scale across processes. A shared Redis-based limiter would be needed for horizontal scaling.

## Questions / Gaps

- **Is `max_budget_per_task` enforced anywhere?** No evidence found. The field exists in `MetricsSnapshot` and is persisted in the database, but no code path checks `accumulated_cost > max_budget_per_task` to halt execution.
- **Is there any response deduplication caching?** No evidence found. No cache key, TTL, or cache lookup exists in the LLM call path.
- **Are there per-user cost quotas?** No evidence found beyond the SaaS-level credit system (`analytics_service.py:285-351`). The OSS version has no per-user cost limits.
- **How are token counts from streaming responses handled?** The `get_token_count()` method counts before sending. Streaming response token counts come from LiteLLM's response metadata.
- **No evidence of adaptive routing based on cost or performance history.** The `Metrics` data accumulates but is not fed back into routing decisions.

---

Generated by `study-areas/20-runtime-economics.md` against `openhands`.
