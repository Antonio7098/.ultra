# Project Index: agentwrap

> Project: `agentwrap`
> Purpose: available governance, evidence, and reasoning pool for agentwrap runtime SDK implementation.

This document defines what can be selected for project work. It does not decide what any individual sprint must use.

## Project Scope

- **Project Slug:** `agentwrap`
- **Repository:** `/home/antonioborgerees/coding/agentwrap`
- **Target Implementation Directory:** `/home/antonioborgerees/coding/agentwrap`
- **Primary Goal:** Build a runtime-neutral Go SDK for wrapping agent runtimes, starting with OpenCode, with explicit run/session lifecycle, structured events, validation, repair, observability, permissions, configuration health, and safe diagnostics.
- **Non-Goals:** Do not add UltraPlan-specific workflow semantics, product-specific report validation, hosted services, browser UI, or a prescribed persistence backend to the SDK.

## Source Documents

| Document | Path | Summary |
| --- | --- | --- |
| Product Requirements | `.ultra/projects/agentwrap/docs/PRD.md` | Product goals, runtime abstraction, validation, repair, observability, metadata, and output safety requirements. |
| Technical Requirements | `.ultra/projects/agentwrap/docs/TRD.md` | Go SDK architecture, runtime interface, lifecycle, validation/repair, error, metadata, persistence hook, permission, and security requirements. |
| Feature Architecture | `.ultra/projects/agentwrap/docs/feature-architecture.md` | State-first architecture guidance, runtime-first flow, explicit orchestration, and abstraction guardrails. |
| Roadmap | `.ultra/projects/agentwrap/roadmap.md` | Incremental sprint sequence and non-negotiable development rules. |
| Decision Log | `.ultra/projects/agentwrap/DECISIONS.md` | Accepted project decisions that constrain future sprint behavior. |

## Active Contract Pool

| Contract | Path | Applies To | Selection Notes |
| --- | --- | --- | --- |
| Architecture | `.ultra/system/contracts/core/architecture.md` | Public SDK packages, adapter packages, package boundaries | Select for public API, package layout, and dependency direction changes. |
| Errors | `.ultra/system/contracts/core/errors.md` | SDK errors, adapter errors, validation/repair failures | Select for any classified error or diagnostics behavior. |
| Configuration | `.ultra/system/contracts/core/configuration.md` | Runtime configuration and health | Select for adapter configuration, environment, and preflight behavior. |
| Observability | `.ultra/system/contracts/core/observability.md` | Events, metadata, run records, diagnostics | Select for lifecycle events, validation/repair visibility, and persistence hooks. |
| Security | `.ultra/system/contracts/core/security.md` | Permissions, redaction, raw payload handling | Select for permission policy, sandbox behavior, diagnostic payloads, and secrets. |
| Testing | `.ultra/system/contracts/core/testing.md` | All implementation sprints | Select for fake runtime, fixtures, unit tests, and gated integration tests. |
| Documentation | `.ultra/system/contracts/core/documentation.md` | SDK docs and integration docs | Select when public behavior or integration guidance changes. |
| LLM Runtime | `.ultra/system/contracts/runtime/llm.md` | Runtime adapter behavior | Select for OpenCode or future runtime adapter work. |
| Persistence And Migrations | `.ultra/system/contracts/runtime/persistence-and-migrations.md` | Optional run stores and durable records | Select when changing run record storage, inspection, or migration behavior. |

## Available Studies

| Study | Path | Useful For | Status |
| --- | --- | --- | --- |
| `opencode-wrap-study` | `.ultra/studies/opencode-wrap-study/` | OpenCode process/session lifecycle, structured output, cancellation, validation, observability, permissions | Current |
| `go-cli-study` | `.ultra/studies/go-cli-study/` | Go package structure, dependency injection, IO abstraction, error handling, configuration, observability, testing, security | Current |

## Available Evidence Packs And Reports

