# Sprint Reasoning: Validation and Diagnostics

> Project: `agentwrap`
> Sprint: `14-validation-and-diagnostics`
> Output: `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/reasoning.md`
> **Inputs Used:** `.ultra/projects/agentwrap/docs/PRD.md`, `.ultra/projects/agentwrap/docs/TRD.md`, `.ultra/projects/agentwrap/docs/feature-architecture.md`, `.ultra/projects/agentwrap/roadmap.md`, `.ultra/projects/agentwrap/DECISIONS.md`, `.ultra/projects/agentwrap/brief.md`, `.ultra/system/templates/sprint-reasoning.md`, `.ultra/system/templates/sprint-plan.md`
> **Required Inputs Missing:** `.ultra/projects/agentwrap/project-index.md`, `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/requirements.md`, `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/sprint-index.md`, `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/technical-handbook.md`, `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/reasoning/*.md`

This document decides only what can be decided from the available evidence. It does not invent Sprint 14 scope because the sprint-specific requirements, sprint index, technical handbook, and area reasoning are absent.

## Sprint Purpose

- **Goal:** Block implementation planning until Sprint 14 requirements and selected evidence exist; preserve a narrow candidate direction for validation-and-diagnostics work based only on project-level requirements and prior decisions.
- **Non-Goals:** Do not implement code, do not define a new diagnostics architecture, do not add workflow complexity, do not reopen prior accepted decisions without Sprint 14 evidence, and do not infer roadmap scope beyond the documented roadmap.
- **Depends On:** Prior implemented validation, repair, permission, resilience, lifecycle, and observability decisions recorded in `DECISIONS.md`; missing Sprint 14 requirements and evidence must be supplied before implementation can proceed.

## Selected Context And Pre-Reasoning Artifacts

| Artifact | Path | How It Was Used |
| --- | --- | --- |
| Sprint Requirements | `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/requirements.md` | Missing. Scope cannot be finalized. |
| Sprint Index | `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/sprint-index.md` | Missing. Selected context, review protocols, and evidence packs cannot be confirmed. |
| Technical Handbook | `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/technical-handbook.md` | Missing. No sprint-specific evidence confidence can be assigned. |
| Area Reasoning | `.ultra/projects/agentwrap/sprints/14-validation-and-diagnostics/reasoning/*.md` | Missing. No area-specific conclusions exist. |
| PRD | `.ultra/projects/agentwrap/docs/PRD.md` | Used for product-level requirements for output validation, explicit failures, diagnostics, metadata, and repair. |
| TRD | `.ultra/projects/agentwrap/docs/TRD.md` | Used for technical requirements for validation, repair, errors, observability, metadata, persistence hooks, and security. |
| Feature Architecture | `.ultra/projects/agentwrap/docs/feature-architecture.md` | Used as planning guardrail: state-first, runtime-first, minimal abstractions, explicit flow. |
| Roadmap | `.ultra/projects/agentwrap/roadmap.md` | Used to verify that Sprint 14 is not defined in the current roadmap and to avoid pulling undocumented scope forward. |
| Decision Log | `.ultra/projects/agentwrap/DECISIONS.md` | Used to carry forward accepted decisions through Sprint 9 and avoid conflicting with existing validation, repair, observability, and persistence choices. |
| Target Brief | `.ultra/projects/agentwrap/brief.md` | Used as compact target intent and boundary summary. |

## Area-Specific Reasoning Inputs

None selected - the sprint index and area reasoning directory for Sprint 14 are absent. Area-specific conclusions must be created after the Sprint 14 requirements identify concrete work areas.

## Sprint Technical Handbook Summary

- **Relevant Patterns:** No Sprint 14 handbook was available. Project-level guardrails still apply: runtime-first flow, explicit state ownership, no speculative abstractions, fake runtimes and fixtures before live runtime trust, runtime exit success is insufficient when validators are configured.
- **Important Trade-Offs:** Planning is intentionally blocked rather than inventing validation-diagnostics architecture. This delays implementation but preserves evidence discipline.
- **Warnings / Anti-Patterns:** Do not treat a broad phrase such as "validation and diagnostics" as sufficient scope. Do not add a diagnostics subsystem, persistence backend, CLI surface, or workflow layer without requirement and evidence pressure.
- **Evidence Confidence:** Low for Sprint 14-specific decisions because required sprint-specific evidence is missing; medium for general constraints because PRD, TRD, roadmap, brief, and decision log were available.

## Contracts Applied

