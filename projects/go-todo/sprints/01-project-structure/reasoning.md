# Sprint Reasoning: 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Output: `.ultra/projects/go-todo/sprints/01-project-structure/reasoning.md`
> **Inputs Used:** `.ultra/projects/go-todo/project-index.md`, `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md`, `.ultra/projects/go-todo/docs/PRD.md`, `.ultra/projects/go-todo/docs/TRD.md`, `.ultra/projects/go-todo/sprints/01-project-structure/sprint-index.md`, `.ultra/projects/go-todo/sprints/01-project-structure/technical-handbook.md`, `.ultra/projects/go-todo/sprints/01-project-structure/reasoning/architecture.md`, `.ultra/projects/go-todo/sprints/01-project-structure/reasoning/errors.md`, `.ultra/system/templates/sprint-reasoning.md`, `.ultra/system/contracts/core/architecture.md`, `.ultra/system/contracts/core/testing.md`

This document decides. It synthesizes selected context, handbook evidence, area-specific reasoning, and contracts into final sprint decisions.

It does not replace `sprint-index.md`, `technical-handbook.md`, or `reasoning/*.md`.

## Sprint Purpose

- **Goal:** Scaffold the `go-todo` Go project: module definition, `cmd/internal/pkg` directory layout, core data model (`Task`, `Priority`, `Status`), and JSON file store with atomic writes and passing tests.
- **Non-Goals:** No command implementations (`add`, `list`, `done`, `rm`); no `internal/app/` package; no shell completion; no output formatting beyond JSON; no priority/due-date flags; no XDG config resolution (deferred to Sprint 03); no `Store` interface (deferred to Sprint 02)
- **Depends On:** None — this is the first sprint.

## Selected Context And Pre-Reasoning Artifacts

| Artifact | Path | How It Was Used |
| --- | --- | --- |
| Sprint Index | `.ultra/projects/go-todo/sprints/01-project-structure/sprint-index.md` | Selected contracts (Architecture, Testing), evidence report (`01-project-structure`), reasoning template (Architecture), excluded context, review protocols |
| Technical Handbook | `.ultra/projects/go-todo/sprints/01-project-structure/technical-handbook.md` | Evidence: thin entry point pattern (14/14 repos), `internal/` protection pattern, unidirectional dependency flow, domain interface split trade-off, anti-pattern warnings (large entry points, reverse imports, global state) |
| Architecture Contract | `.ultra/system/contracts/core/architecture.md` | ARCH-CORE-001 (module boundaries), ARCH-CORE-002 (inward dependency), ARCH-ENTRY-001 (thin transport), ARCH-SHARED-001 (domain-neutral shared) |
| Testing Contract | `.ultra/system/contracts/core/testing.md` | TEST-SEAM-001 (replaceable collaborators), TEST-UNIT-001, TEST-INT-001, TEST-FAIL-001, TEST-DET-001 |

## Area-Specific Reasoning Inputs

Both area reasoning documents were created for this sprint. Architecture reasoning covers module layout, entry point shape, dependency direction, and `internal/` package protection. Error handling reasoning covers error taxonomy, wrapping standard, sentinel errors, and failure path testing.

| Area | Reasoning Document | Key Conclusion | Evidence Basis | Impact On Final Decision |
| --- | --- | --- | --- | --- |
| Architecture | `reasoning/architecture.md` | Use `cmd/` + `internal/` layout (no `pkg/` in Sprint 01); thin entry point under 50 lines; unidirectional imports (`cmd/` → `internal/`, never reverse); defer `Store` interface and `pkg/` to later sprints. | Handbook patterns 1, 2, 4, 7; trade-offs (internal/ vs flat, cmd/ vs root main.go, Store interface now vs defer); anti-patterns (large entry points, bidirectional imports, global state); ARCH-CORE-001/002, ARCH-ENTRY-001, ARCH-SHARED-001 | Architecture conclusions embedded in Final Decisions 1, 2, 4, 5. |
| Error Handling | `reasoning/errors.md` | Hybrid error strategy: sentinel errors for domain failures (`ErrTaskNotFound`, `ErrTaskIDEmpty`), wrapped stdlib errors for I/O failures. `fmt.Errorf("context: %w", err)` at every store method boundary. No third-party error libs, no panics, no custom error types. | Requirements AC-6 (atomic write), AC-7 (error wrapping), AC-8 (failure path tests); TRD error handling section; ARCH-CORE-002; TEST-FAIL-001 | Error handling conclusions embedded in Final Decision 3. |

