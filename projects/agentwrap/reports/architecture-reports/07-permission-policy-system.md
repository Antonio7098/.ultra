# Architecture Review: Permission Policy System

**Reviewed area:** `permissions.go` + `opencode/permissions.go` adapter layer
**Package:** agentwrap
**Review date:** 2026-05-21

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
The system has two layers:

**SDK layer (`permissions.go`):**
- `PermissionPolicy` carries caller intent at run initialization
- `PermissionTool` enum maps runtime-neutral tool classes (read, edit, shell, glob, search, etc.)
- `PermissionAction` enum: allow / deny / ask / default
- `PermissionPathRule` for future path-level rules (not yet enforced)
- `ValidatePermissionPolicy()` validates config before use
- `Summary()` produces a redaction-safe `PermissionPolicySummary` with a deterministic `StableID()` based on SHA-256 of the policy content
- Metadata redaction via `RedactStringMap()` is applied in `Summary()` so sensitive values never leak into run metadata

**Adapter layer (`opencode/permissions.go`):**
- `translatePermissions()` converts SDK `PermissionPolicy` → OpenCode native permission config
- `opencodePermissionTools` static map bridges SDK `PermissionTool` → OpenCode native tool name strings
- Unsupported tool mappings are classified as `unsupported` or `best_effort` per `UnsupportedBehavior`
- Path rules are noted as unsupported in subprocess mode (classified, not silently ignored)
- Audit records are accumulated in `PermissionMetadata.Audit` for observable run metadata
- `mergeEnv()` handles JSON merging of permission config into `OPENCODE_CONFIG_CONTENT` env var

The workflow is clear and the implementation is focused.

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
```
[x] Good fit
```

### Review notes
The SDK layer (`permissions.go`) correctly lives in the core `agentwrap` package as a runtime-neutral abstraction. The adapter layer (`opencode/permissions.go`) lives in the `opencode` sub-package where it belongs, translating neutral SDK concepts to OpenCode-native config.

`PermissionMetadata` is embedded in `RunMetadata` (via `metadata.go:28`) and `PermissionPolicySummary` (via `permissions.go:109`) is the safe-to-expose subset — this follows the established pattern of separating authoritative runtime state from caller-safe summaries used in observability/metadata contexts.

The `opencodePermissionTools` map in the adapter is a simple, honest translation table with no over-engineering.

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
```
[x] Same complexity
```

### Review notes
The design is appropriately simple:
- Plain struct types for `PermissionPolicy`, `PermissionAction`, `PermissionTool`, `PermissionEnforcement`, etc. No unnecessary interfaces.
- A static map (`opencodePermissionTools`) rather than a registry pattern.
- `PermissionEnforcement` enum has exactly four values: native, sdk_managed, best_effort, unsupported — these are dictated by real adapter capability possibilities, not speculative.
- `PermissionUnsupportedBehavior` has exactly two values (fail / best_effort) — appropriate for the one place it's needed.

No abstractions have been added that the feature did not demand.

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
- None. The SDK permission types live in `permissions.go`, the adapter translation lives in `opencode/permissions.go`, and `PermissionMetadata` is correctly embedded in `RunMetadata` in `metadata.go`.

### Recommended improvement
No structural changes needed. The cohesion is good.

---

## 5. Coupling Review

### Main question
Did the change introduce unhealthy dependencies?