| Contract / Requirement ID | Constraint | Decision Impact | Expected Evidence |
| --- | --- | --- | --- |
| PRD Output Validation | Callers can define success criteria beyond runtime exit status; validation failures must be explicit and repairable. | Sprint 14 may refine validation only if requirements name a gap not already covered by Sprint 8. | Tests for missing, malformed, empty, incomplete, or invalid artifacts; validation result events/metadata. |
| PRD Observability and Metadata | Runs expose status, timing, runtime, provider, model, attempts, warnings, errors, artifacts, and usage where available. | Diagnostics must build on existing observability records rather than duplicate adapter-local state. | Metadata completeness tests and event/run-record inspection. |
| PRD Output Safety | Large outputs should be durable artifacts; native/runtime output may be lossy or unsafe. | Diagnostics must avoid persisting unsafe raw payload bytes by default. | Redaction/omission tests and review of diagnostic payload safety. |
| TRD Output and Artifact Validation | Expected outputs may include files, directories, structured data, report sections, metadata fields, or caller-defined validators. | Any new validation work must be runtime-neutral and caller-defined where product-specific. | Validator tests and failure context assertions. |
| TRD Repair and Reprompt | Repair attempts must be bounded, visible, and preserve context where supported. | New diagnostics must not hide repair failures or bypass inherited permissions. | Repair metadata/event tests and permission-denial tests. |
| TRD Error Model | Errors must be explicit, classifiable, safe, and include diagnostic detail without leaking secrets. | Diagnostics should report facts through `SDKError`, events, and records rather than string parsing. | Error category/detail tests and secret-safety review. |
| TRD Persistence Requirements | Persistence is optional and backend-neutral. | Diagnostic history must use existing optional persistence hooks unless evidence justifies a new seam. | Store/inspector tests using memory store or caller-provided fake. |
| Roadmap Non-Negotiable Rules | Every sprint starts from PRD/TRD requirements and cites evidence packs. | Implementation planning remains blocked until Sprint 14 requirements and evidence packs exist. | Completed missing sprint inputs before code work starts. |

## Repos Studied / Source Evidence Used

| Source / Repo / Report | Concrete Reference | Relevant Finding | Why It Matters For This Sprint | Used In Decision(s) |
| --- | --- | --- | --- | --- |
| Project PRD | `.ultra/projects/agentwrap/docs/PRD.md` lines 57-60, 132-137, 144-161 | Validation, repair context, metadata, and output safety are product requirements. | Provides only broad requirement pressure, not Sprint 14 scope. | Decision 1, Decision 2 |
| Project TRD | `.ultra/projects/agentwrap/docs/TRD.md` lines 111-130, 156-220 | Validation, repair, observability, metadata, persistence, and errors have explicit technical constraints. | Defines constraints any future validation-diagnostics work must satisfy. | Decision 1, Decision 2, Decision 3 |
| Roadmap | `.ultra/projects/agentwrap/roadmap.md` lines 74-85, 421-532, 698-716 | Prior roadmap defines validation/repair as Sprint 8 and observability/metadata as Sprint 9; Sprint 14 is not defined. | Prevents inventing new Sprint 14 implementation scope. | Decision 1 |
| Decision Log | `.ultra/projects/agentwrap/DECISIONS.md` DEC-024 through DEC-030 | Validation wrapper, observable validation/repair phases, same-session repair defaults, observability wrapper, backend-neutral persistence, and unsafe raw payload omission are accepted decisions. | Any future diagnostics work must extend these choices rather than duplicate or contradict them. | Decision 2, Decision 3 |
| Feature Architecture | `.ultra/projects/agentwrap/docs/feature-architecture.md` lines 21-87, 167-259 | Identify state first, keep runtime orchestration explicit, avoid single-implementation abstractions and unnecessary files. | Guides future plan shape once requirements exist. | Decision 3 |

## Trade-Off And Debt Analysis

### Accepted Trade-Offs

| Trade-Off | Benefit | Cost / Constraint Accepted | Why Acceptable Now | Revisit Trigger |
| --- | --- | --- | --- | --- |
| Block implementation planning until missing inputs exist. | Avoids ungrounded scope and architecture. | No implementable Sprint 14 task list yet. | Required sprint-specific evidence is absent. | `requirements.md`, `sprint-index.md`, and `technical-handbook.md` are created. |
| Treat project-level docs as constraints, not sprint scope. | Preserves auditability and roadmap discipline. | Plan remains conservative and may feel incomplete. | Sprint 14 requirements name concrete validation or diagnostics gaps. |
| Carry forward prior decisions rather than reopen them. | Avoids duplicate validation/observability systems. | Some desired diagnostics changes may need explicit change requests. | Sprint 14 evidence shows a prior decision is insufficient or wrong. |

### Potential Technical Debt

