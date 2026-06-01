# Project Index: go-todo

> Project: `go-todo`
> Purpose: available governance, evidence, and reasoning pool for all go-todo sprints.

## Project Scope

- **Project Slug:** `go-todo`
- **Repository:** `.ultra/projects/go-todo/`
- **Target Implementation Directory:** `.ultra/projects/go-todo/`
- **Primary Goal:** A minimal, fast, composable todo-list CLI written in Go. Modeled on proven Go CLI patterns (cobra, urfave-cli, gh-cli) distilled from the go-cli-study evidence. Primary user is developers who live in the terminal.
- **Non-Goals:** No web UI or API, no sync/sharing between machines, no team features, no markdown/rich-text task content.

## Source Documents

| Document | Path | Summary |
|---|---|---|
| Product Requirements | `.ultra/projects/go-todo/docs/PRD.md` | Goals: add, list, done, rm tasks; JSON persistence in XDG config dir; shell completion; extensible architecture. |
| Technical Requirements | `.ultra/projects/go-todo/docs/TRD.md` | Architecture: cmd/internal/pkg layout; Task model (Priority, Status enums); urfave-cli command surface; atomic JSON writes; XDG config path. |
| Roadmap | `.ultra/projects/go-todo/roadmap.md` | Sprint 01 (project structure), 02 (command architecture), 03 (configuration), 04 (testing strategy). |

## Active Contract Pool

| Contract | Path | Applies To | Selection Notes |
|---|---|---|---|
| Architecture | `.ultra/system/contracts/core/architecture.md` | All sprints | ARCH-CORE-001/002 (module boundaries, inward dependency), ARCH-ENTRY-001 (thin transport), ARCH-SHARED-001 (domain-neutral shared) always apply. |
| Testing | `.ultra/system/contracts/core/testing.md` | All sprints | TEST-SEAM-001 (replaceable collaborators), TEST-UNIT-001, TEST-INT-001 (persistence integration). Select when implementing store, app, or commands. |
| CLI Surface | `.ultra/system/contracts/surfaces/cli.md` | Sprint 02+ | CLI-SHAPE-001, CLI-HELP-001, CLI-EXIT-001 for command implementation. Defer to sprint 02 unless explicitly needed. |

## Available Studies

| Study | Path | Useful For | Status |
|---|---|---|---|
| `go-cli-study` | `.ultra/studies/go-cli-study/` | Go CLI project structure, command architecture, testing, configuration management, error handling | Current |
| — Reports are at `.ultra/studies/go-cli-study/reports/final/` — |

## Available Evidence Reports

The go-cli-study has two report types:
- **Methodology docs** at `dimensions/` — describe what to study per dimension
- **Final reports** at `reports/final/` — actual findings with source citations (file paths + line numbers from real study repos)

Always read from `reports/final/` for evidence. The sources are at `sources/`.

| Report | Path | Covers | Sprint |
|---|---|---|---|
| `01-project-structure` | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | cmd/internal/pkg layout, module boundaries, thin entrypoint, dependency direction | 01 |
| `02-command-architecture` | `.ultra/studies/go-cli-study/reports/final/02-command-architecture.md` | Command routing, flag parsing, help text, shell completion | 02 |
| `03-configuration-management` | `.ultra/studies/go-cli-study/reports/final/03-configuration-management.md` | Config path resolution (XDG), priority/due-date handling, output formatting | 03 |
| `04-testing-strategy` | `.ultra/studies/go-cli-study/reports/final/11-testing-strategy.md` | Unit, integration, command-level testing patterns | 04 |

## Available Reasoning Templates

All entries must appear in the project index's "Available Reasoning Templates" table.

| Template | Path | Useful For | Status |
|---|---|---|---|---|
| Architecture | `.ultra/system/reasoning/architecture_reasoning_template.md` | Module boundaries, dependency direction, entry point shape, package layout | Current |
| Error Handling | `.ultra/system/reasoning/errors_reasoning_template.md` | Error wrapping, sentinel errors, propagation pattern, failure path testing | Current |
| Testing Strategy | `.ultra/system/reasoning/testing-strategy-reasoning-template.md` | Test levels, failure paths, seams, determinism, coverage strategy | Current |
| Persistence | `.ultra/system/reasoning/persistence-reasoning-template.md` | Data storage, serialization, atomic writes, migration | Deferred |
| CLI Design | `.ultra/system/reasoning/cli-design-reasoning-template.md` | Command routing, flag parsing, help text, shell completion | Deferred |
| Performance | `.ultra/system/reasoning/performance-reasoning-template.md` | Latency, throughput, resource usage | Deferred |
| Observability | `.ultra/system/reasoning/observability-reasoning-template.md` | Logging, tracing, error reporting | Deferred |

## Prior Decisions

None yet — this is the first sprint.

## Review Protocols

| Protocol | Path | Required When |
|---|---|---|
| Architecture Review | `.ultra/system/protocols/architecture-review-protocol.md` | Sprint 01 (verify layering, thin entrypoint, module boundaries) |
| Sprint Review | `.ultra/system/protocols/sprint-review-protocol.md` | Every sprint completion |

## Maintenance Notes

- Update this index when the project adopts new contracts, studies, evidence packs, reasoning templates, or review protocols.
- Do not duplicate sprint-specific selections here. Put sprint-specific selections in `sprint-index.md`.
- Dimension reports are the canonical source for study evidence. The technical handbook model reads dimension reports and extracts specific source citations — do not paste source paths into sprint index.
