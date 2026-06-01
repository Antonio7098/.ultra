# Architecture Review Report: Resilience Policy Engine

**Area reviewed:** Resilience Policy Engine (`policy.go`, `policy_test.go`)

**Package:** `github.com/Antonio7098/agentwrap`

**Files examined:**
- `policy.go` (964 lines) — core policy types, BasicPolicy, ExponentialBackoff, FixedBackoff, PolicyRunner, policyRun
- `policy_test.go` (432 lines) — 10 test cases covering retry, fallback, rate-limit, backoff, cancellation, and dropped events
- `metadata.go` (lines 79–109) — PolicyMetadata, PolicyDecisionRecord, PolicyDroppedEvent
- `events.go` (lines 36–39) — EventRetry, EventFallback, EventRateLimit event kinds
- `errors.go` — ErrorCategory enum and SDKError
- `runtime.go` — Runtime, Run, RunRequest, RunResult contract types

---

## 1. Behaviour Review

### Main question
Can the reviewer clearly understand the feature's behaviour from the code?

### Checks
- [x] The main workflow is visible.
- [x] The feature does what the requirement asked.
- [x] The implementation does not include unrelated work.
- [x] Inputs and outputs are clear.
- [x] Side effects are obvious.
- [x] Failure paths are handled deliberately.

### Review notes
```text
The Resilience Policy Engine implements a classic retry/fallback loop:

1. PolicyRunner.StartRun(ctx, req) launches a goroutine (execute()) that manages the loop.
2. Each iteration: start a runtime run → collect result → call policy.Decide(ctx, policyCtx).
3. Decide() returns a PolicyDecision: stop, retry, wait, or fallback.
4. PolicyRunner executes the decision: applies delay, switches target/index, or terminates.

The input (PolicyContext) is an immutable struct with 15 fields capturing: original request, current request,
attempt counters, target info, prior attempts, current result, error, rate-limit, validation, timing, and metadata.
The output (PolicyDecision) is a struct with 10 fields: kind, reason, detail, delay, target, request override,
session action, rate-limit, metadata, and error.

Side effects are explicit: StartRun spawns a goroutine; Wait() blocks on a channel; execute() sends events
on a buffered channel; decisions are appended to a slice recorded in PolicyMetadata.

Failure paths are deliberate:
- Context cancellation → finishCancelled() sets StatusCancelled.
- Start failure → retry or fallback per policy decision.
- Policy.Decide() error → run terminates with that error.
- Sleep during wait cancelled → run terminates as cancelled.
- Max elapsed exhausted → stop.
- Max attempts exhausted → fallback or stop.
```

---

## 2. Architecture Fit Review

### Main question
Did the change fit the existing architecture, or did it distort it?

### Checks
- [x] The change belongs in the files/modules it touched.
- [x] The current workflow still reads cleanly.
- [x] No feature was jammed into an unsuitable abstraction.
- [x] No large refactor was avoided when the design clearly needed one.
- [x] No large refactor was performed without real need.

### Decision
```text
[✓] Good fit
```

### Review notes
```text
The policy engine is a wrapper layer, exactly as documented in docs/architecture.md:
"Put PolicyRunner close to the adapter when retries and fallback should wrap raw runtime attempts."

PolicyRunner wraps a Runtime and implements the Runtime interface itself (StartRun/Capabilities),
making it composable with ObservingRuntime and ValidatingRuntime in any order.

The ResiliencePolicy interface (Decide(ctx, PolicyContext) (PolicyDecision, error)) is minimal and
focused: one method, inputs and outputs are plain data structs. This is the right abstraction for a
policy — callers inject whatever policy implementation they need (BasicPolicy or custom).

BasicPolicy is a concrete "conservative bounded policy helper" — this is an earned design choice,
not speculative. It handles the most common retry/fallback scenarios without requiring users to
implement ResiliencePolicy from scratch.

No abstraction was forced: the BackoffPolicy interface exists because delay computation varies
independently from the retry decision logic. This is a legitimate separation.
```

---

## 3. Simplicity and Earned Complexity Review

### Main question
Did the implementation add only the complexity required by the feature?

