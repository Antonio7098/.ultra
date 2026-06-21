# Runtime Economics - Combined Study Report

## Study Parameters

| Field | Value |
|-------|-------|
| Protocol | `study-areas/20-runtime-economics.md` |
| Repositories | 13 reference repos |
| Date | 2026-05-17 |

## Repositories Studied

| # | Repo | Path |
|---|------|------|
| 1 | aider | `repos/aider` |
| 2 | autogen | `repos/autogen` |
| 3 | guardrails | `repos/guardrails` |
| 4 | langfuse | `repos/langfuse` |
| 5 | langgraph | `repos/langgraph` |
| 6 | mastra | `repos/mastra` |
| 7 | nemo-guardrails | `repos/nemo-guardrails` |
| 8 | opa | `repos/opa` |
| 9 | openai-agents-python | `repos/openai-agents-python` |
| 10 | opencode | `repos/opencode` |
| 11 | openhands | `repos/openhands` |
| 12 | temporal | `repos/temporal` |
| 13 | hellosales | `repos/hellosales` |

## Executive Summary

Runtime economics across the studied systems falls into four tiers. At the top, **Temporal** (8/10) and **mastra**, **opencode**, **openhands**, and **nemo-guardrails** (all 7/10) implement layered cost-control mechanisms: token budgets, caching, model fallback, rate limiting, and in some cases cost-aware routing. The middle tier — **aider**, **autogen**, **langfuse** (all 6/10) — provides token counting and basic caching or termination conditions but lacks adaptive routing or hard cost ceilings. **OPA** (5/10) and **openai-agents-python** (5/10) offer strong observability and caching but no budget enforcement. **LangGraph** (4/10) delegates all cost control to the provider. **Guardrails** (3/10) and **hellosales** (3/10) have no meaningful cost-control mechanisms — no token counting, no budgets, no caching, and no adaptive routing.

The most striking gap across all LLM-focused systems is the **absence of adaptive model selection**: no repo uses a complexity-aware or cost-aware router that dynamically selects a model based on prompt complexity, remaining budget, or latency targets. Model fallback exists almost exclusively as a retry-on-failure mechanism, not as a cost-optimization strategy. Batching of tool calls into fewer LLM turns is rare (only openhands and langgraph implement it). Per-execution dollar-cost budgets are present in config schemas (openhands, mastra) but are either approximate or unenforced.

## Core Thesis

Runtime economics in LLM agent systems is currently **observability-dominant but enforcement-weak**. Every system tracks something (tokens, cost, or both), but few enforce hard limits. The systems that score highest combine three layers: (1) **proactive context/token budgeting** (compaction, truncation, or pre-call gating), (2) **multi-level caching** (prompt, response, embeddings, and operation-level), and (3) **rate-limiting with backpressure** at the infrastructure layer. The missing fourth layer — **adaptive, cost-aware model selection** — is the single highest-impact improvement available to any system building on this analysis.

## Rating Summary

| Repo | Score | Approach | Main Strength | Main Concern |
|------|-------|----------|---------------|--------------|
| temporal | 8/10 | Infrastructure rate limiting + multi-level caching | Health-sensitive dynamic backpressure at persistence layer; per-API token costing; ownership-based quota scaling | No per-execution cost tracking; not an LLM system |
| mastra | 7/10 | Processor pipeline with pluggable cost guards | Composable TokenLimiter, CostGuard, ResponseCache processors; deterministic SHA-256 cache key with scoped isolation | Cost guard is approximate (async metrics); no hard cost ceiling |
| opencode | 7/10 | Prompt caching + session compaction + small model selection | Three-layer cost data model; automatic context-aware compaction with tail preservation; cache policy engine | No per-execution dollar budget; no response caching |
| openhands | 7/10 | Comprehensive cost tracking + prompt caching + fallback chains | Per-call Metrics snapshots with dollar-cost computation; MultimodalRouter for content-aware routing; tool-call batching | `max_budget_per_task` exists but is not enforced; no response caching |
| nemo-guardrails | 7/10 | Per-task token budgets + LFU cache + speculative execution | LFU cache with get-or-compute dedup; ContextVar-based token accounting; concurrent input rails hide latency | No dollar-cost tracking; cache disabled by default; static model routing |
| aider | 6/10 | Token counting + prompt caching + thinking budget | Chat history summarization; cache warming thread; weak model for commits | No hard budget enforcement; no adaptive routing; no batching |
| autogen | 6/10 | Termination-based budgets + response caching + context management | TokenUsageTermination with per-prompt/completion/total limits; pluggable CacheStore abstraction | Post-hoc budget enforcement (after tokens consumed); no pre-call gating |
| langfuse | 6/10 | Token counting + cost calculation + pricing tiers | Two-layer tokenization (sync + async worker pool); model price/cache infrastructure | Observability platform, not agent runtime; no execution budgets |
| opa | 5/10 | Multi-level caching + operation metrics + body size limits | Extensive trie-based intra-query and inter-query caches; eval operation counters | Not an LLM system; no step/iteration budget; diagnostic-only metrics |
| openai-agents-python | 5/10 | Token tracking + turn budgeting + server-side prompt caching | Per-request usage granularity with cached/reasoning breakdowns; deterministic cache key generation | No cost enforcement; no client-side caching; no model fallback |
| langgraph | 4/10 | Provider-delegated tracking + step limits + caching | Multi-level caching (KV, tool, checkpoint); parallel tool execution | No native cost budgeting; cost control entirely delegated to user |
| guardrails | 3/10 | Passthrough token counting + retry budget | Runner loop with reask budget; streaming token estimation via tiktoken | No budgets, no caching, no adaptive routing; cost control absent |
| hellosales | 3/10 | Retry budgets + backup model + message-count truncation | Provider-level retry loop with backoff; backup provider seam on final attempt | No token counting at all; no cost tracking; no caching; no adaptive routing |

## Approach Models

### Cluster 1: Infrastructure-First Rate Limiting (temporal)

Temporal treats runtime economics as an infrastructure concern. Token-bucket rate limiters at every layer (frontend, history, matching, persistence) use per-API token costing, priority-based quotas, and health-sensitive dynamic backpressure. The system has no concept of per-workflow cost — economics are managed indirectly through resource limits. This approach is appropriate for workflow orchestration where the cost driver is API call volume, not token spend.

### Cluster 2: Processor Pipeline Economics (mastra, opencode, nemo-guardrails)

