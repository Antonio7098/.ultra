# Repo Analysis: opa

## Runtime Economics Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opa |
| Path | `repos/opa` |
| Language / Stack | Go |
| Analyzed | 2026-05-17 |

## Summary

OPA (Open Policy Agent) is a policy engine, not an LLM agent framework, so its "runtime economics" maps to evaluation cost rather than token spend. It has no discrete token or step budget, no cost-aware query planning, and no model selection. What it does have is deep multi-layer caching (virtual, base, comprehension, inter-query HTTP, JWT, regex/glob, prepared queries, compilation), operation-level instrumentation counters (`eval_op_*`), HTTP request body size limits, and a hardcoded partial-evaluation result cap. Rate limiting exists only for decision log uploads, not query evaluation. Evaluation can be cancelled via context deadlines but has no step counter or iteration budget. The system is designed for correctness and throughput, not cost-aware execution.

## Rating

**5 / 10**

OPA provides extensive caching infrastructure and operation-level metrics but lacks any form of execution budgeting, step limits, token tracking, or cost-aware routing. The "would you let this run unattended?" heuristic: yes, because OPA's evaluation surface is bounded by policy size and input data, not by LLM API costs — but there is no mechanism to cap runaway evaluation beyond the Go context deadline.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Token counting | 14 evaluation operation counter constants (`eval_op_plug`, `eval_op_resolve`, `eval_op_builtin_call`, etc.) for diagnosing eval cost | `v1/topdown/instrumentation.go:9-27` |
| Metrics infrastructure | Well-known metric names for server handler, cache hits, Rego compile/eval timing | `v1/metrics/metrics.go:21-43` |
| Virtual cache (rule eval) | Trie-based cache storing evaluated rule results within a single query; Push/Pop/Get/Put lifecycle | `v1/topdown/cache.go:14-136` |
| Base cache (storage reads) | Trie-based cache for base document lookups; prevents redundant storage reads | `v1/topdown/cache.go:139-237` |
| Comprehension cache | Caches comprehension (array/set/object) evaluation results within a query | `v1/topdown/cache.go:240-304` |
| Virtual cache hit/miss counting | Counter increments for cache hits and misses during rule evaluation | `v1/topdown/eval.go:2342-2354` |
| Base cache hit/miss counting | Counter increments for base document cache hits and misses | `v1/topdown/eval.go:1902-1915` |
| Comprehension cache stats | Skip/build/hit/miss counters for comprehension evaluations | `v1/topdown/eval.go:1392-1445` |
| Inter-query cache (cross-query) | Configurable cache with `MaxSizeBytes`, `ForcedEvictionThresholdPercentage`, `StaleEntryEvictionPeriodSeconds`; FIFO eviction | `v1/topdown/cache/cache.go:1-666` |
| Inter-query cache config | `Config` struct with `inter_query_builtin_cache` and `inter_query_builtin_value_cache` settings | `v1/topdown/cache/cache.go:40-149` |
| Inter-query HTTP cache | `checkHTTPSendInterQueryCache` caches `http.send` responses across queries using TTL from HTTP cache headers | `v1/topdown/http.go:876-987` |
| JWT token cache | Named cache `"io_jwt"` for caching JWT decode/verify results; registered default config | `v1/topdown/tokens.go:1238-1280, 1299` |
| Regex pattern cache | Two-tier cache (inter-query value cache + local 100-entry LRU) for compiled regex patterns | `v1/topdown/regex.go:19-155` |
| Glob pattern cache | Same two-tier pattern for compiled glob patterns, capped at 100 entries | `v1/topdown/glob.go:13-109` |
| Prepared eval query cache | Fixed-size FIFO cache (default 100) for compiled partial queries; invalidated on policy reload | `v1/server/cache.go:1-53` |
| Server query cache hit metric | `server_query_cache_hit` counter incremented on cached prepared query reuse | `v1/server/server.go:1230-1238` |
| Compile unknowns cache | LRU cache (size 500) for computed unknowns from compiler annotations | `v1/server/compile_handler.go:41-42, 363-418` |
| Compile masking rules cache | LRU cache (size 500) for masking rules from compiler annotations | `v1/server/compile_handler.go:41-42, 363-418` |
| NDBCache (non-deterministic builtins) | Caches results of non-deterministic builtins within a query; skips re-evaluation | `v1/topdown/builtins/builtins.go:37-94` |
| NDBCache config toggle | `Config.NDBuiltinCache bool` enables/disables the non-deterministic builtin cache | `v1/config/config.go:98` |
| Request body size limits | `DecodingLimitsHandler` middleware enforces `MaxLength` on request body and gzip decompressed size | `v1/server/handlers/decoding.go:20-53` |
| Partial eval result limit | Hardcoded limit `size <= 16` to prevent partial evaluation result blowup (noted as arbitrary) | `v1/topdown/eval.go:4445-4448` |
| Parsing exponent limit | Limits exponent digits in byte parsing to prevent DoS from non-linear parsing cost | `v1/topdown/parse_bytes.go:50` |
| AST parser exponent limit | "Put limit on size of exponent to prevent non-linear cost of String()" | `v1/ast/parser.go:1951` |
| Compiler error limit | Configurable error limit passed to compiler to abort on too many errors | `v1/server/server.go:141, 361-365` |
| Decision log rate limiting | `MaxDecisionsPerSecond *float64` config; drops events when rate exceeded using `golang.org/x/time/rate` | `v1/plugins/logs/plugin.go:274, 283-291` |
| Event buffer rate limiter | `eventBuffer.limiter *rate.Limiter`; `WithLimiter(*float64)`; `limiter.Allow()` check on push | `v1/plugins/logs/eventBuffer.go:31, 59-64, 161-168` |
| Size buffer rate limiter | Same rate limiting pattern for size-based buffer | `v1/plugins/logs/sizeBuffer.go:21, 39-43, 113-119` |
| Evaluation cancellation | `Cancel` interface using atomic flag; checks `e.cancel.Cancelled()` on each expression | `v1/topdown/cancel.go:1-33` |
| Context deadline cancellation | Eval expression returns `CancelErr` when context deadline exceeded | `v1/topdown/eval.go:417-429` |
| HTTP send timeout | `defaultHTTPRequestTimeout = 5s`; configurable via `HTTP_SEND_TIMEOUT` env var or `"timeout"` parameter | `v1/topdown/http.go:39-44` |
| HTTP retry budget | `max_retry_attempts` parameter with min/max retry delay (max 60s) and exponential backoff | `v1/topdown/http.go:123-124, 720-744` |
| Decision log batching | `BatchDecisionID` field on `EventV1` for grouping related decisions; size- and event-based buffers for chunked upload | `v1/plugins/logs/plugin.go:52, 109-110` |
| OpenTelemetry batch config | Configurable batch span processor: `BatchTimeoutMs` (5000), `MaxExportBatchSize` (512), `MaxQueueSize` (2048) | `v1/internal/distributedtracing/distributedtracing.go:48-188` |
| REPL pretty limit | `prettyLimit` default 80 for limiting REPL output | `v1/repl/repl.go:71-72` |
| External rule sources | `eval_op_external_rule_source` counter; Wasm resolver for alternative policy execution backends | `v1/topdown/instrumentation.go:22`; `v1/resolver/wasm/` |

