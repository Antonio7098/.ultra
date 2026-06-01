# Architecture Reasoning: Sprint 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Template: `.ultra/system/reasoning/architecture_reasoning_template.md`
> **Inputs Used:** `.ultra/projects/go-todo/docs/PRD.md`, `.ultra/projects/go-todo/docs/TRD.md`, `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md`, `.ultra/projects/go-todo/sprints/01-project-structure/technical-handbook.md`, `.ultra/system/contracts/core/architecture.md`

## 0. Feature Summary

### Feature name

Sprint 01 — Project Structure Scaffolding

### User/product goal

Establish the Go module, directory layout, data model, and persistence layer for `go-todo` CLI such that Sprint 02 can add commands (`add`, `list`, `done`, `rm`) without restructuring.

### Current task

Create `go.mod`, `cmd/todo/main.go`, `internal/model/task.go`, `internal/store/jsonstore.go`, `internal/store/jsonstore_test.go`, `internal/config/paths.go` following evidence-based patterns.

### Non-goals

- No command implementations (`add`, `list`, `done`, `rm`)
- No `internal/app/` package
- No shell completion
- No output formatting beyond JSON
- No XDG config resolution
- No `Store` interface
- No test dependencies beyond stdlib `testing`

## 1. First-Principles Breakdown

### Core behaviour

The scaffold receives nothing (fresh project), produces: a Go module with three internal packages (model, store, config) and a thin CLI entry point, all passing build, vet, and test gates.

### Inputs

- `PRD.md` goals: add, list, done, rm tasks; JSON persistence in XDG config dir
- `TRD.md` architecture: `cmd/internal/pkg` layout; Task model (Priority, Status enums); urfave-cli command surface; atomic JSON writes
- `requirements.md` ACs: 10 acceptance criteria for Sprint 01
- `technical-handbook.md` evidence: 14 studied Go CLI repos

### Outputs

- `go.mod` at `github.com/antonioborgerees/go-todo`
- `cmd/todo/main.go` under 50 lines, no business logic
- `internal/model/task.go` — Task, Priority, Status types with JSON tags
- `internal/store/jsonstore.go` — JSON file store with atomic writes
- `internal/store/jsonstore_test.go` — CRUD + atomic write + 3 failure paths
- `internal/config/paths.go` — hardcoded placeholder for config dir

### Durable state

- `~/.config/go-todo/tasks.json` (or `configDir/tasks.json`) — JSON array of Task objects
- Created on first write (not on startup in Sprint 01)

### Ephemeral state

- Temp file during atomic write (same directory as target, then `os.Rename`)
- In-memory `[]Task` slice during read and write cycles

### Derived state

None in Sprint 01 — no computed fields on Task model.

### Side effects

- File write: yes — atomic write to JSON store
- File read: yes — read JSON on `List()`, `Done()`, `Remove()`, `Add()`
- File create: yes — on first store write if dir/file doesn't exist

## 2. Existing Architecture Fit

### Where does this behaviour naturally belong?

- `cmd/todo/main.go` — transport adapter (CLI entry point)
- `internal/model/task.go` — domain data types
- `internal/store/jsonstore.go` — persistence infrastructure
- `internal/config/paths.go` — platform configuration

### Existing workflow affected

No existing workflow — this is the first sprint. The shape established here constrains Sprint 02-04.

### Proposed new flow

1. `main.go` calls `config.ConfigDir()` to get path
2. `main.go` constructs store via `store.NewJSONStore(path + "/tasks.json")`
3. `main.go` creates urfave-cli app, no commands registered (Sprint 01)
4. `store` methods operate on JSON file: read-all → modify-in-memory → atomic-write

### Does the current architecture still fit?

Since there is no prior architecture, the question is whether `cmd/internal/pkg` fits the project. Evidence from 14/14 studied repos says yes — this is the dominant pattern for pure Go CLI apps.

**Verdict:** Yes — `cmd/internal/pkg` fits for a single-binary Go CLI with no public library surface.

## 3. Design Options Considered

### Option A: `cmd/` + `internal/` + `pkg/` (fully separated)

**Description:** Three-tier layout: `cmd/todo/main.go`, `internal/{model,store,config}/`, `pkg/cli/format.go` per TRD.

**Pros:**
- Scales to multi-binary (helm pattern: `cmd/helm/`, `cmd/gen-docs/`)
- `internal/` provides Go-enforced encapsulation
- `pkg/` reserved for public shared code

