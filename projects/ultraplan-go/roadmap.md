# UltraPlan Go Roadmap

> Project: `ultraplan-go`  
> Scope: production-grade Go CLI for UltraPlan study workflows and governed sprint planning through `plan`.  
> Phase 1 completed the study-side release scope. Phase 2 adds governed project and sprint planning through `plan` only; sprint execution, smoke, review automation, issue tracking, hosted SaaS, browser UI, and multi-user collaboration remain deferred.

## Scope Principle

Phase 1 of the implementation roadmap is **study-side only**:

- workspace/config/health
- study initialization
- source and dimension discovery
- prompt composition
- runtime execution through `agentwrap` + OpenCode
- per-source analysis
- final synthesis
- report validation
- summary generation
- code-reference extraction
- resumable run-loop
- status, logs, diagnostics, cancellation, retry/fallback

Phase 2 introduces the planning side of UltraPlan:

```text
study -> select -> distill -> reason -> plan
```

Phase 2 stops at producing validated sprint planning artifacts. The following remain out of scope until a later requirements revision:

- sprint implementation execution
- smoke investigation runs
- conformance review automation
- issue tracking
- hosted SaaS
- browser UI
- multi-user collaboration

---

# Current Implementation Roadmap

## Phase 0 — Governance and Scope Alignment

### Sprint 0: Roadmap, Scope, and Template Alignment

**Goal:** remove ambiguity before implementation starts.

**Deliverables:**

- Confirm study-side-only release scope.
- Clean up TRD references that still imply current target/sprint implementation.
- Standardize sprint artifact names:

```text
requirements.md
sprint-index.md
technical-handbook.md
reasoning/*.md
reasoning.md
plan.md
review.md
```

**Acceptance:**

- Roadmap is accepted.
- TRD target/sprint references are removed or clearly marked deferred.
- Template names match the canonical artifact chain.
- Contract reviews use the phase gates below rather than applying production-only requirements to skeleton sprints.

## Contract Phase Gates

The system contracts remain authoritative, but each sprint must apply only the portions selected by its sprint index and made relevant by implemented behavior.

### Skeleton / Local CLI Gate

Applies to CLI shell, workspace/config/health skeletons, and study discovery/listing.

Required now:

- explicit package ownership and allowed dependency direction from `docs/ARCHITECTURE.md`
- thin CLI adapters with deterministic stdout/stderr and stable exit statuses
- no swallowed failures
- preserved error cause chains when translating errors
- local filesystem path safety
- config precedence, validation, and redaction where config behavior exists
- deterministic unit/command tests for public behavior and negative paths

Allowed now:

- concrete local filesystem collaborators when the side effect is narrow and testable
- app-level command wiring without a full registrar/container
- numeric CLI exit statuses as the public process contract, paired with internal stable error codes where errors are classified

Not required until later gates:

- full canonical structured error payloads on every CLI failure
- request/trace correlation IDs
- diagnostics and alert surfaces
- runtime ports for provider/process execution
- e2e run-loop tests, migration tests, bounded worker pools, and provider-cost metadata

### Runtime / Provider Gate

Starts when prompt execution, `agentwrap`, OpenCode, retries, or external process supervision enter scope.

Required then:

- `context.Context` through runtime-capable services
- runtime and process-execution ports
- bounded retries with visible ownership and exhaustion state
- correlation metadata in runtime logs/events
- provider/model cost drivers in operational signals
- fake-runtime tests plus gated real-provider smoke coverage

### Batch / Durable Workflow Gate

Starts when `run-all`, `run-loop`, cancellation, resumability, status, or durable state enters scope.

Required then:

- bounded concurrency and cancellation propagation
- durable task state with explicit terminal success/failure/cancelled states
- atomic writes and compatibility or migration behavior for durable formats
- diagnostics for current/recent workflow state
- scenario tests for critical user journeys

### Stable Release Gate

Applies before the first production-ready study-side release.

Required then:

- stable JSON output schemas for documented automation surfaces
- canonical structured error payloads or documented safe CLI subsets
- stable machine-readable error codes for all public operational failures
- release documentation for config compatibility and recovery workflows
- smoke release checklist including offline tests, build, and gated OpenCode smoke path

---

## Phase 1 — CLI Foundation

### Sprint 1: Go Module, CLI Shell, and App Composition

**Goal:** establish a buildable Go CLI with module-driven structure.

**Build:**

- `cmd/ultraplan/main.go`
- `internal/app`
- initial package layout:

