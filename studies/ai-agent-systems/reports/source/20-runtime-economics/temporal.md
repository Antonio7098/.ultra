# Repo Analysis: temporal

## Runtime Economics Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | temporal |
| Path | `repos/temporal` |
| Language / Stack | Go |
| Analyzed | 2026-05-17 |

## Summary

Temporal Server employs a multi-layered runtime economics model built on token-bucket rate limiting, extensive LRU caching, replication task batching, and per-service priority-based quota systems. Rate limiting is applied at the gRPC interceptor, namespace, and persistence layers with dynamic health-based backpressure. Caching spans workflow mutable state, history events, replication progress, and matching service reachability — all with configurable sizes and TTLs. There is no per-execution cost budgeting or billing-level accounting; economics are managed indirectly through resource limits and quotas.

## Rating

**Rating: 8/10**

Temporal has token budgets (rate limiters with per-API token costs), extensive caching, batching, priority-based routing, and health-sensitive dynamic rate limiting. However, there is no per-execution cost tracking, no adaptive model selection (not applicable to a workflow engine), and no user-facing cost accounting. It earns a high score for sophisticated operational economics but lacks business-level cost control.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Workflow state cache | Host-level LRU cache with pinning, TTL, background eviction, byte-size or count limiting | `service/history/workflow/cache/cache.go:93-149` |
| Events cache | Host-level (256MB) and shard-level (512KB) LRU caches with 1h TTL | `service/history/events/cache.go:56-73` |
| Cache config keys | `HistoryCacheHostLevelMaxSize`=128K, `HistoryCacheTTL`=1h, `EventsHostLevelCacheMaxSizeBytes`=256MB | `common/dynamicconfig/constants.go:1641-1722` |
| Rate limiter interface | Token-bucket abstraction with `Allow`, `Reserve`, `Wait`, `TokensAt`, `RecycleToken` | `common/quotas/rate_limiter.go:10-52` |
| Priority rate limiter | Multi-priority wrapper with per-priority token buckets and operator priority ratio | `common/quotas/priority_rate_limiter_impl.go:10-78` |
| Multi-stage rate limiter | Chains multiple rate limiters (namespace + host must all allow) | `common/quotas/multi_rate_limiter_impl.go:1-235` |
| Frontend quota config | Per-API token costs (1 for polls/long-running, 0 for short ops) | `service/frontend/configs/quotas.go:37-63` |
| Frontend rate limit interceptor | gRPC interceptor applying host-level rate limits, returns `ResourceExhausted` | `common/rpc/interceptor/rate_limit.go:46-60` |
| Namespace rate limit interceptor | Per-namespace rate limits; blocks polls vs rejects non-polls | `common/rpc/interceptor/namespace_rate_limit.go:1-179` |
| Matching rate limit manager | Per-task-queue dynamic rate limiting, effective RPS computed from worker-set + API-set + admin + system defaults | `service/matching/ratelimit_manager.go:14-55` |
| Matching fairness limiting | Per-key rate limiting with fairness key weights, cache for rate limit state | `service/matching/ratelimit_manager.go:42-53` |
| Matching dispatch rate limiter | `TaskDispatchRateLimiter` on engine; short-circuits on `ResourceExhausted` from history | `service/matching/matching_engine.go:90-91, 820-821` |
| Health-based persistence rate limiter | Dynamically adjusts rate multiplier based on latency/error thresholds | `common/persistence/client/health_request_rate_limiter.go:109-138` |
| Persistence rate limiter | 7-level priority rate limiting for DB access | `common/persistence/client/quotas.go:1-300` |
| History service quotas | 5 priority levels, namespace + host fallback, per-reader rate limiting | `service/history/configs/quotas.go:1-61` |
| History queue scheduler quotas | 4 task priority levels for scheduler with namespace+host fallback | `service/history/queues/scheduler_quotas.go:1-87` |
| Generic stream batcher | Configurable `MaxItems`/`MinDelay`/`MaxDelay`/`IdleTime` batching | `common/stream_batcher/batcher.go:31-43` |
| Matching user data batcher | Batches user data updates: MaxItems=100, MinDelay=100ms, MaxDelay=500ms | `service/matching/matching_engine.go:242-247` |
| Replication task batching | `BatchableTask` interface, tasks `BatchWith()`-ed into composite tasks | `service/history/replication/batchable_task.go:17-25` |
| Sequential batch queue | Orders and batches consecutive compatible replication tasks | `service/history/replication/sequential_batch_queue.go:1-117` |
| Ownership-based quota scaling | Shard-count-aware quota scaling for history service persistence | `service/history/shard/ownership_based_quota_calculator.go`, `ownership_based_quota_scaler.go` |
| Execution size limits | `TransactionSizeLimit`=4MB, blob/memo/history size limits, pending activity/signal/child limits | `common/dynamicconfig/constants.go:138-420` |
| Metering metadata | `MeteringMetadata` with `NonfirstLocalActivityExecutionAttempts` propagated into history events | `service/history/historybuilder/history_builder.go:231` |
| Shutdown workers cache | TTL cache for worker instance keys, 10K entries, 30s TTL | `service/matching/matching_engine.go:80-81, 183` |
| Reachability cache | TTL-cached results of visibility-based worker reachability queries | `service/matching/matching_engine.go:322-326` |
| Fairness key rate limit cache | 2000-entry cache for per-key rate limit state | `service/matching/ratelimit_manager.go:74` |

