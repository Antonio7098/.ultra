# Sprint Requirements: 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Status: draft

## Sprint Goal

Scaffold the `go-todo` Go project: module definition, `cmd/internal/pkg` directory layout, core data model, and JSON file store with passing tests. No commands yet (`add`, `list`, `done`, `rm` are Sprint 02).

## Required Outputs

1. `go.mod` with module path `github.com/antonioborgerees/go-todo`, urfave-cli v2 dependency
2. `cmd/todo/main.go` — thin entry point, under 50 lines, wires urfave-cli
3. `internal/model/task.go` — `Task` struct, `Priority`/`Status` int enums with JSON tags
4. `internal/store/jsonstore.go` + `jsonstore_test.go` — JSON file store with atomic writes and CRUD tests
5. `internal/config/paths.go` — config directory stub (XDG deferred to Sprint 03)
6. Sprint artifacts: `sprint-index.md`, `technical-handbook.md`, `reasoning.md`, `plan.md`, `review.md`

## Area-Specific Reasoning Required

This sprint requires **two** area reasoning documents:

1. **Architecture** — module layout (`cmd/internal/pkg`), entry point shape, dependency direction, `internal/` package protection, no reverse imports
2. **Error Handling** — error wrapping pattern (`fmt.Errorf`), no silent failures, sentinel errors, error propagation from store to callers

Reasoning templates to use: `architecture_reasoning_template.md`, `errors_reasoning_template.md`

## Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-1 | `go build ./...` exits 0 | `go build ./...` |
| AC-2 | `go test ./...` all pass | `go test ./...` |
| AC-3 | `go vet ./...` no warnings | `go vet ./...` |
| AC-4 | Directory layout: `cmd/todo/main.go` + `internal/{model,store,config}/` | code review |
| AC-5 | `cmd/todo/main.go` under 50 lines, no business logic | `wc -l cmd/todo/main.go` |
| AC-6 | `internal/store/` uses atomic write pattern (temp file + `os.Rename`) | code review |
| AC-7 | All store errors wrap with `fmt.Errorf("context: %w", err)` | code review |
| AC-8 | Store tests: at least CRUD + atomic write + 3 failure paths | `go test -v ./internal/store/` |
| AC-9 | Model tests: enum values, zero-value, JSON tags | `go test -v ./internal/model/` |
| AC-10 | Deterministic tests — `go test -count=100 ./...` all pass | `go test -count=100 ./...` |

## Non-Goals

- No command implementations (`add`, `list`, `done`, `rm`)
- No `internal/app/` package
- No shell completion
- No output formatting beyond JSON
- No priority/due-date flags
- No XDG config resolution (deferred to Sprint 03)
- No `Store` interface (deferred to Sprint 02)

## Constraints

- Sprint index must select the Architecture and Errors reasoning templates
- Technical handbook must cite only study evidence (not contracts directly)
- Area reasoning documents must be created for Architecture and Error Handling
- Sprint reasoning must synthesize area reasoning conclusions into final decisions
- All stage prompts must list their input documents at the top