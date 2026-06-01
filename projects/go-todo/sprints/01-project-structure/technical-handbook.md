# Sprint Technical Handbook: 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Source: `sprint-index.md`
> **Inputs Used:** `.ultra/projects/go-todo/sprints/01-project-structure/sprint-index.md`, `.ultra/studies/go-cli-study/reports/final/01-project-structure.md`, `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md`

This handbook distills the studies and reports selected by `sprint-index.md` for sprint reasoning. It does not decide architecture or implementation.

## Selected Studies And Reports

| Study / Report | Path | Relevant Finding | Confidence |
| --- | --- | --- | --- |
| `go-cli-study` / `01-project-structure` | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | All 14 application repos use a thin CLI entry point that delegates to business logic; `cmd/` + `internal/` is the dominant pattern for pure CLI apps; `internal/` provides Go-enforced encapsulation | high |
| `go-cli-study` / `01-project-structure` | same | chezmoi's `main.go:26-34` (34 lines), gh-cli's `cmd/gh/main.go:6` (12 lines), fzf's `main.go:1-104` — thin entry point pattern is universal across size and age | high |
| `go-cli-study` / `01-project-structure` | same | chezmoi, k9s, restic demonstrate strict unidirectional import flow: `cmd/` → `internal/`, never reverse. chezmoi's `internal/chezmoi/chezmoi.go:1-2` verified to have zero `internal/cmd` imports. | high |
| `go-cli-study` / `01-project-structure` | same | restic (`internal/restic/repository.go:18` defines `Repository` interface; `internal/repository/repository.go:1` implements) shows domain interface/implementation split — relevant when `Store` interface is introduced in Sprint 02. | medium |

## Relevant Patterns

- **Thin CLI Entry Point (Pattern 1):** All 14 application repos in the study demonstrate this. Entry points do only: flag parsing, dependency construction, and delegation. chezmoi's `main.go:26-34` is 34 lines; gh-cli's `cmd/gh/main.go:6` is 12 lines; fzf's `main.go:1-104` handles option parsing, shell script printing, and man page display — no business logic. This pattern directly supports Sprint 01 AC-5 (cmd/todo/main.go under 50 lines, no business logic).

- **`internal/` Package Protection (Pattern 2):** The dominant approach for pure CLI applications. chezmoi (`internal/chezmoi/chezmoi.go:1-2`), k9s (`internal/view/`, `internal/dao/`), restic (`internal/restic/`), opencode (`internal/app/`, `internal/llm/`) all use `internal/` for private business logic. Go's compiler prevents modules outside the project from importing these packages. This pattern directly validates the Sprint 01 directory layout of `internal/{model,store,config}/`.

- **Unidirectional Dependency Flow (Pattern 4):** Imports must flow CLI → business logic, never reverse. chezmoi: verified `internal/chezmoi` has zero imports from `internal/cmd`. yq: `cmd/` imports `pkg/yqlib/`; `pkg/yqlib/` never imports `cmd/`. helm: `pkg/cmd/` imports `pkg/action/`; never reverse. This must be enforced for Sprint 01: `cmd/todo/main.go` may import `internal/` packages; `internal/` packages must never import `cmd/`.

- **Domain Interface/Implementation Split (Pattern 7):** restic defines `Repository` interface in `internal/restic/repository.go:18`, implements in `internal/repository/repository.go:1`. The interface package has zero implementation dependencies. Relevant for Sprint 02 when `Store` interface is introduced — but the structure chosen now (`internal/store/`) should accommodate adding an interface later without restructuring.

- **Command-per-File Organization (Pattern 5):** chezmoi (`addcmd.go`, `applycmd.go` in `internal/cmd/`), gh-cli (`pkg/cmd/issue/list/`), helm (`pkg/cmd/install.go`, `pkg/cmd/upgrade.go`). Not directly applicable to Sprint 01 (no commands yet), but the `internal/store/` package layout should anticipate multiple files per concern.

## Trade-Offs

