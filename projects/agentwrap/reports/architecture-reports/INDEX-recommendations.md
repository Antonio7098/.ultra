# Architecture Recommendations Index

Compiled from 7 architectural review reports across the agentwrap codebase.

---

## Tier 1 — Actionable Now or Soon

Items that have a clear path to resolution and should be addressed within the current or next sprint.

### 1.8 Add ValidateRunRequest(RunRequest) SDK-Level Function (Core Domain)
**Priority: Low-Medium**
**Report:** `01-core-domain-runtime-contract.md`

`ValidateEffectiveConfig` must be called explicitly by callers, but there is no SDK-level centralized pre-flight validation for RunRequest. Callers who forget validation get runtime errors instead of clear validation failures.

**Recommended action:** Add a `ValidateRunRequest(RunRequest) error` function at the SDK level to centralize pre-flight validation. Related to item 1.4.

### 1.1 String-Based Event Classification in projector.go (OpenCode Adapter)
**Priority: Medium-High**
**Report:** `05-opencode-adapter.md`

The `projectNative.classify()` method uses `strings.Contains` for event classification, which is brittle if OpenCode introduces new event types with names that collide with existing keyword matches.

**Recommended action:** Replace string containment checks with an explicit event type mapping table (struct-based dispatch).

---

### 1.2 Duplicate process Signal Implementation (OpenCode Adapter)
**Priority: Medium**
**Report:** `05-opencode-adapter.md`

`process_windows.go` and `process_other.go` are identical (both just call `proc.Kill()`). This is duplication that could become a maintenance hazard.

**Recommended action:** Merge into a single file with a broader build tag (e.g., `//go:build !unix`).

---

### 1.3 LifecycleEvent/SessionEvent Ignore RuntimeContext (Observability)
**Priority: Medium**
**Report:** `04-observability-event-infrastructure.md`

The `_ = ctx` pattern in `LifecycleEvent()` and `SessionEvent()` discards the RuntimeContext parameter. If future features need runtime-kind-specific context checks, this is a latent design gap.

**Recommended action:** Evaluate whether the parameter should be used or removed entirely. If it must stay for API compatibility, document the intended use.

---

### 1.4 Config Validation Is Convention, Not Enforcement (Config/Health)
**Priority: Medium**
**Report:** `06-configuration-health-management.md`

`ValidateEffectiveConfig` must be called explicitly by callers before `StartRun`. Nothing enforces this. Callers who forget it will get a runtime error instead of a clear validation failure.

**Recommended action:** Document the convention in `doc.go` or a `CONTRACT.md` file. Consider adding a `ValidateRunRequest(RunRequest)` function at the SDK level to centralize pre-flight validation.

---

### 1.5 EffectiveConfig.Secrets Not Deduplicated (Config/Health)
**Priority: Low-Medium**
**Report:** `06-configuration-health-management.md`

Secrets are appended with source tracking, not deduplicated by name. Callers expecting a unique secret map may be surprised.

**Recommended action:** Document the append behaviour explicitly. Decide whether deduplication is intentional for audit purposes or if it should be changed.

---

### 1.6 Rate-Limit Text Classification Hardcoded Strings (OpenCode Adapter)
**Priority: Low-Medium**
**Report:** `05-opencode-adapter.md`

`rate_limit.go` has many hardcoded string patterns for classifying rate-limit errors from text, headers, and structured data. These may need updating as OpenCode error messages change.

**Recommended action:** Consider a more structured classification table or regex-based pattern matching that can be updated without code changes.

---

### 1.7 Session Continuation Best-Effort Silent Failures (OpenCode Adapter)
**Priority: Low-Medium**
**Report:** `05-opencode-adapter.md`

Session support is explicitly "best-effort" (runtime.go:668). When session continuation fails silently, there is no indication to the caller that the session was not continued.

**Recommended action:** Consider surfacing a `SessionNotContinued` warning or error when session continuation fails, so callers are aware the session may not be resumable.