| Debt / Shortcut | Why It Might Accrue | Current Mitigation | Owner / Follow-Up |
| --- | --- | --- | --- |
| Placeholder Sprint 14 artifacts may be mistaken for implementable scope. | They contain candidate constraints but no final task decisions. | Mark status as blocked and require missing inputs before implementation. | Sprint planner must replace or update after requirements are supplied. |
| Diagnostics scope may overlap existing observability/persistence models. | The phrase "diagnostics" is broad and could duplicate `RunRecord`, events, or errors. | Require explicit gap analysis against DEC-024 through DEC-030. | Sprint 14 requirements author and implementer. |
| Product-specific validation could leak into SDK validators. | Report-section or artifact expectations may be UltraPlan-specific. | Keep product-specific checks as caller-defined validators unless requirements justify SDK-level generic behavior. | Future Sprint 14 reasoning after requirements exist. |

### Future Considerations

| Consideration | Deferred Until | Reason Deferred | What Should Be Preserved Now |
| --- | --- | --- | --- |
| Diagnostics bundle/export format | Sprint 14 requirements identify a caller need. | No requirement currently asks for a bundle, schema, or file format. | Existing event, metadata, error, and run-record facts. |
| Additional built-in validators | Requirements identify common generic validators not already covered by Sprint 8. | Existing decision log says built-ins are generic and product-specific semantics stay caller-defined. | Validator extension seam and explicit failure context. |
| OpenCode live evidence for diagnostics | Requirements identify runtime-specific behavior needing verification. | Current prompt requested planning only and no sprint handbook exists. | Gated smoke-test pattern and fixture-first rule. |
| Persistent diagnostic retention policy | Product integration selects durable backend and retention requirements. | TRD avoids prescribing persistence technology. | Backend-neutral `RunStore`, `RunInspector`, event sinks, safe raw payload policy. |

## Final Decisions

### Decision 1: Sprint 14 Implementation Planning Is Blocked Until Required Inputs Exist

- **Decision:** Do not create implementable code tasks for Sprint 14 until `requirements.md`, `sprint-index.md`, and `technical-handbook.md` exist and identify concrete validation-and-diagnostics scope.
- **Rationale:** The roadmap requires each sprint to start from PRD/TRD requirements and cite evidence packs. The Sprint 14 directory is empty, and Sprint 14 is not defined in the roadmap.
- **Study / Source Grounding:** `.ultra/projects/agentwrap/roadmap.md` non-negotiable rules and sprint arc; missing requested Sprint 14 files.
- **Trade-Offs Accepted:** Implementation is delayed, but decisions remain auditable and do not invent architecture.
- **Technical Debt / Future Impact:** The blocked plan must be updated before implementation; this is intentional process debt rather than code debt.
- **Alternatives Rejected:** Inferring scope from the sprint slug was rejected because it would be ungrounded. Reusing Sprint 8 or Sprint 9 scope verbatim was rejected because those sprints already have accepted decisions and implementations.
- **Contracts Satisfied:** Roadmap non-negotiable development rules; user instruction to avoid ungrounded architecture decisions.
- **Evidence Required:** Presence and review of Sprint 14 `requirements.md`, `sprint-index.md`, `technical-handbook.md`, and any area reasoning.

### Decision 2: Future Validation-Diagnostics Work Must Extend Existing Validation, Repair, Observability, Error, And Persistence Facts

- **Decision:** If Sprint 14 proceeds, it must begin with a gap analysis against DEC-024 through DEC-030 and extend existing runtime-neutral facts rather than adding a parallel diagnostics subsystem.
- **Rationale:** Prior decisions already establish a runtime-neutral validation wrapper, observable validation/repair phases, repair permission/session behavior, observability wrapper, backend-neutral persistence hooks, and safe raw payload omission.
- **Study / Source Grounding:** `.ultra/projects/agentwrap/DECISIONS.md` DEC-024 through DEC-030; PRD output validation and observability requirements; TRD validation, repair, observability, metadata, persistence, error, and security requirements.
- **Trade-Offs Accepted:** New diagnostics capabilities may need to fit existing models instead of starting with a blank architecture.
- **Technical Debt / Future Impact:** If prior models are insufficient, the future reasoning must explicitly reopen the relevant decision with evidence.
- **Alternatives Rejected:** Adapter-local diagnostics were rejected because existing decisions keep validation and observability runtime-neutral. Persisting all native payloads was rejected because unsafe raw payloads are omitted by default.
- **Contracts Satisfied:** PRD Output Validation, PRD Observability and Metadata, PRD Output Safety, TRD Error Model, TRD Persistence Requirements.
- **Evidence Required:** Gap table mapping each requested Sprint 14 feature to existing types/events/metadata; tests showing no duplicate state model or secret leakage.

### Decision 3: Candidate Scope, If Requirements Confirm It, Should Be Diagnostics Of Existing Validation Outcomes Rather Than New Workflow Composition