| Evidence | Path | Summary | Use When |
| --- | --- | --- | --- |
| Runtime Contract | `.ultra/projects/agentwrap/reports/evidence/runtime-contract.md` | Runtime-neutral contract and adapter boundary findings. | Public SDK contract or adapter behavior changes. |
| Session Lifecycle | `.ultra/projects/agentwrap/reports/evidence/session-lifecycle.md` | Run/session lifecycle, cancellation, cleanup, retained sessions. | Lifecycle, cancellation, timeout, cleanup, or retained-session changes. |
| Resilience Policies | `.ultra/projects/agentwrap/reports/evidence/resilience-policies.md` | Retry/fallback/classification policy findings. | Policy engine or retry/fallback changes. |
| Validation Repair | `.ultra/projects/agentwrap/reports/evidence/validation-repair.md` | Validation, repair, bounded reprompt, failure context. | Validator, repair, diagnostic, or validation outcome changes. |
| Observability Metadata | `.ultra/projects/agentwrap/reports/evidence/observability-metadata.md` | Events, metadata, persistence, run inspection, safe raw payload policy. | Events, metadata, diagnostics, or run store changes. |
| Testing Strategy | `.ultra/projects/agentwrap/reports/evidence/testing-strategy.md` | Fake runtime, fixtures, deterministic tests, gated live runtime checks. | Any implementation sprint. |
| Permission Policy | `.ultra/projects/agentwrap/reports/permission-based-agent-wrapping.md` | Permission policy and approval mechanics. | Permission or sandbox behavior changes. |
| Architecture Reports | `.ultra/projects/agentwrap/reports/architecture-reports/` | Implemented architecture reviews for core runtime, resilience, validation, observability, OpenCode, health, and permissions. | Gap analysis or regression review. |

## Available Reasoning Templates

| Template | Path | Use When |
| --- | --- | --- |
| Architecture | `.ultra/system/reasoning/architecture_reasoning_template.md` | Package boundaries, dependency direction, adapter/root package ownership. |
| Error Handling | `.ultra/system/reasoning/errors_reasoning_template.md` | Error categories, wrapping, diagnostics, and failure propagation. |
| Testing Strategy | `.ultra/system/reasoning/testing-strategy-reasoning-template.md` | Test level selection, fixture strategy, fake runtime strategy, gated integrations. |
| Observability | `.ultra/system/reasoning/observability-reasoning-template.md` | Event, metadata, logging, run record, and diagnostic visibility changes. |
| Persistence | `.ultra/system/reasoning/persistence-reasoning-template.md` | Durable run records, store interfaces, and migration concerns. |

## Prior Decisions

| Decision | Path | Carry Forward When |
| --- | --- | --- |
| Project decisions | `.ultra/projects/agentwrap/DECISIONS.md` | Always check for compatibility before changing public SDK behavior, validation/repair, observability, persistence, permissions, health, or adapter behavior. |

## Review Protocols

| Protocol | Path | Required When |
| --- | --- | --- |
| Sprint Review | `.ultra/system/protocols/sprint-review-protocol.md` | Every completed or blocked sprint execution. |
| Architecture Review | `.ultra/system/protocols/architecture-review-protocol.md` | Public API, package boundary, adapter/root package, persistence, or orchestration changes. |

## Selection Rules

- Select contracts by changed surface, runtime impact, data sensitivity, and public API exposure.
- Select evidence packs before finalizing sprint reasoning; use full reports only when the compressed evidence does not answer a concrete decision.
- Select prior decisions that constrain compatibility, architecture, or operational behavior.
- Keep sprint-specific selections in `sprint-index.md`, not in this project index.

## Maintenance Notes

- Update this index when the project adopts new contracts, studies, evidence packs, reasoning templates, or review protocols.
- The target implementation directory is `/home/antonioborgerees/coding/agentwrap`; implementation files belong there, not in `.ultra/projects/agentwrap/sprints/`.
- Product-specific UltraPlan workflow logic remains outside the SDK.