## Answers to Protocol Questions

**1. How are token counts tracked?**

Token counts are tracked via the token-bucket rate limiter (`common/quotas/rate_limiter_impl.go:1-115`). Each rate limiter wraps Go's `golang.org/x/time/rate` limiter with dynamic RPS/burst updates. Per-API token costs are defined in `ExecutionAPICountLimitOverride` (`service/frontend/configs/quotas.go:37-63`), where long-polling/blocking APIs consume 1 token and others consume 0. The `RateLimitDefaultToken` constant is 1 (`common/rpc/interceptor/rate_limit.go:16`). Tokens are not counted per execution — they are counted per request at the service entry layer.

**2. Is there a cost budget per execution?**

No. There is no per-workflow-execution cost budget. Limits are at the infrastructure level: RPS limits, rate limiter tokens, cache sizes, and execution size limits (e.g., `TransactionSizeLimit` at `common/dynamicconfig/constants.go:138`). There is no mechanism to assign a "cost budget" to a single workflow run.

**3. Are responses cached?**

Yes. Workflow mutable state is cached at the host level (`service/history/workflow/cache/cache.go:93-149`) with LRU eviction, pinning (in-use entries not evicted), and TTL (1h). History events are cached at both host and shard levels (`service/history/events/cache.go:56-73`). Replication progress is cached (`service/history/replication/progress_cache.go:51-60`). The matching service caches reachability results and shutdown worker keys (`service/matching/matching_engine.go:80-81, 183, 322-326`).

**4. Is there model fallback (cheaper model for simple tasks)?**

Not applicable. Temporal is a workflow orchestration engine, not an AI system. The closest analogue is priority-based rate limiting where higher-priority requests (operator, API) get separate token buckets with larger RPS shares (`common/quotas/priority_rate_limiter_impl.go:25-49`), and namespace-level rate limits allow blocking poll requests to wait rather than reject (`common/rpc/interceptor/namespace_rate_limit.go:1-179`). There is no "cheaper model" pattern.

**5. How is latency managed?**

Latency is managed through multiple mechanisms:
- **Health-based persistence throttling**: The `HealthRequestRateLimiterImpl` (`common/persistence/client/health_request_rate_limiter.go:109-138`) monitors average latency and error ratio; when latency exceeds a threshold, it reduces the rate multiplier (backoff step), and when healthy, increases it (increase step).
- **Priority-based dispatch**: Higher-priority requests bypass lower-priority queues (`common/quotas/priority_rate_limiter_impl.go`).
- **Batching to reduce round-trips**: Replication tasks batched via `BatchableTask` (`service/history/replication/batchable_task.go`); user data updates batched via stream batcher (`service/matching/matching_engine.go:242-247`).
- **Poll-blocking vs rejection**: Namespace rate limiter blocks poll requests (waits for token) while rejecting other request types (`common/rpc/interceptor/namespace_rate_limit.go`).
- **Backlog-aware forwarding**: `MatchingForwarderMaxOutstandingPolls`, `BacklogNegligibleAge`, and `MaxWaitForPollerBeforeFwd` control when to forward polls to higher-priority partitions (`service/matching/matching_engine.go:1320-1323`).

**6. Are tool calls batched?**

