# Architecture Review: Output Validation & Bounded Repair System

**File reviewed:** `validation.go`
**Review date:** 2026-05-21
**Reviewer:** Architecture audit

---

## 1. Behaviour Review

### Main question
Can the reviewer clearly understand the feature's behaviour from the code?

Check:
- [x] The main workflow is visible.
- [x] The feature does what the requirement asked.
- [x] The implementation does not include unrelated work.
- [x] Inputs and outputs are clear.
- [x] Side effects are obvious.
- [x] Failure paths are handled deliberately.

Review notes:
```text
The ValidatingRuntime wraps a Runtime and adds post-run validation with bounded repair loops.
Main workflow: StartRun → execute() → startAndWait() → validate() → if failed, runRepair() → repeat.
Built-in expectations cover file, directory, artifact, markdown template, JSON, and metadata.
Repair is configurable via RepairConfig with MaxAttempts, SessionAction, ShouldRepair, BuildPrompt, OverrideRequest.
Failure paths handle: context cancellation/timeout during validation, repair exhaustion, permission errors,
unsupported same-session repair with optional fresh-session fallback.
Inputs: RunRequest, ValidationSpec (expectations + validators + repair config).
Outputs: RunResult with ValidationMetadata and RepairMetadata populated.
Event emissions for lifecycle transitions (validating, repairing) and structured validation/repair events.
```

---

## 2. Architecture Fit Review

### Main question
Did the change fit the existing architecture, or did it distort it?

Check:
- [x] The change belongs in the files/modules it touched.
- [x] The current workflow still reads cleanly.
- [x] No feature was jammed into an unsuitable abstraction.
- [x] No large refactor was avoided when the design clearly needed one.
- [x] No large refactor was performed without real need.

Decision:
```text
[x] Good fit
[ ] Acceptable fit with minor issues
[ ] Works but architecture is bending
[ ] Refactor required before merge
```

Review notes:
```text
ValidatingRuntime is a clean decorator around Runtime, following the wrapper/decorator pattern.
It implements the same Runtime interface, making it composable with PolicyRunner and other wrappers.
ValidationSpec is embedded in RunRequest, keeping validation configuration close to the request.
ValidationResult, ValidationCheck, ValidationFailure are separate from core types, correctly placed in validation.go.
RepairContext and RepairConfig are well-separated concepts.
No distortion of existing abstractions; the wrapper adds validation without modifying the wrapped Runtime contract.
```

---

## 3. Simplicity and Earned Complexity Review

### Main question
Did the implementation add only the complexity required by the feature?

Check:
- [x] No speculative abstractions.
- [x] No unnecessary interfaces/protocols/base classes.
- [x] No plugin/factory/registry unless justified.
- [x] No generic engine for a single concrete use case.
- [x] No framework ceremony added without need.
- [x] The simplest honest design was chosen.

Complexity verdict:
```text
[x] Simpler than before
[ ] Same complexity
[ ] More complex, justified
[ ] More complex, not justified
```

Review notes:
```text
Validator interface is minimal: one method Validate(context.Context, ValidationContext) ValidationCheck.
ValidatorFunc adapter allows plain functions to satisfy Validator without extra types.
No factory or registry for validators — callers pass slices directly.
RepairConfig uses plain function fields (ShouldRepair, BuildPrompt, OverrideRequest) rather than interfaces.
The built-in expectation kinds are handled via a simple switch statement, not a registry.
Repair loop is a straightforward for loop with clear exit conditions.
Overall complexity is appropriate for the feature scope.
```

---

## 4. Cohesion Review

### Main question
Are responsibilities grouped around real concepts and reasons to change?

Check:
- [x] Related rules are kept together.
- [x] Unrelated behaviours are not forced into one unit.
- [x] Functions/classes/modules have clear names and purposes.
- [x] No god object/service/module was expanded.
- [x] No excessive micro-fragmentation was introduced.

Cohesion issues:
```text
- validationRun.execute() handles the main loop, but also builds repair requests and manages history.
  The repair-specific logic (runRepair, repairRequest, defaultRepairPrompt) could be extracted.
- validationRun.sendEvent() handles event emission including payload cloning and ID generation,
  which is somewhat removed from the core validation/repair concern.
- Two helper summary functions: repairSummary() and the inline summary building in runRepair()
  are partially duplicated.
```

Recommended improvement:
```text
Extract a repairRunner helper type to encapsulate repair-specific state and methods:
  type repairRunner struct { spec RepairConfig; ... }
This would separate repair orchestration from validation orchestration within validationRun.
The two repair summary builders could be unified.
```

---

## 5. Coupling Review

### Main question
Did the change introduce unhealthy dependencies?

Check:
```text
Global coupling:
- [x] No new mutable global state. (validationRunCounter is atomic and benign)
- [x] Runtime configuration/state is passed explicitly where needed.

Content coupling:
- [x] No external code reaches into internals/private fields.
- [x] Public methods/interfaces are used appropriately. (Runtime interface, Run, Validator)

Stamp coupling:
- [x] Functions do not accept large objects when only small values are needed.
- [x] Parameter objects are cohesive and purposeful. (ValidationContext, RepairContext, ValidationSpec)

Dependency coupling:
- [x] External dependencies are injected or isolated at boundaries.
- [x] Core logic is not tightly coupled to infrastructure.
```