These systems implement cost controls as composable, pluggable units that hook into the agentic loop at well-defined points. Mastra's processors (TokenLimiter, CostGuard, ResponseCache) attach to input, output, and LLM request/response hooks. Opencode's cache policy engine and session compaction operate before each LLM call. Nemo-guardrails' LFU cache sits between the agent and the LLM provider. The processor pattern enables mixing and matching cost controls without modifying agent core logic.

### Cluster 3: Termination-Based Budget Enforcement (autogen, openhands)

These systems enforce budgets by stopping execution when limits are exceeded. Autogen's `TokenUsageTermination` fires after a token threshold is passed. OpenHands' `max_budget_per_task` exists in config and Metrics snapshots but lacks enforcement (the budget field is tracked and persisted but never checked before a call). The key tradeoff: post-hoc termination wastes the tokens that exceeded the budget; pre-call gating is harder to implement but prevents waste.

### Cluster 4: Observability-Only Tracking (langfuse, openai-agents-python, langgraph)

These systems track tokens and costs meticulously but never enforce limits. Langfuse calculates cost per observation after ingestion. OpenAI Agents SDK preserves per-request usage entries for accurate billing. LangGraph relies on provider `usage_metadata` flowing through LangChain messages. All three assume the caller is responsible for budget enforcement. This is appropriate for platforms (langfuse) or SDKs (openai-agents-python) but dangerous for autonomous agents.

### Cluster 5: Minimal / Consumer-Grade (aider, guardrails, hellosales)

These systems have basic or no cost-control infrastructure. Aider has the most of this group (token counting, prompt caching, weak model for commits) but no hard budgets or adaptive routing. Guardrails and hellosales have essentially no cost control beyond retry budgets. Guardrails captures token counts from provider responses but never uses them for enforcement. HelloSales doesn't even extract token counts from provider responses — usage data from the API is ignored.

## Pattern Catalog

### P1: Prompt Caching (via Cache Markers)

**What problem it solves**: Reduces token spend by reusing cached prefix content across requests.

**Which repos demonstrate it**: opencode (cache policy engine with `"auto"` default and 4-breakpoint cap, `packages/llm/src/cache-policy.ts:99-111`), openhands (Anthropic-style `_apply_prompt_caching()` with two-block system message pattern, `openhands/sdk/llm/llm.py:1380-1407`), nemo-guardrails (prompt caching via model config, disabled by default, `nemoguardrails/rails/llm/config.py:89-100`), aider (`--cache-prompts` flag with cache warming thread at 5min intervals, `aider/coders/base_coder.py:1340-1394`), openai-agents-python (server-side prompt caching via `prompt_cache_retention` setting, `src/agents/model_settings.py:125-129`).

**Why it works**: Provider-side prompt caching (Anthropic, OpenAI) offers significant cost reduction (1.25x write cost, 0.1x read cost for Anthropic). Even a single cache hit across two requests breaks even.

**When to copy it**: Any system that sends repeated or incrementally growing prompts (conversational agents, tool-use loops, multi-turn interactions).

**When it is overkill or risky**: Single-shot or stateless applications. Cache markers add overhead to every request. Provider breakpoint limits (Anthropic 4-breakpoint cap) require careful allocation.

**Evidence**: opencode justifies the `"auto"` default explicitly: a single reuse wins on Anthropic's cache economics (`packages/llm/src/cache-policy.ts:26-28`).

### P2: Response Caching (Deterministic Key)

**What problem it solves**: Avoids duplicate LLM calls for identical (or near-identical) prompts.

**Which repos demonstrate it**: autogen (`ChatCompletionCache` with SHA-256 hash key, `autogen-ext/src/autogen_ext/models/cache/_chat_completion_cache.py:176-204`), mastra (`ResponseCache` processor with SHA-256 from prompt+model+scope+step, default 300s TTL, `packages/core/src/processors/processors/response-cache.ts:193-313`), nemo-guardrails (LFU cache per model, SHA-256 normalized prompt key, `nemoguardrails/llm/cache/lfu.py:80-470`).

**Why it works**: Deterministic prompts (tool results, file reads, routine queries) produce identical LLM responses. Caching eliminates the API call entirely.

**When to copy it**: Systems with repetitive tool outputs, deterministic workflows, or multi-tenant scenarios where different users may ask similar questions.

**When it is overkill or risky**: Highly dynamic prompts (random seeds, timestamps in prompts). Cache key collisions from semantically different but structurally similar prompts. Cache TTL must be tuned to avoid serving stale responses.

**Evidence**: autogen's cache marks results `cached=True` on `CreateResult` (`autogen-ext/src/autogen_ext/models/cache/_chat_completion_cache.py:276-284`). Mastra includes agent ID and resource scope in the cache key for multi-tenant isolation (`packages/core/src/processors/processors/response-cache.ts:345-349`).

### P3: Token Budget Enforcement via Termination

**What problem it solves**: Prevents unbounded token spend by stopping execution when a threshold is exceeded.

**Which repos demonstrate it**: autogen (`TokenUsageTermination` with `max_total_token`, `max_prompt_token`, `max_completion_token`, `autogen-agentchat/src/autogen_agentchat/conditions/_terminations.py:250-255`), mastra (`CostGuardProcessor` with configurable `maxCost`, 3 scopes, configurable windows, `packages/core/src/processors/processors/cost-guard.ts:154-306`), opencode (session compaction with automatic overflow detection and pruning, `packages/opencode/src/session/compaction.ts:306-350`).

**Why it works**: Hard limits give predictable cost bounds. Autogen's approach is post-hoc (triggers after tokens consumed). Mastra's is pre-call (checks before each LLM call).

**When to copy it**: Any system deployed in production where cost predictability matters. Pre-call gating (mastra) is strictly better than post-hoc termination (autogen).

**When it is overkill or risky**: Development or prototyping environments where cost is not a concern. Tight budgets may interrupt legitimate long-running conversations.

**Evidence**: autogen's termination fires on `on_condition_changed` event (`autogen-agentchat/src/autogen_agentchat/conditions/_terminations.py:275-282`). Mastra's cost guard queries observability metrics which are async/buffered — explicitly documented as approximate (`packages/core/src/processors/processors/cost-guard.ts:109-112`).

### P4: Health-Sensitive Dynamic Rate Limiting

