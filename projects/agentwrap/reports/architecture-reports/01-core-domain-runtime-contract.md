# Architecture Review Report: Core Domain / Runtime Contract

**Area reviewed:** Core Domain / Runtime Contract (`runtime.go`, `ids.go`, `lifecycle.go`, `events.go`, `errors.go`, plus closely related `metadata.go`, `health.go`, `permissions.go`, `config.go`, `lifecycle_events.go`, `redact.go`)

**Package:** `github.com/Antonio7098/agentwrap`

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
The runtime contract is clean and unambiguous. Core types (Runtime, Run, RunRequest, RunResult, Capabilities) define a tight, explicit interface where:
- Runtime.StartRun returns a Run handle; Run exposes Events() channel and Wait()/Cancel() methods — standard async-pattern.
- RunRequest is a flat struct of scalar values (strings, durations, enums) — no nested mutable objects, easy to audit.
- RunResult carries everything the caller needs: status, metadata, artifacts, usage, error.
- Capabilities is a map of feature → support, with an explicit Unsupported list for capability-gated flows.
- Error taxonomy is classified and rich (22 ErrorCategory values), with structured fields (StatusCode, RetryAfter, Provider/Model IDs, ExitCode, Signal, etc.).

The contract separates concerns well: event envelope (Event), native payload preservation (RawPayload), runtime-kind-specific concepts (IDs), lifecycle status vocabulary, and SDK error classification. No hidden state machines or implicit transitions.
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
The runtime contract types live in their own files (runtime.go, ids.go, lifecycle.go, events.go, errors.go) with one concern per file. Related types (Event helpers in lifecycle_events.go, metadata types in metadata.go, health types in health.go, permission types in permissions.go) are colocated by concept. This is textbook package-level cohesion.

The design uses Go interfaces for the two main abstractions (Runtime, Run) while keeping data structs plain — appropriate for a contract layer that is meant to be runtime-neutral. No inheritance, no base classes, no framework ceremony.

Configuration (config.go) and redaction (redact.go) are separated from the core contract, which is correct — the contract defines types, not configuration loading logic, though ValidateEffectiveConfig lives alongside ConfigValue/ConfigLayer which blurs the line slightly (see Coupling Review).
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
[✓] Same complexity — the complexity present is fully justified by the domain
```

### Review notes
```text
The capability registry (map[Capability]CapabilitySupport) is the most "abstract" pattern, but it is required because the SDK must support multiple runtimes with different feature sets without changing the API.

The ErrorOption functional option pattern (WithDebugDetail, WithStatusCode, etc.) is more complex than a plain struct constructor, but it is the right choice here: SDKError has 15+ fields, many optional, and the option pattern keeps call sites clean (errors_test.go line 18-21 shows four options chained). This is earned complexity — a plain constructor with 15 parameters would be worse.

EventPayload is []any — a map of open type. This is the correct trade-off: runtime events are inherently untyped at the contract level; callers project them via Event.Kind() and type-assert on payload keys. No sealed event type hierarchy was forced in.

The only mild complexity concern: RunMetadata, AttemptSummary, PolicyMetadata, RepairMetadata, and other metadata structs are large (225-line metadata.go). However, they represent distinct conceptual domains (run context, attempt tracking, policy decisions, repair history), and splitting them would make cross-field references harder.
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
- config.go mixes two distinct concepts: ConfigValue[T] (a generic value-with-provenance holder) and EffectiveConfig (the merged result), ConfigLayer (a source layer), ConfigSource (provenance enum), and the merge/validate functions. The file is cohesive as a "configuration domain" but the merge logic (MergeEffectiveConfig, 40+ lines) and validation logic (ValidateEffectiveConfig) are somewhat removed from the type definitions they operate on.
- redact.go has both generic Redact* functions and SecretFromEnv/RedactEnv which are configuration-specific helpers. These are related but serve different caller contexts.
- lifecycle_events.go lives in the same package but is not imported by runtime.go or lifecycle.go — it is a utility for constructing events, not part of the contract itself. This is fine but slightly hidden.
```

### Recommended improvement
```text
Consider extracting config.go into config/ subpackage if it grows further, or at minimum move ValidateEffectiveConfig closer to ConfigValue definitions. The current colocation is defensible but not perfectly cohesive.
```

---

## 5. Coupling Review

### Main question
Did the change introduce unhealthy dependencies?

### Checks
```text
Global coupling:
- [x] No new mutable global state. The package uses only package-level constants (Capability*, Status*, ErrorCategory*, EventKind*) which are immutable strings — no globals.