Yes. Temporal batches at multiple levels:
- **Replication tasks**: `BatchableTask` interface (`service/history/replication/batchable_task.go:17-25`) allows tasks to merge via `BatchWith()` into composite tasks that Ack/Nack as a unit.
- **Sequential batch queue**: Orders and batches consecutive tasks sharing a queue ID (`service/history/replication/sequential_batch_queue.go:1-117`).
- **Matching user data updates**: Stream batcher with MaxItems=100, MinDelay=100ms, MaxDelay=500ms (`service/matching/matching_engine.go:242-247`).
- **Generic stream batcher**: `common/stream_batcher/batcher.go:15-43` provides reusable configurable batching.
- **Frontend batch operations**: User-facing batch reset/signal/terminate workflows (`service/worker/batcher/workflow.go`).

**7. Is there adaptive model selection?**

No. Temporal does not have model selection. The closest pattern is its **priority-based routing** and **fairness-based dispatch**:
- Matching engine uses priority-based backlog forwarding (`service/matching/matching_engine.go:1320-1323`) to route tasks to higher-priority pollers first.
- `MatchingEnableFairness` and `MatchingMaxFairnessKeyWeightOverrides` (`service/matching/ratelimit_manager.go:42-53`) enable weighted fair distribution across task queue keys.
- Worker versioning routing (`service/matching/matching_engine.go:185-196`) directs tasks to the correct worker version using reachability cache and worker deployment data.
- Ownership-based quota scaling adjusts persistence quotas based on shard ownership count (`service/history/shard/ownership_based_quota_calculator.go`).

**8. How are expensive operations (e.g., large context) gated?**

Through explicit size and count limits, all defined in `common/dynamicconfig/constants.go`:
- `TransactionSizeLimit` — 4MB (`common/dynamicconfig/constants.go:138-140`)
- `BlobSizeLimitError` / `BlobSizeLimitWarn` — blob payload limits (L326-334)
- `HistorySizeLimitError` / `HistorySizeLimitWarn` — total history size (L370-378)
- `HistoryCountLimitError` / `HistoryCountLimitWarn` — total event count (L386-394)
- `NumPendingChildExecutionsLimitError` — pending child workflow limit (L346-349)
- `NumPendingActivitiesLimitError` — pending activity limit (L352-355)
- `NumPendingSignalsLimitError` — pending signal limit (L358-361)
- `MutableStateSizeLimitError` / `MutableStateSizeLimitWarn` — mutable state size (L407-415)
- `MutableStateTombstoneCountLimit` — tombstone record count (L417-420)
- `MaxCallbacksPerWorkflow` — 32 callbacks max (L1008-1011)
- `MaxIDLengthLimit` — max ID string length (L433-436)

Resource exhaustion also gates expensive operations: workflows return `ErrResourceExhaustedBusyWorkflow` when cache lock cannot be acquired (`service/history/workflow/cache/cache.go:345`), and the update registry rejects concurrent updates with `ResourceExhausted` (`service/history/workflow/update/registry.go:406, 427`).

## Architectural Decisions

1. **Token-bucket rate limiting at every layer** (`common/quotas/rate_limiter.go`). Every service (frontend, history, matching, persistence) has its own priority-aware token-bucket rate limiter. This prevents any single caller from overwhelming a service, with per-API token costing for long-poll vs short operations.

2. **Health-sensitive dynamic backpressure on persistence** (`common/persistence/client/health_request_rate_limiter.go:109-138`). Rather than static RPS limits, the persistence rate limiter monitors latency and error signals and adjusts throughput dynamically — increasing when healthy, decreasing when under stress. This is the most sophisticated cost-control mechanism in the system.

3. **Ownership-based quota scaling** (`service/history/shard/ownership_based_quota_calculator.go`). History service nodes that own more shards get proportionally larger persistence budgets, matching capacity to load without manual tuning.

4. **Priority-based overprovisioning for operators** (`common/quotas/priority_rate_limiter_impl.go:25-49`). Operator requests get a separate token bucket with a configurable RPS ratio, ensuring administrative operations are never starved by user traffic.

5. **Cache-everything architecture with pinning** (`service/history/workflow/cache/cache.go:93-149`). Workflow state is aggressively cached with LRU eviction and pinning to prevent churn. The cache supports both entry-count and byte-size limits.

## Notable Patterns

- **Generic stream batcher** (`common/stream_batcher/batcher.go:15-43`): A reusable generic Go type that accepts items concurrently, batches by size/delay thresholds, and processes them sequentially. Used by matching service for user data updates. Could be adopted by other services.

- **Finalizer pattern for cache eviction** (`service/history/workflow/cache/cache.go:106-125`): On cache put, a finalizer callback is registered; on eviction, it deregisters. This ensures workflow context state is properly cleaned up when evicted.

