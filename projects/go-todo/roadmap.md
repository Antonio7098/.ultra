# Go Todo CLI — Roadmap

## Sprint 01-project-structure

**Goal:** Scaffold the project with go.mod, directory layout, Task model, and JSON store with tests.

**Outputs:**

- `cmd/todo/main.go`, `internal/model/task.go`, `internal/store/jsonstore.go`, `internal/config/paths.go`
- `go.mod` with cobra, urfave-cli, stretchr/testify deps
- `internal/store/jsonstore_test.go` passing
- `go build ./...` succeeds

**Evidence Sources:** go-cli-study → project-structure, mitchellh-cli patterns

---

## Sprint 02-command-architecture

**Goal:** Implement `todo add`, `todo list`, `todo done`, `todo rm` commands using urfave-cli v2/v3.

**Outputs:**

- `internal/app/todoapp.go` with Add/List/Done/Remove methods
- `cmd/todo/commands.go` with all subcommands registered
- `cmd/todo/commands_test.go` with command tests
- All commands respond to `--help`

**Evidence Sources:** go-cli-study → command-architecture, urfave-cli source evidence

---

## Sprint 03-configuration-management

**Goal:** Config path resolution (XDG vs fallback), priority/due-date flags, output formatting.

**Outputs:**

- `internal/config/paths.go` resolving config dir correctly
- Priority enum with `-p/--priority` flag
- Due date with `-d/--due` flag accepting RFC3339
- `pkg/cli/format.go` for table/formatted output

**Evidence Sources:** go-cli-study → configuration-management, chezmoi patterns

---

## Sprint 04-testing-strategy

**Goal:** Comprehensive tests: unit, integration, command-level. Coverage ≥ 70%.

**Outputs:**

- `internal/app/todoapp_test.go` (mock store)
- `internal/store/integration_test.go`
- Command tests with urfave-cli test helpers
- `go test ./... -cover` ≥ 70%

**Evidence Sources:** go-cli-study → testing-strategy, go-task test patterns