| Trade-Off | Benefit | Cost | When It Matters |
| --- | --- | --- | --- |
| `internal/` for business logic vs flat/no-boundary layout | Go-enforced encapsulation; blocks external import; enables confident refactoring (evidence: chezmoi, k9s, restic, opencode) | Cannot be imported by external test packages; requires `internal/` directory at module root (evidence: lazygit avoids `internal/` for this reason — `main.go:23` + `pkg/` only) | Sprint 01 directory layout decision. The project is a pure CLI app with no public library intent, so `internal/` benefit outweighs cost. |
| `cmd/todo/main.go` vs root `main.go` | `cmd/` style scales to multi-binary; explicit discoverable entry points (evidence: helm has `cmd/helm/` + `cmd/gen-docs/`; chezmoi, gh-cli, k9s all use `cmd/`) | Additional directory indirection for a single binary (evidence: fzf, lazygit, yq use root `main.go` for single binaries) | Sprint 01 entry point location. The requirements specify `cmd/todo/main.go` explicitly, aligning with the dominant pattern for CLIs that may grow. |
| Define `Store` interface now vs defer to Sprint 02 | Deferring keeps Sprint 01 focused; avoids premature abstraction (evidence: restic's pattern of defining interface in one package, implementing in another creates clear seam) | Subsequent sprint must restructure `internal/store/` or add an interface layer; atomic write details may need refactoring | Sprint 01 non-goals explicitly state no `Store` interface. The evidence supports deferring — but the store's concrete API should be designed with an eye toward extractability. |

## Anti-Patterns And Warnings

- **Large entry point files:** chezmoi's `internal/cmd/config.go:1` is 3425 lines — a known concern in the study. Sprint 01 AC-5 enforces `cmd/todo/main.go` under 50 lines. If the entry point starts growing beyond that, extract flag wiring or app construction to a helper package immediately.

- **Bidirectional/reverse imports:** If `internal/store/` or `internal/model/` ever imports `cmd/todo/`, the dependency direction is violated. chezmoi's `internal/chezmoi/chezmoi.go:1-2` was verified to have zero reverse imports; k9s's `cmd/root.go:112-127` delegates to `internal/view/` but never the reverse. Verify with `go list -m` or import-cycle checks in CI.

- **Monolithic internal packages:** k9s's `internal/view/` has ~90 files; fzf's `src/terminal.go` has 8209 lines; opencode's `internal/config/config.go:1` has 980 lines. For Sprint 01, each `internal/` subdirectory should start focused: one concern per file, split before reaching 500 lines.

- **Global state without explicit initialization order:** rclone's `fs.GetConfig(ctx)`, yq's `pkg/yqlib/lib.go:13-21` global `ExpressionParser`, and opencode's `internal/config/config.go` package-level vars create hidden coupling and test isolation failures. For Sprint 01's `internal/store/jsonstore.go`, avoid package-level state — pass dependencies explicitly or use constructor functions.

## Examples Worth Inspecting

| Example | Path / Source | Why It Is Useful |
| --- | --- | --- |
| chezmoi `main.go` | `main.go:26-34` (chezmoi repo) | Archetype of a thin entry point — 34 lines, only flag parsing and delegation. Direct model for `cmd/todo/main.go`. |
| gh-cli `cmd/gh/main.go` | `cmd/gh/main.go:6` (gh-cli repo) | 12-line entry point — the thinnest in the study. Shows how little logic belongs in the CLI layer. |
| restic domain interface split | `internal/restic/repository.go:18` defines interface; `internal/repository/repository.go:1` implements (restic repo) | Demonstrates how to define an interface in one package and implement in another without coupling. Relevant model for future `Store` interface. |

## Design Pressures

- **AC-5 enforces < 50 lines for `cmd/todo/main.go`** — the entry point must be strictly delegation-only. Any flag parsing beyond basic setup or business logic must live elsewhere.
- **AC-6 requires atomic write pattern** (temp file + `os.Rename`) in `internal/store/` — the evidence report does not cover this pattern directly; the implementation must be grounded in Go stdlib, not study evidence.
- **AC-7 requires `fmt.Errorf("context: %w", err)`** — all store errors must wrap. The study does not cover error handling; this is a separate concern driven by contracts and requirements.
- **No `Store` interface** — the concrete store struct in `internal/store/jsonstore.go` will need to be refactored or interfaced in Sprint 02. The constructor and method signatures should be designed with future extraction in mind.
- **`internal/config/paths.go` is a stub** — XDG config resolution is deferred to Sprint 03. Do not introduce config parsing or path resolution logic beyond a hardcoded placeholder.

## Open Questions For Reasoning

1. Should `internal/store/jsonstore.go` use a constructor function (e.g., `NewJSONStore(path string)`) or export the struct directly? The evidence shows constructors are preferred (mitchellh-cli's `NewCLI()` at `cli.go:152`, gdu's `app.NewUI()` at `cmd/gdu/app/app.go:30-49`), but the template does not mandate it.

2. What concrete error types/sentinels should `internal/store/` define before the Sprint 02 interface extraction? The requirements demand `fmt.Errorf` wrapping with context — should sentinel errors (e.g., `var ErrTaskNotFound = errors.New("task not found")`) live in `internal/store/` now or in a shared `internal/model/` package?

3. Should `internal/model/task.go` define only types, or also include validation and serialization methods? The sprint scope includes JSON tags and enum definitions; validation logic may belong here or in `internal/store/`.

4. Given that no `Store` interface exists yet, how should `cmd/todo/main.go` reference the store? Direct struct dependency, or an adapter layer? The thin entry point pattern suggests direct struct usage is acceptable for Sprint 01, with the interface extracted in Sprint 02.

## Evidence Pointers

- `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` — Pattern Catalog section (lines 116–186): the four directly relevant patterns (thin entry point, `internal/` protection, unidirectional flow, domain interface split) and their evidence citations.
- `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` — Tradeoffs table (lines 270–278): benefit/cost analysis for `internal/` vs `pkg/`, thin CLI vs root `main.go`, domain-named package vs generic internal.
- `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` — Anti-Patterns section (lines 340–352): large entry points, bidirectional imports, monolithic packages, global state risks.
- `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` — Practical Tips (lines 324–339): guidelines on keeping `cmd/*/main.go` under 50 lines, using `internal/` for private code, naming packages meaningfully, keeping interfaces in the business logic layer.

## Handoff To Reasoning

- Use this handbook as evidence input.
- Validate whether the observed patterns fit this project's constraints.
- Do not copy external patterns without sprint-specific reasoning.