- **Rate limit source tracking** (`service/matching/ratelimit_manager.go:24-30`): The matching rate limit manager tracks four distinct RPS sources (worker-set, API-set, admin namespace, admin task queue) to compute the effective RPS, enabling transparent debugging of which limit is active.

- **RecycleToken** (`common/quotas/rate_limiter.go:51`): A token recycling mechanism for the matching service — if a task dispatch fails (e.g., invalid task), the token is recycled to avoid wasting rate limit capacity.

## Tradeoffs

1. **Complexity vs. flexibility in rate limiting** (`common/quotas/`): The rate limiting system has 12+ limiter implementations (priority, multi, dynamic, health, map-based, routing, etc.). This provides fine-grained control but makes it difficult to reason about the effective end-to-end rate limit for any given request.

2. **Cache size vs. memory pressure**: Workflow mutable state cache defaults to 128K entries or 1GB (`common/dynamicconfig/constants.go:1652-1663`). Large caches reduce persistence load but increase memory pressure and GC costs, especially on hosts owning many shards.

3. **Batching latency vs. throughput**: The stream batcher defaults (100ms min delay, 500ms max delay) trade latency for throughput. Short-lived workflows may see delayed user data propagation.

4. **Health-based throttling lag**: The persistence health rate limiter refreshes every 10s (`common/persistence/client/health_request_rate_limiter.go:18`). During sudden load spikes, it takes up to 10s to detect and respond, during which the database may be overloaded.

5. **No per-execution cost tracking**: Temporal tracks infrastructure-level metrics (RPS, latency, cache hit rates) but has no concept of per-workflow cost. This makes it hard to attribute resource costs to specific tenants or workflows without external tooling.

## Failure Modes / Edge Cases

1. **Cache stampede on host restart**: When a history host restarts, its workflow state cache is cold. All shards assigned to that host will miss cache simultaneously, potentially overwhelming persistence until the cache warms up.

2. **Rate limiter cascading failures**: The matching service short-circuits on `ResourceExhausted` from history (`service/matching/matching_engine.go:820-821, 1060-1061`). If history is throttled, matching stops dispatching, which cascades to frontend. This is intentional but can amplify failures.

3. **Batched task ack/nack coupling**: In `batchedTask` (`service/history/replication/batchable_task.go:27-36`), all individual tasks in a batch share the same ack/nack fate. If one task in a batch fails, all are retried, potentially causing wasted work.

4. **Rate limit cache staleness**: The fairness key rate limit cache (`service/matching/ratelimit_manager.go:74`, configurable `FairnessKeyRateLimitCacheSize`=2000) can become stale if task queue partitions exceed this count, causing fairness violations.

5. **Lock contention on cache pinning**: The workflow cache pins entries in use (`service/history/workflow/cache/cache.go:93-149`, Pin: true). Under high concurrency, many entries may be pinned simultaneously, preventing eviction and causing the cache to grow past its limit.

## Future Considerations

- **Per-workflow execution budgets**: Adding token budgets per execution (e.g., max API calls per workflow) would enable better multi-tenant cost isolation.
- **Adaptive cache sizing**: Currently cache sizes are fixed at startup. Dynamic resizing based on memory pressure could reduce OOM risks.
- **Cross-service rate limit coordination**: Rate limits are independently configured per service. A global rate limit controller could prevent one service from throttling while another accepts requests.
- **Metering hooks for billing**: The `MeteringMetadata` in history events (`service/history/historybuilder/history_builder.go:231`) could be extended with more billing-relevant data (e.g., storage consumption, execution duration) for external billing systems.

## Questions / Gaps

- **No evidence found** of per-execution cost tracking or budgeting. The `MeteringMetadata` only captures `NonfirstLocalActivityExecutionAttempts` — no storage, compute, or bandwidth costs are tracked per workflow.
- **No evidence found** of automated cost-aware routing. Temporal routes based on priority and load, not cost.
- **No evidence found** of token quota management for users/tenants. Rate limits are namespace-scoped but there is no user-facing token quota system.
- **No evidence found** of speculative execution or prompt caching (not relevant to workflow engines).
- Cache hit rates and rate limit effectiveness are observable through emitted metrics but no adaptive tunings exist based on these signals outside the health-based persistence rate limiter.

---

Generated by `study-areas/20-runtime-economics.md` against `temporal`.