---

## Tier 2 — Watch With Threshold Triggers

Justified now but need monitoring. Each item has a specific growth threshold or condition that, when crossed, should trigger action.

### 2.1 BasicPolicy Field Count Approaching Limit (Resilience Policy)
**Priority: Medium**
**Report:** `02-resilience-policy-engine.md`

BasicPolicy has 7 configuration fields. If fields exceed ~10, the struct becomes harder to maintain and a builder or structured config should be considered.

**Trigger for action:** Adding 3+ more fields to BasicPolicy.

---

### 2.2 policy.go execute() Loop Complexity (Resilience Policy)
**Priority: Medium**
**Report:** `02-resilience-policy-engine.md`

The `execute()` loop (98 lines) handles loop control, attempt management, and decision dispatch. Future additions (circuit breaker, retry budget per error category) could make it harder to follow.

**Trigger for action:** Adding any new retry strategy, circuit breaker logic, or budget tracking to PolicyRunner.

---

### 2.3 PolicyContext Copy Cost at Scale (Resilience Policy)
**Priority: Low**
**Report:** `02-resilience-policy-engine.md`

PolicyContext is passed by value (copy). If `PriorAttempts` grows large (e.g., very long retry loops), copying could become expensive.

**Trigger for action:** PriorAttempts slice consistently exceeding ~20 entries in production workloads.

---

### 2.4 policy.go Cohesion / Future Subdirectory Split (Resilience Policy)
**Priority: Low**
**Report:** `02-resilience-policy-engine.md`

policy.go is a 964-line file mixing three conceptual areas (types/interfaces, concrete implementations, execution engine). The current colocation is defensible for a single-file domain of this size, but further growth may warrant extraction into a `policy/` subdirectory.

**Trigger for action:** Any new policy-related types or implementations being added that would make the file harder to navigate.

---

### 2.5 config.go Approaching Upper Size Limit (Config/Health)
**Priority: Low-Medium**
**Report:** `06-configuration-health-management.md`

Config.go mixes type definitions with merge/validation behaviour. Cohesive as a "configuration domain" but approaching the practical limit for a single file.

**Trigger for action:** Any new config-related functions or types (e.g., file loading, env parsing) should trigger extraction to a `config/` subpackage.

---

### 2.6 validation.go execute() Method Length (Output Validation)
**Priority: Low**
**Report:** `03-output-validation-repair.md`

`execute()` is long and mixes repair-specific state handling. Two slightly different repairSummary code paths exist.

**Trigger for action:** Adding any new repair strategy or expectation type.

---

### 2.7 Event.Kind() Edge Cases Untested (Core Domain)
**Priority: Low**
**Report:** `01-core-domain-runtime-contract.md`

Edge cases for `Event.Kind()` — nil Payload, string type, missing `event_kind` key — lack unit tests. `Capabilities.Supports()` is also untested.

**Trigger for action:** Adding any new EventKind or Capability type.

---

### 2.8 RawPayload.Safe Trust Boundary Undocumented (Core Domain)
**Priority: Low**
**Report:** `01-core-domain-runtime-contract.md`

The `RawPayload.Safe` field is a trust boundary: callers must know whether the payload has been scrubbed. No documentation exists on what makes a payload "safe."

**Trigger for action:** Any new RawPayload usage in wrapper layers (PolicyRunner, ValidatingRuntime, ObservingRuntime).

---

### 2.9 Unbounded history/repairSummaries Memory Risk (Output Validation)
**Priority: Low-Medium**
**Report:** `03-output-validation-repair.md`

No maximum bound on history/repairSummaries slices. Very long repair loops could accumulate memory.

**Trigger for action:** Extremely long repair loops in production.

---

### 2.10 sendEvent() Cohesion Concern (Output Validation)
**Priority: Very Low**
**Report:** `03-output-validation-repair.md`

`sendEvent()` handles event emission including payload cloning and ID generation, which is somewhat removed from the core validation/repair concern.

