# Architecture Review: Observability & Event Infrastructure

**Package**: `agentwrap` (root)
**Files reviewed**: `observability.go`, `lifecycle_events.go`, `lifecycle.go`, `events.go`
**Review date**: 2026-05-21

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
ObservingRuntime wraps a Runtime and surfaces two concern axes:

1. Event projection — a goroutine (forward) consumes inner.Events(), builds
   RunEventRecord with sequence numbering, applies business rules
   (status from payload, artifact injection, usage tracking), and fans out to
   zero-or-more NamedEventSinks plus an optional RunStore.

2. Run state inspection — ObservingRuntime exposes ListActiveRuns, GetCompletedRun,
   ListRunEvents directly from the store. This gives callers a query path without
   exposing store internals.

Failure paths are explicit:
- required sinks cause Wait() to return an SDKError
- best-effort sink failures are recorded on the RunRecord but do not block
- store failures are recorded, not propagated to the caller
- context cancellation in forward() stops the goroutine cleanly

The lifecycle event constructors (LifecycleEvent, SessionEvent) in lifecycle_events.go
are canonical factory functions. They ignore the RuntimeContext parameter (evidenced by
the _ = ctx pattern), which is suspicious — this may hide a future design gap.
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
[x] Good fit
[ ] Acceptable fit with minor issues
[ ] Works but architecture is bending
[ ] Refactor required before merge
```

### Review notes
```text
ObservingRuntime follows the decorator/wrapper pattern correctly:
it holds a Runtime, implements the same interface, and adds cross-cutting
observation without modifying the wrapped type. This is clean.

The interfaces are properly separated:
- EventSink: single-method AppendEvent (observer pattern)
- RunStore: full persistence/query contract
- RunInspector: read-only projection of RunStore

The placement in observability.go is appropriate; lifecycle_events.go handles
canonical event construction; lifecycle.go defines the RunStatus vocabulary.
No abstractions were forced into unsuitable locations.

No distortion to existing architecture detected.
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
[x] Simpler than before
[ ] Same complexity
[ ] More complex, justified
[ ] More complex, not justified
```

### Review notes
```text
ObservingRuntime is a thin, focused wrapper. No unnecessary indirection.

However, cloneReflectValue (lines 691–743) is a large hand-rolled deep-clone
utility using reflection. It handles all types recursively. This is significant
complexity, but it is earned: the observing layer must not mutate original
payloads or records that may be retained by the inner runtime. Without it,
shared map/slice references could cause observation to corrupt inner state.

The alternative — requiring callers to supply immutable data — is not
enforceable here since EventPayload is map[string]any.

MemoryRunStore is a simple in-memory map triplet with mutex protection.
Appropriate for reference/test use. Production stores would implement RunStore.

The three "first*" functions (firstRunID, firstContext, firstUsage) are simple
but verbose. They could be generic, but the duplication is marginal and the
specific typed signatures avoid boxing overhead.
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
- No cohesion problems detected in this area.
```

### Recommended improvement
```text
The clone functions (cloneRunRecord, cloneEventRecord, clonePayload,
clonePayloadValue, cloneReflectValue, cloneAnyMap, cloneStringMap) are
grouped at the bottom of observability.go. This is fine for a utility cluster,
but they are generally applicable helpers that could live in a shared
clone utility file if the codebase grows. For now, keeping them in observability.go
is acceptable since they are only used within this package.
```

---

## 5. Coupling Review

### Main question
Did the change introduce unhealthy dependencies?

### Checks
```text
Global coupling:
- [x] No new mutable global state.
- [x] Runtime configuration/state is passed explicitly where needed.

Content coupling:
- [x] No external code reaches into internals/private fields.
- [x] Public methods/interfaces are used appropriately.

Stamp coupling:
- [x] Functions do not accept large objects when only small values are needed.
- [x] Parameter objects are cohesive and purposeful.