### Checks
```
Global coupling:
- [x] No new mutable global state.

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
```
[x] Coupling acceptable
```

### Review notes
`translatePermissions()` accepts an `agentwrap.RunRequest` (a large struct) but this is necessary — the adapter needs access to `PermissionPolicy`, `Permissions`, and other fields from the request. The function only reads; it does not mutate the request.

`opencodePermissionTools` is a package-level map in `opencode/permissions.go`. This is acceptable — it is an immutable translation table, not mutable state.

The adapter layer correctly imports `agentwrap` and does not pull in unrelated packages.

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
```
[x] No concerning duplication
```

### Review notes
The `opencodePermissionTools` map does not duplicate any knowledge — it is the one-to-one bridge between SDK tool names and OpenCode native tool names. No other code has this mapping.

`ValidatePermissionPolicy()` and `validatePermissionAction()` are the single source of validation truth. No duplication.

`RedactStringMap()` is a shared utility also used elsewhere in the codebase (confirmed by grep hits on `validation.go` and `metadata.go`). This is proper reuse, not duplication.

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
```
[x] Clear and safe
```

### Review notes
`PermissionPolicy` is an immutable value object once constructed (no mutation methods). `Summary()` produces a new `PermissionPolicySummary` without modifying the original — correct.

The adapter's `translatePermissions()` is a pure function: it reads `RunRequest` and returns `permissionTranslation` + `agentwrap.SDKError`. No side effects.

`mergeEnv()` does mutate a local `existing` map but the side effect is contained within the function and does not escape. The function's output is the modified env slice — this is acceptable.

No shared mutable state is introduced.

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
```
[x] Good fit
```

### Review notes
Go idiom is followed throughout:
- Plain structs for data types (`PermissionPolicy`, `PermissionAudit`, `PermissionFeatureSupport`, `PermissionPathRule`)
- Value receiver methods where mutation is not needed (`Summary()`, `StableID()`, `ValidatePermissionPolicy()`)
- One interface at the adapter boundary (`ResiliencePolicy` — but this is in `policy.go`, not `permissions.go`; the permissions code has no interfaces)
- No inheritance
- Composition of policy structures (`BasicPolicy` containing `BackoffPolicy` interface) is appropriate for the resilience domain

The permissions code is structurally simple and correctly avoids unnecessary OOP ceremony.

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
```
[x] Strong
```

### Review notes
`ValidatePermissionPolicy()` returns `*SDKError` with `ErrorConfiguration` category for all invalid inputs. Errors are specific:
- "permission tool cannot be empty"
- "permission action for {tool} must be default, allow, deny, or ask"
- "permission path rule cannot have an empty path"
- "unsupported permission fallback behavior {value}"

The adapter layer uses `unsupportedPermissionError()` which wraps `UnsupportedPermissionError` (from `UnsupportedFeatureSupport`) into `SDKError` with `ErrorConfiguration` category.

`translatePermissions()` returns early on unsupported tools/features if `UnsupportedBehavior` is not `best_effort` — this is deliberate, preventing silent policy misconfiguration from reaching a runtime.

`mergeEnv()` returns errors for malformed JSON in existing `OPENCODE_CONFIG_CONTENT` — handled.

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
```
[x] Acceptable
```

### Review notes
Observable signals present:
- `PermissionAudit` records are accumulated in `metadata.Audit` with source, tool, action, enforcement, and reason
- `PermissionFeatureSupport` records track which features are native vs. unsupported
- `PermissionPolicySummary.StableID()` provides a deterministic correlation ID for the policy
- `PermissionPolicySummary` is embedded in `PermissionMetadata` → `RunMetadata` → `RunResult.Metadata` so the effective policy is always traceable from the result

Gaps:
- No dedicated `EventKind` for permission policy initialization (unlike `EventRetry`, `EventFallback` for policy decisions). However, permission policy is set at startup, not mid-run, so this is minor.
- No span/trace context propagation in the permission translation step (though this is a lower-priority concern for the permissions subsystem specifically).

The metadata redaction in `Summary()` is a strong safety feature for observability — it ensures that even if permission policy metadata contains secrets (e.g. `"api_key": "secret"`), they will not appear in run metadata outputs.

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
```
[x] Acceptable
```

### Review notes
**Unit tests in `permissions_test.go`:**
- `TestValidatePermissionPolicyRejectsInvalidAction`: validates that invalid `PermissionAction` values are rejected — covers a failure path
- `TestPermissionPolicySummaryRedactsMetadata`: validates that `Summary()` redacts sensitive metadata (e.g. `api_key`) — covers the redaction safety invariant

**Integration test coverage in `opencode/integration_test.go`:**
- `PermissionPolicy` with tool-level allow/deny is tested against the OpenCode runtime adapter
- Path rules with `PermissionActionDeny` are tested
- Policy with `PermissionActionAsk` is tested

**Policy tests in `policy_test.go`:**
- `PolicyRunner` tests cover retry, fallback, cancellation — these are the consumers of permission policy through `RunRequest.PermissionPolicy` (which flows through `overlayRunRequest()`)

Gaps:
- No explicit test for `PermissionPolicySummary.StableID()` deterministic uniqueness
- No test for empty/invalid tool name in `ValidatePermissionPolicy`
- No test for `PermissionPathRule` with invalid path (empty string is tested, but non-empty path with invalid action would be covered by the action validation)
- No test for `UnsupportedBehavior` rejection in `ValidatePermissionPolicy` — currently `UnsupportedBehavior` is not validated by `ValidatePermissionPolicy`

These are minor but worth noting.

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
```
[x] Fine
```

### Review notes
`StableID()` computes a SHA-256 hash once per `Summary()` call — this is appropriate. No caching is needed since `Summary()` is called once per run initialization.

`opencodePermissionTools` is a static map lookup (O(n) where n=16, the number of known tools) — trivially fast.

No expensive operations are repeated. The translation in `translatePermissions()` is O(num_tools + num_path_rules) which is bounded and small.

Concurrency: `policyRun` uses a mutex to guard `current`, `result`, `waitErr`, `droppedEvents`, and `decisions` — this is correct. The event channel has a buffer of 64 and dropped events are tracked when the channel is full — this is a deliberate backpressure handling strategy, not a performance bug.

---

## 13. Maintainability Verdict

### Would the next related feature be easier or harder after this change?

```
[x] About the same
```

### Main risks left behind
- `PermissionMode` (runtime.go:43) and `PermissionPolicy` both exist as permission-related concepts on `RunRequest`. `PermissionMode` is described as an "open placeholder for future permission policies." If both are set simultaneously, there is no explicit conflict error — the relationship is resolved by the adapter. This is acceptable for now but should be documented as the permission model evolves.
- `PermissionPathRule` is marked as "reserved for future" in comments. Path rules are already validated and the adapter classifies them as unsupported in subprocess mode. If a future adapter cannot enforce path rules, this should be surfaced as a `PermissionFeatureSupport` gap rather than silently best-efforted.

### Required changes before merge
- None. `ValidatePermissionPolicy()` correctly validates `UnsupportedBehavior` with a proper default case that returns an error for invalid values (permissions.go:167-172).

### Optional improvements later
- Add a dedicated `EventKind` for permission policy initialization if mid-run permission decisions become observable in future.
- Add test for `StableID()` uniqueness and determinism.

---

## 14. Final Review Decision

```
Decision:
[x] Approve with comments

Reason:
The Permission Policy System is well-architected with correct SDK/adapter separation, appropriate typing, strong observability metadata, and proper validation. One minor observation: the `PermissionMetadata.Mode` field (of type `PermissionMode`) is populated from `req.Permissions` in `translatePermissions()` but `PermissionMode` is noted as an "open placeholder for future permission policies" in `runtime.go:43` — if `PermissionMode` and `PermissionPolicy` are both set, the relationship between them is implicit rather than validated. This is acceptable given current usage but worth documenting as the two concepts evolve.

Highest priority fix:
None required — the implementation is sound.
```

---

## Summary

The Permission Policy System is well-structured and correctly split across SDK and adapter layers. The runtime-neutral abstraction in `permissions.go` is clean, the OpenCode adapter in `opencode/permissions.go` is a straightforward translation layer, and the observability metadata (audit records, support tracking, summary with redaction) is appropriately designed. No required changes. Optional improvements are noted in section 13.