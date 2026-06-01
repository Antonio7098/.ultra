# Sprint Plan: 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Source: `reasoning.md`
> **Inputs Used:** `.ultra/projects/go-todo/project-index.md`, `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md`, `.ultra/projects/go-todo/docs/PRD.md`, `.ultra/projects/go-todo/docs/TRD.md`, `.ultra/projects/go-todo/sprints/01-project-structure/sprint-index.md`, `.ultra/projects/go-todo/sprints/01-project-structure/technical-handbook.md`, `.ultra/projects/go-todo/sprints/01-project-structure/reasoning/architecture.md`, `.ultra/projects/go-todo/sprints/01-project-structure/reasoning/errors.md`, `.ultra/projects/go-todo/sprints/01-project-structure/reasoning.md`, `.ultra/system/contracts/core/architecture.md`, `.ultra/system/contracts/core/testing.md`

This plan executes `reasoning.md`. It must not invent architecture, scope, or decisions beyond that document.

## Reasoning Source

- **Sprint Reasoning:** `reasoning.md`
- **Sprint Index:** `sprint-index.md`
- **Technical Handbook:** `technical-handbook.md`
- **Area Reasoning:** `reasoning/architecture.md`, `reasoning/errors.md`

## Sprint Status

- **Status:** `complete`
- **Owner:** `implementation agent`
- **Start Date:** `2026-05-26`
- **Completion Date:** `2026-05-26`

## Decisions To Execute

| Decision | Source Section | Execution Implication |
|---|---|---|
| Module Directory Layout | `reasoning.md#decision-1` | Create `cmd/todo/main.go`, `internal/{model,store,config}/`. Module path: `github.com/antonioborgerees/go-todo`. No `pkg/` directory. No `internal/app/` package. |
| Entry Point Shape | `reasoning.md#decision-2` | `cmd/todo/main.go` under 50 lines — only flag parsing, dependency construction, delegation to urfave-cli. No business logic. urfave-cli v2 with no subcommands registered (exits with help text). |
| Store Design And Error Handling | `reasoning.md#decision-3` | Concrete `JSONStore` struct with `NewJSONStore(path)` constructor. Methods: `Add(Task) (Task, error)`, `List() ([]Task, error)`, `Done(id string) (Task, error)`, `Remove(id string) error`. Atomic write: temp file + `os.Rename`. Errors wrap with `fmt.Errorf("context: %w", err)`. Sentinels in `internal/store/errors.go`: `ErrTaskNotFound`, `ErrTaskIDEmpty`. |
| Model Package Design | `reasoning.md#decision-4` | `internal/model/task.go`: `Priority` (int: Low=0, Med=1, Hi=2), `Status` (int: Pending=0, Done=1), `Task` struct with JSON tags per TRD schema. Task ID is `string`. No validation, no custom marshal/unmarshal. |
| Config Path Stub | `reasoning.md#decision-5` | `internal/config/paths.go` exports `ConfigDir() string` returning `filepath.Join(os.Getenv("HOME"), ".config", "go-todo")`. No XDG resolution. Store creates directory on first write. |
| Testing Strategy | `reasoning.md#decision-6` | Model unit tests (enum values, zero-value, JSON round-trip). Store integration tests (CRUD, atomic write verify, 3+ failure paths). Isolated temp dirs per test. Stdlib `testing` only. |

## Requirements / Contracts To Satisfy

| Contract / Requirement ID | Required Behavior | Evidence Planned |
|---|---|---|
| AC-1 | `go build ./...` exits 0 | `go build ./...` succeeds |
| AC-2 | `go test ./...` all pass | `go test ./...` all green |
| AC-3 | `go vet ./...` no warnings | `go vet ./...` clean |
| AC-4 | Directory layout: `cmd/todo/main.go` + `internal/{model,store,config}/` | `ls -R` confirms layout |
| AC-5 | `cmd/todo/main.go` under 50 lines, no business logic | `wc -l cmd/todo/main.go` < 50 |
| AC-6 | Atomic write: temp file + `os.Rename` | Code review of `jsonstore.go` |
| AC-7 | All store errors wrap with `fmt.Errorf("context: %w", err)` | Code review of all store methods |
| AC-8 | Store tests: CRUD + atomic write + 3 failure paths | `go test -v ./internal/store/` output |
| AC-9 | Model tests: enum values, zero-value, JSON tags | `go test -v ./internal/model/` output |
| AC-10 | Deterministic tests — 100 runs all pass | `go test -count=100 ./...` output |
| ARCH-CORE-001 | Module boundaries explicit; single concern per package | Code review confirms package boundaries |
| ARCH-CORE-002 | Dependency direction inward; `internal/` never imports `cmd/` | `go vet` passes; import review |
| ARCH-ENTRY-001 | Transport adapter thin; no business logic in `main.go` | `wc -l` < 50; code review |
| ARCH-SHARED-001 | Shared/domain-neutral packages; model has no store/command deps | Code review of model imports |
| TEST-SEAM-001 | Constructor injection provides replaceable seam | `NewJSONStore(path)` accepts temp path in tests |
| TEST-UNIT-001 | Business logic unit coverage | Model tests exist |
| TEST-INT-001 | Persistence integration coverage | Store tests with real temp files |
| TEST-FAIL-001 | Failure paths tested explicitly | 3+ failure path tests in store suite |
| TEST-DET-001 | Deterministic tests, no shared state | Isolated `os.MkdirTemp` per test |