## Answers to Protocol Questions

**1. How are token counts tracked?**
OPA does not track token counts. Instead, it tracks evaluation operations via instrumentation counters (`eval_op_plug`, `eval_op_builtin_call`, `eval_op_rule_index`, etc.) defined in `v1/topdown/instrumentation.go:9-27`. These counters are disabled by default and are diagnostic tools, not budgets. There is no tokenizer, no token accounting, and no per-query token limit.

**2. Is there a cost budget per execution?**
No. There is no per-query cost budget. Evaluation continues until the query is fully resolved or the caller cancels via context deadline (`v1/topdown/eval.go:417-429`). The only hard limits are: partial eval result size (`v1/topdown/eval.go:4445-4448`, hardcoded at 16), compiler error limit (`v1/server/server.go:141`), and request body size (`v1/server/handlers/decoding.go:20-53`).

**3. Are responses cached?**
Yes, extensively at multiple levels:
- **Intra-query**: Virtual cache (rule eval results, `v1/topdown/cache.go:14-136`), base cache (storage reads, `v1/topdown/cache.go:139-237`), comprehension cache (`v1/topdown/cache.go:240-304`), NDBCache (non-deterministic builtins, `v1/topdown/builtins/builtins.go:37-94`)
- **Cross-query**: Inter-query cache for HTTP responses (`v1/topdown/cache/cache.go:1-666`; `v1/topdown/http.go:876-987`), JWT token cache (`v1/topdown/tokens.go:1238-1280`), regex/glob pattern cache (`v1/topdown/regex.go:107-155`; `v1/topdown/glob.go:19-109`), prepared eval query cache (`v1/server/cache.go:1-53`)
- **Compilation**: Compile unknowns cache (`v1/server/compile_handler.go:363-418`), masking rules cache (same file), Rego compilation cache (`v1/rego/rego.go:2226-2245`)