**What problem it solves**: Prevents system overload by dynamically adjusting throughput based on backend health signals.

**Which repos demonstrate it**: temporal (persistence rate limiter monitors latency and error ratio, adjusts rate multiplier dynamically, `common/persistence/client/health_request_rate_limiter.go:109-138`).

**Why it works**: Static rate limits are either too conservative (wasting capacity) or too aggressive (causing overload). Dynamic adjustment based on real-time health signals maximizes throughput while maintaining stability.

**When to copy it**: Any system with a backend that exhibits latency degradation under load (databases, LLM APIs, external services).

**When it is overkill or risky**: Systems with predictable, constant load. Requires instrumentation of backend health signals.

**Evidence**: temporal's rate limiter refreshes every 10s with configurable latency threshold and backoff/increase step sizes (`common/persistence/client/health_request_rate_limiter.go:18, 109-138`).

### P5: Model Fallback on Failure (Not Cost-Aware)

**What problem it solves**: Maintains availability when the primary model is unavailable or returns errors.

**Which repos demonstrate it**: openhands (`FallbackStrategy` iterates `fallback_llms` on transient errors, `openhands/sdk/llm/fallback_strategy.py:39-149`), mastra (model fallback array with per-entry `maxRetries` and `modelSettings`, `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:538-581`), aider (weak model for commit messages only, `aider/models.py:596-616`), opencode (`Catalog.model.small()` for cheap model selection, `packages/core/src/catalog.ts:204-256`).

**Why it works**: Availability failures (rate limits, outages, transient errors) are redirected to alternate models. The system degrades gracefully rather than crashing.

**When to copy it**: Production systems that depend on a single model provider.

**When it is overkill or risky**: When fallback models produce significantly worse results. Mastra's pattern of not retrying TripWire errors on fallback models is important — safety-critical processor rejections should not be bypassed.

**Evidence**: openhands' `_LLM_FALLBACK_EXCEPTIONS` includes RateLimitError, APIConnectionError, ServiceUnavailableError (`openhands/sdk/llm/fallback_strategy.py:28-36`). Mastra explicitly skips fallback for TripWire errors (`packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:563-565`).

### P6: Tool-Call Batching with Parallel Execution

**What problem it solves**: Reduces wall-clock time per turn by executing multiple tool calls concurrently.

**Which repos demonstrate it**: openhands (`_ActionBatch` with `ParallelToolExecutor` using `ThreadPoolExecutor`, `openhands/sdk/agent/agent.py:112-238`, `openhands/sdk/agent/parallel_executor.py:38-162`), langgraph (`executor.map` for sync, `asyncio.gather` for async, `libs/prebuilt/langgraph/prebuilt/tool_node.py:821-858`).

**Why it works**: LLM responses often contain multiple tool calls. Executing them sequentially wastes latency; parallel execution completes in the time of the slowest tool.

**When to copy it**: Any system where the model can emit multiple independent tool calls per turn.

**When it is overkill or risky**: When tools have side effects that conflict. OpenHands' `BatchAtomicityProperty` (`openhands/sdk/context/view/properties/batch_atomicity.py:11-88`) addresses this by ensuring batch events are treated as atomic units.

**Evidence**: openhands' batch handles the full lifecycle: truncation at `FinishTool`, partitioning blocked vs non-blocked actions, and atomicity enforcement (`openhands/sdk/agent/agent.py:112-238`).

### P7: Context-Aware Token Budgeting via Compaction

**What problem it solves**: Prevents context overflow by reducing prompt size while preserving recent conversation and key context.

**Which repos demonstrate it**: opencode (session compaction with tail-turn preservation and older content summarization, `packages/opencode/src/session/compaction.ts:306-350`), autogen (`TokenLimitedChatCompletionContext` removes messages from the middle iteratively, `autogen-core/src/autogen_core/model_context/_token_limited_chat_completion_context.py:57-77`), nemo-guardrails (`render_task_prompt()` truncates history when `max_length` exceeded, `nemoguardrails/llm/taskmanager.py:304-337`).

**Why it works**: Budget-aware compaction preserves maximum useful context while fitting within model limits. Summary-based compaction (opencode) retains semantic content better than simple truncation (autogen, nemo-guardrails).

**When to copy it**: Long-running conversational agents where context grows unboundedly.

**When it is overkill or risky**: Compaction itself costs tokens (opencode uses a compaction agent). Over-compaction can lose important context. Middle-removal (autogen) can drop critical information.

**Evidence**: opencode's compaction preserves recent verbatim turns (25% of budget, clamped 2000-8000 tokens) and summarizes older content via a compaction agent (`packages/opencode/src/session/compaction.ts:306-350`). Overflow detection uses `COMPACTION_BUFFER=20000` reserved tokens (`packages/opencode/src/session/overflow.ts:19-25`).

### P8: Per-Request Usage Granularity

**What problem it solves**: Enables accurate cost attribution and billing by preserving per-request token breakdowns.

**Which repos demonstrate it**: openai-agents-python (`request_usage_entries` preserves per-call breakdowns even after aggregation, `src/agents/usage.py:125-136`), openhands (`TokenUsage` model per call with prompt/completion/cache/reasoning, `openhands/sdk/llm/utils/metrics.py:34-73`), nemo-guardrails (`LLMCallInfo` and `LLMStats` via ContextVars, `nemoguardrails/context.py:40-48`).

**Why it works**: Aggregated totals hide per-call variations. Per-request granularity enables accurate billing, cost debugging, and model-level cost attribution.

**When to copy it**: Multi-tenant systems, billing platforms, or any system where cost per call matters.

**When it is overkill or risky**: Simple single-user tools where aggregate cost is sufficient.

**Evidence**: openai-agents-python's `Usage.add()` auto-creates `RequestUsage` entries and preserves nested cached/reasoning detail (`src/agents/usage.py:157-215`).

### P9: Rate-Limit Backoff with Token Budgets

**What problem it solves**: Prevents overwhelming the LLM provider and handles transient failures gracefully.

**Which repos demonstrate it**: temporal (token-bucket rate limiters at every layer with per-API costs, `common/quotas/rate_limiter.go`), opencode (exponential backoff on 429/503/504/529 with OpenAI/Anthropic header parsing, `packages/llm/src/route/executor.ts:90-147`), openhands (5 retries, 8s initial, 64s max, `openhands/sdk/llm/utils/retry_mixin.py:22-128`), nemo-guardrails (2 retries, 0.5s initial, 8s max, `nemoguardrails/llm/clients/constants.py:18-24`), mastra (rate limit header parsing with 10s backoff when `<2000` tokens remaining, `packages/core/src/llm/model/model.loop.ts:267-271`).

