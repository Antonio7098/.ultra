# UltraPlan Go Architecture

## Architecture Philosophy

UltraPlan Go is module-driven, not global-layer-driven.

The guiding question is not:

> What technical category does this file belong to?

It is:

> Which module owns this behavior and state?

A product module should encapsulate a complete slice of behavior:

```text
module = state + logic + workflows + validation + persistence adapters + CLI/API surface
```

This means study behavior should stay with the study module. Project catalog behavior should stay with the project module. Sprint planning behavior should stay with the sprint module. Code extraction behavior should stay with the code extraction module. Workspace behavior should stay with the workspace module. Shared platform packages should exist only for genuinely cross-cutting infrastructure.

## Core Rule

Prefer this:

```text
internal/study owns its validation, scheduling, reports, prompts, state, and persistence
internal/project owns project docs, project-index cataloging, and project validation
internal/sprint owns planning artifacts, planning flow state, prompt rendering, and stage validation through plan
internal/codeextract owns its parsing, resolution, extraction, and validation behavior
internal/workspace owns workspace discovery, path rules, and workspace validation
internal/platform/runtime owns generic execution only
```

Avoid this as the default shape:

```text
internal/validation
internal/scheduler
internal/reports
internal/prompts
internal/study
```

Global technical-layer packages look clean at first, but they tend to fracture product context and create cross-module coupling.

## Initial Layout

Use a pragmatic Go layout: one package per product module, split by focused files first, and introduce subpackages only when the module grows enough that the boundary improves comprehension.

```text
cmd/
  ultraplan/
    main.go

internal/
  app/
    app.go                  # composition root and dependency wiring

  platform/
    config/
    logging/
    filesystem/
    runtime/
      runtime.go            # generic execution interface
      agentwrap.go          # agentwrap integration
      opencode.go           # opencode-specific adapter, if needed

  workspace/
    domain.go
    discovery.go
    validation.go
    paths.go
    store.go

  study/
    domain.go               # Study, Source, Dimension, Report, RunState
    service.go              # use-case coordination
    init.go
    run.go
    run_all.go
    synthesize.go
    scheduler.go
    state.go
    prompts.go
    validation.go
    reports.go
    summary.go
    store_fs.go
    cli.go

  project/
    domain.go               # Project, ProjectIndex, catalog entries
    discovery.go
    validation.go
    service.go
    store_fs.go
    cli.go

  sprint/
    domain.go               # Sprint, PlanningStage, FlowState
    flow.go
    prompts.go
    validation.go
    state.go
    service.go
    store_fs.go
    cli.go

  codeextract/
    domain.go
    service.go
    parser.go
    resolver.go
    validation.go
    cli.go
```

Do not immediately create a large clean-architecture tree such as:

```text
internal/study/domain/
internal/study/app/
internal/study/ports/
internal/study/adapters/
internal/study/validation/
internal/study/reports/
internal/study/prompts/
```

That can recreate the same abstraction problem as global layers. Start with one package per module and multiple focused files. Split into subpackages later when there is a concrete readability or dependency benefit.

## Module Ownership

### `study`

`study` is the main product module for the current build. It owns the full study lifecycle:

```text
Study definitions
Sources
Dimensions
Source applicability
Prompt creation
Single analysis runs
Full study runs
Run-loop state
Scheduling
Per-source report paths
Final synthesis report paths
Study validation
Report parsing
Summary generation
Filesystem persistence for study artifacts
CLI commands for study workflows
```

Prefer:

```text
internal/study/validation.go
internal/study/scheduler.go
internal/study/reports.go
internal/study/prompts.go
```

Instead of:

```text
internal/validation/study.go
internal/scheduler/study.go
internal/reports/study.go
internal/prompts/study.go
```

The study module may call platform runtime services, workspace path services, and config/logging infrastructure. Runtime and platform packages must not import `study`.

### `project`

`project` owns the planning root under `projects/<project>`:

```text
Project discovery and resolution
Project docs discovery
Roadmap discovery
project-index.md parsing
Catalog entries for contracts, evidence, reasoning templates, and review protocols
Project validation
Project status output
Filesystem persistence for project catalog artifacts
CLI commands for project workflows
```

`project` may call workspace path services and config/logging infrastructure. It should not import `study`; study outputs are referenced as catalog paths, not consumed through study services.

### `sprint`

`sprint` owns governed planning artifacts under `projects/<project>/sprints/<slug>` through `plan.md`:

```text
requirements.md
sprint-index.md
technical-handbook.md
reasoning/*.md
reasoning.md
plan.md
flow-state.json
```

It owns:

```text
Planning stage order through plan
Stage validation
Sprint-index subset checks against project-index.md
Technical handbook prompt/rendering behavior
Area reasoning prompt/rendering behavior
Final reasoning prompt/rendering behavior
Plan prompt/rendering behavior
Flow state persistence
Sprint status output
CLI commands for planning-stage sprint workflows
```

`sprint` may depend on `project` for project catalogs, `workspace` for path rules, and `platform/runtime` for generic prompt execution. It must not depend on `study` services, source/dimension models, study report validation, rating parsing, summary generation, or study run-loop scheduling.

Phase 2 stops at `plan.md`. `sprint` must not model implementation execution, smoke investigation, review automation, issue tracking, or Git mutation as current workflow stages.

### `platform/runtime`

Runtime is platform-level because it is generic execution infrastructure, not study behavior.

It may understand:

```text
Prompt
Working directory
Model
Timeout
Environment
Permissions
Expected output path
Execution events
Execution result
```

