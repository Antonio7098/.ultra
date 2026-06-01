# Error Handling Reasoning: Sprint 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Template: `.ultra/system/reasoning/errors_reasoning_template.md`
> **Inputs Used:** `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md`, `.ultra/projects/go-todo/docs/TRD.md`, `.ultra/system/contracts/core/architecture.md`

## 0. Feature Summary

### Feature / Component

`internal/store/jsonstore.go` — JSON file persistence layer, and `internal/model/task.go` — data types.

### What can fail

- JSON file does not exist on read (first-run or deleted)
- JSON file contains corrupt/unparseable data
- File write permission denied (directory not writable)
- Temp file creation fails (disk full, permissions)
- `os.Rename` fails (cross-device link, permissions)
- Task ID is empty on Add/Done/Remove
- Task ID not found on Done/Remove

### Failure impact

- User sees descriptive error on stderr (exit code 1 in Sprint 02)
- No partial state: atomic write ensures either complete write or no change
- Failures are recoverable mid-operation — retry is safe because the atomic write pattern leaves the original file intact until `os.Rename` succeeds

## 1. Error Taxonomy

### Expected failures (normal flow)

- `ErrTaskNotFound`: recoverable — caller should surface "task not found" to user
- `ErrTaskIDEmpty`: recoverable — caller should surface "task ID cannot be empty" to user
- File not found on read: recoverable — treated as empty list (first-run), not an error
- Corrupt JSON: recoverable — error is returned; user must fix or delete file

### Unexpected failures (exceptional)

- Permission denied on write: surfaced as wrapped `*os.PathError` — caller shows "cannot write to <path>: permission denied"
- Disk full: surfaced as wrapped error — caller shows "no space left on device"
- Cross-device rename: surfaced as wrapped error — caller shows generic error (rare in practice)

### Error surface size

```
[X] Small — a few distinct error classes
```

Two sentinel errors (`ErrTaskNotFound`, `ErrTaskIDEmpty`) plus wrapped stdlib errors for I/O failures.

## 2. Error Chain Design

### Should errors wrap?

```
[X] Yes — %w wrapping at boundary, callers use errors.Is/errors.As
```

Every store method wraps internal errors with context: `fmt.Errorf("add task: %w", err)`. This satisfies AC-7.

### Sentinel errors needed?

```
[X] Partial — only for expected failures
```

Define `var ErrTaskNotFound` and `var ErrTaskIDEmpty` in `internal/store/errors.go`. These are the only two domain-specific failures that callers need to distinguish.

I/O failures (permission denied, corrupt JSON, disk full) are surfaced through wrapped stdlib errors. Callers in Sprint 02 can use `errors.Is(err, fs.ErrNotExist)` or `errors.As(err, &fs.PathError{})` if they need to distinguish I/O subtypes.

### Propagation pattern

```
[X] sentinel errors + wrap at boundary
```

```
Store method → fmt.Errorf("context: %w", err) → caller
```

The store is the error boundary. Errors are wrapped exactly once at the store method level. `cmd/todo/main.go` and (in Sprint 02) `internal/app/todoapp.go` receive wrapped errors and surface them.

## 3. Silent Failure Check

### Where could failures be swallowed?

- File-not-found on read: explicitly handled — return empty slice, not error. This is deliberate, not a swallowed failure.
- `defer os.Remove(tempFile.Name())` in atomic write: failure to clean up temp file is logged but not returned (best-effort cleanup). Acceptable because the temp file is in the same directory as the target and will not affect correctness.

### Are all error returns explicit?

```
[X] Yes — every failure is returned or deliberately swallowed
```

## 4. Panic Safety

### Are panics used instead of errors?

```
[X] No panics in this component
```

## 5. Call-site ergonomics

### How will callers check errors?

- `errors.Is(err, store.ErrTaskNotFound)` — for task-not-found
- `errors.Is(err, store.ErrTaskIDEmpty)` — for empty ID
- `errors.Is(err, fs.ErrNotExist)` — if caller needs to distinguish file-missing
- `fmt.Errorf("...%w", err)` unwrapped via `errors.Is` for all other failures

### Error messages for humans

Messages follow the pattern: `"add task: %w"` where `%w` provides the leaf error. This produces messages like:
- `"add task: task not found"` (sentinel unwrapped)
- `"list tasks: open /home/user/.config/go-todo/tasks.json: permission denied"` (wrapped `*os.PathError`)

Messages include the operation name and the root cause. They do not expose internal implementation details beyond the file path (which the user already knows from their config).

## 6. Error Wrapping Standard

### %w vs %s vs %v

- Use `%w` for all error wrapping: `fmt.Errorf("add task: %w", err)`
- Do not use `%v` for error values — loses the error chain
- Do not use `%s` for error content — produces non-wrapped string

### When to NOT wrap

- At the original failure point: sentinel errors are created with `errors.New`, not wrapped
- When re-raising a wrapped error: each store method wraps exactly once at its public boundary

## 7. Testing Error Paths

### Error test patterns needed

```
[X] errors.Is for sentinel errors
[ ] errors.As for typed errors
[X] Table-driven error tests — for CRUD happy paths only
[X] Chaos/resilience tests — permission denied via temp dir removal
```

### Minimum error test coverage

- Happy path: add, list, done, remove succeed
- `ErrTaskNotFound`: done/remove with nonexistent ID
- `ErrTaskIDEmpty`: add with empty ID
- Corrupt JSON: write invalid JSON to file, call List()
- Permission denied: create file without write permission, call Add()

Each failure path test verifies:
1. The correct sentinel or wrapped error is returned
2. `errors.Is()` correctly identifies the error type
3. The error message contains context about the operation

## 8. Final Decision

```
Error strategy:
- Hybrid: sentinel errors for domain-specific failures (task not found, empty ID);
  wrapped stdlib errors for I/O failures (permission, corrupt data, disk full).

Sentinels:
- `var ErrTaskNotFound = errors.New("task not found")`
- `var ErrTaskIDEmpty = errors.New("task ID cannot be empty")`

Wrapping standard:
- `fmt.Errorf("operation name: %w", err)` at every store method boundary.
  File-not-found on first read is NOT an error — return empty slice.
  Temp file cleanup failures are best-effort (not returned, not panicked).

Call-site contract:
- Callers use `errors.Is()` for sentinel checks and I/O error classification.
- Callers do not string-match on error messages.
- The CLI layer (Sprint 02) maps errors to exit codes: 1 for I/O errors, 2 for invalid input.

What this does NOT include:
- No panics
- No third-party error libraries
- No custom error types (sentinels are `errors.New`)
- No error logging at the store level (logging is the caller's responsibility)
- No opaque error strings — all errors are wrappable and identifiable
```

## Evidence Sources

- `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md` — AC-6 (atomic write), AC-7 (error wrapping), AC-8 (failure path tests)
- `.ultra/projects/go-todo/docs/TRD.md` — Error Handling section: `fmt.Errorf("list tasks: %w", err)`, exit codes 0/1/2
- `.ultra/system/contracts/core/architecture.md` — ARCH-CORE-002 (dependency direction) error wrapping in Go idiom
- `.ultra/system/contracts/core/testing.md` — TEST-FAIL-001 (failure paths must be tested explicitly)
