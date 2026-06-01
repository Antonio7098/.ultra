# Architecture Review: OpenCode Adapter (Infrastructure/Driver)

**Package**: `opencode/`
**Review Date**: 2026-05-21
**Reviewer**: Architecture Review
**Files Under Review**: `runtime.go`, `health.go`, `permissions.go`, `options.go`, `process.go`, `process_unix.go`, `process_windows.go`, `process_other.go`, `rate_limit.go`, `decoder.go`, `projector.go`

---

## 1. Behaviour Review

### Main question
Can the reviewer clearly understand the feature's behaviour from the code?

**Answer**: Yes. The adapter launches `opencode run --format json`, captures stdout as a JSON-lines event stream, projects native OpenCode events to canonical agentwrap events, and returns structured results with classified errors.

### Check
- [x] The main workflow is visible.
- [x] The feature does what the requirement asked.
- [x] The implementation does not include unrelated work.
- [x] Inputs and outputs are clear.
- [x] Side effects are obvious.
- [x] Failure paths are handled deliberately.

### Review notes
```text
- StartRun (runtime.go:20) orchestrates: validation -> preflight health -> permission translation -> processSpec building -> subprocess start -> goroutines for stderr capture, context monitoring, and event loop.
- Event flow: scanNativeRecords (decoder.go) -> projectNative (projector.go) -> emit via channel.
- FinalResult logic (runtime.go:281) is comprehensive: handles decode errors, context errors, exit code errors, sawFinal flag precedence.
- Cleanup is centralized via cleanupOnce (runtime.go:412) and invoked on multiple exit paths.
```

---

## 2. Architecture Fit Review

### Main question
Did the change fit the existing architecture, or did it distort it?

**Answer**: Good fit. Clean implementation of the `agentwrap.Runtime` interface with proper separation between the adapter's internal abstractions (`processRunner`, `process`, `processSpec`) and the external `agentwrap` contract.

### Check
- [x] The change belongs in the files/modules it touched.
- [x] The current workflow still reads cleanly.
- [x] No feature was jammed into an unsuitable abstraction.
- [x] No large refactor was avoided when the design clearly needed one.
- [x] No large refactor was performed without real need.

### Decision
```text
[x] Good fit
```

### Review notes
```text
- Runtime implements agentwrap.Runtime (options.go:80) and agentwrap.HealthChecker (health.go:14).
- Internal process abstraction (processRunner interface, options.go:126) cleanly separates exec-process spawning for testability.
- Projector (projector.go) is a pure transformation function - no side effects, no I/O.
- Decoder (decoder.go) handles I/O scanning but is focused solely on JSON-line parsing.
- Permission translation (permissions.go) is isolated and stateless.
```

---

## 3. Simplicity and Earned Complexity Review

### Main question
Did the implementation add only the complexity required by the feature?

**Answer**: Yes. The complexity present is earned by the requirement to adapt a native CLI to a structured event stream with proper error classification.

### Check
- [x] No speculative abstractions.
- [x] No unnecessary interfaces/protocols/base classes.
- [x] No plugin/factory/registry unless justified.
- [x] No generic engine for a single concrete use case.
- [x] No framework ceremony added without need.
- [x] The simplest honest design was chosen.

### Complexity verdict
```text
[x] Simpler than before
```

### Review notes
```text
- Functional options pattern (options.go) for Runtime configuration is appropriate and idiomatic.
- processRunner interface is minimal: Start method only.
- process interface is minimal: Stdout, Stderr, Wait, Cancel.
- No unnecessary abstraction layers.
- rate_limit.go complexity is justified: must classify multiple rate-limit patterns from text, headers, and structured data.
```

---

## 4. Cohesion Review

### Main question
Are responsibilities grouped around real concepts and reasons to change?

**Answer**: Yes. File organization reflects natural boundaries.

### Check
- [x] Related rules are kept together.
- [x] Unrelated behaviours are not forced into one unit.
- [x] Functions/classes/modules have clear names and purposes.
- [x] No god object/service/module was expanded.
- [x] No excessive micro-fragmentation was introduced.

### Cohesion issues
```text
- process_other.go (17 lines) is an exact duplicate of process_windows.go (17 lines). Both implement the same signalProcessGroup and configureProcessGroup for platforms without unix or windows build tags. This is intentional for build flexibility but represents code duplication.
```

