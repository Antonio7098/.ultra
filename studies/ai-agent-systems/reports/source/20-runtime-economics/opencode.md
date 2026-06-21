# Repo Analysis: opencode

## Runtime Economics Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opencode |
| Path | `repos/opencode` |
| Language / Stack | TypeScript (bun monorepo with Turborepo) |
| Analyzed | 2026-05-17 |

## Summary

OpenCode implements a multi-layered runtime economics system centered on prompt caching, session compaction with token budgets, model selection with cost-aware small-model fallback, automated retry with rate-limit backoff, and configurable execution budgets for thinking/reasoning. The system is designed primarily for client-side cost control rather than per-request billing: there is no hard execution cost cap, but context-window overflow is proactively managed through compaction and pruning. The console/cloud tier adds server-side rate limiting (TPM, TPS, IP, key-based) and billing infrastructure absent from the CLI.

## Rating

**Score: 7** — Token budgets, caching, and cost tracking exist. Session compaction automates context-aware token budgeting. Model catalog carries per-model cost data with tiers. No hard per-execution spending cap or adaptive model routing across providers. Batching is absent. The answer to the rubric heuristic ("Would you let this run unattended?") is **yes for context overflow** (automatic compaction prevents crashes) but **not reliably for cost** — unbounded tool loops (up to step count) and no per-turn spending limit mean a runaway agent could accumulate significant API charges before hitting the step cap.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Token estimation | Simple chars/4 heuristic | `packages/opencode/src/util/token.ts:1-4` |
| Token usage schema | `Usage` class with input, output, cache, reasoning fields | `packages/llm/src/schema/events.ts:50-73` |
| Session compaction | Context overflow detection, token budget calculation, prune | `packages/opencode/src/session/compaction.ts:36-42,137-142,306-350` |
| Compaction config | Configurable auto/prune/tail_turns/preserve_recent_tokens/reserved | `packages/opencode/src/config/config.ts:254-272` |
| Overflow detection | `usable()` computes available context minus reserved buffer | `packages/opencode/src/session/overflow.ts:8-26` |
| Cache policy engine | Applies `"auto"`/`"none"`/object-form CacheHint to tools, system, messages | `packages/llm/src/cache-policy.ts:18-22,99-111` |
| Cache breakpoint cap | 4-breakpoint limit for Anthropic/Bedrock | `packages/llm/src/protocols/utils/cache.ts:10-16` |
| Model cost schema | `Cost` struct with input/output/cache tiers | `packages/core/src/model.ts:23-34` |
| Remote model costs | Cost schema with tiers and context_over_200k | `packages/opencode/src/provider/models.ts:13-38` |
| Model cost propagation | Remote API costs mapped to internal Model cost objects | `packages/opencode/src/provider/provider.ts:989-999` |
| Rate limit handling | Retry with exponential backoff on 429/503/504/529; parses OpenAI/Anthropic rate limit headers | `packages/llm/src/route/executor.ts:34-37,90-147,334-353` |
| Thinking budget (Anthropic) | `budgetTokens` lowered to `budget_tokens` in body | `packages/llm/src/protocols/anthropic-messages.ts:125-128,344-354` |
| Thinking budget (provider transform) | Maps `"high"`/`"max"`/`"custom"` to token values for many providers | `packages/opencode/src/provider/transform.ts:700-714` |
| Small model selection | `Catalog.model.small()` scores models by cost + age | `packages/core/src/catalog.ts:204-256` |
| Small model priority list | Hardcoded model name priorities for cheap fallback | `packages/opencode/src/provider/provider.ts:1671-1679` |
| Default model selection | Config model, recent-model history, fallback to sorted provider models | `packages/opencode/src/provider/provider.ts:1715-1747` |
| Prompt caching (request-level) | `promptCacheKey` set to sessionID for OpenAI | `packages/opencode/src/provider/transform.ts:1096-1098` |
| Tool output pruning | `PRUNE_MINIMUM=20000` / `PRUNE_PROTECT=40000` thresholds | `packages/opencode/src/session/compaction.ts:36-38,306-350` |
| Console TPM rate limiter | Per-model per-minute token tracking | `packages/console/app/src/routes/zen/util/modelTpmLimiter.ts:5-47` |
| Console billing infrastructure | `billing.ts` and monthly limit UI | `packages/console/core/src/billing.ts` |

## Answers to Protocol Questions

**1. How are token counts tracked?** Through the `Usage` schema (`packages/llm/src/schema/events.ts:50-73`), which captures `inputTokens`, `outputTokens`, `totalTokens`, and breakdown fields (`nonCachedInputTokens`, `cacheReadInputTokens`, `cacheWriteInputTokens`, `reasoningTokens`). A client-side `estimate()` helper (`packages/opencode/src/util/token.ts:3`) provides rough char/4 heuristic used during compaction budget calculations. Session compaction also computes per-turn token sizes via `Token.estimate(JSON.stringify(msgs))` (`packages/opencode/src/session/compaction.ts:249`).