## Sprint Technical Handbook Summary

- **Relevant Patterns:** Thin CLI entry point (Pattern 1 — 14/14 repos, supports AC-5 under 50 lines); `internal/` package protection (Pattern 2 — chezmoi, k9s, restic, opencode evidence supports `internal/{model,store,config}/`); unidirectional dependency flow (Pattern 4 — cmd → internal, never reverse); domain interface/implementation split (Pattern 7 — restic pattern, relevant for Sprint 02 Store interface, but current concrete store should anticipate extraction)
- **Important Trade-Offs:** `internal/` vs flat layout — benefit of Go-enforced encapsulation outweighs cost (no external import) for pure CLI app; `cmd/todo/main.go` vs root `main.go` — cmd/ scales to multi-binary, dominant pattern; defer Store interface — keeps Sprint 01 focused, but concrete API must design with extractability in mind
- **Warnings / Anti-Patterns:** Large entry points (chezmoi `config.go:1` at 3425 lines — AC-5 enforces < 50); bidirectional/reverse imports (verify with import-cycle checks in CI); monolithic internal packages (k9s `internal/view/` ~90 files — split before 500 lines per file); global state (rclone `fs.GetConfig`, yq global `ExpressionParser` — avoid, use constructor injection)
- **Evidence Confidence:** High — patterns from 14 real Go CLI repos with line-number source citations; trade-offs grounded in studied project differences

## Contracts Applied

| Contract / Requirement ID | Constraint | Decision Impact | Expected Evidence |
| --- | --- | --- | --- |
| ARCH-CORE-001 | Module boundaries must remain explicit | Directs `internal/{model,store,config}/` split — each package is a distinct concern with focused public API | Code review confirms each package has single concern |
| ARCH-CORE-002 | Dependency direction must point inward | `cmd/todo/main.go` may import `internal/` packages; `internal/` packages must never import `cmd/` or each other in cycles | `go vet ./...` passes; no reverse import in code review |
| ARCH-ENTRY-001 | Transport adapters must stay thin | `cmd/todo/main.go` under 50 lines, no business logic — only flag parsing, dependency construction, delegation | `wc -l cmd/todo/main.go` < 50; no business logic by code review |
| ARCH-SHARED-001 | Shared and platform code must stay domain-neutral | `internal/model/` defines pure data types with no store/command coupling; `internal/config/` has no business behavior | Code review confirms no business logic in shared packages |
| TEST-SEAM-001 | Collaborators must be replaceable through public seams | `NewJSONStore(path)` constructor injection makes file path a replaceable seam | Store tests use temp dirs instead of real config path |
| TEST-UNIT-001 | Business logic must have unit coverage | Model tests for enum values, zero values, JSON tags | `go test -v ./internal/model/` |
| TEST-INT-001 | Persistence changes must have integration coverage | Store CRUD tests with real temp files — not mocks | `go test -v ./internal/store/` |
| TEST-FAIL-001 | Failure paths must be tested explicitly | At least 3 store failure paths (e.g., missing file, corrupt JSON, write-permission denied) | `go test -v ./internal/store/` covers negative cases |
| TEST-DET-001 | Tests must remain deterministic | Store tests use isolated temp dirs per test; no shared state | `go test -count=100 ./...` all pass |
| AC-1 through AC-10 | Sprint acceptance criteria | All decisions below are designed to satisfy specific ACs | Per-AC verification commands listed in requirements |

## Final Decisions

### Decision 1: Module Directory Layout

- **Decision:** Use `cmd/todo/main.go` for the entry point and `internal/{model,store,config}/` for private business logic packages. No `pkg/` directory yet (deferred to Sprint 03 if output formatting warrants it). No `internal/app/` package (deferred to Sprint 02). Module path: `github.com/antonioborgerees/go-todo`.
- **Rationale:** `cmd/` + `internal/` is the dominant pattern across all 14 studied Go CLI repos (technical handbook Pattern 2 — chezmoi, k9s, restic, opencode). Go's compiler enforces the `internal/` boundary, preventing external import and enabling confident refactoring. The `cmd/` directory scales to multi-binary (helms's `cmd/helm/` + `cmd/gen-docs/`). One concern per `internal/` subdirectory follows the bounded-context principle from ARCH-CORE-001 and prevents monolithic packages (anti-pattern warning: k9s `internal/view/` at ~90 files). Module path matches the GitHub repository convention established in the requirements.
- **Alternatives Rejected:**
  1. Flat layout with no `internal/` (lazygit uses `pkg/` only; fzf uses root `main.go` + `src/`) — rejected because this project is a pure CLI with no public library intent; `internal/` protection reduces maintenance burden as the codebase grows. Benefit (encapsulation) outweighs cost (no external import) per handbook trade-offs table.
  2. Root-level `main.go` without `cmd/` directory (fzf, lazygit, yq pattern for single-binary apps) — rejected because the PRD and TRD specify extensible architecture; `cmd/` is the standard for projects that may grow (helm, chezmoi, gh-cli, k9s all use `cmd/`). The cost of one extra directory level is negligible.