Coupling verdict:
```text
[x] Coupling reduced
[ ] Coupling acceptable
[ ] Coupling increased but justified
[ ] Coupling increased and should be fixed
```

Review notes:
```text
ValidatingRuntime depends only on the Runtime interface and core types (RunRequest, RunResult).
ValidationContext uses RunRequest and RunResult which are from runtime.go — appropriate.
No external package dependencies beyond stdlib.
Event cloning in sendEvent() is defensive but correct for safety when forwarding events.
```

---

## 6. DRY and Duplication Review

### Main question
Did the change duplicate knowledge or create a bad abstraction to avoid duplication?

Check:
- [x] Business rules are not duplicated.
- [x] Security/authorization rules are not duplicated.
- [x] Validation rules are not duplicated inconsistently.
- [x] Similar code shape was not abstracted prematurely.
- [x] Shared abstractions do not contain caller-specific branches.
- [x] No new boolean flags were added to preserve a bad abstraction.

Duplication verdict:
```text
[x] No concerning duplication
[ ] Duplication exists but is only code shape and acceptable
[ ] Business knowledge duplication must be fixed
[ ] Bad abstraction must be split
```

Review notes:
```text
The two repair summary builders (runRepair inline and repairSummary) have similar shape but
acceptable — one is a method on validationRun with access to spec, the other is a pure function.
No validation logic is duplicated; each expectation kind has one validation function.
The normalizeCheck function applies defaults uniformly, not duplicating validation logic.
Repair hint formatting appears once in defaultRepairPrompt.
```

---

## 7. State and Side Effects Review

### Main question
Are state changes and side effects explicit, controlled, and testable?

Check:
- [x] Durable state changes are clear.
- [x] Derived state is not treated as authoritative unless justified.
- [x] Ephemeral state does not leak into global/shared state.
- [x] Mutating operations are named clearly.
- [x] Queries do not unexpectedly mutate state.
- [x] Side effects are at boundaries where practical.

State verdict:
```text
[x] Clear and safe
[ ] Minor concerns
[ ] Hidden mutation risk
[ ] Needs redesign
```

Review notes:
```text
validationRun holds mutable state (result, current run, history) protected by mutex — appropriate.
The execute() goroutine drives all state changes; callers interact only via Events() and Wait().
withValidationMetadata() creates new metadata rather than mutating input — safe.
Event forwarding is the primary side effect, done via buffered channel (64 deep) with non-blocking send.
No mutation of RunRequest after creation (repaired request built via repairRequest()).
No shared mutable state across concurrent runs; validationRunCounter is atomic and read-only.
```

---

## 8. Function/Class/Paradigm Review

### Main question
Does the chosen coding style fit the problem?

Check:
- [x] Functions are used where behaviour is stateless/simple.
- [x] Classes are justified by state, invariants, lifecycle, or polymorphism.
- [x] Inheritance is shallow and honest if used.
- [x] Composition is used where behaviour varies independently.
- [x] Functional pipelines improve readability rather than obscure it.
- [x] Framework conventions are followed without hiding domain behaviour.

Paradigm verdict:
```text
[x] Good fit
[ ] Acceptable
[ ] Over-object-oriented
[ ] Over-functional/too dense
[ ] Over-procedural/no useful boundaries
[ ] Framework-driven rather than domain-driven
```

Review notes:
```text
ValidatingRuntime is a struct wrapping an interface — simple composition.
validationRun is a class-like type with private state and methods, appropriate for the
complex state machine it manages (validating, repairing, completing).
Pure validation functions (validatePath, validateArtifact, etc.) are package-level functions,
appropriate for stateless operations.
The decorator/wrapper pattern is applied correctly: ValidatingRuntime wraps Runtime and
implements the same interface.
```

---

## 9. Error Handling Review

### Main question
Are failures explicit, useful, and recoverable where appropriate?

Check:
- [x] Expected failures have specific handling.
- [x] Unexpected failures are surfaced clearly.
- [x] Error names/messages are actionable.
- [x] Errors are not swallowed silently.
- [x] Retry behaviour is safe and deliberate.
- [x] Partial progress is handled.
- [x] AI/model/tool failures are validated and typed where relevant.

Error handling verdict:
```text
[x] Strong
[ ] Acceptable
[ ] Too generic
[ ] Unsafe / incomplete
```

Review notes:
```text
SDKError categories cover validation (ErrorValidation) and repair exhaustion (ErrorRepairExhausted).
contextValidationError() converts context cancellation/timeout to typed SDKErrors.
firstSDKError() prefers the primary error from RunResult over secondary wait errors.
Repair errors propagate correctly; permission errors set PermissionDenied in metadata.
Validation failures are aggregated with FailedCount and specific ValidationFailure entries.
ErrorRepairExhausted with metadata about max_attempts when repair is exhausted.
Unsupported same-session repair is handled explicitly with specific error category.
```