Dependency coupling:
- [x] External dependencies are injected or isolated at boundaries.
- [x] Core logic is not tightly coupled to infrastructure.
```

### Coupling verdict
```text
[x] Coupling reduced
[ ] Coupling acceptable
[ ] Coupling increased but justified
[ ] Coupling increased and should be fixed
```

### Review notes
```text
ObservingRuntime depends on the Runtime interface and optionally a RunStore.
Both are injected (not constructed internally), which is correct dependency
inversion.

observedRun holds references to the store, sinks, and inner Run — all
explicit dependencies passed at construction time. No hidden global state.

The code calls reflect.ValueOf and reflect.TypeOf in clone operations,
which creates a coupling to Go's reflection package, but this is intentional
and unavoidable for deep-cloning arbitrary map/slice/struct payloads.
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
[x] No concerning duplication
[ ] Duplication exists but is only code shape and acceptable
[ ] Business knowledge duplication must be fixed
[ ] Bad abstraction must be split
```

### Review notes
```text
No business logic duplication detected.

The cloneReflectValue handles multiple types with a switch-on-kind, which
is repeated shape but is the standard Go pattern for generic deep clone.
It is not a premature abstraction — it is a necessary utility.

lifecycle_events.go has a local itoa64 function (lines 44–56) for
event ID construction. This is fine; it is a specialized formatter not
general enough to warrant a shared utility, and it avoids importing
strconv or fmt for a simple integer-to-string conversion.
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
[x] Clear and safe
[ ] Minor concerns
[ ] Hidden mutation risk
[ ] Needs redesign
```

### Review notes
```text
Key stateful operations:
- observedRun.forward() runs in a goroutine; it closes r.done and r.events on exit.
  This is explicit and clean.
- appendRecord calls store.AppendEvent and all sinks; these are side effects at the
  boundary layer. Failures are captured, not propagated.
- upsert is called after Wait() and after each event; it writes the run record to
  the store. This is the durable state mutation.

Mutations to r.record (the in-memory RunRecord) are protected by r.mu.Lock().
This is correct since the goroutine forward() runs concurrently with Wait().

context.WithCancel is used to signal forward() to stop when the observedRun is
cancelled. This is clean.

No query operation mutates state. ListActiveRuns, GetCompletedRun, ListRunEvents
are all read-only with respect to the store.
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
[x] Good fit
[ ] Acceptable
[ ] Over-object-oriented
[ ] Over-functional/too dense
[ ] Over-procedural/no useful boundaries
[ ] Framework-driven rather than domain-driven
```

### Review notes
```text
ObservingRuntime is a struct with methods — appropriate for a wrapper that
carries configuration (Runtime, Store, Sinks, Policy) and delegates to an inner
Runtime. No inheritance hierarchy.

observedRun is a concrete type that holds state (record, seq, events channel)
and implements the Run interface by delegating to inner. This is honest
composition.

The forward() goroutine is the natural place for async event fan-out.
It is not hidden; it is a named method on the type.

Interfaces (EventSink, RunStore, RunInspector) are small and purposeful.
No interface pollution.

Functional helpers (clone*) areplain functions, not method chains.
Correct choice for utilities.
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
[x] Strong
[ ] Acceptable
[ ] Too generic
[ ] Unsafe / incomplete
```

### Review notes
```text
Error handling is thorough:

- NewError(ErrorConfiguration, "observing runner", ...) is used for nil-runtime
  configuration errors, giving a clear category and operation name.

- mergeRequiredObserverError propagates a required sink/store failure as the
  Wait() error when the primary runtime error is nil. This preserves the
  semantic that required observation failures are significant.

- SinkFailure records capture name, required flag, operation, timestamp, and
  SDKError. These are queryable on the RunRecord, so callers can inspect
  what failed without the failure causing a fatal Wait() error.

- sdkErrorValue converts arbitrary errors to SDKError using errors.As, with
  a fallback that wraps in NewError(ErrorUnknown, ...). This ensures all
  stored errors are typed consistently.