### Checks
- [x] No speculative abstractions.
- [x] No unnecessary interfaces/protocols/base classes.
- [x] No plugin/factory/registry unless justified.
- [x] No generic engine for a single concrete use case.
- [x] No framework ceremony added without need.
- [x] The simplest honest design was chosen.

### Complexity verdict
```text
[✓] Same complexity — complexity present is fully justified by the domain
```

### Review notes
```text
Resilience policy is inherently multi-dimensional: error categories × retry budgets × backoff strategies ×
fallback targets. A simple single-function policy would not cover real-world provider failures.

The complexity that IS present is earned:
- ResiliencePolicy interface: required because BasicPolicy is not the only valid policy.
  Users may implement custom policies (e.g., circuit-breaker, adaptive, ML-guided).
- BackoffPolicy interface: backoff computation (fixed, exponential, jittered, provider-aware) varies
  orthogonally from retry decisions. Keeping them separate avoids god-class Policy.
- BasicPolicy struct with 7 fields: each field represents a distinct configuration axis
  (limits, backoff, rate-limits, fallbacks, hooks). A builder or options pattern would add
  ceremony without reducing real complexity.
- policyRun internal struct with 14 fields: this is a run-loop state machine. Keeping it internal
  (unexported) means the complexity is encapsulated. The public API (PolicyRunner, ResiliencePolicy)
  is clean.
- Two-level target index (targetIndex vs attemptOnTarget): required because retry budgets apply
  per-target, not globally. This is an honest reflection of the domain.

No factory/registry pattern: the design uses direct composition (PolicyRunner{Policy: myPolicy}) which
is simpler and sufficient. No plugin system was added.

The execute() loop at 98 lines is the most complex function, but it is a straightforward state
machine with clear branches for stop/retry/wait/fallback decisions.
```

---

## 4. Cohesion Review

### Main question
Are responsibilities grouped around real concepts and reasons to change?

### Checks
- [x] Related rules are kept together.
- [x] Unrelated behaviours are not forced into one unit.
- [x] Functions/classes/modules have clear names and purposes.
- [x] No god object/service/module was expanded.
- [x] No excessive micro-fragmentation was introduced.

### Cohesion issues
```text
- policy.go is a 964-line file that mixes three distinct conceptual areas:
  1. Policy types and interfaces (lines 14–91): ResiliencePolicy, PolicyContext, PolicyDecision,
     RateLimitInfo, FallbackAlternative, BackoffPolicy
  2. Concrete policy implementations (lines 94–276): FixedBackoff, ExponentialBackoff, BasicPolicy,
     defaultRetryable, defaultFallbackable
  3. PolicyRunner and policyRun execution engine (lines 278–964)

  The file hangs together because all three areas are part of "resilience policy" as a bounded
  concept. Splitting them would scatter the domain and make policy composition harder.

- policy_test.go shares the scriptRuntime/scriptRun test helper types (107 lines) which are
  non-trivial test infrastructure. These are not part of the production policy domain but
  are appropriately in the _test.go file rather than a separate testkit package.
```

### Recommended improvement
```text
Consider a policy/ subdirectory if the policy domain grows further, with:
- policy/types.go: interfaces and data types
- policy/backoff.go: BackoffPolicy and implementations
- policy/basic.go: BasicPolicy and default strategies
- policy/runner.go: PolicyRunner and policyRun

However, the current colocation is defensible for a single-file domain of this size.
```

---

## 5. Coupling Review

### Main question
Did the change introduce unhealthy dependencies?

### Checks

**Global coupling:**
- [x] No new mutable global state.
- [x] Runtime configuration/state is passed explicitly where needed.

**Content coupling:**
- [x] No external code reaches into internals/private fields.
- [x] Public methods/interfaces are used appropriately.

**Stamp coupling:**
- [x] Functions do not accept large objects when only small values are needed.
- [x] Parameter objects are cohesive and purposeful.

**Dependency coupling:**
- [x] External dependencies are injected or isolated at boundaries.
- [x] Core logic is not tightly coupled to infrastructure.

### Coupling verdict
```text
[✓] Coupling acceptable
```