---

## 10. Observability Review

### Main question
Can we understand this feature in real execution?

Check:
- [x] Important workflow start/completion/failure is observable.
- [x] Logs/events/metrics include correlation identifiers.
- [x] Dependency calls are traceable where relevant.
- [x] Duration/performance can be inspected.
- [x] Errors include useful type/context.
- [x] Sensitive data is not logged.
- [x] AI-specific context is versioned/traced where relevant.

Observability verdict:
```text
[x] Strong
[ ] Acceptable
[ ] Missing useful signals
[ ] Unsafe logging risk
```

Review notes:
```text
Lifecycle events emitted: StatusValidating, StatusRepairing transitions with reason strings.
Structured events: validation.started, validation.completed (with passed/failed counts),
repair.started, repair.completed, repair.failed (with attempt number and error category).
Event IDs include sequence numbers for ordering.
Inner RunID preserved in payload under "inner_run_id" for tracing.
ValidationHistory and RepairAttempts captured in result metadata.
StartedAt/FinishedAt recorded for each repair attempt; Duration computed.
ParentRunID set on result metadata.
No prompt content or sensitive data in events/metadata.
```

---

## 11. Testing Review

### Main question
Do the tests protect the behaviour and reflect the architecture?

Check:
- [x] Pure logic has focused unit tests.
- [x] Workflow/use-case behaviour is tested.
- [x] External adapters are tested at the right level.
- [x] Failure paths are tested.
- [x] Regression cases are covered.
- [x] Tests do not require unnecessary real infrastructure.
- [x] Tests are not over-mocked to the point of meaninglessness.

Testing verdict:
```text
[x] Strong
[ ] Acceptable
[ ] Missing important cases
[ ] Tests reveal architecture problems
```

Review notes:
```text
TestValidateRunBuiltIns tests all 6 expectation kinds in one test.
TestValidateRunReportsMarkdownAndJSONFailures tests failure aggregation and detail preservation.
TestValidateRunCallerDefinedValidator tests the Validator interface.
TestValidatingRuntimeFailsSuccessfulRuntimeOnMissingOutput tests basic validation failure.
TestValidatingRuntimeRepairsThenSucceeds tests repair loop success after one attempt.
TestValidatingRuntimeRepairExhaustion tests max attempts and exhaustion error.
TestValidatingRuntimePermissionDeniedDuringRepair tests error propagation with metadata.
TestValidatingRuntimeCancellationDuringValidation tests context cancellation.
TestValidatingRuntimeUnsupportedSameSessionRepair tests unsupported session handling.
TestValidatingRuntimeFreshSessionFallbackAfterUnsupportedSameSessionRepair tests fallback behavior.
TestValidatingRuntimeCancellationDuringRepair tests cancellation during repair.
TestPolicyContextReceivesValidationResult tests integration with PolicyRunner.
validationScriptRuntime is a proper test double — no real infrastructure.
```

---

## 12. Performance Review

### Main question
Are performance choices appropriate for the known constraints?

Check:
- [x] No premature optimization harmed clarity.
- [x] Known scale/latency constraints were considered.
- [x] Expensive operations are not repeated unnecessarily.
- [x] Data loading is not accidentally excessive.
- [x] Concurrency/race risks are considered where relevant.
- [x] Measurement exists or planned if needed.

Performance verdict:
```text
[x] Fine
[ ] Needs measurement
[ ] Likely bottleneck
[ ] Over-optimized prematurely
```

Review notes:
```text
Events channel buffered (64) to prevent backpressure on inner runtime.
Event forwarding uses non-blocking send with select/default — won't stall inner runtime.
history and repairSummaries are accumulated via append which is efficient for small lists.
No caching or memoization that could cause stale data issues.
Mutex contention minimized: lock only for current Run reference and result update.
No repeated expensive operations in validation loops.
Atomic counter for validationRunCounter (module-level) is appropriate.
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
- Two repair summary builders (inline in runRepair and repairSummary function) could drift apart.
- No maximum bound on history/repairSummaries slices; very long repair loops could accumulate memory.
- The validationRun.execute() method is long (60 lines) and handles multiple phases; extracting
  repair orchestration could improve readability.
```

### Required changes before merge
```text
None identified.
```

### Optional improvements later
```text
- Extract repairRunner helper to encapsulate repair-specific state and separate concerns.
- Consider unifying the two repairSummary code paths.
- Consider a cap on history/repairSummaries length for extremely long repair loops.
- Could extract a validationPhase or repairPhase helper type to reduce execute() complexity.
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
Clean decorator pattern implementation with appropriate complexity. Validation and repair
concerns are well-separated from core runtime. Strong observability with lifecycle and
structured events. Comprehensive test coverage including failure paths and integration.
No architectural distortions or unhealthy coupling introduced.

Highest priority fix:
None required. Optional: consider extracting repairRunner to reduce execute() method length.
```