## Tasks

- [x] **Task 1: Initialize Go module**
  > Executes: Decision 1 (Module Directory Layout)
  - [x] Create `go.mod` with module path `github.com/antonioborgerees/go-todo` and Go version (use `go 1.22` or latest stable)
  - [x] Add `github.com/urfave/cli/v2` dependency via `go get github.com/urfave/cli/v2`
  - [x] Run `go mod tidy`
  - [x] Verify: `go build ./...` exits 0

- [x] **Task 2: Create directory structure**
  > Executes: Decision 1 (Module Directory Layout)
  - [x] Create `cmd/todo/` directory
  - [x] Create `internal/model/` directory
  - [x] Create `internal/store/` directory
  - [x] Create `internal/config/` directory
  - [x] Verify: `ls -R` shows required structure

- [x] **Task 3: Implement model package**
  > Executes: Decision 4 (Model Package Design)
  - [x] Create `internal/model/task.go`:
  - [x] Create `internal/model/task_test.go`:
  - [x] Verify: `go test -v ./internal/model/` passes

- [x] **Task 4: Implement store sentinel errors**
  > Executes: Decision 3 (Store Design And Error Handling)
  - [x] Create `internal/store/errors.go`:
    - `var ErrTaskNotFound = errors.New("task not found")`
    - `var ErrTaskIDEmpty = errors.New("task ID cannot be empty")`
  - [x] Verify: file compiles with `go build ./internal/store/`

- [x] **Task 5: Implement JSON store**
  > Executes: Decision 3 (Store Design And Error Handling)
  - [x] Create `internal/store/jsonstore.go`:
  - [x] Verify: `go build ./internal/store/` passes

- [x] **Task 6: Implement store tests**
  > Executes: Decision 3 (Store Design And Error Handling), Decision 6 (Testing Strategy)
  - [x] Create `internal/store/jsonstore_test.go`:
  - [x] Verify: `go test -v ./internal/store/` shows all tests passing
  - [x] Verify: `go test -count=100 ./internal/store/` all pass

- [x] **Task 7: Implement config path stub**
  > Executes: Decision 5 (Config Path Stub)
  - [x] Create `internal/config/paths.go`:
  - [x] Verify: `go build ./internal/config/` passes

- [x] **Task 8: Implement entry point**
  > Executes: Decision 2 (Entry Point Shape)
  - [x] Create `cmd/todo/main.go`:
  - [x] Verify: `wc -l cmd/todo/main.go` < 50
  - [x] Verify: `go run cmd/todo/main.go --help` outputs help text
  - [x] Verify: `go run cmd/todo/main.go --version` outputs version

- [x] **Task 9: Run verification suite**
  > Executes: All decisions — acceptance criteria gate
  - [x] Run `go build ./...` — must exit 0 (AC-1)
  - [x] Run `go test ./...` — all tests pass (AC-2)
  - [x] Run `go vet ./...` — no warnings (AC-3)
  - [x] Run `go test -count=100 ./...` — all pass (AC-10)
  - [x] Run `wc -l cmd/todo/main.go` — under 50 lines (AC-5)
  - [x] Record all outputs in execution log

- [x] **Task 10: Record deviations and complete sprint artifacts**
  > Executes: Sprint process requirements
  - [x] Record any deviations from `reasoning.md` with justification
  - [x] Run Architecture Review Protocol (`.ultra/system/protocols/architecture-review-protocol.md`)
  - [x] Create `review.md` with architecture review and sprint review findings
  - [x] Update `sprint-index.md` if any evidence gaps were discovered
  - [x] Update `project-index.md` if any new contracts or templates were adopted

## Evidence Checklist

- [x] Tests prove the required behavior — AC-1 through AC-10 define specific test/verification evidence
- [x] Runtime or diagnostic evidence exists where required — `go run cmd/todo/main.go` shows help text
- [x] Documentation updates are complete where required — `sprint-index.md`, `project-index.md` updated
- [x] Deviations from `reasoning.md` are recorded before implementation continues
- [x] Required review protocols have evidence — Architecture Review Protocol run and recorded in `review.md`

## Verification Commands