**2. Is there a cost budget per execution?** No hard cost budget. The system has token budgets for context management (compaction thresholds, thinking budgetTokens) but no mechanism to limit per-execution dollar spend. The only guard is the step-count ceiling in tool loops (`LLM.stepCountIs(10)`) per `packages/llm/AGENTS.md`.

**3. Are responses cached?** Prompt-level caching is the primary caching mechanism. The `CachePolicy` engine (`packages/llm/src/cache-policy.ts:99-111`) injects `CacheHint` markers onto tool definitions, system prompts, and the latest user message by default (`"auto"` mode). Cache markers are respected by Anthropic (`anthropic-messages`) and Bedrock; other providers use implicit caching. A 4-breakpoint cap is enforced (`packages/llm/src/protocols/utils/cache.ts:10`). Response caching (key-value cache of LLM responses) is not implemented.

**4. Is there model fallback (cheaper model for simple tasks)?** Yes. `Catalog.model.small()` (`packages/core/src/catalog.ts:204-256`) selects a cheap model by scoring candidates on cost (80% weight) and age (20% weight), preferring models matching `SMALL_MODEL_RE = /\b(nano|flash|lite|mini|haiku|small|fast)\b/`. The CLI provider has a hardcoded small-model priority list (`packages/opencode/src/provider/provider.ts:1671-1679`). This is available via `Provider.getSmallModel()` but is not automatically invoked during normal session execution — it is used explicitly by callers.

**5. How is latency managed?** No explicit latency budget. The rate-limit retry layer (`packages/llm/src/route/executor.ts:34-37,90-147`) handles transient failures with exponential backoff (`BASE_DELAY_MS=500`, `MAX_DELAY_MS=10000`, `MAX_RETRIES=2`). Session compaction reduces context size to avoid overflow, which indirectly improves latency by keeping prompt sizes manageable. No adaptive timeout or latency-aware routing exists.

**6. Are tool calls batched?** No. Tool calls are sequential per-step (the model emits multiple tool calls in a single response, but they execute concurrently via `Effect.forEach`). There is no mechanism to batch tool calls across turns. The config schema has an `experimental.batch_tool` flag (`packages/opencode/src/config/config.ts:277`) but no implementation was found.

**7. Is there adaptive model selection?** Partial. The `Catalog.model.small()` selection is cost-aware but not dynamic at runtime — it picks once based on static model metadata. There is no per-request routing that selects models based on prompt complexity, token count, or semantic content. The default model is chosen from config, recent usage history, or sorted provider models (`packages/opencode/src/provider/provider.ts:1715-1747`), but this selection is session-level, not per-turn.

**8. How are expensive operations (e.g., large context) gated?** The primary overflow gate is session compaction. `isOverflow()` (`packages/opencode/src/session/overflow.ts:19-25`) detects when total tokens exceed `usable()` (context minus reserved buffer of `COMPACTION_BUFFER=20000`). When overflow is detected, compaction triggers: recent turns are preserved verbatim (up to `preserveRecentBudget`, default 25% of usable context, clamped 2000-8000), older content is summarized, and tool outputs beyond a protection threshold (`PRUNE_PROTECT=40000`, `PRUNE_MINIMUM=20000`) are erased from older turns (`packages/opencode/src/session/compaction.ts:306-350`). The compaction auto-continue feature re-sends the user message after summary to maintain workflow. No hard input token limit enforcement exists at the LLM request layer — overflow is managed reactively after a response is returned.

## Architectural Decisions

- **Prompt caching by default**: The `"auto"` cache policy is the default for all requests (`packages/llm/src/cache-policy.ts:26-28`). The decision is explicitly justified by Anthropic's cache economics (1.25x write, 0.1x read — a single reuse wins).
- **Client-side char/4 token estimation**: Instead of using a tokenizer, the system uses a 4-char-per-token heuristic for compaction budget calculations (`packages/opencode/src/util/token.ts:1-4`). This is intentionally fast and approximate since compaction only needs relative sizing.
- **Compaction over truncation**: Rather than hard-truncating context, the system preserves recent verbatim turns with a budget-based tail and summarizes older content via a compaction agent. This retains maximum useful context while fitting within model limits.
- **Effect Schema-first cost model**: Costs are modeled as Effect Schema structs with tiers (`packages/core/src/model.ts:23-34`), enabling cost-based model selection to be composed with other Effect services.
- **Provider-agnostic caching layer**: The `CachePolicy` engine is decoupled from protocol implementations. Only `anthropic-messages` and `bedrock-converse` respect inline cache hints; other providers (OpenAI, Gemini) skip the policy pass and rely on their own implicit caching (`packages/llm/src/cache-policy.ts:42`).