- **Contracts Satisfied:** ARCH-CORE-001 (module boundaries), ARCH-CORE-002 (dependency direction), ARCH-SHARED-001 (domain-neutral shared packages)
- **Evidence Required:** Directory listing confirms `cmd/todo/main.go`, `internal/model/`, `internal/store/`, `internal/config/` exist; `go vet ./...` passes with no import-cycle errors; code review confirms no package crosses concern boundaries

### Decision 2: Entry Point Shape And Responsibilities

- **Decision:** `cmd/todo/main.go` must be under 50 lines (AC-5). It performs only: (1) parse flags if needed, (2) construct dependencies (store, config path), (3) delegate to urfave-cli app. No business logic, no inline store operations, no file path resolution beyond calling `internal/config/paths.go`. Use urfave-cli v2 `app.Run(os.Args)` as the delegation target.
- **Rationale:** All 14 studied repos demonstrate thin entry points (Pattern 1). chezmoi's `main.go:26-34` is 34 lines; gh-cli's `cmd/gh/main.go:6` is 12 lines; fzf's `main.go:1-104` handles only option parsing and delegation. This satisfies ARCH-ENTRY-001 (transport adapters must stay thin). Keeping the entry point under 50 lines prevents the anti-pattern of large entry files (chezmoi's `internal/cmd/config.go:1` at 3425 lines). Since there are no commands yet in Sprint 01, `main.go` will essentially create the urfave-cli app with no subcommands registered and call `app.Run(os.Args)` — the app will exit with help text.
- **Alternatives Rejected:**
  1. Embedding command logic in `main.go` with inline switch/if-else — rejected because this violates ARCH-ENTRY-001, makes testing impossible (no seam), and would immediately break the 50-line limit.
  2. Using cobra instead of urfave-cli — rejected because requirements specify urfave-cli v2 dependency; the PRD's command surface matches urfave-cli conventions. The study's evidence includes urfave-cli patterns.
- **Contracts Satisfied:** ARCH-ENTRY-001 (thin transport), AC-5 (under 50 lines, no business logic)
- **Evidence Required:** `wc -l cmd/todo/main.go` output < 50; code review confirms no business logic (no store CRUD, no model manipulation); `go build ./...` succeeds; `go vet ./...` passes

### Decision 3: Store Design And Error Handling