**Why it works**: Exponential backoff reduces provider load during transient failures. Token-aware rate limiting (mastra reading `x-ratelimit-remaining-tokens`) prevents hitting hard limits.

**When to copy it**: Any system making HTTP calls to rate-limited APIs.

**When it is overkill or risky**: Internal-only deployments without rate limits.

**Evidence**: opencode's retry layer parses both OpenAI (`x-ratelimit-remaining-tokens`, `x-ratelimit-remaining-requests`) and Anthropic (`anthropic-ratelimit-tokens-remaining`, `anthropic-ratelimit-requests-remaining`) rate limit headers (`packages/llm/src/route/executor.ts:90-147`).

## Key Differences

### Caching Strategy

| Dimension | opencode | openhands | mastra | nemo-guardrails | autogen |
|-----------|----------|-----------|--------|-----------------|---------|
| Prompt cache | Default `"auto"` policy, 4-breakpoint cap | Enabled by default, Anthropic-style markers | Not implemented | Opt-in per model, disabled by default | Not implemented |
| Response cache | Not implemented | Not implemented | SHA-256 key, 300s TTL, pluggable backend | LFU per model, 50K entries, thread-safe get-or-compute | SHA-256 key, pluggable CacheStore |
| Embeddings cache | Not applicable | Not applicable | Not implemented | Filesystem/Redis backends | Not applicable |
| Cache scope | Per-session prompt cache | Per conversation | Agent+step+scope key | Per-model | Per model client |

### Cost Enforcement

| Dimension | openhands | mastra | opencode | autogen | openai-agents-python |
|-----------|-----------|--------|----------|---------|---------------------|
| Per-call token tracking | Full breakdown with dollar cost | Client-side estimation | Char/4 heuristic + per-response | Via RequestUsage | Per-request entries |
| Dollar cost tracking | Per-call via Metrics | Estimated from observability | In cost data model, not tracked | No | No |
| Budget enforcement | `max_budget_per_task` exists but unenforced | Approximate (async metrics) | Step-only (tool loop cap) | Post-hoc termination | Turn count only |
| Model selection cost-awareness | None | Per-tier via DynamicArgument | Small model via Catalog.small() | None | None |

### Exclusivity: What Only One Repo Does Well

- **Temporal**: Health-sensitive dynamic rate limiting, per-API token costing, ownership-based quota scaling, priority-based request routing.
- **openhands**: Per-call dollar-cost computation via `_compute_cost()` with provider header fallback chain (`openhands/sdk/llm/utils/telemetry.py:248-286`). Tool-call batching with parallel execution and atomicity.
- **mastra**: Processor pipeline architecture that makes cost controls composable and pluggable. Deterministic SHA-256 cache key derivation with multi-tenant isolation.
- **nemo-guardrails**: Speculative execution (input rails race LLM generation, `nemoguardrails/rails/llm/config.py:569-576`). LFU cache with asyncio.Future-based get-or-compute dedup.
- **opencode**: Session compaction with tail-turn preservation and older content summarization (`packages/opencode/src/session/compaction.ts:306-350`). Cache policy engine with `"auto"`/`"none"`/object-form `CacheHint`.
- **temporal**: Token recycling for rate limit capacity (`RecycleToken`, `common/quotas/rate_limiter.go:51`).

## Tradeoffs

### T1: Pre-call gating vs. Post-hoc enforcement

| Side | Benefit | Cost | Best-fit context | Failure mode |
|------|---------|------|------------------|--------------|
| Pre-call (mastra CostGuard, opencode compaction) | No wasted tokens on denied requests | Complexity; cost estimation before call; may be approximate | Systems with predictable cost per call | Estimated cost differs from actual; false positives block legitimate requests |
| Post-hoc (autogen TokenUsageTermination) | Simple to implement; uses actual cost data | Wastes tokens that exceeded budget; cannot prevent overspend | Systems where small overage is acceptable | Overshoot budget entirely on large single calls |

### T2: Client-side token estimation vs. Provider token counts

| Side | Benefit | Cost | Best-fit context | Failure mode |
|------|---------|------|------------------|--------------|
| Client-side (opencode char/4, mastra tokenx) | Fast, no provider dependency, works offline | May not match provider tokenization; estimation error | Context budgeting where exact match not required | Underestimation causes context overflow; overestimation wastes budget |
| Provider counts (autogen, openai-agents-python) | Exact match with what you'll be billed | Requires provider API response; no pre-call visibility | Billing, cost tracking, observability | Provider may not return counts (streaming, errors) |

### T3: Response caching with TTL vs. No caching

| Side | Benefit | Cost | Best-fit context | Failure mode |
|------|---------|------|------------------|--------------|
| Cache responses (autogen, mastra, nemo-guardrails) | Eliminates duplicate API calls; reduces latency and cost | Cache invalidation complexity; stale responses; key collision risk | Repetitive tool outputs, deterministic workflows | Stale responses served; cache poisoning |
| No caching (openhands, opencode, aider) | Simpler; always fresh responses | Every call costs full price; higher latency for repeats | Highly dynamic prompts; safety-critical where staleness matters | Missed cost savings on repeated calls |

### T4: Turn-based budgeting vs. Token-based budgeting

| Side | Benefit | Cost | Best-fit context | Failure mode |
|------|---------|------|------------------|--------------|
| Turn-based (openai-agents-python `max_turns`, langgraph `recursion_limit`) | Simple to reason about; easy to configure | Does not control token spend per turn; one turn can be arbitrarily expensive | Systems with uniform turn costs | A single turn with large context burns budget without control |
| Token-based (autogen max_total_token, opencode compaction budget) | Directly controls the actual cost driver | Harder to implement; requires per-call token counting | Systems with variable per-turn token consumption | Counting errors cause incorrect limits |

### T5: Provider-integrated caching vs. Client-side caching