All intra-query caches are scoped to a single query and discarded after. Inter-query caches persist across queries with configurable size, TTL, and eviction policies.

**4. Is there model fallback (cheaper model for simple tasks)?**
No. OPA has no concept of model selection or fallback. It evaluates all policies using its Rego engine. External rule sources (Wasm resolvers in `v1/resolver/wasm/`) allow alternative execution backends but are not used for cost-aware routing or model fallback. There is no mechanism to route simple vs. complex queries to different evaluators.

**5. How is latency managed?**
Latency is managed through:
- **Caching**: All the caches listed above avoid redundant computation and I/O
- **Context deadlines**: Caller can set a `context.Context` with deadline; evaluation checks `e.cancel.Cancelled()` on each expression (`v1/topdown/eval.go:417`)
- **HTTP timeouts**: `http.send` has `defaultHTTPRequestTimeout = 5s` (`v1/topdown/http.go:44`), configurable via `HTTP_SEND_TIMEOUT` env var or the `"timeout"` parameter
- **Shutdown deadline**: Server `Shutdown` uses context deadline for graceful shutdown (`v1/server/server.go:256-281`)

There is no query planner, no predicate ordering optimization, and no latency SLA enforcement.

**6. Are tool calls batched?**
No. OPA does not have tool calls in the LLM sense. Decision log events include a `BatchDecisionID` (`v1/plugins/logs/plugin.go:52`) for grouping related decisions, and the log upload buffers batch events by size (`uploadSizeLimitBytes` default 32KB, `v1/plugins/logs/plugin.go:268`) or count (`bufferSizeLimitEvents` default 10000), but these are upload batching, not execution batching. OpenTelemetry export is also batched (`v1/internal/distributedtracing/distributedtracing.go:48-188`).

**7. Is there adaptive model selection?**
No. OPA always uses the same Rego evaluator. There is no adaptive routing, no cost-aware query planner, and no mechanism to select different evaluation strategies based on query complexity or cost.

**8. How are expensive operations (e.g., large context) gated?**
Primitively:
- **Request body size limits**: `DecodingLimitsHandler` middleware rejects oversized requests (`v1/server/handlers/decoding.go:20-53`)
- **Partial eval result cap**: Hardcoded limit of 16 results (`v1/topdown/eval.go:4445-4448`)
- **Parsing safety limits**: Exponent digit limits in byte/JSON parsing to prevent DoS (`v1/topdown/parse_bytes.go:50`; `v1/ast/parser.go:1951`)
- **Compiler error limit**: Configurable limit on compiler errors before aborting (`v1/server/server.go:141`)
- **Context deadline**: The caller must set an appropriate timeout; no automatic gating of large inputs

There is no query complexity analysis, no step counting, no memory budgeting, and no automatic input size gating beyond HTTP body limits.

## Architectural Decisions

- **Caching is the primary cost control mechanism.** OPA invests heavily in multi-level caching as the main strategy for reducing redundant evaluation work. This is a pragmatic choice for a policy engine where the same rules and data are queried repeatedly.
- **No step/iteration budget.** The evaluator processes queries via `evalStep()` (`v1/topdown/eval.go:461`) but does not count steps or enforce a step limit. The design assumes policies terminate naturally based on the finite size of Rego rules and input data.
- **Metrics over enforcement.** Operation counters and timers exist for diagnostics (`v1/topdown/instrumentation.go`) but are not used for runtime cost enforcement. They are opt-in and intended for debugging performance issues.
- **Rate limiting is infrastructure-only.** The only rate limiter throttles decision log uploads (`v1/plugins/logs/plugin.go:291`), not query evaluation itself. This reflects OPA's role as an infrastructure component where policy evaluation is the primary function and must not be artificially throttled.
- **Inter-query cache as a shared resource.** The inter-query cache (`v1/topdown/cache/cache.go`) is a global cache with configurable size limits, FIFO eviction, and TTL-based stale entry cleanup. It is an explicitly managed resource with size budgets.

## Notable Patterns