### Review notes
```text
PolicyRunner depends on the core Runtime interface (from runtime.go) and RunResult/SDKError (from
errors.go/metadata.go) — these are the natural dependencies for a wrapper layer.

ResiliencePolicy is injected: callers provide their own implementation. This is proper dependency
inversion.

policyRun.execute() closes over Runtime via the runtimeFor() method — this is appropriate;
the goroutine needs access to the runtime to start new attempts.

BackoffPolicy is injected into BasicPolicy — correct.

The policy engine imports the errors.go types (SDKError, ErrorCategory) and events.go types
(EventRetry, EventFallback, EventRateLimit). These are package-level types, not adapter-specific,
so the coupling is acceptable.

Global state: only policyRunCounter (atomic int64) at package level — used for generating
unique run IDs. This is appropriate for ID generation and is safely atomic.
```

---

## 6. DRY and Duplication Review

### Main question
Did the change duplicate knowledge or create a bad abstraction to avoid duplication?

### Checks
- [x] Business rules are not duplicated.
- [x] Security/authorization rules are not duplicated.
- [x] Validation rules are not duplicated inconsistently.
- [x] Similar code shape was not abstracted prematurely.
- [x] Shared abstractions do not contain caller-specific branches.
- [x] No new boolean flags were added to preserve a bad abstraction.

### Duplication verdict
```text
[✓] No concerning duplication
```

### Review notes
```text
defaultRetryable() and defaultFallbackable() (lines 248–276) have similar shape (switch on
ErrorCategory), but they encode genuinely different business rules:
- Retryable: timeout, runtime_exit, runtime_unavailable, provider_unavailable, model_unavailable,
  malformed_event, plus rate-limit if RetryAfter/status code suggests it.
- Fallbackable: rate_limit, timeout, runtime_exit, runtime_unavailable, provider_unavailable,
  model_unavailable, malformed_event, validation, unknown — but NOT authentication, permission,
  configuration, or cancellation.

These are intentionally different sets. Duplicating the switch statement is honest; merging them
would create a fragile abstraction.

normalizeDecision() and overlayRunRequest() are small helper functions that avoid minor
duplication without being premature abstractions.

No boolean flags were added to PolicyDecision or PolicyContext to preserve a bad abstraction.
The design uses explicit enum-like PolicyDecisionKind (stop/retry/wait/fallback) which is clear.
```

---

## 7. State and Side Effects Review

### Main question
Are state changes and side effects explicit, controlled, and testable?

### Checks
- [x] Durable state changes are clear.
- [x] Derived state is not treated as authoritative unless justified.
- [x] Ephemeral state does not leak into global/shared state.
- [x] Mutating operations are named clearly.
- [x] Queries do not unexpectedly mutate state.
- [x] Side effects are at boundaries where practical.

### State verdict
```text
[✓] Clear and safe
```

### Review notes
```text
policyRun is the only mutable state holder for a run. It is unexported and not shared across
goroutines — each StartRun creates its own policyRun instance. Concurrent access to shared
fields (mu, result, current, seq, droppedEvents) is protected by sync.Mutex.

Derived state:
- result.Metadata.Attempts is derived from r.attempts slice (appended on each iteration).
- result.Metadata.Policy is derived from r.decisions and r.droppedEvents.
- These are explicit: finish() assembles PolicyMetadata from the run's recorded state.

No durable state changes: the policy engine does not persist runs. It only assembles metadata
that is returned in RunResult — callers or wrappers (ObservingRuntime) decide what to persist.

Ephemeral state (targetCounts map, seq counter, droppedEvents slice) is contained in policyRun.
The global policyRunCounter is atomic and only used for ID generation.

Side effects at boundaries:
- Goroutine spawn (execute()) is at StartRun(), the boundary between caller and runner.
- Event channel send is at the boundary between policy run and caller observer.
- Sleep is at the boundary between policy decision and time — the caller provides the Sleep
  function, so timing is injectable.

Context cancellation is propagated to the inner runtime run and to the sleep function.
```

---

## 8. Function/Class/Paradigm Review

### Main question
Does the chosen coding style fit the problem?

