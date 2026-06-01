# Go Todo CLI — Technical Requirements Document

## Architecture

### Project Structure

```
go-todo/
├── cmd/
│   └── todo/
│       └── main.go          # Entry point, cobra root
├── internal/
│   ├── app/
│   │   └── todoapp.go       # Core business logic (add, list, done, rm)
│   ├── store/
│   │   └── jsonstore.go     # JSON file persistence
│   ├── model/
│   │   └── task.go          # Task struct, Priority, Status enums
│   └── config/
│       └── paths.go         # Config dir resolution (XDG vs fallback)
├── pkg/
│   └── cli/
│       └── format.go        # Output formatting helpers
├── main.go                  # Thin main.go → cmd/todo/main.go
├── go.mod
└── go.sum
```

### Models

```go
type Priority int  // low=0, medium=1, high=2
type Status  int  // pending=0, done=1
type Task struct {
    ID       string    `json:"id"`
    Text     string    `json:"text"`
    Priority Priority  `json:"priority"`
    Status   Status    `json:"status"`
    Due      string    `json:"due,omitempty"`  // RFC3339 date or empty
    CreatedAt string   `json:"created_at"`
    DoneAt   string   `json:"done_at,omitempty"`
}
```

### Command Surface (urfave-cli style)

| Command | Args     | Flags                                      | Description    |
| ------- | -------- | ------------------------------------------ | -------------- |
| `add`   | `<text>` | `--priority/-p`, `--due/-d`                | Add a task     |
| `list`  |          | `--status/-s`, `--priority/-p`, `--due/-d` | List tasks     |
| `done`  | `<id>`   |                                            | Mark task done |
| `rm`    | `<id>`   |                                            | Delete task    |
| `edit`  | `<id>`   | `--text/-t`, `--priority/-p`, `--due/-d`   | Edit task      |

### Persistence

- Config file: `~/.config/go-todo/tasks.json` (XDG) or `$HOME/.config/go-todo/tasks.json`
- File format: JSON array of Task objects
- On startup: create file + parent dirs if missing
- On write: write to temp file, then rename (atomic)

### Error Handling

- All errors wrap with context: `fmt.Errorf("list tasks: %w", err)`
- Exit codes: 0=success, 1=general error, 2=invalid input
- User-facing errors printed to stderr, no stack traces

### Testing Strategy

- Unit tests for `internal/app/` (mock store interface)
- Integration tests for `internal/store/` (temp file)
- Command tests using `urfave-cli` test helper pattern

## Quality Gates

1. `go build ./...` succeeds with no errors
2. `go test ./...` all pass
3. `go vet ./...` no warnings
4. Commands work with `ultra --help` showing all subcommands