**Trigger for action:** Adding new event types or payload handling logic.

---

### 2.11 Injectable Now Clock-Skew Risk (Observability)
**Priority: Low**
**Report:** `04-observability-event-infrastructure.md`

`ObservingRuntime.Now` is injectable for testing and clock replacement. However, if a caller returns `time.Now()` repeatedly within the same `observedRun` lifecycle, `ObservedAt` timestamps may become non-monotonic. No production guidance on safe usage is documented.

**Trigger for action:** Any production deployment using a custom `Now` function that doesn't guarantee monotonic advancement within a run.

---

### 2.12 ConfigSource Enum Is Closed (Config/Health)
**Priority: Low**
**Report:** `06-configuration-health-management.md`

ConfigSource enum has 6 values (default, adapter_option, environment, config_provider, caller_request, runtime_discovered). Future new sources (e.g., "file" or "config_server") require adding a new enum value and updating merge logic.

**Trigger for action:** Any need to add a new configuration source.

---

### 2.13 HealthCheckID Enum Is Closed (Config/Health)
**Priority: Low**
**Report:** `06-configuration-health-management.md`

HealthCheckID enum has 8 values (runtime, structured_output, workdir, config, provider, model, auth, paths). New health checks require a new enum value and adapter implementation. SDK version bump needed for new checks.

**Trigger for action:** Any need to add a new health check.

---

### 2.14 RuntimeContext Field Addition Is Cross-Cutting (Config/Health)
**Priority: Low**
**Report:** `06-configuration-health-management.md`

RuntimeContext is referenced in HealthCheckRequest, HealthReport, AttemptSummary, and PolicyDecisionRecord. Adding a new field requires updating all these references.

**Trigger for action:** Any need to add a field to RuntimeContext.

---

## Tier 3 — Future Considerations

Justified now with no immediate action needed. These represent natural extension points or evolutions of the system.

### 3.0 PermissionMetadata.Mode Field Populated from Wrong Source (Permissions) ⚠️ NEW
**Priority: Very Low**
**Report:** `07-permission-policy-system.md`

`PermissionMetadata.Mode` (type `PermissionMode`) is populated from `req.Permissions` in `translatePermissions()`. However, `req.Permissions` is of type `Permissions` (not `PermissionPolicy`). `PermissionMode` is documented as an "open placeholder for future permission policies" (runtime.go:43). The risk is that callers may expect `Mode` to reflect the active `PermissionPolicy`, but it actually reflects the legacy `Permissions` field. Worth clarifying intent as the permission model evolves.

**Watch condition:** Any new permission-related feature on `RunRequest`.

---

### 3.1 PermissionMode ↔ PermissionPolicy Relationship (Permissions)
**Priority: Low**
**Report:** `07-permission-policy-system.md`

`PermissionMode` (runtime.go:43) and `PermissionPolicy` both exist on `RunRequest`. If both are set, the relationship is implicit rather than validated.

**Watch condition:** Any new permission-related feature being added to RunRequest.

---

### 3.2 PermissionPathRule Silent Best-Effort (Permissions)
**Priority: Low**
**Report:** `07-permission-policy-system.md`

Path rules are classified as unsupported in subprocess mode. If a future adapter cannot enforce path rules, this surfaces as a `PermissionFeatureSupport` gap rather than an explicit error.

**Watch condition:** Any new runtime adapter being implemented.

---

### 3.3 OpenTelemetry Span Propagation (Observability)
**Priority: Low**
**Report:** `04-observability-event-infrastructure.md`

No OpenTelemetry instrumentation. Useful for trace correlation across wrapper boundaries in production.

**Watch condition:** Any observability/monitoring infrastructure being added to the SDK.

---

### 3.4 Prometheus Metrics Emitter (Observability)
**Priority: Low**
**Report:** `04-observability-event-infrastructure.md`

RunRecord fields are not translated into Prometheus counters/gauges.

**Watch condition:** Any metrics/dashboard requirement being added.