## Notable Patterns

- **Three-layer cost data**: Costs flow from remote API (`packages/opencode/src/provider/models.ts`) through a schema-defined `Cost` struct with `tiers` and `context_over_200k` into the internal `ModelV2.Cost` schema (`packages/core/src/model.ts:23-34`). Costs are attached to models but never used for real-time spend accounting.
- **Thinking budget propagation**: Thinking/reasoning `budgetTokens` flow from config → provider transform → protocol-level lowering, with per-provider mapping for Anthropic, Google, OpenAI, Bedrock, and OpenAI-compatible providers (`packages/opencode/src/provider/transform.ts:700-760`).
- **Cross-process cache coherency**: Model fetch uses `Flock` advisory locks (`packages/opencode/src/provider/models.ts:167-171`) so concurrent opencode processes safely share the model cache file without corruption.
- **Redacted credentials in errors**: The executor redacts sensitive header values and body fields in error contexts to prevent credential leakage in logs (`packages/llm/src/route/executor.ts:47-53,59-194`).

## Tradeoffs

| Tradeoff | Choice | Rationale |
|----------|--------|-----------|
| Token estimation vs tokenization | Char/4 heuristic | Fast, no dependency on provider tokenizers, sufficient for compaction decisions |
| Prompt caching vs response caching | Prompt caching only | Provider prompt caching (Anthropic 5m) yields immediate cost savings; response caching would add complexity for limited benefit in tool-use loops |
| Auto-compaction vs hard context limit | Soft compaction with auto-continue | Preserves workflow continuity; user may not notice compaction happened. Risk: compaction agent costs tokens itself |
| Cost data vs cost enforcement | Cost data stored, not enforced | Model costs are available to consumers but no runtime enforces spending limits |
| Rate limit handling | Client-side retry only | Retry up to 2x with backoff; no client-side rate-limit queuing — the system depends on the provider for throttling |
| Small model selection | Priority-list-based | Simple, predictable, but not adaptive to actual task complexity |

## Failure Modes / Edge Cases

- **Compaction failure loop**: If the compaction agent itself exceeds context limits, it returns `"compact"` and sets an error (`packages/opencode/src/session/compaction.ts:467-476`). This is the last-resort error path, but it leaves the session in an error state.
- **Token estimate invalidity**: The char/4 heuristic undercounts code-heavy or non-English text (actual ratios vary 2-6). This means compaction may trigger earlier or later than desired, but never causes overflow since compaction uses estimates conservatively.
- **No per-execution cost cap**: An opencode agent with tool access can run many steps (up to the step limit), each consuming tokens. Without a dollar budget, cost grows unboundedly in long sessions.
- **Cache marker exhaustion**: Anthropic/Bedrock enforce a 4-breakpoint cap. The cache policy allocates in invalidation order (tools → system → messages), so cache hints on earlier messages may be silently dropped when the cap is reached (`packages/llm/src/protocols/utils/cache.ts:10`).
- **Growth of compaction summaries**: Each compaction creates a summary message that persists in history. Over many compaction cycles, summaries accumulate and consume context that could otherwise hold fresh turns.

## Future Considerations

- **Per-execution cost budget**: A hard spending cap per session or per turn, enforced before the LLM request is sent, would provide predictable cost control.
- **Dynamic model routing**: Routing simple prompts to cheaper models and complex reasoning to expensive ones based on prompt structure or estimated complexity.
- **Response caching**: Caching LLM responses for deterministic or repeated queries could reduce costs for tool outputs or file reads.
- **Tool call batching**: The `experimental.batch_tool` flag suggests intent to batch tool calls, but no implementation was found in this version.
- **Client-side rate-limit queuing**: Integrating with provider rate limits to pre-queue requests rather than relying solely on retry-backoff after 429 responses.

## Questions / Gaps

- No evidence was found of any mechanism to compute or display dollar cost per session or per request. The cost data exists in model metadata but is never logged or tracked in real-time spend accounting.
- The `experimental.batch_tool` config key (`packages/opencode/src/config/config.ts:277`) exists but has no corresponding implementation — unclear if this is a future feature placeholder or dead config.
- No context-window monitoring is done during the actual LLM request — overflow detection happens reactively on the returned `tokens` object after the response arrives. Real-time truncation mid-request is not supported.
- No evidence of cost-based routing across providers (e.g., "if provider A is cheaper for this prompt, route there"). All routing is by model ID, not cost comparison.

---

Generated by `study-areas/20-runtime-economics.md` against `opencode`.