- Raw unsafe payload omission is handled deliberately: when
  policy.PersistUnsafeRawPayloads is false and Raw.Safe is false, the raw
  data is not stored and RawOmitted/RawOmissionReason are set. This is
  explicit, not silent failure.

No retry logic is present, which is correct: the observability layer is
not responsible for retry; it observes and records. The runtime below
may have its own retry semantics.
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
[x] Strong
[ ] Acceptable
[ ] Missing useful signals
[ ] Unsafe logging risk
```

### Review notes
```text
Observability signals present:

- RunRecord tracks StartedAt, FinishedAt, Duration, CompletedAt, ObservedAt —
  comprehensive timing for any run.

- EventCount and DroppedEventCount allow detection of event channel overflow.

- SinkFailures and StoreFailures are recorded with timestamps and error details
  on every run record. Failures are observable without requiring log inspection.

- RunEventRecord includes Sequence number for ordering, ObservedAt and StoredAt
  for latency measurement, and RawSource/RawEncoding for tracing provenance.

- ObservingRuntime.Now is injectable for testing and for clock replacement
  in production if needed.

- Correlation IDs: RunID is propagated into every RunEventRecord and RunRecord.
  SessionID and TurnID are also preserved.

- Sensitive data: Raw payloads with Safe=false are omitted unless
  policy.PersistUnsafeRawPayloads is explicitly enabled. This prevents
  accidental logging of model prompts/repsonses.

Missing signals:
- No explicit trace/span propagation. ObservingRuntime does not currently
  support OpenTelemetry or similar. This is acceptable as Sprint 2 scope,
  but the RunRecord's NativeMetadata could carry trace IDs in the future.

- No metric emissions (Prometheus counters, etc.). RunRecord fields could
  be scraped, but there is no direct instrumentation path.
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
[x] Strong
[ ] Acceptable
[ ] Missing important cases
[ ] Tests reveal architecture problems
```

### Review notes
```text
observability_test.go covers:

1. MemoryRunStore active/completed lifecycle and event sequencing
   (TestMemoryRunStoreActiveCompletedAndEventOrdering)

2. ObservingRuntime end-to-end: event capture, unsafe raw omission,
   artifact metadata injection, usage tracking, parent run ID propagation
   (TestObservingRuntimeStoresRecordsAndOmitsUnsafeRawPayload)

3. Artifact collection from events vs. result vs. metadata merge
   (TestObservingRuntimePreservesEventCollectedArtifacts)

4. Deep clone of EventPayload to prevent shared mutation
   (TestRunEventRecordPayloadIsDeepCloned)

5. Non-blocking behavior when outer event channel is unconsumed
   (TestObservingRuntimeDoesNotBlockOnUnconsumedOuterEvents)

6. Required sink failure propagates to Wait()
   (TestObservingRuntimeRequiredSinkFailureChangesWaitError)

7. Best-effort sink failure recorded but does not change Wait() result
   (TestObservingRuntimeBestEffortSinkFailureIsRecorded)

8. Concurrent run isolation in MemoryRunStore
   (TestMemoryRunStoreConcurrentRunIsolation)

The staticRuntime/staticRun test helpers are appropriate: they provide a
deterministic runtime without mocking framework overhead. They implement
the Runtime/Run interfaces in-memory.

All tests use real store (MemoryRunStore), not a mock. This is correct —
the test verifies the full path including store interaction, not just
interface compliance.

drainEvents helper with 2-second timeout prevents goroutine leaks in tests.
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
- [x] Measurement exists or planned if needed.

### Performance verdict
```text
[x] Fine
[ ] Needs measurement
[ ] Likely bottleneck
[ ] Over-optimized prematurely
```