It must not understand:

```text
Study
Project
Sprint
Dimension
Source
Synthesis gating
Report semantics
Study state machines
Project catalog semantics
Sprint stage semantics
Summary generation
```

The dependency direction is:

```text
study -> platform/runtime
sprint -> platform/runtime
platform/runtime -> no product modules
```

Runtime supervision is delegated to `agentwrap`. UltraPlan's runtime integration should translate generic execution requests into agentwrap requests and translate generic results/events back to UltraPlan's platform-facing runtime model.

### `workspace`

`workspace` owns where UltraPlan is operating and how workspace paths are resolved.

It owns:

```text
Root discovery
Workspace marker/config lookup
Canonical workspace paths
Workspace-level validation
Path safety rules
```

It should not know:

```text
Which dimensions exist
How study synthesis works
How report summaries are generated
How code extraction parses citations
```

Boundary:

```text
workspace = where am I and where are things?
study = what study work happens here?
```

### `codeextract`

`codeextract` owns code-reference extraction as a distinct product capability.

It owns:

```text
Parsing report citations
Resolving referenced source files
Extracting source snippets
Producing extraction output
Validating extraction requests
CLI commands for extraction workflows
```

It may consume report paths or metadata produced by `study`, but it should not become a generic `reports` package unless the behavior is genuinely shared by multiple modules.

## Dependency Rules

Use these rules to keep module boundaries clear:

```text
Product modules may depend on platform packages.
Product modules may depend on workspace when they need workspace paths.
Product modules should not depend on other product modules unless there is a clear product relationship.
Platform packages must not depend on product modules.
Shared helpers must not become a dumping ground for product behavior.
Runtime must not import study, project, or sprint.
```

Expected dependency direction for the current build:

```text
cmd/ultraplan -> internal/app
internal/app -> product modules + platform modules
study -> workspace
study -> platform/runtime
study -> platform/config/logging/filesystem as needed
project -> workspace
project -> platform/config/logging/filesystem as needed
sprint -> project
sprint -> workspace
sprint -> platform/runtime
sprint -> platform/config/logging/filesystem as needed
codeextract -> workspace
codeextract -> platform/filesystem/logging as needed
workspace -> platform/filesystem as needed
platform/* -> no product modules
```

## Encapsulation in Practice

A module should expose a small use-case-oriented surface and hide internal helpers.

Example shape:

```go
type Service struct {
    store   Store
    runtime Runtime
    clock   Clock
}

func (s *Service) InitStudy(ctx context.Context, req InitStudyRequest) error
func (s *Service) RunDimension(ctx context.Context, req RunDimensionRequest) error
func (s *Service) RunAll(ctx context.Context, req RunAllRequest) error
func (s *Service) Synthesize(ctx context.Context, req SynthesizeRequest) error
```

Internally, the module can call helpers such as:

```go
validateStudy(...)
buildAnalysisPrompt(...)
resolveSources(...)
scheduleRuns(...)
parseReports(...)
writeRunState(...)
```

Callers should not need to know those helpers exist.

## Interface Guidance

Interfaces should appear at external or volatile boundaries, not everywhere by default.

Good interface boundaries:

```text
Runtime execution
Filesystem persistence where tests need fakes
Clock/time
External process execution
```

Avoid introducing interfaces for every internal helper. If a function is purely internal to a module and not volatile, keep it concrete.

## Contract Interpretation For Go Sprints

The shared contracts are production standards. Apply them through this Go module architecture rather than literal Python-style package shapes such as `use_cases/ports.py` or `bootstrap.py`.

Current CLI foundation and study-discovery sprints may use concrete local filesystem collaborators when:

```text
The side effect is local and narrow.
The package boundary is explicit.
The behavior is tested through the public CLI or module surface.
The design does not block later introduction of runtime, persistence, or process-execution ports.
```

Do not reject current-sprint code only because it lacks a port or registrar. Reject it when a concrete dependency crosses a volatile boundary, hides side effects, makes tests require private mutation, or couples product modules in a way this document does not allow.

The following become mandatory when their capability enters scope:

```text
Runtime/provider execution: context propagation, cancellation, runtime ports, correlation IDs, retry ownership, bounded provider calls, and cost metadata.
Batch/run-loop execution: bounded concurrency, durable task state, diagnostics, terminal failure state, and resumability.
Stable public JSON/release: canonical structured error payloads, stable machine-readable error codes, scenario tests, documented compatibility, and migration/rejection behavior for durable formats.
```

`study -> workspace` is an allowed dependency for workspace path resolution and safety helpers. It is not a cross-module violation unless `study` starts depending on workspace-owned behavior that knows study semantics or reaches around the exported workspace package API.

## Reuse Boundary For Phase 2

Reuse infrastructure, not study semantics.

Good candidates for reuse:

```text
workspace discovery and path safety
config loading, precedence, and redaction
generic runtime prompt execution
command exit codes and output discipline
atomic file and JSON writes
small result/diagnostic structs without product semantics
```

Do not extract these from `study` for Phase 2:

```text
study Service
Source and Dimension models
study prompt builders
report validation
rating parsing
summary generation
run-loop scheduling
task state machines
```

If two modules need the same mechanical filesystem behavior, extract the mechanical helper. If two modules merely have similar product workflows, keep the behavior in the owning modules until repeated concrete implementations prove a shared abstraction is stable.

## Final Principle

```text
Platform owns generic capabilities.
Modules own product behavior.
Logic stays near the state it transforms.
Interfaces appear only at external or volatile boundaries.
```