```text
internal/platform/config
internal/platform/logging
internal/platform/filesystem
internal/platform/runtime
internal/workspace
internal/study
internal/codeextract
```

- `ultraplan --help`
- `ultraplan version`

**Evidence:**

```bash
go test ./...
go build ./cmd/ultraplan
ultraplan --help
ultraplan version
```

### Sprint 2: Workspace, Config, Logging, and Health Skeleton

**Goal:** make UltraPlan able to find, initialize, inspect, and validate a workspace.

**Build:**

- workspace discovery
- `init-workspace`
- `config show`
- basic `health`
- config precedence skeleton
- secret redaction
- text/JSON output foundation

**Commands:**

```bash
ultraplan init-workspace
ultraplan config show
ultraplan health
```

---

## Phase 2 — Study Model and Initialization

### Sprint 3: Study Domain, Listing, and Resolution

**Goal:** model studies, sources, dimensions, and deterministic listing.

**Build:**

- `Study`
- `Source`
- `Dimension`
- source/dimension lookup
- study discovery
- `study list`
- `study <study> list`

**Commands:**

```bash
ultraplan study list
ultraplan study <study> list
```

### Sprint 4: Study Initialization From YAML

**Goal:** generate a study structure from `study-init.yml`.

**Build:**

- YAML parser
- dimension file generation
- study README generation
- normalized `study-init.yml`
- dry-run
- force behavior
- shallow clone support, if included in this sprint

**Command:**

```bash
ultraplan study init <study-init.yml>
ultraplan study init <study-init.yml> --dry-run
```

### Sprint 5: Markdown Document Sources and Applicability

**Goal:** support top-level Markdown document sources with optional `applicable_dimensions` frontmatter.

**Build:**

- Markdown source discovery
- frontmatter parsing
- frontmatter stripping
- dimension normalization
- applicability filtering
- skipped/inapplicable task behavior

**Core helper:**

```go
GetApplicableSources(sources []Source, dimension Dimension) []Source
```

**Acceptance:**

- Directory sources are always applicable.
- Markdown sources without filters apply to all dimensions.
- Markdown sources with filters only apply to matching normalized dimensions.
- Inapplicable pairs are skipped, not failed.

---

## Phase 3 — Reports, Prompt Composition, and Run State

### Sprint 6: Report Validation and Rating Parsing

**Goal:** reports become validated product artifacts, not just runtime output files.

**Build:**

- per-source report validation
- final report validation
- rating parser
- validation diagnostics
- Markdown-source validation rules that do not require code citations by default

### Sprint 7: Prompt Composition

**Goal:** deterministic prompts for directory analysis, Markdown analysis, and synthesis.

**Build:**

- base prompt loading
- report template loading
- directory source prompt builder
- Markdown document prompt builder
- synthesis prompt builder
- dry-run prompt preview

**Acceptance:**

- Directory prompts require source isolation and file-line citations.
- Markdown prompts embed stripped document content and forbid external code/filesystem exploration.
- Synthesis prompts include selected per-source report manifest.

**Command:**

```bash
ultraplan study <study> prompt analysis <dimension-ref> <source-ref>
ultraplan study <study> prompt synthesis <dimension-ref>
```

### Sprint 8: Run State Persistence and Status

**Goal:** create deterministic durable run-state primitives before executing runtime work.

**Build:**

- versioned `run-state.json`
- deterministic analysis and synthesis task construction
- source/dimension applicability in task construction
- atomic state writes
- strict state loading and validation
- completed-output revalidation on resume
- runtime-free status summaries

**Command:**

```bash
ultraplan study <study> status
```

---

## Phase 4 — Runtime and Prompt Execution

### Sprint 9: Agentwrap/OpenCode Runtime Integration

**Goal:** integrate runtime execution correctly without reimplementing OpenCode supervision.

**Build:**

- `agentwrap` runtime wiring
- `agentwrap/opencode` adapter construction
- runtime health checks
- `ObservingRuntime`
- `ValidatingRuntime`
- `PolicyRunner`
- permission policy mapping
- event/log mapping

**Architecture constraint:**

```text
study -> platform/runtime -> agentwrap/opencode
platform/runtime must not know study semantics
```

### Sprint 10: Single Analysis and Synthesis

**Goal:** run one source/dimension pair and synthesize one dimension.

**Build:**

```bash
ultraplan study <study> run <dimension-ref> <source-ref>
ultraplan study <study> synthesize <dimension-ref>
```