**Cons:**
- `pkg/` is empty in Sprint 01 — premature directory
- Extra directory depth for a single-binary project

**Risks:**
- Empty directories create ambiguity about where code belongs
- Handbook evidence: lazygit avoids `internal/` for single binary; fzf uses root `main.go`

### Option B: `cmd/` + `internal/` only (no `pkg/`)

**Description:** Two-tier layout: `cmd/todo/main.go`, `internal/{model,store,config}/`. No `pkg/` directory until Sprint 03 when output formatting warrants it.

**Pros:**
- Simpler than Option A, matches Sprint 01 scope
- `internal/` still enforces encapsulation boundary
- `cmd/` still scales to multi-binary
- No empty directories

**Cons:**
- Sprint 03 must add `pkg/` directory, moving code between packages
- Less aligned with TRD diagram that shows `pkg/cli/format.go`

**Risks:**
- Low — adding `pkg/` is additive, not restructuring

### Option C: Flat layout with root `main.go` + `internal/` only

**Description:** Root `main.go` (fzf, lazygit, yq pattern) + `internal/{model,store,config}/`. No `cmd/` directory.

**Pros:**
- Simplest directory structure
- Fewer import paths
- Directly matches single-binary projects (fzf, lazygit)

**Cons:**
- Does not scale to multi-binary
- Deviates from TRD which specifies `cmd/todo/main.go`
- Less discoverable entry point for newcomers familiar with Go CLI conventions

**Risks:**
- Future binary addition (e.g., `todo-gen-docs`) would require restructuring
- Violates PRD goal of extensible architecture

### Chosen option

**Option B: `cmd/` + `internal/` only (no `pkg/`)**

**Reason:** Matches Sprint 01 scope exactly. `cmd/` satisfies PRD extensibility requirement. `internal/` satisfies Go encapsulation without the cost of empty `pkg/` directory. `pkg/cli/format.go` can be added cleanly in Sprint 03 without restructuring existing packages.

## 4. Abstraction Check

### Are we adding a new abstraction?

```
[ ] No
[X] Yes — interface/protocol/trait — deferred to Sprint 02
[ ] Yes — service/component/module
[ ] Yes — strategy/function parameter
[ ] Yes — data structure/DTO/config object
[ ] Yes — plugin/registry/factory
```

No abstractions in Sprint 01. `Store` interface is explicitly deferred to Sprint 02. The sprint uses concrete types only.

### If no, why are we keeping it concrete?

The `Store` interface would protect a test seam, but there is only one implementation (JSON file). Adding an interface now violates Architecture contract principle #7: "Do not introduce ports... speculatively." The concrete `JSONStore` with constructor injection provides the replaceable seam through its constructor parameter (file path). Sprint 02 will extract the interface when `internal/app/` requires polymorphism.

### Bad abstraction smell check

```
[ ] Generic name like Manager/Handler/Processor/Common/Helper
[ ] Only one implementation with no real volatility
[ ] Boolean flags or mode switches
[ ] Optional parameters for caller-specific behaviour
[ ] Interface mirrors a concrete class rather than consumer needs
[ ] Abstraction exists only to reduce line count
[ ] Abstraction makes the flow harder to trace
```

No concerns — no abstractions introduced.

## 5. Coupling Check

### Dependencies required

- `github.com/urfave/cli/v2` — CLI framework (required by requirements)
- `golang.org/x/mod` (if needed for module versioning)

### Coupling risks

```
Global coupling:
[X] None

Content coupling:
[X] None — packages interact through exported functions only

Stamp coupling:
[X] None — functions accept only what they need
```

### Dependency injection check

```
Are side-effectful dependencies created at the edge and passed inward?
[X] Yes — file path created in main.go, passed to NewJSONStore
```

`cmd/todo/main.go` resolves the config path and constructs the store. The store receives its file path as a constructor parameter — no global state, no internal construction of side-effectful dependencies.

## 6. State and Mutation Check

### Mutation points

- `internal/store/jsonstore.go: writeTasks()` — writes to temp file, then `os.Rename` to target
- `internal/store/jsonstore.go: Add()` — appends to in-memory slice, writes to disk
- `internal/store/jsonstore.go: Done()` — mutates Status field in-place, writes to disk
- `internal/store/jsonstore.go: Remove()` — removes from slice, writes to disk

### Is mutation explicit from names and flow?

```
[X] Yes
```