| Side | Benefit | Cost | Best-fit context | Failure mode |
|------|---------|------|------------------|--------------|
| Provider-side (openai-agents-python prompt_cache_retention, aider --cache-prompts) | Backed by provider infrastructure; works at KV cache level | Only works with supported providers (Anthropic, OpenAI); cost controlled by provider | Systems using supported providers | Provider changes caching policy or pricing |
| Client-side (mastra ResponseCache, nemo-guardrails LFUCache) | Provider-agnostic; can cache any model's output | Duplicates storage; must implement invalidation | Multi-provider systems, self-hosted models | Misses provider-level KV cache benefits |

## Decision Guide

### "Should I implement response caching?"

Yes if:
- You have repetitive tool calls or deterministic prompts
- You run multi-tenant with similar queries across tenants
- Your cache hit rate exceeds ~20% (breakeven depends on storage vs. API cost)

No if:
- Every prompt is unique (timestamps, random seeds)
- Response freshness is critical (no TTL is acceptable)
- Storage cost exceeds API cost for your volume

### "Should I use prompt caching, response caching, or both?"

Use **prompt caching** if your prompts grow incrementally (conversational agents). Implementation cost is low — just add cache markers. Opencode's `"auto"` policy is the right default for multi-turn agents.

Add **response caching** if you have repeated identical prompts. The cache key must include model identity, prompt content, and tenant scope. Mastra's SHA-256(agent+model+scope+step) pattern is the most complete.

### "How should I enforce cost budgets?"

Start with **turn-based limits** (simplest). Add **token-based limits** when per-turn variance is high (autogen's approach). Consider **dollar-cost limits** only when you have accurate per-model pricing data (openhands' approach but with actual enforcement). Mastra's processor pipeline pattern is the most flexible — start with TokenLimiter, add CostGuard when you need dollar limits.

### "Which caching strategy for multi-tenant?"