| Check | Command | Expected Result |
|---|---|---|
| Build passes | `go build ./...` | Exit 0, no errors |
| All tests pass | `go test ./...` | All tests pass |
| No vet warnings | `go vet ./...` | No warnings |
| Deterministic tests | `go test -count=100 ./...` | All 100 runs pass |
| Entry point under 50 lines | `wc -l cmd/todo/main.go` | `< 50` |
| Model tests | `go test -v ./internal/model/` | Enum, zero-value, JSON tests pass |
| Store tests | `go test -v ./internal/store/` | CRUD, atomic write, 3+ failure paths |
| Help text | `go run cmd/todo/main.go` | Shows urfave-cli help text |
| Version output | `go run cmd/todo/main.go --version` | Shows `0.1.0` |
| Directory layout | `ls -R cmd/todo/ internal/` | Shows `cmd/todo/main.go`, `internal/{model,store,config}/` |
| No business logic in main | Code review of `cmd/todo/main.go` | Only flag parsing, dep construction, delegation |
| Atomic write pattern | Code review of `internal/store/jsonstore.go` | `os.CreateTemp` + `os.Rename` |
| Error wrapping | Code review of store methods | `fmt.Errorf("context: %w", err)` throughout |
| No reverse imports | `go vet` + import review | No `internal/` package imports `cmd/` |

## Risks And Blockers

| Risk / Blocker | Source | Mitigation | Status |
|---|---|---|---|
| Go module path `github.com/antonioborgerees/go-todo` may not match actual repo URL | `reasoning.md` assumptions | Verify `go.mod` path before committing; update if different | closed — verified, matches |
| urfave-cli v2 requires at least one registered command to produce useful output | `reasoning.md` assumptions | Test `go run cmd/todo/main.go` produces help text with no commands; add dummy no-op command if API requires it | closed — `--help` and `--version` work without registered commands |
| No `Store` interface increases Sprint 02 refactoring cost | `reasoning.md` Decision 3 risk | Design `JSONStore` methods with clean signatures that are interface-extractable. Document extraction path in sprint-index for Sprint 02 | carried forward — Sprint 02 must extract interface |
| Config path stub may need rework if cross-platform XDG differs from assumptions | `reasoning.md` Decision 5 risk | Keep `ConfigDir()` signature simple so Sprint 03 can replace implementation without changing callers | carried forward — Sprint 03 |
| Errors template was added to project index mid-sprint — possible synchronization gap with other agents | Sprint process | Confirm project-index is the single source of truth; update any agent prompt references | closed — project-index is current |

## Review Inputs

Review should use:

- `sprint-index.md`
- `technical-handbook.md`
- `reasoning/architecture.md`
- `reasoning/errors.md`
- `reasoning.md`
- this `plan.md`
- implementation diff
- verification evidence
- required protocols from `sprint-index.md` (Architecture Review Protocol, Sprint Review Protocol)

## Execution Log

| Date / Step | Action | Evidence / Notes |
|---|---|---|
| `2026-05-26` | Task 1: Initialize Go module | Switched from urfave/cli v3 to v2, `go get github.com/urfave/cli/v2`, `go mod tidy` — matches plan |
| `2026-05-26` | Task 2: Create directory structure | Directories exist: `cmd/todo/`, `internal/{model,store,config}/` — verified via `ls -R` |
| `2026-05-26` | Task 3: Implement model package | `internal/model/task.go` and `task_test.go` match plan. 5 tests pass (enum values, zero-value, JSON round-trip, omitempty) |
| `2026-05-26` | Task 4: Implement store sentinel errors | Created `internal/store/errors.go` with `ErrTaskNotFound` and `ErrTaskIDEmpty`. `go build ./internal/store/` passes |
| `2026-05-26` | Task 5: Implement JSON store | Created `internal/store/jsonstore.go` with `JSONStore` struct, `NewJSONStore(path)` constructor, `Add`/`List`/`Done`/`Remove` methods, atomic write, error wrapping |
| `2026-05-26` | Task 6: Implement store tests | 11 tests: CRUD (Add, List, Done, Remove), atomic write verification, 5 failure paths (DoneNotFound, RemoveNotFound, AddEmptyID, CorruptJSON, PermissionDenied, ListEmptyOnFirstRun). All pass |
| `2026-05-26` | Task 7: Implement config path stub | `internal/config/paths.go` with `ConfigDir()` only (removed `DataFile()`). `go build ./internal/config/` passes |
| `2026-05-26` | Task 8: Implement entry point | `cmd/todo/main.go` — 24 lines, under 50. Config resolution, store construction, urfave-cli app with name/usage/version. `--help` and `--version` work |
| `2026-05-26` | Task 9: Run verification suite | `go build ./...` (exit 0), `go test ./...` (all pass), `go vet ./...` (clean), `go test -count=100 ./...` (all pass), `wc -l` (24 < 50) |
| `2026-05-26` | Task 10: Record deviations, complete artifacts | No material deviations from `reasoning.md`. Architecture Review Protocol completed in `review.md`. Sprint Review Protocol not found (deferred). `.run-state.json` written |

## Completion Criteria

- [x] All tasks are complete or explicitly deferred.
- [x] Verification commands were run or deferrals are documented.
- [x] Evidence satisfies the expectations from `reasoning.md`.
- [x] `review.md` can evaluate conformance without guessing intent.