---

### 3.5 Upsert Debounce/Batch for High-Frequency Events (Observability)
**Priority: Low**
**Report:** `04-observability-event-infrastructure.md**

Store writes happen per-event. High-frequency event streams may benefit from batching.

**Watch condition:** Running with runtimes that emit very high event frequencies (e.g., hundreds of events/second).

---

### 3.6 Circuit Breaker / Retry Budget per Error Category (Resilience Policy)
**Priority: Low**
**Report:** `02-resilience-policy-engine.md`

The execute() loop architecture could support circuit breaker behaviour, but nothing exists today.

**Watch condition:** Any new retry strategy or resilience pattern being added to BasicPolicy.

---

### 3.7 ExponentialBackoff Jitter (Resilience Policy)
**Priority: Low**
**Report:** `02-resilience-policy-engine.md`

ExponentialBackoff has no jitter option. Production use with multiple clients could cause thundering herd on rate-limited endpoints.

**Watch condition:** Multiple concurrent agentwrap instances being used in production against shared rate-limited endpoints.

---

### 3.8 PolicyMetadata.MaxAttempts / MaxElapsed Not Exported (Resilience Policy)
**Priority: Low**
**Report:** `02-resilience-policy-engine.md`

BasicPolicy limits exist but aren't exported to the audit record. Dashboard/audit consumption would benefit.

**Watch condition:** Any audit or reporting feature being built on top of RunMetadata.

---

### 3.9 Extract repairRunner Helper (Output Validation)
**Priority: Low**
**Report:** `03-output-validation-repair.md`

Repair-specific state could be encapsulated in a helper to reduce `execute()` complexity.

**Watch condition:** Adding a new repair strategy or expectation type.

---

### 3.10 Config Merge/Validate Extraction (Config/Health)
**Priority: Low**
**Report:** `06-configuration-health-management.md`

Merge and validation logic could be moved to an internal file if config.go grows.

**Watch condition:** Any new config behaviour being added.

---

### 3.11 Dedicated Permission EventKind (Permissions)
**Priority: Very Low**
**Report:** `07-permission-policy-system.md`

Mid-run permission decisions are not observable as a distinct event kind today.

**Watch condition:** Any feature requiring observable permission decisions during a run.

---

### 3.12 StableID() Test for Uniqueness/Determinism (Permissions)
**Priority: Very Low**
**Report:** `07-permission-policy-system.md`

`StableID()` uses SHA-256 but has no dedicated test for uniqueness and determinism.

**Watch condition:** Any change to how policy identity is computed.

---

### 3.13 Clone Utilities Potential Shared Location (Observability)
**Priority: Very Low**
**Report:** `04-observability-event-infrastructure.md`

Clone functions are currently in observability.go but are generally applicable helpers.

**Watch condition:** Any other package needing similar deep-clone functionality.

---

### 3.14 WithCorrelationID ErrorOption (Core Domain)
**Priority: Very Low**
**Report:** `01-core-domain-runtime-contract.md`

No way to attach correlation IDs to errors for distributed tracing.

**Watch condition:** Any distributed tracing requirement being added to the SDK.

---

### 3.15 Document Known Test Gaps (OpenCode Adapter)
**Priority: Very Low**
**Report:** `05-opencode-adapter.md`

Two tests are marked with known behavior gaps (`TestRunCleanExitWithOutputWithoutFinalCompletesWithWarning`, `TestTimeoutWithRecentProviderErrorLogClassifiesRateLimit`).

**Watch condition:** Any change to exit handling or rate-limit classification logic.

---

### 3.16 Structured Event Type Registry (OpenCode Adapter)
**Priority: Very Low**
**Report:** `05-opencode-adapter.md`

The projector uses string containment checks for event classification instead of an explicit event type mapping table.

**Watch condition:** Any change to event classification logic or addition of new OpenCode event types.

---

### 3.17 Structured Logging for Event Classification Decisions (OpenCode Adapter)
**Priority: Very Low**
**Report:** `05-opencode-adapter.md`

No structured logging exists for the event classification decisions in `projector.go`. This makes debugging classification mismatches difficult.

**Watch condition:** Any classification-related bug reports or new event type additions.

---

### 3.18 Config/Health Test Gaps (Config/Health)
**Priority: Very Low**
**Report:** `06-configuration-health-management.md`

Missing test coverage for: MergeEffectiveConfig with empty layers; ValidateEffectiveConfig for all validation cases; OverallHealthStatus for transient_fail, skipped/unsupported orderings; HealthReport construction and population; Metadata struct construction.

**Watch condition:** Any changes to config/health merge, validation, aggregation, or health check logic.

---

## Summary Table

| Tier | Item | Area | Trigger |
|------|------|------|---------|
| 1 | Event classification brittleness | OpenCode Adapter | Any OpenCode event type addition |
| 1 | Duplicate process signal impl | OpenCode Adapter | Any change to process signaling |
| 1 | Rate-limit hardcoded strings | OpenCode Adapter | OpenCode error msg changes |
| 1 | Session best-effort silent fail | OpenCode Adapter | Session continuation usage |
| 1 | RuntimeContext ignored in events | Observability | Any runtime-kind feature |
| 1 | Config validation convention | Config/Health | Any new caller |
| 1 | Secrets not deduplicated | Config/Health | Any caller expecting unique map |
| 1 | ValidateRunRequest() SDK function | Core Domain | Any new caller |
| 2 | BasicPolicy field count | Resilience | +3 fields |
| 2 | policy.go execute() complexity | Resilience | New retry strategy |
| 2 | PolicyContext copy cost | Resilience | PriorAttempts > ~20 |
| 2 | policy.go cohesion/subdir | Resilience | File growth |
| 2 | config.go size | Config/Health | New config functions |
| 2 | execute() method length | Output Validation | New repair strategy |
| 2 | Event.Kind() untested | Core Domain | New EventKind |
| 2 | RawPayload.Safe undocumented | Core Domain | New wrapper usage |
| 2 | Unbounded history memory | Output Validation | Long repair loops |
| 2 | sendEvent() cohesion | Output Validation | New event types |
| 2 | Injectable Now clock-skew | Observability | Custom Now usage |
| 2 | ConfigSource enum is closed | Config/Health | Any new config source |
| 2 | HealthCheckID enum is closed | Config/Health | Any new health check |
| 2 | RuntimeContext cross-cutting | Config/Health | Any RuntimeContext change |
| 3 | PermissionMetadata.Mode source | Permissions | New permission feature |
| 3 | PermissionMode/Policy relationship | Permissions | New permission feature |
| 3 | PathRule best-effort gap | Permissions | New adapter |
| 3 | OpenTelemetry propagation | Observability | Any observability infra |
| 3 | Prometheus metrics | Observability | Any metrics requirement |
| 3 | Event upsert batching | Observability | High-freq event runtime |
| 3 | Circuit breaker | Resilience | New retry pattern |
| 3 | Backoff jitter | Resilience | Multi-instance prod use |
| 3 | PolicyMetadata exports | Resilience | Audit/reporting feature |
| 3 | Extract repairRunner | Output Validation | New repair strategy |
| 3 | Config merge/validate extraction | Config/Health | New config behaviour |
| 3 | Dedicated Permission EventKind | Permissions | Observable permission decisions |
| 3 | StableID() test gaps | Permissions | Policy identity change |
| 3 | Clone utilities shared location | Observability | Other clone need |
| 3 | WithCorrelationID | Core Domain | Distributed tracing |
| 3 | Document known test gaps | OpenCode Adapter | Exit/ratelimit changes |
| 3 | Structured event type registry | OpenCode Adapter | Classification logic changes |
| 3 | Structured logging for classification | OpenCode Adapter | Classification bug reports |
| 3 | Config/Health test gaps | Config/Health | Config/health test changes |