Content coupling:
- [x] No external code reaches into internals/private fields. Types are either exported interfaces (Runtime, Run) or exported data structs with exported fields — consistent with a public SDK contract.
- [x] Public methods/interfaces are used appropriately. Runtime is an interface consumed by callers; Run is an interface returned by StartRun.

Stamp coupling:
- [x] Functions do not accept large objects when only small values are needed. RunRequest is intentionally flat (scalars, maps) so callers can construct it without referencing other large structs.
- [x] Parameter objects are cohesive and purposeful. RunRequest, HealthCheckRequest, AttemptRequest are all cohesive request objects. RunResult, RunMetadata are cohesive result objects.

Dependency coupling:
- [x] External dependencies are injected or isolated at boundaries. The SDK has no external dependencies (pure stdlib except redact.go's regexp, which is fine for a security-sensitive package). Runtime adapters (like FakeRuntime in testkit) implement Runtime interface — no hard coupling.
- [x] Core logic is not tightly coupled to infrastructure. The core contract (runtime.go, ids.go, lifecycle.go, events.go, errors.go) has no imports beyond context, time, errors, fmt — minimal surface area.
```

### Coupling verdict
```text
[✓] Coupling acceptable
```

### Review notes
```text
One observation: ValidateEffectiveConfig (config.go) and ValidatePermissionPolicy (permissions.go) are called by higher-level policy code. This is fine, but callers must know to call them. There is no enforced pre-run validation step at the Runtime.StartRun level — this is intentional (StartRun accepts any RunRequest, validation is the caller's responsibility), but worth noting.

The redact.go package-level compiled regexes (secretNamePattern, bearerPattern, assignmentSecretPattern) are module-level globals with compile-time initialization — acceptable for regex patterns that are truly constant.
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
- RunStatus.Terminal() (lifecycle.go:18) is the only terminal-state logic. No duplication.
- Event.Kind() (events.go:57) derives the EventKind from payload using a well-known key (eventKindPayloadKey) — single point of truth.
- Redaction is centralized in redact.go with no duplication in error construction or event handling.
- No "utility" package with duplicated helper functions — each function lives in its conceptual file.
- config.go has similar validation patterns (ValidateEffectiveConfig and ValidatePermissionPolicy both construct errors via helper functions), but the validation rules themselves differ — not concerning duplication.
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
The contract is intentionally stateless at the SDK level — Runtime and Run are interfaces, not structs. The "state" lives entirely within a runtime adapter's implementation (e.g., FakeRuntime.fakeRun struct). This is the correct design for a middleware/shim SDK.

Side effects are explicit:
- Runtime.StartRun ((context, RunRequest) → (Run, error)) is the primary stateful entry point — returns a handle, does not mutate shared state.
- Run.Wait blocks until completion — clearly a mutating operation (status change) from the caller's perspective.
- Run.Cancel signals cancellation — documented as such.
- Run.Events() returns a receive-only channel — obvious consumer-side pattern.

No hidden state: Event.Payload is map[string]any (open), Event.Raw is *RawPayload (explicitly marked as sensitive), RunResult.Err is typed as *SDKError rather than plain error.

RunMetadata comments explicitly note "best-effort until later adapter and observability sprints" — the code itself documents its own limitations.
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
Go idioms throughout:
- Interfaces (Runtime, Run, HealthChecker) define contracts; data structs are plain.
- Functional options (ErrorOption) for optional error fields — clean and idiomatic.
- Channels for async event delivery — appropriate for streaming events.
- No inheritance; no class hierarchy; no ORM-style patterns.
- Package-level constants for enums (string-based type aliases) — standard Go practice.
- Generic ConfigValue[T] — used tastefully for provenance-tracking config values.
- itoa64 in lifecycle_events.go is a private utility function; appropriate for internal use.

The design choices are driven by the domain (runtime contract for agentic coding), not by framework conventions.
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
SDKError is a rich, classified error type:
- 22 ErrorCategory values cover the full failure spectrum (configuration, health, runtime, provider, model, auth, permission, rate limit, timeout, cancellation, validation, etc.).
- Fields include everything needed for debugging, retry, or user-facing messages (Operation, UserDetail, DebugDetail, StatusCode, ResponseHeaders/Body — redacted, Provider, Model, RuntimeKind, ExitCode, Signal, NativeType, RetryAfter, Metadata).
- errors.As-compatible (ErrorAs function) for idiomatic error unwrapping.
- Unwrap returns Cause for errors.Is support (tested in errors_test.go:24).
- ResponseBody and ResponseHeaders are redacted before storage (WithResponse applies RedactStringMap/RedactString).

ErrorOption pattern allows callers to attach only the context relevant to their failure mode — avoids null fields on SDKError.

RetryAfter field exists for rate-limit scenarios. Signal, ExitCode, NativeType for runtime-exit scenarios. This is comprehensive without being baroque.

One minor note: ErrorForHealthStatus (health.go:169) silently defaults category to ErrorHealth if not provided — this is reasonable defaulting behavior, not a concern.
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
[✓] Acceptable
```

### Review notes
```text
Strengths:
- RunEvents channel delivers structured Event objects with EventID, RunID, SessionID, TurnID, Time, Type, Payload, Raw — full correlation IDs are present.
- Lifecycle events (LifecycleEvent helper) include from/to status transitions with reason strings.
- RunMetadata tracks duration (StartedAt, FinishedAt, Duration), session, usage, artifacts, errors.
- AttemptSummary records each retry attempt with context, request sanitized (prompt stripped), status, duration.
- PolicyMetadata records all policy decisions (PolicyDecisionRecord) with delay, reason, context.
- SDKError contains Operation, Category, DebugDetail — structured, not just a string.

Limitations/minor concerns:
- No explicit tracing/tracing接口 in the contract itself (no trace ID propagation in Event envelope beyond what runtime adapter might provide via Payload).
- observability.go exists in the same package (observability.go) — it likely adds higher-level observability wrappers; the base contract is observable but not necessarily traceable by default.
- No metrics API in the base contract (metrics would be in policy/observability layer, which is appropriate).
- Sensitive data redaction is present (redact.go, WithResponse redacts) but RawPayload.Safe bool is the mechanism — runtime adapters must correctly set Safe=true when raw data is safe to persist. This is a trust boundary worth documenting.
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
[✓] Acceptable
```

### Review notes
```text
Test coverage present:
- errors_test.go: Tests SDKError wrapping, unwrapping (errors.Is), ErrorAs, redaction (authorization header redacted, token=redacted in body), provider/model/retry fields.
- lifecycle_test.go: Tests RunStatus.Terminal() for all 5 states (starting, running, completed, failed, cancelled).
- lifecycle_events_test.go: Tests LifecycleEvent and SessionEvent payload construction and Kind() projection.
- FakeRuntime in internal/testkit/fake_runtime.go: Full contract implementation for testing — validates StartRun, capability checking, event streaming, cancellation, status transitions. FakeRuntime is a real implementation following the interface contract, not a mock.

Missing coverage (not necessarily a concern — these may exist in adapter implementations):
- No runtime_test.go (file not present).
- No test for Event.Kind() with nil Payload or with string type (covered by review of events.go:57-67).
- No test for Capabilities.Supports() or CapabilitySupport.
- No test for RunRequest construction or RunResult field mapping.

The existing tests cover the core logic that is not dependent on a real runtime: error construction/wrapping, lifecycle state transitions, event kind projection. This is appropriate for a contract package.

FakeRuntime is a reference contract implementation, not a mock — it provides value in testing caller's policy code without a real runtime.
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
No performance concerns in the core contract:
- Event.Payload is map[string]any — lookups are O(1); no linear scans.
- RunResult, RunMetadata copy slices explicitly (append([]ArtifactRef(nil), r.artifacts...) in fake_runtime.go:127) — defensive but not a bottleneck at contract level.
- Event channel (Event() <-chan Event) is the standard Go pattern for streaming — no buffering assumptions made.
- MergeEffectiveConfig loops over config layers — O(n) where n is number of layers (typically small, 3-5).
- Regex patterns in redact.go are compiled once at package init — only cost is the match operation itself.
- FakeRuntime uses sync.Once for cancellation close — correct concurrent primitive.
- sync.Mutex used in FakeRuntime for mutable state — correct.
```

---

## 13. Maintainability Verdict

### Would the next related feature be easier or harder after this change?

```text
[✓] Easier
```

### Main risks left behind
```text
- RawPayload.Safe contract: Runtime adapters must correctly set Safe=true when raw payload is safe to persist. If an adapter sets Safe=false (or omits it), the payload is omitted from persisted event records. There is no enforcement — this is a trust boundary that could be documented more prominently.
- Event.Kind() projection: The Kind() method reads from Payload map using a well-known key (eventKindPayloadKey). If a runtime adapter emits an event without this key, Kind() returns "". This is documented but the fallback behavior relies on the caller to handle empty string.
- ValidateEffectiveConfig must be called explicitly by callers before passing config to StartRun. If a caller forgets to call it, invalid config flows into the runtime adapter. This is a convention, not an enforcement.
- config.go mixes type definitions, merge logic, and validation — adding new config fields requires touching multiple sections of the same file.
```

### Required changes before merge
```text
None — the code is clean, testable, and well-structured for its purpose.
```

### Optional improvements later
```text
- Add tests for Event.Kind() edge cases (nil Payload, string type, missing event_kind key) and Capabilities.Supports() in a new runtime_test.go file.
- Consider adding a ValidateRunRequest(RunRequest) function at the SDK level to centralize pre-flight validation rather than relying on caller convention.
- Document the RawPayload.Safe trust boundary in doc.go or a dedicated CONTRACT.md file.
- Extract config.go merge/validation into a config.go-internal file if the file continues to grow.
- Add a WithCorrelationID ErrorOption if correlation IDs are to be attached to errors for distributed tracing.
```

---

## 14. Final Review Decision

```text
Decision:
[✓] Approve

Reason:
The Core Domain / Runtime Contract is well-designed, clean Go code that correctly captures the runtime-neutral SDK contract. Types are intentional, interfaces are small and focused, error taxonomy is rich and actionable, and the separation between contract types, configuration, health, and permissions is architecturally sound. The main strengths are: flat request/result structs with no hidden dependencies, rich error classification with full context, explicit event envelopes with correlation IDs, and a capability system that allows runtime extensibility without API changes. The minor concerns (RawPayload.Safe trust boundary, explicit config validation convention, Event.Kind() empty fallback) are documented and do not represent architectural defects.

Highest priority fix:
None — no fixes required before merge.
```

---

## Appendix: Files Reviewed

| File | Purpose | Lines |
|------|--------|-------|
| `runtime.go` | Runtime/Run interfaces, RunRequest, RunResult, Capabilities, Capability types | 103 |
| `ids.go` | ID type definitions (RunID, SessionID, TurnID, etc.) | 29 |
| `lifecycle.go` | RunStatus enum, Terminal() method | 25 |
| `events.go` | Event envelope, EventPayload, EventKind constants, RawPayload | 78 |
| `errors.go` | SDKError, ErrorCategory, ErrorOption helpers | 156 |
| `metadata.go` | RuntimeContext, RunMetadata, AttemptSummary, SessionMetadata, ArtifactRef, Usage | 225 |
| `health.go` | HealthChecker, HealthCheckRequest, HealthReport, HealthResult, AggregateHealth | 181 |
| `permissions.go` | PermissionPolicy, PermissionTool, PermissionAction, PermissionAudit | 197 |
| `config.go` | ConfigValue[T], ConfigLayer, EffectiveConfig, merge/validate | 164 |
| `lifecycle_events.go` | LifecycleEvent, SessionEvent helpers, itoa64 utility | 56 |
| `redact.go` | RedactString, RedactMetadata, RedactEnv, secret pattern matchers | 93 |
| `doc.go` | Package-level documentation | 38 |
| `internal/testkit/fake_runtime.go` | FakeRuntime contract implementation | 261 |
| `errors_test.go` | SDKError wrapping/redaction tests | 52 |
| `lifecycle_test.go` | Terminal() state tests | 22 |
| `lifecycle_events_test.go` | Event construction tests | 33 |