### Recommended improvement
```text
Consider merging process_windows.go and process_other.go into a single file with a broader build tag (e.g., `//go:build !unix`) since both implementations are identical (both just call proc.Kill()).
```

---

## 5. Coupling Review

### Main question
Did the change introduce unhealthy dependencies?

### Check
```text
Global coupling:
- [x] No new mutable global state. (runCounter atomic is the only global, and it's appropriate for unique ID generation)
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
[x] Coupling acceptable
```

### Review notes
```text
- processRunner interface (options.go:126) allows concrete execProcessRunner to be swapped for fakes in tests.
- Runtime holds processRunner as an interface field, not a concrete type.
- rate_limit.go has many helper functions (stringify, intFromAny, firstNonNil, etc.) that could be shared utilities but are currently package-local. Acceptable for this package scope.
```

---

## 6. DRY and Duplication Review

### Main question
Did the change duplicate knowledge or create a bad abstraction to avoid duplication?

### Check
- [x] Business rules are not duplicated.
- [x] Security/authorization rules are not duplicated.
- [x] Validation rules are not duplicated inconsistently.
- [x] Similar code shape was not abstracted prematurely.
- [x] Shared abstractions do not contain caller-specific branches.
- [x] No new boolean flags were added to preserve a bad abstraction.

### Duplication verdict
```text
[x] No concerning duplication
```

### Review notes
```text
- process_windows.go and process_other.go are identical but serve different build tags. This is a known Go pattern for platform-specific code.
- rate_limit.go has repeated lowercasing patterns but each is in context-specific classification functions.
- No abstraction was created prematurely to avoid small duplication.
```

---

## 7. State and Side Effects Review

### Main question
Are state changes and side effects explicit, controlled, and testable?

### Check
- [x] Durable state changes are clear.
- [x] Derived state is not treated as authoritative unless justified.
- [x] Ephemeral state does not leak into global/shared state.
- [x] Mutating operations are named clearly.
- [x] Queries do not unexpectedly mutate state.
- [x] Side effects are at boundaries where practical.

### State verdict
```text
[x] Clear and safe
```

### Review notes
```text
- The `run` struct (runtime.go:141) is the central state holder for an active run.
- State transitions are guarded by mutexes (eventMu, mu) where necessary.
- sendEvent and sendLocalEvent use recover() to handle channel-closed panics gracefully.
- cleanupOnce ensures cleanup runs exactly once.
- Lifecycle state machine (transitionLifecycle) is well-defined with terminal state guards.
```

---

## 8. Function/Class/Paradigm Review

### Main question
Does the chosen coding style fit the problem?

### Check
- [x] Functions are used where behaviour is stateless/simple.
- [x] Classes are justified by state, invariants, lifecycle, or polymorphism.
- [x] Inheritance is shallow and honest if used. (None used)
- [x] Composition is used where behaviour varies independently.
- [x] Functional pipelines improve readability rather than obscure it.
- [x] Framework conventions are followed without hiding domain behaviour.

### Paradigm verdict
```text
[x] Good fit
```

### Review notes
```text
- Functional options pattern for Runtime configuration is idiomatic Go.
- The `run` struct is a concrete implementation of the `agentwrap.Run` interface, managing a clear lifecycle.
- Process abstraction uses interface composition appropriately.
- Projector uses pure function transformation (projectionInput -> projectionResult).
- Decoder uses a callback-based streaming pattern which is appropriate for line-by-line JSON parsing.
```

---

## 9. Error Handling Review

### Main question
Are failures explicit, useful, and recoverable where appropriate?

### Check
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
```

### Review notes
```text
- SDKError categories are specific: ErrorRuntimeUnavailable, ErrorMalformedEvent, ErrorRuntimeExit, ErrorCancellation, ErrorTimeout, ErrorRateLimit, ErrorCleanup, ErrorConfiguration.
- classifyStartError, classifyDecodeError, classifyExitError, classifyContextError provide clear error attribution.
- postFinalDecodeWarning (runtime.go:387) handles the edge case of decode errors after a final result has been seen.
- Health checks return structured HealthResult with severity levels.
- Errors include debug detail for diagnostics while user detail is clean.
```

---

## 10. Observability Review

### Main question
Can we understand this feature in real execution?

### Check
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
```

### Review notes
```text
- Lifecycle events (EventLifecycle) track status transitions with sequence numbers and reasons.
- NativeMetadata includes: event_count, event_categories, native_event_types, native_extension_count, stderr, exit_code.
- Event projection preserves raw JSON in Raw field with Safe=false by default.
- Rate limit info is captured when available.
- Permissions audit trail is emitted as events.
- runCounter provides unique run identification.
- Health checks probe and report structured results.
```

---

## 11. Testing Review

### Main question
Do the tests protect the behaviour and reflect the architecture?

### Check
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
```

### Review notes
```text
- fakeRunner and fakeProcess (runtime_test.go) provide controlled test doubles.
- Golden fixtures (testdata/*.ndjson, testdata/*.golden.json) ensure consistent event projection across changes.
- Tests cover: command construction, permission injection, session validation, event projection, error classification, cancellation, timeout, cleanup failure, concurrent runs, health checks.
- Integration tests (integration_test.go) are gated behind environment variables and test real OpenCode behavior.
- Workstream 1 tests (runtime_test.go:863+) document known behavior gaps as test cases with descriptive comments.
```

---

## 12. Performance Review

### Main question
Are performance choices appropriate for the known constraints?

### Check
- [x] No premature optimization harmed clarity.
- [x] Known scale/latency constraints were considered.
- [x] Expensive operations are not repeated unnecessarily.
- [x] Data loading is not accidentally excessive.
- [x] Concurrency/race risks are considered where relevant.
- [x] Measurement exists or planned if needed.

### Performance verdict
```text
[x] Fine
```

### Review notes
```text
- Scanner buffer: 256KB initial, 16MB max (decoder.go:64). Appropriate for JSON event lines.
- Stderr buffer limit: 16KB default (options.go:13). Bounded to prevent memory issues.
- Events channel: 32 buffered (runtime.go:46). Allows backpressure-free event emission.
- 2-second cleanup timeout (runtime.go:212, 268) is reasonable.
- No repeated expensive operations in hot paths.
```

---

## 13. Maintainability Verdict

### Would the next related feature be easier or harder after this change?

```text
[x] Easier
```

### Main risks left behind
```text
- Projector.classify() (projector.go:90) uses string containment checks (strings.Contains) for event classification. New OpenCode event types with names containing keywords like "warning", "session", or "artifact" would be incorrectly classified. This is a brittleness risk as OpenCode evolves.
- Rate-limit text classification (rate_limit.go) has many hardcoded string patterns that may need updating as OpenCode error messages change.
- Session support is explicitly "best-effort" (runtime.go:668), which may cause confusion when session continuation silently fails.
```

### Required changes before merge
```text
- None. The implementation is complete and well-tested for Sprint 3 scope.
```

### Optional improvements later
```text
- Consider extracting process platform implementations into a shared file with broader build tags to eliminate duplication between windows and other platforms.
- Consider a more structured event type registry in projector.go instead of string-based containment checks.
- Consider adding structured logging for the event classification decisions to aid debugging classification mismatches.
- Document the known behavior gaps (TestRunCleanExitWithOutputWithoutFinalCompletesWithWarning, TestTimeoutWithRecentProviderErrorLogClassifiesRateLimit) with tracking issues.
```

---

## 14. Final Review Decision

```text
Decision:
[x] Approve with comments

Reason:
The OpenCode adapter is a well-structured, clean implementation of the agentwrap Runtime interface. It properly separates concerns, handles errors comprehensively, and has strong test coverage. The main concern is the string-based event classification in projector.go which could be brittle if OpenCode introduces new event types with names that collide with existing keyword matches.

Highest priority fix:
None required for merge. Consider addressing the string-based event classification brittleness (projector.go:90-122) in a future iteration by using a more explicit event type mapping table.
```

---

## Summary

The OpenCode adapter implements a CLI-to-runtime adapter pattern cleanly. Key strengths:

1. **Clean abstraction**: `processRunner`/`process` interfaces enable full testability without real subprocesses
2. **Comprehensive error classification**: Every failure mode is typed and attributed
3. **Strong observability**: Lifecycle events, native metadata, and permission audit trails
4. **Well-tested**: Unit tests with fake doubles and golden fixtures, plus gated integration tests

The primary architectural concern is the reliance on `strings.Contains` for event classification, which creates a fragile coupling to OpenCode's event type naming conventions. This is acceptable for Sprint 3 but should be addressed before the adapter handles production traffic with evolving OpenCode versions.