Include tenant/resource ID in the cache key (mastra's scope hash). Never share cache across tenants. Use a distributed cache (Redis) for cross-process dedup. Set TTL conservatively — 300s is a reasonable default (mastra, nemo-guardrails).

### "When should I implement model fallback?"

Always implement **failure fallback** (primary → secondary on error). Consider **cost-based fallback** (cheap model for simple queries) only after you have complexity classification. The openhands MultimodalRouter pattern (conditional on input characteristics) is the right starting point.

## Practical Tips

### Patterns to Copy

1. **Processor pipeline for cost controls** (mastra): Separates economics logic from agent core. New cost mechanisms can be added without modifying the agent loop.
2. **Deterministic cache key with scope isolation** (mastra): SHA-256(prompt + model + scope + step) prevents cross-tenant contamination and stale-step hits.
3. **Session compaction with tail preservation** (opencode): Preserves recent context verbatim, summarizes older content. Better than middle-removal (autogen) or simple truncation (nemo-guardrails).
4. **Per-request usage granularity** (openai-agents-python): Preserve per-call breakdowns even after aggregation for accurate billing and debugging.
5. **Two-block system message caching** (openhands): First (static) block marked for cache, second (dynamic) block left unmarked — enables cross-conversation cache hits for shared system prompts.
6. **Health-sensitive dynamic rate limiting** (temporal): Adjust throughput based on backend latency rather than static RPS limits.
7. **Weak model for specific subtasks** (aider): Use cheap models for peripheral tasks (commit messages, summarization) while keeping the primary model for core reasoning.

### Patterns to Avoid or Delay

1. **Post-hoc budget enforcement without pre-call gating** (autogen, openhands): Budget limits that trigger after exceeding the limit waste tokens. Always add pre-call checks.
2. **Cache disabled by default** (nemo-guardrails): Users miss significant cost savings. Cache should be opt-out, not opt-in.
3. **Metrics-only cost tracking without enforcement** (openhands `max_budget_per_task`): Tracking a budget field without enforcement provides false confidence.
4. **Static model routing without fallback** (all except openhands, mastra): A single point of failure.
5. **Char/4 token estimation for accuracy-critical budgets** (opencode): Fine for compaction decisions; use proper tokenizers for billing.

### Decision Rules for Choosing Approaches

1. **If cost is not a concern →** Skip caching, skip budgets. Use turn-based limits only.
2. **If cost is a minor concern →** Enable prompt caching, set a max_turns limit.
3. **If cost is a major concern →** Implement response caching, model fallback chains, token budgets per execution, cost-aware routing.
4. **If multi-tenant →** Add scope isolation to all cache keys, per-tenant cost tracking, and tenant-level budget enforcement.
5. **If high-latency backend →** Implement health-sensitive dynamic rate limiting (temporal pattern).

### Caution Signs That Runtime Economics Is Becoming Brittle

1. **Unexpected provider bills**: Your system lacks token tracking or cost budgets. Add per-call tracking + termination conditions.
2. **Context overflow errors in production**: You need session compaction or token-limited context managers (opencode, autogen patterns).
3. **Rate limit errors in logs**: You need retry with exponential backoff and rate-limit header parsing (opencode, openhands patterns).
4. **Same prompt called multiple times**: You need response caching (autogen, mastra patterns).
5. **Can't explain cost variance per user/tenant**: You need per-request usage granularity (openai-agents-python pattern).

## Anti-Patterns / Caution Signs

1. **Token counting without budget enforcement.** Token counts that are collected but never checked against a threshold provide visibility without control. Every repo except temporal and mastra exhibits this to some degree.

2. **Budget enforcement using async metrics.** Mastra's CostGuardProcessor queries asynchronously buffered metrics, making it an approximate guard. Agents running faster than the metric flush interval can exceed budgets.

3. **No input token budget.** Multiple repos (openai-agents-python, aider, hellosales) limit output tokens but not input tokens. A large conversation history can drive up costs with no control.

4. **Model fallback that bypasses safety processors.** Mastra's fallback execution correctly skips TripWire errors — other implementations should follow this pattern. Never let fallback models bypass safety-critical processor rejections.

5. **Cache key collisions from metadata stripping.** Mastra's `stripMastraInternalMetadata()` removes internal fields from cache key hashing. If internal metadata is semantically significant, different prompts could produce the same cache key.

6. **Post-hoc token budget that overspends on large single calls.** Autogen's `TokenUsageTermination` fires after tokens are consumed. A single large-context call can exceed the budget before termination triggers.

7. **Compaction cost itself unbounded.** Opencode's compaction agent costs tokens to run. Over many compaction cycles, summaries accumulate and consume context that could hold fresh turns.

## Notable Absences

1. **Adaptive/Cost-Aware Model Selection.** No repo implements a router that selects a model based on prompt complexity, token budget, latency targets, or accumulated cost. The closest is openhands' MultimodalRouter (content-based: images → primary, text-only → secondary) and opencode's `Catalog.model.small()` (static selection, not per-request dynamic).

2. **Hard Per-Execution Dollar Cost Ceilings.** Mastra's CostGuard is approximate. OpenHands' `max_budget_per_task` exists but is not enforced. No repo has a hard, pre-call dollar-cost check that blocks a request before it is sent.

3. **Speculative Execution Across Models.** No repo runs multiple models in parallel and uses the fastest or cheapest result. Nemo-guardrails' speculative execution races input rails against LLM generation, but this is safety, not cost optimization.

4. **Prompt Compression Beyond Truncation.** No repo implements semantic compression (summarizing or condensing prompt content to reduce token count while preserving meaning). Opencode's session compaction is the closest but uses a compaction agent (which costs tokens itself).

5. **Batching Across Turns.** No repo batches multiple agent turns into a single LLM call. Tool call batching within a turn exists (openhands, langgraph), but cross-turn batching is absent.

6. **Provider-Side Prompt Caching for Non-OpenAI/Anthropic Providers.** Mastra's cache is client-side only. OpenAI and Anthropic prompt caching is available only through those providers' APIs. Self-hosted models get no prompt caching benefit.

7. **Rate-Limit Queuing (vs. Retry).** No repo implements client-side request queuing with rate-limit awareness. All handle rate limits via retry with backoff after receiving a 429. Temporal's token-bucket approach is closest but operates at the infrastructure layer, not the application layer.

8. **Cost Allocation Per User/Tenant.** Only langfuse (as an observability platform) and temporal (via namespace-level rate limits) have any notion of per-tenant cost allocation. Agent frameworks lack multi-tenant cost isolation.

## Per-Repo Notes

**temporal (8/10)**: Not an LLM system, but the most sophisticated runtime economics in the study. Health-sensitive dynamic backpressure, token-bucket rate limiting at every layer, ownership-based quota scaling. The pattern of per-API token costing (long-poll = 1 token, short op = 0 tokens) is directly adaptable to LLM systems for per-request cost prioritization.

**mastra (7/10)**: The processor pipeline architecture is the most extensible cost-control pattern in the study. TokenLimiter + CostGuard + ResponseCache + ModelFallback as composable processors. The cost guard's async-metric approximation is a weakness — hard ceilings would require live per-token cost estimation.

**opencode (7/10)**: Strong prompt caching with a well-justified default policy. Session compaction with tail preservation is the best context-budgeting pattern in the study. Model cost data flows through three layers (remote → schema → internal) but is never used for real-time spend accounting — a gap.

**openhands (7/10)**: The most comprehensive cost tracking (per-call dollar cost, token breakdown, latency). MultimodalRouter is the closest to adaptive model selection. The critical gap: `max_budget_per_task` is tracked but not enforced. Tool-call batching is the best implementation in the study.

**nemo-guardrails (7/10)**: LFU cache with thread-safe get-or-compute is production-grade. Speculative execution hides input rail latency. ContextVar-based token accounting enables deep observability without explicit parameter passing. Cache disabled by default is a missed opportunity.

**aider (6/10)**: Chat history summarization and cache warming are pragmatic. Weak model for commits is a simple but effective cost-saving pattern. The lack of any hard budget enforcement or adaptive routing limits its production readiness.

**autogen (6/10)**: TokenUsageTermination is the cleanest termination-based budget pattern. ChatCompletionCache with pluggable backends is well-designed. Post-hoc enforcement and lack of pre-call gating are the main weaknesses.

**langfuse (6/10)**: Tokenization via worker thread pool with configurable pool size is a robust pattern for observability workloads. Pricing tier matching with conditional cost calculation is sophisticated. Not an agent runtime — budgets and routing are out of scope.

**opa (5/10)**: The most extensive caching infrastructure in the study (trie-based intra-query caches, inter-query caches, JWT, regex, glob). Not an LLM system; no token or cost concepts. Evaluation operation counters are the closest thing to token tracking.

**openai-agents-python (5/10)**: Clean per-request usage granularity. Server-side prompt caching via OpenAI API. No client-side caching, no cost enforcement, no model fallback. Designed as an SDK layer that delegates cost management to the caller.

**langgraph (4/10)**: Provider-delegated token tracking with no native cost control. Multi-level caching is strong. Step-based execution limits do not control token spend. The dynamic model selection hook is available but users must implement all routing logic.

**guardrails (3/10)**: Passthrough token counting with no enforcement. Runner loop controls retries but not cost. Streaming token estimation via tiktoken is the only redeeming pattern. No caching, no adaptive routing, no budgets.

**hellosales (3/10)**: No token counting — the LLM provider contract lacks usage fields. No cost tracking. No caching beyond `@lru_cache` on settings. Message-count truncation is a coarse proxy for cost control. Backup model activates only on final attempt, making it a failover mechanism, not a cost strategy.

## Open Questions

1. **Why does adaptive model selection remain unimplemented across all repos?** The infrastructure exists (Metrics in openhands, cost data in opencode's model schema, DynamicArgument in mastra), yet no system routes based on complexity, cost, or latency. Is this a deliberate engineering choice (complexity, risk of quality degradation) or an unaddressed opportunity?

2. **Can cost-aware routing be effective without a complexity classifier?** OpenHands' MultimodalRouter uses image presence as a proxy. What other cheap proxies exist (prompt length, tool count, domain)?

3. **What is the cost of compaction?** Opencode's compaction agent burns tokens. At what compaction frequency does the cost of compaction exceed the cost of context overflow? No repo addresses this tradeoff.

4. **Should response caching be per-agent or global?** Mastra uses agent+step+scope; autogen uses per client; nemo-guardrails uses per model. What is the optimal isolation boundary?

5. **Is the absence of prompt compression technology a gap or a deliberate choice?** Summarization costs tokens; truncation loses information. Are there zero-shot compression techniques (extractive, learned) that would be cost-effective?

6. **What is the right metric for runtime economics effectiveness?** Total cost? Cost per task? Cost variance? Budget adherence? Latency-cost Pareto? No repo defines a success metric for its cost-control mechanisms.

7. **How should multi-tenant cost isolation work in agent frameworks?** Temporal has namespace-level rate limits. Langfuse has per-project usage thresholds. Agent frameworks have no equivalent.

## Evidence Index

Every evidence reference in this report follows the `path/to/file.ts:NN` format. Below is a consolidated index of key evidence by area.

### Caching

| Evidence | Report |
|----------|--------|
| opencode cache policy engine `packages/llm/src/cache-policy.ts:99-111` | opencode |
| openhands prompt caching `openhands/sdk/llm/llm.py:1380-1407` | openhands |
| nemo-guardrails LFU cache `nemoguardrails/llm/cache/lfu.py:80-470` | nemo-guardrails |
| autogen ChatCompletionCache `autogen-ext/src/autogen_ext/models/cache/_chat_completion_cache.py:176-204` | autogen |
| mastra ResponseCache `packages/core/src/processors/processors/response-cache.ts:193-313` | mastra |
| aider cache warming `aider/coders/base_coder.py:1340-1394` | aider |
| langgraph server-side KV cache `libs/sdk-py/langgraph_sdk/cache.py:59-90` | langgraph |
| temporal workflow state cache `service/history/workflow/cache/cache.go:93-149` | temporal |
| opa trie-based caches `v1/topdown/cache.go:14-304` | opa |
| langfuse model match cache `packages/shared/src/server/ingestion/modelMatch.ts:44-156` | langfuse |

### Token Budgets / Cost Enforcement

| Evidence | Report |
|----------|--------|
| autogen TokenUsageTermination `autogen-agentchat/src/autogen_agentchat/conditions/_terminations.py:250-255` | autogen |
| mastra CostGuardProcessor `packages/core/src/processors/processors/cost-guard.ts:154-306` | mastra |
| opencode session compaction `packages/opencode/src/session/compaction.ts:306-350` | opencode |
| openhands max_budget_per_task `openhands/sdk/llm/utils/metrics.py:86-87` | openhands |
| nemo-guardrails max_tokens per task `nemoguardrails/rails/llm/config.py:447-451` | nemo-guardrails |
| temporal rate limit interceptor `common/rpc/interceptor/rate_limit.go:46-60` | temporal |
| openai-agents-python max_turns `src/agents/run_config.py:33, 197-198` | openai-agents-python |
| aider max_chat_history_tokens `aider/models.py:349-351` | aider |
| langgraph recursion limit `libs/langgraph/langgraph/pregel/_loop.py:1668,1927` | langgraph |

### Model Fallback / Routing

| Evidence | Report |
|----------|--------|
| openhands FallbackStrategy `openhands/sdk/llm/fallback_strategy.py:39-149` | openhands |
| openhands MultimodalRouter `openhands/sdk/llm/router/impl/multimodal.py:29-61` | openhands |
| mastra model fallback array `packages/core/src/agent/types.ts:227-235` | mastra |
| opencode small model selection `packages/core/src/catalog.ts:204-256` | opencode |
| aider weak model for commits `aider/models.py:596-616` | aider |
| hellosales backup model `src/hello_sales_backend/platform/llm/providers/openai_compatible.py:171-174` | hellosales |
| openai-agents-python MultiProvider `src/agents/models/multi_provider.py:61-260` | openai-agents-python |

### Tool Batching / Parallelism

| Evidence | Report |
|----------|--------|
| openhands _ActionBatch `openhands/sdk/agent/agent.py:112-238` | openhands |
| openhands ParallelToolExecutor `openhands/sdk/agent/parallel_executor.py:38-162` | openhands |
| langgraph parallel tool execution `libs/prebuilt/langgraph/prebuilt/tool_node.py:821-858` | langgraph |
| temporal replication batching `service/history/replication/batchable_task.go:17-25` | temporal |

### Rate Limiting / Backoff

| Evidence | Report |
|----------|--------|
| temporal health rate limiter `common/persistence/client/health_request_rate_limiter.go:109-138` | temporal |
| opencode retry executor `packages/llm/src/route/executor.ts:90-147` | opencode |
| openhands retry mixin `openhands/sdk/llm/utils/retry_mixin.py:22-128` | openhands |
| nemo-guardrails retry client `nemoguardrails/llm/clients/base.py:185-240` | nemo-guardrails |
| mastra rate limit header parsing `packages/core/src/llm/model/model.loop.ts:267-271` | mastra |
| aider exponential backoff `aider/models.py:1038-1073` | aider |
| hellosales LLM retry loop `src/hello_sales_backend/platform/llm/providers/openai_compatible.py:421-541` | hellosales |

### Token Tracking / Cost Calculation

| Evidence | Report |
|----------|--------|
| openhands Metrics `openhands/sdk/llm/utils/metrics.py:34-312` | openhands |
| openhands cost computation `openhands/sdk/llm/utils/telemetry.py:248-286` | openhands |
| openai-agents-python Usage class `src/agents/usage.py:102-205` | openai-agents-python |
| nemo-guardrails UsageInfo + LLMStats `nemoguardrails/types.py:52-58`, `nemoguardrails/logging/stats.py:19-35` | nemo-guardrails |
| langfuse tokenCount `worker/src/features/tokenisation/usage.ts:31-55` | langfuse |
| opencode token estimation `packages/opencode/src/util/token.ts:1-4` | opencode |
| opencode usage schema `packages/llm/src/schema/events.ts:50-73` | opencode |
| aider cost tracking `aider/coders/base_coder.py:2000-2061` | aider |
| aider model info cache `aider/models.py:154-168` | aider |
| langfuse cost calculation `worker/src/services/IngestionService/index.ts:1280-1352` | langfuse |
| langfuse pricing tier matcher `packages/shared/src/server/pricing-tiers/matcher.ts:88-125` | langfuse |

---

## HelloSales — Improvement Recommendations

Based on all reference system patterns found, the following changes are recommended for HelloSales.

### Quick Wins (Low Effort, High Impact)

1. **Extract token counts from provider responses.** HelloSales' `OpenAICompatibleLLMProvider` ignores usage data even when the provider returns it. Add a `usage` field to `TextGenerationResult`, `JSONGenerationResult`, and `ToolCallCompletionResult` (`src/hello_sales_backend/platform/llm/contracts.py:61-88`). Parse `response.usage` in `_post_chat_completion` (`src/hello_sales_backend/platform/llm/providers/openai_compatible.py:421-541`). This is a 1-day change and unlocks every downstream cost-control feature. Pattern: openai-agents-python's `Usage` class (`src/agents/usage.py:102-205`).

2. **Replace message-count truncation with token-aware context budgeting.** `AgentContextBudget.max_context_messages` (`src/hello_sales_backend/platform/agents/context.py:50-54`) truncates by count, not tokens. A conversation of 50 short messages passes while 5 long ones may overflow. Add a token budget parameter and use client-side estimation (tiktoken or char/4 heuristic) to enforce it. Pattern: opencode's session compaction (`packages/opencode/src/session/compaction.ts:306-350`) or nemo-guardrails' `max_tokens` per task (`nemoguardrails/rails/llm/config.py:447-451`).

3. **Add `max_tool_iterations` to limit per-turn LLM calls.** HelloSales already has `max_tool_iterations = 8` (`src/hello_sales_backend/platform/agents/config.py:15`). Make this configurable per agent run and emit a warning when approaching the limit. Add equivalent `max_llm_calls` to cap total LLM invocations. Pattern: openai-agents-python's `max_turns` (`src/agents/run_config.py:33, 197-198`).

4. **Log token usage per request to structured logging.** Even without budget enforcement, log the `usage` data extracted in recommendation #1 per LLM call. This enables dashboards, cost analysis, and anomaly detection. Pattern: openhands' `Metrics.accumulated_token_usage` (`openhands/sdk/llm/utils/metrics.py:34-73`).

5. **Enable response caching for deterministic tool calls.** Tool invocations with identical inputs produce identical LLM responses. Add an LRU cache (or LFU, as in nemo-guardrails) keyed on SHA-256 of the request prompt. Start with in-memory, 5-minute TTL. Pattern: mastra's `ResponseCache` with `MastraServerCache` backend (`packages/core/src/processors/processors/response-cache.ts:193-313`).

### Long-Term Improvements (High Effort, Architectural)

1. **Implement token-based cost budgets per execution.** Add a `max_cost` parameter to `AgentRuntime` and check accumulated cost before each LLM call. Use provider-reported token counts from recommendation #1 multiplied by hardcoded or configurable per-model pricing. Pattern: mastra's `CostGuardProcessor` (`packages/core/src/processors/processors/cost-guard.ts:154-306`) with pre-call checking — but make it a hard ceiling, not approximate.

2. **Add model fallback chain with configurable routing.** HelloSales' `backup_model` activates only on final attempt (`src/hello_sales_backend/platform/llm/providers/openai_compatible.py:171-174`). Replace this with a configurable fallback array: `[primary_model, secondary_model, tertiary_model]`. Each fallback should have its own `max_retries` and `model_settings`. Pattern: mastra's `ModelWithRetries` type (`packages/core/src/agent/types.ts:227-235`) and openhands' `FallbackStrategy` (`openhands/sdk/llm/fallback_strategy.py:39-149`).

3. **Build a MultimodalRouter variant for HelloSales.** Implement a content-aware router that sends image-heavy or complex queries to a capable (expensive) model and text-only simple queries to a cheaper model. Use prompt length and tool call count as complexity proxies. Pattern: openhands' `MultimodalRouter` (`openhands/sdk/llm/router/impl/multimodal.py:29-61`).

4. **Implement tool call batching with parallel execution.** HelloSales executes tool calls sequentially (`src/hello_sales_backend/platform/agents/runtime.py:299`). Add a `ToolBatchExecutor` that runs independent tool calls concurrently. Add atomicity enforcement (all succeed or roll back as a unit). Pattern: openhands' `_ActionBatch` + `ParallelToolExecutor` (`openhands/sdk/agent/agent.py:112-238`, `openhands/sdk/agent/parallel_executor.py:38-162`).

5. **Add provider-level prompt caching markers.** For supported providers (Anthropic, OpenAI), add configurable cache breakpoints to system prompts and tool definitions. Use an opt-out default (enabled by default). Pattern: opencode's cache policy engine (`packages/llm/src/cache-policy.ts:99-111`) and openhands' `_apply_prompt_caching()` (`openhands/sdk/llm/llm.py:1380-1407`).

6. **Build a processor pipeline architecture for cost controls.** Rather than hardcoding cost logic in agent/worker runtimes, implement a composable processor pipeline with input/output/LLM-request/LLM-response hooks. Start with `TokenLimiterProcessor` and `CostGuardProcessor`. Pattern: mastra's processor pipeline (`packages/core/src/processors/processors/` — 18+ processor implementations).

7. **Add per-tenant cost isolation.** HelloSales appears to be a single-tenant system today, but if multi-tenant is on the roadmap, add tenant-scoped cost tracking and budget enforcement now. The `request_context` seam already exists — attach a tenant ID and use it for cost accounting and rate limit enforcement. Pattern: temporal's namespace-level rate limits (`common/rpc/interceptor/namespace_rate_limit.go:1-179`) and mastra's resource-scoped cache isolation.

### Risks (What Could Go Wrong If Not Addressed)

1. **Unbounded cost in production.** HelloSales has no mechanism to limit spending. A single agent run with tool loops, large context, and no token budget could accumulate hundreds of dollars in API costs. **Risk: HIGH.** Mitigation: implement quick wins #1 and #3 immediately.

2. **Rate limit storms.** The provider-level retry loop (`src/hello_sales_backend/platform/llm/providers/openai_compatible.py:176-179`) uses linear backoff without rate limit header parsing. If `retry_backoff_seconds = 0` and the provider returns 429, retries fire immediately and worsen rate limiting. **Risk: MEDIUM.** Mitigation: implement opencode's rate limit header parsing pattern (`packages/llm/src/route/executor.ts:90-147`).

3. **Context overflow on long-running sessions.** Without token-aware context budgeting, a session with many turns will eventually exceed the model's context window. The `max_context_messages` limit is a count-based proxy that doesn't prevent overflow. **Risk: MEDIUM.** Mitigation: implement quick win #2.

4. **No cost observability for stakeholders.** Without token or cost tracking, product managers and operators have no visibility into LLM spend. Budget requests, capacity planning, and cost optimization are impossible. **Risk: MEDIUM.** Mitigation: implement quick win #4.

5. **Backup provider never activates.** The `backup_provider` seam activates on final attempt only (`src/hello_sales_backend/platform/workers/runtime.py:473-481`). If `max_attempts = 1`, the backup is never used. **Risk: LOW.** Mitigation: review and document the activation threshold.

---

Generated by protocol `study-areas/20-runtime-economics.md`.