**Acceptance:**

- Runtime success alone is insufficient.
- Expected output must exist.
- Output validation must pass.
- Inapplicable Markdown pairs skip cleanly.

---

## Phase 5 — Batch Execution and Resumability

### Sprint 11: `run-all` Batch Execution

**Goal:** run all applicable analysis tasks with bounded parallelism.

**Build:**

```bash
ultraplan study <study> run-all
```

**Features:**

- filter by source and dimension
- bounded worker pool
- synthesis after applicable reports pass
- summary generation after completion

### Sprint 12: Durable `run-loop`, Retry, and Cancellation

**Goal:** production-grade resumable orchestration.

**Build:**

```bash
ultraplan study <study> run-loop
ultraplan study <study> status
```

**Features:**

- atomic `run-state.json`
- task state machine
- stale running task recovery
- retry/fallback metadata from `agentwrap`
- cancellation handling
- per-study lock file

### Sprint 13: Summary Generation and Code Reference Extraction

**Goal:** make completed study outputs easy to review, compare, and audit.

**Build:**

- deterministic `summary.csv`
- source/dimension score matrix
- missing vs inapplicable distinction
- total score sorting
- missing/ambiguous rating warnings
- source table parser
- citation parser
- reference resolver
- line/range/list extraction
- unresolved reference reporting
- text and JSON output

**Commands:**

```bash
ultraplan study <study> summary
ultraplan code <report>...
```

---

## Phase 6 — Hardening and Release

### Sprint 14: Validation Command, Diagnostics, and JSON Stability

**Goal:** make the CLI inspectable and automatable.

**Build:**

```bash
ultraplan study <study> validate
ultraplan health --json
ultraplan study <study> status --json
```

**Features:**

- stable JSON shapes
- actionable validation failures
- redacted diagnostics
- run metadata summaries

### Sprint 15: Docs, Packaging, and Smoke Release

**Goal:** first production-ready study-side release.

**Build:**

- user docs
- recovery docs
- config docs
- OpenCode smoke instructions
- Linux/macOS builds
- checksums

**Release gate:**

```bash
go test ./...
go build ./cmd/ultraplan
```

plus gated OpenCode smoke tests when environment is available.

---

# Planning Phase 2 — Governed Project and Sprint Planning

Planning Phase 2 implements the planning side of UltraPlan in Go. It ports the proven `.ultra/cli` planning flow into production-grade modules without implementing sprint execution.

The phase workflow is:

```text
study -> select -> distill -> reason -> plan
```

## Planning Scope Principle

Planning behavior belongs to project and sprint modules, not to the study module:

- `study` produces validated research artifacts.
- `project` catalogs governance documents, contracts, evidence, reasoning templates, and review protocols.
- `sprint` creates and validates planning artifacts selected from the project catalog.
- `platform/runtime` remains generic prompt execution infrastructure.

Reusable study-side infrastructure is allowed when it is genuinely generic:

- workspace discovery and path safety
- config loading, precedence, and redaction
- generic runtime prompt execution
- command exit codes and output discipline
- atomic file/JSON writes when used by more than one module

Study semantics are not reusable abstractions for planning. Do not abstract study services, source/dimension models, report validation, rating parsing, summary generation, or run-loop scheduling into shared packages for Planning Phase 2.

## Planning Artifact Chain

Planning Phase 2 supports these sprint artifacts:

```text
requirements.md
sprint-index.md
technical-handbook.md
reasoning/*.md
reasoning.md
plan.md
flow-state.json
```

The following artifacts remain future scope:

```text
.run-state.json
smoke.md
smoke.json
review.md
issues.md
issues.json
```

Existing historical sprint `review.md` files may remain in project history, but Planning Phase 2 does not generate or automate reviews.

## Planning Phase 2 Contract Gate

Required for planning-stage sprints:

- project and sprint packages own planning behavior and validation
- sprint-index selections are validated as a subset of `project-index.md`
- technical handbooks distill only selected evidence
- reasoning artifacts decide from selected contracts, evidence, and handbook content
- plans trace to `reasoning.md`
- generated artifacts are editable Markdown
- flow state is versioned JSON with atomic writes and strict loading
- prompt previews and dry runs are available before runtime execution
- runtime execution, when used for artifact generation, validates expected output before marking a stage complete
- text output is calm and scriptable; JSON output is stable where documented

Not required in Planning Phase 2:

- implementation execution
- smoke investigation execution
- conformance review automation
- local issue tracking
- Git mutation
- multi-stage implementation run loops