### Checks
- [x] Functions are used where behaviour is stateless/simple.
- [x] Classes are justified by state, invariants, lifecycle, or polymorphism.
- [x] Inheritance is shallow and honest if used.
- [x] Composition is used where behaviour varies independently.
- [x] Functional pipelines improve readability rather than obscure it.
- [x] Framework conventions are followed without hiding domain behaviour.

### Paradigm verdict
```text
[✓] Good fit
```

### Review notes
```text
The codebase uses Go idiomatically:
- Interfaces for polymorphism (ResiliencePolicy, BackoffPolicy, Runtime, Run).
- Plain structs for data (PolicyContext, PolicyDecision, FallbackAlternative).
- Unexported structs with methods for encapsulation (policyRun).
- Functional options pattern NOT used; instead plain struct initialization with named fields,
  which is cleaner for a 7-field struct like BasicPolicy.

No inheritance. Composition is used throughout:
- PolicyRunner wraps Runtime (composition, not inheritance of behavior).
- policyRun holds references to primary Runtime and Alternatives.
- BasicPolicy holds BackoffPolicy interface (behavioral composition).

Functions are used for stateless helpers: normalizeDecision(), requestForDecision(),
fallbackRequest(), overlayRunRequest(), rateLimitFromResult(), validationFromResult(),
ensureSDKError(), contextPolicyError(), defaultPolicySleep(), cloneStringMap(), cloneAnyMap(),
sortedKeys(). These are all deterministic and testable.

The execute() method on policyRun is the main "state machine" — it is a method because it
needs access to the run's mutex and state. This is appropriate.

No functional pipelines that obscure control flow. The execute() loop is written as a clear
for/select state machine.
```

---

## 9. Error Handling Review

### Main question
Are failures explicit, useful, and recoverable where appropriate?

### Checks
- [x] Expected failures have specific handling.
- [x] Unexpected failures are surfaced clearly.
- [x] Error names/messages are actionable.
- [x] Errors are not swallowed silently.
- [x] Retry behaviour is safe and deliberate.
- [x] Partial progress is handled.
- [x] AI/model/tool failures are validated and typed where relevant.

### Error handling verdict
```text
[✓] Strong
```

### Review notes
```text
Error taxonomy is rich and typed (ErrorCategory with 16 values). PolicyContext.Err carries the
classified error; callers can switch on Category without string matching.

Expected failures with specific handling:
- ErrorRateLimit: respected if RetryRateLimits enabled, respects RetryAfter/ResetAt from provider.
- ErrorRuntimeExit: triggers fallback if ShouldFallback and fallback available.
- ErrorTimeout, ErrorRuntimeUnavailable, ErrorProviderUnavailable, ErrorModelUnavailable,
  ErrorMalformedEvent: retryable by default.
- ErrorAuthentication, ErrorPermission, ErrorConfiguration, ErrorCancellation: not retryable,
  not fallbackable (correct — these won't resolve on their own).
- ErrorUnknown: not retryable by default (conservative).

Errors not swallowed:
- Start failures: returned as SDKError with ensureSDKError(), recorded in last.Err.
- Wait failures: merged into result.Err if Wait error is non-nil.
- Policy.Decide() errors: cause immediate termination with the error.
- Sleep cancellation: converted to SDKError with ErrorCancellation category.

PolicyDecision.Err allows the policy itself to contribute an error to the final result.
This is used when stopping due to max elapsed or rate-limit-disabled.

Partial progress:
- Each attempt is recorded in r.attempts ([]AttemptSummary) even if later attempts succeed.
- Each decision is recorded in r.decisions ([]PolicyDecisionRecord).
- Dropped events are tracked separately (r.droppedEvents → PolicyDroppedEvent).
- Final result includes full attempt history and decision trail in PolicyMetadata.

Context cancellation is converted to ErrorCancellation SDKError with "policy run stopped" message.
```

---

## 10. Observability Review

### Main question
Can we understand this feature in real execution?

### Checks
- [x] Important workflow start/completion/failure is observable.
- [x] Logs/events/metrics include correlation identifiers.
- [x] Dependency calls are traceable where relevant.
- [x] Duration/performance can be inspected.
- [x] Errors include useful type/context.
- [x] Sensitive data is not logged.
- [x] AI-specific context is versioned/traced where relevant.