- **Trie-based intra-query caches**: Virtual cache, base cache, and comprehension cache all use trie structures keyed by `ast.Ref` for fast path-based lookups (`v1/topdown/cache.go`)
- **Two-tier regex/glob caching**: Pattern caches check the inter-query value cache first, then fall back to a local 100-entry map. This gives cross-query reuse with a bounded local fallback (`v1/topdown/regex.go:107-155`)
- **Cache invalidation on policy change**: Prepared eval queries, compile unknowns cache, and masking rules cache are all purged when storage reloads (`v1/server/server.go:1087-1091`); inter-query caches persist across reloads
- **Rate limiter via golang.org/x/time/rate**: Both event and size buffers use the standard Go rate limiter with burst = max(1, rate) (`v1/plugins/logs/eventBuffer.go:59-63`)
- **Inter-query cache hooks**: `hooks.InterQueryCacheHook` and `hooks.InterQueryValueCacheHook` allow external code to access server caches at init time (`v1/hooks/hooks.go:80-91`)

## Tradeoffs

| Tradeoff | Decision | Implication |
|----------|----------|-------------|
| No execution budget vs. simplicity | OPA opts for no step/iteration limit, relying on finite input size | Runaway queries can only be stopped via context deadline; no fine-grained cost control |
| Caching over cost tracking | Heavy investment in caching vs. token budgeting | Excellent performance for repeated queries; no ability to limit spend per request |
| Diagnostic metrics only | Operation counters are opt-in and for debugging | No built-in cost visibility for production monitoring without custom instrumentation |
| Request body limits as sole input gate | Only HTTP-level size enforcement, no query complexity analysis | A small request can trigger an expensive query (deep recursion); no protection beyond timeout |
| Infrastructure-level rate limiting | Rate limiting only on log uploads, not evaluation | Decision logs won't overwhelm upstream, but an attacker can saturate the evaluator |

## Failure Modes / Edge Cases

1. **Deeply recursive policies with no step limit**: A policy with unbounded recursion can run until context deadline, consuming CPU/memory with no intermediate abort mechanism. OPA's `evalStep()` (`v1/topdown/eval.go:461`) does not count iterations.
2. **Inter-query cache memory exhaustion**: If `max_size_bytes` is not configured (defaults to 0 = unlimited, `v1/topdown/cache/cache.go:22`), cached HTTP responses can grow unboundedly, leading to OOM.
3. **Missing query complexity gating**: A small HTTP request with a complex Rego query passes the body size limit but may trigger exponential evaluation time. There is no query cost analysis before execution.
4. **No per-query cache isolation**: The inter-query cache is shared across all queries. A single query that populates many cache entries can evict entries from other queries, degrading their performance.
5. **Partial eval result limit is hardcoded**: The limit of 16 (`v1/topdown/eval.go:4448`) is arbitrary and not configurable. Real-world partial evaluation may legitimately need more results.

## Future Considerations

- **Step/iteration budget**: Adding a configurable step counter to `evalStep()` (`v1/topdown/eval.go:461`) would provide a predictable computation cap per query, analogous to token budgets in LLM systems.
- **Per-query cost accounting**: A `Cost` field on the eval context that increments on builtin calls, storage reads, and rule evaluations would enable cost-aware query planning and budgeting.
- **Query complexity analysis**: A pre-execution pass that estimates query cost (e.g., number of rules traversed, comprehension depth) could reject or flag expensive queries before evaluation.
- **Configurable partial eval result limit**: Making the hardcoded `size <= 16` limit configurable would support use cases requiring more partial evaluation results.
- **Query complexity metrics as budgets**: The existing `eval_op_*` counters could be repurposed as budgets — if a query exceeds a threshold of operations, it is aborted.

## Questions / Gaps

- No evidence of any token counting, token budgeting, or per-request spend tracking. OPA has no concept of "tokens" — it tracks evaluation operations via counters (`v1/topdown/instrumentation.go:9-27`) but these are diagnostic-only.
- No evidence of adaptive routing, model selection, or cost-aware query planning. OPA uses a single Rego evaluator for all queries; Wasm resolvers (`v1/resolver/wasm/`) provide alternative backends but are not used for dynamic routing.
- No evidence of execution step counting or iteration limits. The `evalStep()` function (`v1/topdown/eval.go:461`) executes a single step but does not count or limit total steps per query.
- No evidence of automatic input size gating beyond the HTTP body size limit (`v1/server/handlers/decoding.go:20-53`). There is no Rego-level limit on input size.
- No evidence of cost budgets per execution, per user, or per endpoint. All query evaluation is unbounded except by Go context deadlines.

---

Generated by `study-areas/20-runtime-economics.md` against `opa`.