All mutating methods have verb names (Add, Done, Remove). The write-to-disk is not hidden — every mutating method follows read-in-memory → modify → atomic-write.

### Could hidden state make this hard to debug?

```
[X] No
```

No global state, no package-level variables. Each test creates its own `JSONStore` with a temp file path.

## 7. Function/Class/Module Shape

### Primary unit of behaviour

```
[ ] Function
[X] Class/object — JSONStore struct
[ ] Module
[ ] Service/component
[ ] Pipeline/workflow
[ ] Adapter
```

### Why this unit?

`JSONStore` maintains meaningful state (file path) and protects the invariant that the JSON file is always internally consistent (atomic writes). The struct groups cohesive persistence behaviour (CRUD operations) around a single responsibility.

### If using a class/object, what justifies it?

```
[X] Maintains meaningful state — file path
[X] Protects invariants — atomic write ensures no partial writes
[X] Groups cohesive behaviour — all persistence operations in one place
```

## 8. Error Handling Design

*Note: Detailed error handling reasoning is in `reasoning/errors.md`. This section covers architecture-specific implications.*

### Expected failures

- File not found on read: handled as empty list (first-run case)
- Corrupt JSON on read: returned as wrapped error to caller
- Permission denied on write: returned as wrapped error to caller
- Missing temp file directory: returned as wrapped error to caller

### Error propagation pattern

All store errors wrap with `fmt.Errorf("context: %w", err)`. Callers use `errors.Is()` to check sentinel errors. This ensures errors are actionable at the CLI layer (Sprint 02).

## 9. Implementation Plan

### Files to create

```
go-todo/
├── cmd/
│   └── todo/
│       └── main.go           # Entry point, under 50 lines
├── internal/
│   ├── model/
│   │   └── task.go           # Task struct, Priority/Status enums
│   ├── store/
│   │   ├── jsonstore.go      # JSONStore struct with CRUD methods
│   │   ├── jsonstore_test.go # CRUD + atomic write + 3 failure paths
│   │   └── errors.go         # Sentinel errors (ErrTaskNotFound, ErrTaskIDEmpty)
│   └── config/
│       └── paths.go          # ConfigDir() returning hardcoded path
├── go.mod
└── go.sum
```

### Step-by-step plan

1. Create `go.mod`: `module github.com/antonioborgerees/go-todo`, require `github.com/urfave/cli/v2`
2. Create `internal/model/task.go`: Priority (int), Status (int), Task struct with JSON tags
3. Create `internal/model/task_test.go`: enum values, zero-value, JSON round-trip
4. Create `internal/store/errors.go`: `ErrTaskNotFound`, `ErrTaskIDEmpty` sentinels
5. Create `internal/store/jsonstore.go`: `JSONStore` struct, `NewJSONStore(path)`, `Add`, `List`, `Done`, `Remove` — atomic write pattern (temp file + os.Rename)
6. Create `internal/store/jsonstore_test.go`: CRUD tests, atomic write verify, 3 failure paths, isolated temp dirs per test
7. Create `internal/config/paths.go`: `ConfigDir() string` returning hardcoded `filepath.Join(os.Getenv("HOME"), ".config", "go-todo")`
8. Create `cmd/todo/main.go`: under 50 lines, resolve config path, construct store, create urfave-cli app, `app.Run(os.Args)`
9. Run verification: `go build ./...`, `go test ./...`, `go vet ./...`, `go test -count=100 ./...`

## 10. Final Decision

```
Decision: Proceed

Complexity introduced:
Low — established patterns from 14 studied repos; no abstractions; no speculative design

Complexity removed:
None — first sprint

Main trade-off:
Deferring `pkg/` directory to Sprint 03 vs matching TRD diagram exactly.
Accepting because empty directories are worse than deferred additions.
```

## Evidence Sources

- `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` — Pattern Catalog (lines 116–186), Tradeoffs (lines 270–278), Anti-Patterns (lines 340–352)
- `.ultra/projects/go-todo/sprints/01-project-structure/technical-handbook.md` — Patterns 1, 2, 4, 7; Tradeoffs and Anti-Patterns sections
- `.ultra/system/contracts/core/architecture.md` — ARCH-CORE-001/002, ARCH-ENTRY-001, ARCH-SHARED-001
- `.ultra/system/contracts/core/testing.md` — TEST-SEAM-001, TEST-UNIT-001, TEST-INT-001, TEST-FAIL-001, TEST-DET-001
