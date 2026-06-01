# Sprint Index: 01 — Project Structure

> Project: `go-todo`
> Sprint: `01-project-structure`
> Purpose: selected context for this sprint. Must be a subset of `.ultra/projects/go-todo/project-index.md`.
> **Inputs Used:** `.ultra/projects/go-todo/project-index.md` (updated), `.ultra/projects/go-todo/sprints/01-project-structure/requirements.md`, `.ultra/projects/go-todo/docs/PRD.md`, `.ultra/projects/go-todo/docs/TRD.md`

This document selects what must be read, distilled, reasoned through, or checked for this sprint. It does not make implementation decisions. All selections must come from the project index — no items may be included that are not listed in the project index.

## Sprint Scope

- **Sprint Goal:** Scaffold the `go-todo` Go project: module definition, `cmd/internal/pkg` directory layout, core data model, and JSON file store with passing tests.
- **Planned Output:** `go.mod`, `cmd/todo/main.go`, `internal/model/task.go`, `internal/store/jsonstore.go` (+ `jsonstore_test.go`), `internal/config/paths.go`, sprint artifacts (`sprint-index.md`, `technical-handbook.md`, `reasoning/architecture.md`, `reasoning/errors.md`, `reasoning.md`, `plan.md`, `review.md`)
- **Depends On:** None — this is the first sprint.
- **Non-Goals:** No command implementations (`add`, `list`, `done`, `rm`); no `internal/app/` package; no shell completion; no output formatting beyond JSON; no priority/due-date flags; no XDG config resolution (deferred to Sprint 03); no `Store` interface (deferred to Sprint 02)

## Source Project Index

- `.ultra/projects/go-todo/project-index.md` — authoritative source. Any file or item referenced below must appear there.

## Selected Contracts

Each contract applies as a flat whole to this sprint. All paths must appear in the project index's "Active Contract Pool" table.

| Contract     | Why Selected                                 |
| ------------ | -------------------------------------------- |
| Architecture | Module boundaries, thin entrypoint, dependency direction, `internal/` package protection; ARCH-CORE-001/002, ARCH-ENTRY-001, ARCH-SHARED-001 are especially relevant to the directory layout and entry point deliverables. |
| Testing      | Required for `internal/store/jsonstore_test.go`; TEST-SEAM-001, TEST-UNIT-001, TEST-INT-001 apply to store CRUD tests and atomic write verification. |

## Selected Evidence Reports

Copied from the project index's "Available Evidence Reports" table. These tell the technical handbook which reports to read — the project index is the authoritative source.

| Report      | Path                                                   | Covers                          |
| ----------- | ------------------------------------------------------ | ------------------------------- |
| `01-project-structure`  | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | `cmd/internal/pkg` layout, module boundaries, thin entrypoint, dependency direction |

## Selected Reasoning Templates

All paths must appear in the project index's "Available Reasoning Templates" table.

| Template     | Output Path                                                     | Why Selected |
| ------------ | -------------------------------------------------------------- | ------------ |
| Architecture | `.ultra/projects/go-todo/sprints/01-project-structure/reasoning/architecture.md` | Module boundaries, dependency direction, entry point shape, package layout — directly informs the sprint's directory structure and module decisions. |
| Error Handling | `.ultra/projects/go-todo/sprints/01-project-structure/reasoning/errors.md` | Error wrapping standard, sentinel errors, propagation pattern, failure path testing per requirements AC-6, AC-7, AC-8. |

## Prior Decisions To Carry Forward

All decision paths must appear in the project index's "Prior Decisions" table.

| Decision     | Path     | Constraint For This Sprint |
| ------------ | -------- | -------------------------- |
| None         | —        | No prior decisions exist; this is the first sprint. |

## Required Review Protocols

All paths must appear in the project index's "Review Protocols" table.

| Protocol         | Path                                    | Required Evidence |
| ---------------- | --------------------------------------- | ----------------- |
| Architecture Review | `.ultra/system/protocols/architecture-review-protocol.md` | Directory layout follows `cmd/internal/pkg`, thin entrypoint under 50 lines, no reverse imports across `internal/` boundary. |
| Sprint Review    | `.ultra/system/protocols/sprint-review-protocol.md` | All acceptance criteria met, all outputs produced, evidence reports read. |

## Excluded Context

| Context     | Reason Excluded | Revisit If    |
| ----------- | --------------- | ------------- |
| CLI Surface contract | Sprint 02+ per project index selection notes | Sprint 02 command implementation |
| `02-command-architecture` evidence report | Sprint 02 deliverable | Sprint 02 |
| `03-configuration-management` evidence report | Sprint 03 deliverable | Sprint 03 |
| `04-testing-strategy` evidence report | Sprint 04 deliverable | Sprint 04 |
| ~~Errors reasoning template (`errors_reasoning_template.md`)~~ | ~~Not listed in the project index — excluded~~ | Resolved — added to project index and selected in Selected Reasoning Templates |
| Persistence, CLI Design, Performance, Observability reasoning templates | Deferred status in project index; not needed for Sprint 01 | When their status changes to Current |
| XDG config resolution | Deferred to Sprint 03 per requirements non-goals | Sprint 03 |
| `Store` interface | Deferred to Sprint 02 per requirements non-goals | Sprint 02 |

## Next Artifacts

- `technical-handbook.md` reads from the evidence reports listed above.
- `reasoning/architecture.md` captures Architecture area reasoning.
- `reasoning/errors.md` captures Error Handling area reasoning.
- `reasoning.md` makes final sprint decisions.
- `plan.md` executes `reasoning.md`.
- `review.md` runs the selected review protocols against implementation.