### Observability verdict
```text
[✓] Strong
```

### Review notes
```text
Events emitted (via r.sendEvent):
- Retry event (EventRetry kind) with: attempt, target_index, decision, reason, detail, delay, session_action.
- Fallback event (EventFallback kind) with same fields.
- RateLimit event (EventRateLimit kind) with: provider, model, retry_after, reset_at, detail.
- All events enriched with: policy_run_id (the logical run ID), attempt number, target_index.

Correlation:
- Each event carries run ID (r.id = PolicyRunID) for correlation across the policy run.
- Each inner run's events are forwarded with attempt/target_index annotations.
- Event sequence numbers (r.seq) enable ordering verification.

Durable metadata (PolicyMetadata in RunResult):
- LogicalRunID: the policy-level run ID.
- FinalAttempt, FinalTargetIndex: which attempt/target finally resolved the run.
- Exhausted flag + exhaustedReason: why the policy gave up (if applicable).
- Decisions []PolicyDecisionRecord: every policy decision with full context.
- DroppedEvents []PolicyDroppedEvent: when the event buffer overflowed.

Timing:
- PolicyContext.StartedAt and Elapsed: monotonic elapsed time for max-elapsed checking.
- AttemptSummary records StartedAt, FinishedAt, Duration per attempt.
- RunMetadata records aggregate StartedAt, FinishedAt, Duration for the logical run.

Error observability:
- SDKError carries Category, Operation, UserDetail, DebugDetail, StatusCode, Provider, Model,
  RuntimeKind, ExitCode, Signal, NativeType, RetryAfter, Metadata.
- Errors are preserved in AttemptSummary.Error and RunMetadata.Errors.

No sensitive data in events: the policy engine deals with error categories and rate-limit
info, not prompts or request content. AttemptRequest deliberately omits Prompt.
```

---

## 11. Testing Review

### Main question
Do the tests protect the behaviour and reflect the architecture?

### Checks
- [x] Pure logic has focused unit tests.
- [x] Workflow/use-case behaviour is tested.
- [x] External adapters are tested at the right level.
- [x] Failure paths are tested.
- [x] Regression cases are covered.
- [x] Tests do not require unnecessary real infrastructure.
- [x] Tests are not over-mocked to the point of meaninglessness.

### Testing verdict
```text
[✓] Strong
```

### Review notes
```text
policy_test.go has 10 tests covering:

1. TestPolicyRunnerRetriesThenSucceeds: retry → success path.
2. TestPolicyRunnerFallbackThenRetriesOnFallbackTarget: fallback → retry on fallback → success.
   Verifies session action inheritance (SessionActionFresh from FallbackAlternative).
3. TestPolicyRunnerHonorsShouldFallbackBeforeRuntimeExitFallback: ShouldFallback hook
   correctly prevents fallback when it returns false. Verifies hook override of default behavior.
4. TestBasicPolicyDoesNotRetryUnknownByDefault: ErrorUnknown is not retried. Verifies
   conservative default — unknown errors stop immediately.
5. TestPolicyRunnerHonorsRateLimitRetryAfter: RetryAfter from RateLimitInfo is used as
   delay, not backoff. Verifies provider-reported retry-after is respected.
6. TestPolicyRunnerCancellationDuringBackoff: cancelling context during sleep terminates
   the run with cancellation error. Verifies graceful cancellation.
7. TestPolicyRunnerDoesNotBlockOnNoisyRuntimeEvents: 128 events sent; tests event buffer
   overflow (64) and dropped event recording. Verifies the non-blocking event forwarder.
8. TestExponentialBackoffCapsDelay: exponential backoff with Max cap. Verifies math.
9. TestBasicPolicyHonorsRateLimitRetryAfter: policy-level test of RetryAfter delay selection.

Test helpers:
- scriptRuntime and scriptRun are simple, readable test fakes. They simulate success, error,
  and event streams deterministically without real infrastructure.
- collectEvents(), hasCategory(), hasDecision() are clean test utilities.
- noSleep mock for synchronous testing.

Backoff computation (ExponentialBackoff.Delay) is tested directly without a full policy run,
which is appropriate unit testing.

All tests run in memory, no real network, no real runtime process spawn.
```