- **Decision:** Implement `internal/store/jsonstore.go` with a concrete `JSONStore` struct, constructor `NewJSONStore(path string)`, and methods `Add(Task) (Task, error)`, `List() ([]Task, error)`, `Done(id string) (Task, error)`, `Remove(id string) error`. No `Store` interface (deferred to Sprint 02). Use atomic write pattern (temp file + `os.Rename`). All errors wrap with `fmt.Errorf("context: %w", err)` using standard library errors. Define sentinel errors in `internal/store/errors.go`: `var ErrTaskNotFound = errors.New("task not found")` and `var ErrTaskIDEmpty = errors.New("task ID cannot be empty")`.
- **Rationale:** Deferring the `Store` interface keeps Sprint 01 focused and avoids premature abstraction (Architecture contract principle #7: "Do not introduce ports... speculatively"). The constructor pattern follows the study evidence (mitchellh-cli `NewCLI()` at `cli.go:152`, gdu `app.NewUI()` at `cmd/gdu/app/app.go:30-49`) and satisfies TEST-SEAM-001 (file path is a public replaceable seam). Atomic writes are required by AC-6 and are standard Go practice (temp file in same directory + `os.Rename`). Error wrapping with `fmt.Errorf("%w")` satisfies AC-7 and uses stdlib only — no third-party error library needed. Sentinel errors are defined in `internal/store/` (not `internal/model/`) because they represent store-specific failure conditions; they are exported so callers in Sprint 02 can use `errors.Is()`. This satisfies TEST-FAIL-001 by making failure paths testable.
- **Alternatives Rejected:**
  1. Define `Store` interface now with `internal/store/store.go` — rejected because requirements non-goals explicitly state no `Store` interface in Sprint 01. Premature abstraction would create a seam with no concrete benefit until Sprint 02, violating contract principle #7.
  2. Use third-party error library (e.g., `cockroachdb/errors`, `pkg/errors`) — rejected because `fmt.Errorf` with `%w` (Go 1.13+) provides sufficient wrapping, unwrapping, and `errors.Is`/`errors.As` support. No additional dependency is justified for the error patterns required by Sprint 01.
  3. Return raw errors without wrapping — rejected because AC-7 explicitly requires `fmt.Errorf("context: %w", err)`. Unwrapped errors would fail acceptance criteria.
  4. Package-level global store variable — rejected because handbook anti-patterns document shows rclone, yq, and opencode's global state causes test isolation failures. Constructor injection ensures deterministic, isolated tests (TEST-DET-001).
- **Contracts Satisfied:** TEST-SEAM-001 (constructor injection), TEST-INT-001 (integration tests with temp files), TEST-FAIL-001 (failure path tests), TEST-DET-001 (isolated temp dirs per test), AC-6 (atomic write), AC-7 (error wrapping), AC-8 (CRUD + atomic write + 3 failure paths)
- **Evidence Required:** `go test -v ./internal/store/` shows CRUD tests, atomic write verification, and at least 3 failure path tests; code review confirms `os.Rename` pattern and `fmt.Errorf("...%w", err)` usage; `go test -count=100 ./internal/store/` passes

### Decision 4: Model Package Design

- **Decision:** `internal/model/task.go` defines `Priority` (int: Low=0, Medium=1, High=2), `Status` (int: Pending=0, Done=1), and `Task` struct with JSON tags matching the TRD schema. No validation methods, no serialization logic, no `String()` methods beyond what Go generates. Task ID is a `string` field (not `int`) to allow flexible ID strategies in Sprint 02 (e.g., UUID, nanoid, or incremental). Zero-value `Task{}` is valid (Pending + Low priority).
- **Rationale:** The model package is a pure data definition — it has no behavior, no dependencies, no side effects. This satisfies ARCH-SHARED-001 (domain-neutral). Keeping it simple prevents scope creep into validation or serialization concerns that belong in `internal/store/` (serialization) or `internal/app/` Sprint 02 (validation). The `ID` field as `string` anticipates the ID-generation strategy to be chosen in Sprint 02 without requiring a model change. Enum values start at 0 so zero-value initialization (Go default) maps to sensible defaults (Pending + Low).
- **Alternatives Rejected:**
  1. Include validation methods (`Validate() error`) on Task — rejected because validation rules depend on the command context (e.g., `add` requires non-empty text; `done` needs valid ID). Placing validation on the model would create coupling between data representation and business rules. Validation belongs at the store or app boundary.
  2. Include custom JSON marshal/unmarshal methods — rejected because default `encoding/json` handles all fields with JSON tags. Custom marshaling is not needed until Sprint 03 (due date formatting) and would introduce unnecessary complexity now.
  3. Use `int` ID instead of `string` — rejected because the TRD defines `ID` as `string`. An incrementing int ID would require stateful ID generation in the store, coupling ID strategy to persistence. String IDs allow Sprint 02 to choose UUID, nanoid, or other strategies without store refactoring.
- **Contracts Satisfied:** ARCH-SHARED-001 (domain-neutral), AC-9 (model tests for enums, zero-value, JSON tags)
- **Evidence Required:** `go test -v ./internal/model/` passes (enum values, zero-value initialization, JSON round-trip); code review confirms no validation or serialization logic in model package

### Decision 5: Config Path Stub

- **Decision:** `internal/config/paths.go` exports a single function `ConfigDir() string` that returns a hardcoded placeholder path (e.g., `filepath.Join(os.Getenv("HOME"), ".config", "go-todo")`). No XDG resolution, no config parsing, no directory creation logic. The function is called by `cmd/todo/main.go` to construct the store path. Directory creation (if not exists) happens in `internal/store/jsonstore.go` on first write.
- **Rationale:** Requirements non-goals explicitly state "No XDG config resolution (deferred to Sprint 03)". A hardcoded placeholder satisfies the need for a config path source without committing to the XDG resolution strategy. The stub is minimal and can be replaced entirely in Sprint 03 without changing callers (same function signature). Moving directory creation to the store keeps the config package focused on path resolution only. The `ConfigDir()` function signature (`func ConfigDir() string`) is designed to be replaced with XDG-aware logic in Sprint 03 without refactoring callers.
- **Alternatives Rejected:**
  1. Implement full XDG resolution now using `os.UserConfigDir()` — rejected because this is explicitly deferred to Sprint 03 per requirements non-goals. Pre-implementing would create a config resolution design that might need rework.
  2. Hardcode config path directly in `main.go` — rejected because config path resolution belongs in `internal/config/paths.go` per the directory layout decision (Architecture contract — bounded context). Embedding path logic in the entry point would violate ARCH-ENTRY-001 (transport knows too much).
  3. Use environment variable (`$GO_TODO_CONFIG`) — rejected because the PRD specifies XDG standard paths. Environment variables would add a non-standard configuration mechanism that needs removal in Sprint 03.
- **Contracts Satisfied:** ARCH-SHARED-001 (config is domain-neutral), ARCH-CORE-001 (config concern in its own package)
- **Evidence Required:** Code review confirms `ConfigDir()` returns a hardcoded path; `go build ./...` succeeds; no XDG or config parsing imports in `internal/config/`

### Decision 6: Testing Strategy

- **Decision:** Three test levels: (1) **Model unit tests** in `internal/model/task_test.go` — test enum values, zero-value behavior, JSON serialization round-trip (AC-9); (2) **Store integration tests** in `internal/store/jsonstore_test.go` — CRUD operations, atomic write verify (write file, stat temp+final), at least 3 failure paths (missing file, corrupt JSON, permission denied), determinism with isolated temp dirs (AC-6, AC-8, AC-10); (3) **Build/static analysis** — `go build ./...`, `go test ./...`, `go vet ./...`, `go test -count=100 ./...` (AC-1, AC-2, AC-3, AC-10). Use `testing` stdlib only (no testify in Sprint 01 — deferred to Sprint 02 or 04).
- **Rationale:** Model tests are pure unit tests with no dependencies (TEST-UNIT-001). Store tests are integration tests using real temp files (TEST-INT-001) — the constructor `NewJSONStore(path)` receives a temp path, making filesystem interaction explicit and non-global. Failure path tests satisfy TEST-FAIL-001 (at least 3 negative cases). Determinism (TEST-DET-001) is achieved by isolating each test with its own temp directory. Using stdlib `testing` only avoids introducing a test dependency (testify) before Sprint 02 when assertion patterns can be evaluated against the study evidence.
- **Alternatives Rejected:**
  1. Use testify/require for assertions in Sprint 01 — rejected because the testing strategy is deferred to Sprint 04; adding testify now would introduce a dependency before the project's testing conventions are established. Stdlib `testing` with `t.Fatalf`/`t.Errorf` is sufficient for Sprint 01.
  2. Use table-driven tests for store CRUD — accepted as partial approach (table-driven for CRUD happy paths is structurally appropriate), but each failure path needs explicit test functions for clarity (per TEST-FAIL-001).
  3. Mock the filesystem for store tests — rejected because TEST-INT-001 requires testing against real persistence; temp files are the correct approach. Mocking the filesystem would test the mock, not the atomic write pattern.
- **Contracts Satisfied:** TEST-UNIT-001 (model tests), TEST-INT-001 (store integration tests), TEST-FAIL-001 (failure paths), TEST-DET-001 (deterministic tests), AC-8 through AC-10
- **Evidence Required:** `go test -v ./internal/model/` passes; `go test -v ./internal/store/` shows CRUD, atomic write verify, and 3+ failure paths; `go test -count=100 ./...` passes; `go vet ./...` passes; `go build ./...` passes

## Expected Evidence

| Evidence Type | Required Evidence | Source / Command / Review Check |
| --- | --- | --- |
| Tests | `go build ./...` exits 0 | `go build ./...` |
| Tests | `go test ./...` all pass | `go test ./...` |
| Tests | `go vet ./...` no warnings | `go vet ./...` |
| Tests | Store CRUD + atomic write + 3 failure paths | `go test -v ./internal/store/` |
| Tests | Model enum values, zero-value, JSON tags | `go test -v ./internal/model/` |
| Tests | Deterministic — 100 runs all pass | `go test -count=100 ./...` |
| Review | `cmd/todo/main.go` under 50 lines | `wc -l cmd/todo/main.go` |
| Review | `cmd/todo/main.go` has no business logic | Code review — only flag parsing, dependency construction, delegation |
| Review | Directory layout: `cmd/todo/main.go` + `internal/{model,store,config}/` | `ls -R` directory listing |
| Review | Atomic write: temp file + os.Rename | Code review of `internal/store/jsonstore.go` |
| Review | Error wrapping: `fmt.Errorf("context: %w", err)` | Code review of all store methods |
| Review | No reverse imports across `internal/` boundary | Import statement review + `go vet` |
| Review | Architecure Review Protocol | `.ultra/system/protocols/architecture-review-protocol.md` |
| Documentation | Project index updated if new contracts or templates added | `.ultra/projects/go-todo/project-index.md` |

## Assumptions And Risks

| Item | Type | Impact | Mitigation / Follow-Up |
| --- | --- | --- | --- |
| Go module path `github.com/antonioborgerees/go-todo` is available and matches the repository URL | Assumption | Build failures if module path doesn't match import paths | Verify `go.mod` module path before committing; update if repository URL differs |
| urfave-cli v2 API is compatible with the thin entry point pattern (no mandatory subcommands) | Assumption | If urfave-cli requires at least one command to register, Sprint 01 app will fail to run | Test `go run cmd/todo/main.go` outputs help text without commands registered; add a dummy no-op command if required by urfave-cli v2 API |
| No `Store` interface now increases refactoring cost in Sprint 02 | Risk (medium) | Sprint 02 must restructure `internal/store/` to extract interface; constructors and callers change | Mitigate by designing `JSONStore` methods with clean signatures (`Add(Task) (Task, error)`, etc.) that are interface-extractable. Document the extraction path in sprint-index for Sprint 02 |
| Error Handling reasoning template `errors_reasoning_template.md` was added to project index during sprint reasoning | Resolved | Template added to project index, selected by sprint-index, and `reasoning/errors.md` created with full error handling decisions | Resolved |
| Architecture reasoning document (`reasoning/architecture.md`) was created during sprint reasoning | Resolved | Architecture reasoning captured in `reasoning/architecture.md` — reusable in future sprints | Resolved |
| Config path stub may need rework if XDG resolution reveals edge cases (e.g., Windows, macOS $HOME) | Risk (low) | Sprint 03 may need to change `ConfigDir()` signature or behavior if cross-platform XDG differs from assumptions | Keep `ConfigDir()` signature simple (`func ConfigDir() string`) so Sprint 03 can replace implementation without changing callers |

## Implementation Constraints

- `cmd/todo/main.go` must be under 50 lines and contain zero business logic — all domain work lives in `internal/` packages
- `internal/store/` must use atomic write: write to a temp file in the same directory, then `os.Rename()` — never write directly to the target path
- All store errors must wrap with `fmt.Errorf("context: %w", err)` — no raw `err` returns, no third-party error libraries
- No `Store` interface — use a concrete `JSONStore` struct; the constructor must accept the file path as a parameter (no global state)
- No XDG config resolution — `internal/config/paths.go` returns a hardcoded `~/.config/go-todo` path
- No test dependencies beyond stdlib `testing` — no testify, no mock libraries in Sprint 01
- Package `internal/` packages must never import `cmd/` — verify with `go vet` or manual import review
- Each `internal/` subdirectory must have a single, focused concern: `model/` for types only, `store/` for persistence, `config/` for path resolution
- Store tests must use `os.MkdirTemp` to create isolated temp directories per test — no shared state between tests
- `go.mod` must use module path `github.com/antonioborgerees/go-todo` (not a vanity URL)

## Plan Handoff

`plan.md` must execute these decisions. It must not invent architecture, scope, or decisions beyond this document.

The plan must carry forward:

- final decisions (6 decisions above) with their rationale, rejected alternatives, and contracts
- applicable contracts and requirement IDs mapped per decision
- expected evidence per decision and aggregated in the evidence table
- risks and assumptions with mitigations
- required review protocols (Architecture Review + Sprint Review)

## Phase Exit Criteria

- [x] Selected context was read and used.
- [x] Area-specific reasoning documents were completed where applicable or explicitly marked not applicable.
- [x] Area-specific reasoning conclusions are reflected or explicitly overridden in final decisions.
- [x] Contracts are explicitly mapped to decisions and expected evidence.
- [x] Final decisions are clear enough for `plan.md` to execute.
- [x] Expected evidence is specific and reviewable.