- **Decision:** The only candidate direction supported by available evidence is improving how validation failures, repair attempts, diagnostic error facts, and run records can be inspected and explained. Workflow orchestration, product-specific report semantics, new persistence backends, and broad CLI/user-facing surfaces remain out of scope unless Sprint 14 requirements explicitly add them.
- **Rationale:** PRD/TRD require validation failure context, explicit error facts, metadata, and safe diagnostics. The roadmap warns not to add workflow complexity before lower-level primitives are correct, testable, observable, and hard to misuse.
- **Study / Source Grounding:** PRD lines 57-60 and 132-137; TRD lines 111-130 and 156-220; feature architecture state-first and minimal abstraction rules; roadmap lines 74-85.
- **Trade-Offs Accepted:** Candidate scope is intentionally narrow and may not satisfy unstated expectations for a larger diagnostics feature.
- **Technical Debt / Future Impact:** Requirements may legitimately broaden or redirect the sprint; if so, this decision should be superseded with named evidence.
- **Alternatives Rejected:** Adding workflow/DAG composition was rejected by PRD non-goals and roadmap sequencing. Adding a diagnostics export format was rejected because no current requirement names a format or consumer.
- **Contracts Satisfied:** PRD Output Validation, TRD Output and Artifact Validation, TRD Repair and Reprompt, TRD Error Model, feature architecture guardrails.
- **Evidence Required:** Requirements that identify concrete diagnostic questions callers cannot answer today; tests around validation failure context, repair visibility, run record inspection, and secret-safe diagnostics.

## Expected Evidence

| Evidence Type | Required Evidence | Source / Command / Review Check |
| --- | --- | --- |
| Planning Inputs | Missing Sprint 14 requirements, sprint index, and technical handbook are added. | File review before implementation. |
| Gap Analysis | Requested validation-diagnostics behaviors are mapped to existing decisions, types, events, metadata, and missing gaps. | Future `reasoning.md` update or area reasoning artifact. |
| Tests | Tests cover any confirmed gaps using fake runtimes/fixtures before live OpenCode. | `go test ./...` in implementation repository, plus targeted package tests named by future plan. |
| Runtime | Live runtime evidence only for behavior that cannot be proven with fixtures. | Gated smoke command documented in future plan if needed. |
| Review | Review confirms no product-specific UltraPlan workflow or unearned abstraction entered the SDK. | Feature architecture checklist and decision log review. |
| Documentation | Decision log updated if Sprint 14 changes durable SDK behavior. | `.ultra/projects/agentwrap/DECISIONS.md` or target implementation decision log as appropriate. |

## Assumptions And Risks

| Item | Type | Impact | Mitigation / Follow-Up |
| --- | --- | --- | --- |
| Sprint 14 requirements are intentionally absent rather than misplaced. | Assumption | Planning cannot finalize scope. | Create or provide the missing files; if paths were wrong, rerun planning with corrected paths. |
| Sprint 14 may duplicate Sprint 8/9 unless narrowed. | Risk | Duplicate models for validation, diagnostics, or persistence. | Require gap analysis against DEC-024 through DEC-030. |
| The project index requested by the prompt does not exist. | Risk | Traceability to selected studies/contracts is incomplete. | Create project index or identify replacement index before implementation planning. |
| The roadmap currently ends the expected arc at Sprint 12/13 while this sprint is Sprint 14. | Risk | Sprint number may represent post-roadmap work without documented scope. | Add roadmap section or Sprint 14 requirements with explicit relationship to prior work. |
| Diagnostics may expose unsafe native payloads or secrets. | Risk | Security regression. | Preserve DEC-030 unsafe raw payload omission and TRD secret-safe diagnostics requirements. |

## Implementation Constraints

- Do not implement Sprint 14 code from this blocked reasoning alone.
- Do not add architecture, public APIs, persistence formats, CLI surfaces, or workflow layers without Sprint 14 requirements and evidence.
- Any future validation-diagnostics implementation must extend or explicitly supersede DEC-024 through DEC-030.
- Keep product-specific validation semantics in caller-defined validators unless requirements prove they are generic SDK behavior.
- Preserve secret-safe diagnostics and unsafe raw payload omission by default.
- Use fake runtimes and fixtures for default tests; gate live OpenCode evidence behind explicit opt-in commands.

## Plan Handoff

`plan.md` must execute these decisions by marking Sprint 14 blocked, listing missing inputs, and defining only prerequisite planning tasks. It must not invent implementation scope beyond this document.

The plan must carry forward:

- final decisions
- applicable contracts and requirement IDs
- expected evidence
- risks and assumptions
- required review protocols

## Phase Exit Criteria

- [x] Selected available context was read and used.
- [x] Area-specific reasoning documents were explicitly marked not applicable because none exist.
- [x] Missing sprint-specific inputs were recorded.
- [x] Contracts are explicitly mapped to decisions and expected evidence where available from project-level docs.
- [x] Final decisions are clear enough for `plan.md` to avoid ungrounded implementation.
- [x] Expected evidence is specific and reviewable.