### Review notes
```text
Performance considerations:

- forward() goroutine: events from inner.Events() are consumed in a loop.
  If the inner runtime produces events faster than they are consumed by
  sinks and the outer channel, the events channel (buffered 64) can fill.
  The default case in the select drops events and increments
  DroppedEventCount. This is a deliberate backpressure signal.

- Deep clone via reflection on every event: this is expensive for large
  payloads. However, it is necessary for safety (prevents mutation
  of retained inner event data). In production, if event volume is high,
  this could become a bottleneck. No caching or object pooling is
  implemented, which is appropriate for Sprint 2 scope.

- upsert on every event: each forward() iteration calls upsert(), which
  does a store.UpsertRun. For high-frequency events, this could be
  excessive. There is no batching or debouncing. The design assumes
  store implementations may be batch-aware (e.g., write-ahead log in
  front of a database). This is a reasonable assumption given the
  RunStore interface is backend-neutral.

- MemoryRunStore uses three mutex-protected maps. Under high concurrency,
  lock contention could be a factor. Again, appropriate for reference
  implementation.

No performance measurement infrastructure (metrics, benchmarks) is present,
which is acceptable for current scope. The design does not preclude
future optimization.
```

---

## 13. Maintainability Verdict

### Would the next related feature be easier or harder after this change?

```text
[x] Easier
[ ] About the same
[ ] Harder but justified
[ ] Harder and not justified
```

### Main risks left behind
```text
- The injectable Now func enables testability but could hide clock-skew
  issues in production if misused (e.g., returning time.Now() repeatedly
  within the same observedRun lifecycle causes non-monotonic ObservedAt).
  No production guidance on this is documented.
```

### Required changes before merge
```text
- None identified.
```

### Optional improvements later
```text
- Consider adding OpenTelemetry span propagation to ObservingRuntime for
  trace correlation across the wrapper boundary.

- Consider a configurable upsert debounce/batch to reduce store write
  frequency for high-frequency event streams.

- Consider adding a concrete Prometheus metrics emitter that translates
  RunRecord fields into counters/gauges.

- LifecycleEvent and SessionEvent currently ignore the RuntimeContext
  parameter. If future features require context (e.g., runtime kind
  checks), this is a latent design gap. Evaluate whether the parameter
  should be used or removed.
```

---

## 14. Final Review Decision

```text
Decision:
[x] Approve
[ ] Approve with comments
[ ] Request small changes
[ ] Request architecture refactor
[ ] Reject / redesign required

Reason:
The observability and event infrastructure is well-designed, correctly
implementing the decorator pattern with explicit failure handling, clean
interface boundaries, and thorough test coverage. No architectural
distortion, no unhealthy coupling, no business logic duplication.
The reflection-based deep clone is earned complexity. The design
preserves all failure signals and does not silently swallow errors.

Highest priority fix:
None required. Optional improvement: evaluate whether RuntimeContext
parameter in LifecycleEvent/SessionEvent is a latent design gap.
```

---

## Summary

The Observability & Event Infrastructure in `agentwrap` is a clean,
well-scoped implementation of the observer pattern applied to runtime
execution. Key strengths:

- **Decorator pattern** correctly applied: `ObservingRuntime` wraps a
  `Runtime` without modifying it.
- **Interface segregation**: `EventSink`, `RunStore`, `RunInspector`
  are small, purposeful contracts.
- **Failure transparency**: required observers fail the `Wait()` result;
  best-effort failures are recorded on the `RunRecord`.
- **Deep clone safety**: reflection-based cloning prevents observation
  from corrupting inner runtime state.
- **Strong test coverage**: 8 test cases cover the full event lifecycle,
  concurrent isolation, and failure paths using real in-memory stores.

The only notable observation is that `LifecycleEvent` and `SessionEvent`
accept a `RuntimeContext` parameter that is immediately discarded (`_ = ctx`),
which may indicate a future design need — but this is not a current defect.

**Files reviewed**: `observability.go`, `lifecycle_events.go`, `lifecycle.go`, `events.go`
**Tests**: `observability_test.go`
**Test helpers**: `internal/testkit/fake_lifecycle.go`, `fake_runtime.go`