### Sprint 16: Project Domain and Project Index

**Goal:** model `.ultra/projects/<project>` as a first-class planning root.

**Build:**

- `internal/project`
- project discovery and resolution
- `docs/` discovery
- `roadmap.md` and `project-index.md` validation
- catalog parsing for contracts, evidence reports, reasoning templates, and review protocols
- `ultraplan project list`
- `ultraplan project <project> status`

**Acceptance:**

- Project commands do not depend on study internals.
- Project index remains a catalog, not a sprint plan.
- Catalog references resolve or fail with actionable diagnostics.

### Sprint 17: Sprint Artifact Domain and Flow State

**Goal:** model planning-stage sprint artifacts and durable stage state.

**Build:**

- `internal/sprint`
- sprint discovery and resolution
- stage model through `plan`:

```text
requirements
sprint-index
technical-handbook
area-reasoning
reasoning
plan
```

- versioned `flow-state.json`
- atomic flow-state writes
- strict flow-state loading
- `ultraplan sprint <project> <sprint> status`

**Acceptance:**

- Existing artifacts can be inspected and reflected in flow state.
- Missing, ready, complete, failed, and skipped states are explicit.
- No implementation, smoke, review, or issue stages are modeled.

### Sprint 18: Select Stage

**Goal:** create and validate `sprint-index.md` as the authoritative context selection.

**Build:**

- `ultraplan sprint <project> <sprint> validate sprint-index`
- `ultraplan sprint <project> <sprint> prompt sprint-index`
- `ultraplan sprint <project> <sprint> flow --to sprint-index`
- subset validation against `project-index.md`
- selected contracts, evidence reports, reasoning templates, and review protocols

**Acceptance:**

- `sprint-index.md` cannot reference contracts, evidence, templates, or protocols absent from `project-index.md`.
- Excluded context is explicit.
- The stage supports dry run and prompt preview.

### Sprint 19: Distill Stage

**Goal:** produce `technical-handbook.md` from selected evidence only.

**Build:**

- technical handbook prompt rendering
- selected evidence loading
- handbook validation
- flow execution through `technical-handbook`

**Acceptance:**

- Handbook content traces to selected studies/reports.
- It captures relevant patterns, trade-offs, anti-patterns, open questions, and evidence pointers.
- It does not make implementation decisions.

### Sprint 20: Reason Stage

**Goal:** produce optional area reasoning and final `reasoning.md`.

**Build:**

- selected reasoning-template detection
- `reasoning/*.md` generation and validation when selected
- `reasoning.md` generation and validation
- flow execution through `reasoning`

**Acceptance:**

- Area reasoning is skipped only when no templates are selected.
- Final reasoning includes decisions, expected evidence, assumptions, and risks.
- Reasoning does not invent unselected contracts or evidence.

### Sprint 21: Plan Stage

**Goal:** produce `plan.md` from validated reasoning.

**Build:**

- plan prompt rendering
- plan validation
- task/evidence checklist validation
- flow execution through `plan`

**Acceptance:**

- `plan.md` cites `reasoning.md`.
- Tasks map to decisions and acceptance evidence.
- The phase stops after plan generation and validation.
- No implementation execution is invoked.

### Sprint 22: Planning Documentation and Release Gate

**Goal:** document and verify the planning-side release.

**Build:**

- CLI reference for `project` and planning-stage `sprint` commands
- recovery docs for failed planning stages
- migration notes from `.ultra/cli`
- offline fixture tests
- gated real-runtime planning smoke, if environment is available

**Release gate:**

```bash
go test ./...
go build ./cmd/ultraplan
```

plus gated planning-runtime smoke when environment is available.

---

# Roadmap Review Gates

Before Sprint 1 starts:

- [ ] Roadmap accepted.
- [ ] Phase 1 study-side scope confirmed.
- [ ] TRD target/sprint contradictions resolved or replaced by Planning Phase 2 scope.
- [ ] Canonical sprint artifact names confirmed.

Before runtime integration starts:

- [ ] Agentwrap dependency and version strategy confirmed.
- [ ] OpenCode smoke environment documented.
- [ ] Runtime validation strategy reviewed.

Before first release:

- [ ] `go test ./...` passes.
- [ ] CLI builds as a single binary.
- [ ] Fake-runtime test suite passes.
- [ ] Gated OpenCode smoke path documented.
- [ ] User-facing docs explain normal and recovery workflows.