---

## 12. Performance Review

### Main question
Are performance choices appropriate for the known constraints?

### Checks
- [x] No premature optimization harmed clarity.
- [x] Known scale/latency constraints were considered.
- [x] Expensive operations are not repeated unnecessarily.
- [x] Data loading is not accidentally excessive.
- [x] Concurrency/race risks are considered where relevant.
- [x] Measurement exists or is planned if needed.

### Performance verdict
```text
[✓] Fine
```

### Review notes
```text
Event channel buffer: 64 entries (line 315). This is a deliberate trade-off between
memory use and the ability to handle bursty event producers (e.g., TestPolicyRunnerDoesNotBlockOnNoisyRuntimeEvents
with 128 events proves the buffer fills and events are dropped, not blocking the producer).

When the buffer is full, events are dropped and recorded as PolicyDroppedEvent — correct
back-pressure handling without blocking the runtime run.

Event forwarding: a goroutine (forwardEvents) reads from the inner run's event channel and
forwards to the outer events channel. This decouples event production from consumption.
The goroutine exits when the inner run's event channel closes (eventsDone signal).

Exponential backoff: simple loop multiplication (no math.Pow), with early return on b.Initial <= 0.
The loop runs at most attemptOnTarget-1 iterations (typically < 10). This is efficient.

No allocations in hot paths:
- FallbackAlternatives are copied with append([]FallbackAlternative(nil), ...) to avoid
  sharing the slice with callers.
- PolicyContext is constructed per-attempt with explicit copies of slices (PriorAttempts,
  Alternatives) to prevent aliasing. This is correct but allocates; however, policy runs
  are not expected to be ultra-high-frequency (they wrap actual LLM/runner calls which
  dominate timing).

Concurrency: the main execute() loop is single-threaded (runs in one goroutine). Concurrent
access to policyRun fields is protected by sync.Mutex for the few cases where Wait() or
Cancel() need to read state. targetCounts map access is protected by the execute loop's
single goroutine, not concurrent. seq counter uses atomic operations.

Global counter policyRunCounter uses atomic.Add/Load — lock-free and safe.
```

---

## 13. Maintainability Verdict

### Would the next related feature be easier or harder after this change?

```text
[✓] Easier
```

### Main risks left behind

```text
- BasicPolicy's 7 configuration fields may grow over time as new retry strategies are added.
  Monitor this: if fields exceed ~10, consider a PolicyOptions builder or structured config.
- The execute() loop is complex (98 lines, multiple responsibilities: loop control, attempt
  management, decision dispatch). Future additions (e.g., circuit breaker, retry budget
  per error category) could make it harder to follow. Consider extracting sub-methods if
  it grows further.
- PolicyContext is passed by value (a copy). This is safe but means that if PolicyContext
  grows to be very large (e.g., large PriorAttempts slice), copying could become expensive.
  Currently PriorAttempts is small, so this is not a concern.
```

### Required changes before merge

```text
None — the implementation is clean and well-tested.
```

### Optional improvements later

```text
- Consider extracting the execute() loop into smaller methods (e.g., runAttempt(),
  collectResult(), applyDecision()) to improve readability if new decision types are added.
- Consider adding PolicyMetadata.MaxAttempts and MaxElapsed to the public record for
  dashboard/audit consumption (currently these limits are in BasicPolicy but not exported).
- Consider adding a jitter option to ExponentialBackoff for production use to avoid
  thundering herd on rate-limited endpoints.
```

---

## 14. Final Review Decision

```text
Decision:
[✓] Approve

Reason:
The Resilience Policy Engine is a well-designed, clean implementation of a retry/fallback
policy runner. The interface design (ResiliencePolicy) is minimal and extensible. BasicPolicy
covers common cases without being opinionated. Error classification is thorough. Observability
is comprehensive (events + durable metadata). Tests are focused and cover both happy paths
and failure paths including cancellation, backoff, rate limits, and dropped events. The
implementation fits naturally into the wrapper layer documented in architecture.md and
composes correctly with ObservingRuntime and ValidatingRuntime.

Highest priority fix:
None — no issues requiring changes before merge.
```
