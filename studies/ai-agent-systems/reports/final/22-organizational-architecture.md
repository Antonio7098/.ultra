# Organizational Architecture Analysis - Combined Study Report

## Study Parameters

| Field | Value |
|-------|-------|
| Protocol | `study-areas/22-organizational-architecture.md` |
| Repositories | 13 reference repos |
| Date | 2026-05-17 |

## Repositories Studied

| # | Repo | Path |
|---|------|------|
| 1 | aider | `repos/aider` |
| 2 | autogen | `repos/autogen` |
| 3 | guardrails | `repos/guardrails` |
| 4 | hellosales | `repos/hellosales` |
| 5 | langfuse | `repos/langfuse` |
| 6 | langgraph | `repos/langgraph` |
| 7 | mastra | `repos/mastra` |
| 8 | nemo-guardrails | `repos/nemo-guardrails` |
| 9 | opa | `repos/opa` |
| 10 | openai-agents-python | `repos/openai-agents-python` |
| 11 | opencode | `repos/opencode` |
| 12 | openhands | `repos/openhands` |
| 13 | temporal | `repos/temporal` |

## Executive Summary

This study examined how 13 AI agent frameworks and infrastructure projects approach organizational architecture — the assumptions they make about team structures, ownership boundaries, governance mechanisms, and operational responsibilities. The analysis reveals a spectrum from single-developer tools (aider) to CNCF-graduated platform infrastructure (OPA, Temporal) designed for large enterprise platform teams.

The central finding: **organizational architecture is a first-class design concern in mature systems**. Projects at score 7+ share a common pattern — they explicitly distinguish between a platform layer (owned by infra/platform engineers) and an application/feature layer (owned by developers building on the platform), with well-defined interfaces between them. Projects that score lower either lack this distinction entirely or implement it only as convention without tooling.

The organizational model a system assumes shapes everything: deployment complexity, governance enforcement, required operational expertise, and the minimum viable team size. HelloSales scores 8/10 — matching the highest-rated reference systems — indicating it is architected for genuine platform team + feature team independence.

## Core Thesis

**Organizational architecture is encoded in code structure, deployment boundaries, and governance mechanisms — not just documentation.** The most mature systems in this study make platform/feature separation a tangible engineering reality through: dependency rules that prevent feature code from importing platform internals, declarative configuration systems that let app teams operate without touching runtime code, RBAC systems that model real organizational roles, and self-serve tooling that reduces platform team burden.

Systems that achieve scores 8-10 on the organizational architecture rubric share four structural properties:

1. **A defined platform layer** — a package, directory, or set of interfaces that constitutes the "shared runtime" owned by a platform team
2. **A defined application layer** — code that consumes platform contracts and implements business logic, owned by feature teams
3. **A dependency rule** — platform never depends on application code; application depends on platform
4. **A governance boundary** — some mechanism (RBAC, license, config inheritance) that enforces organizational separation between who manages the platform and who builds on it

Lower-scoring systems either lack one or more of these properties, or implement them only as convention without enforcement.

## Rating Summary

| Repo | Score | Approach | Main Strength | Main Concern |
|------|-------|----------|---------------|--------------|
| aider | 2 | Solo developer tool | Zero complexity, easy adoption | No organizational awareness; bus-factor-1 |
| autogen | 7 | Three-layer platform | Clear core→agentchat→ext dependency chain | Maintenance mode; version lockstep across packages |
| guardrails | 7 | Platform + Hub registry | Library/server dual-mode; Hub as validator marketplace | No multi-tenant isolation; in-memory history |
| hellosales | 8 | Platform + modules + app | Three-layer agent split (mechanics/policy/exposure); composition root | No import-linter enforcement of module boundaries |
| langfuse | 8 | Monorepo + shared layer | RBAC at org+project level; entitlement-gated features; plan-based access | Entitlements split across code + license + env vars |
| langgraph | 8 | Platform orchestration | Three-tier API (StateGraph→prebuilt→SDK); self-serve agent creation | LangSmith lock-in; no self-hosted governance |
| mastra | 7 | Platform-core + adapters | Interface-based plugin system; EE RBAC/FGA; per-package AGENTS.md | No CODEOWNERS; EE features in OSS repo creates license boundary risk |
| nemo-guardrails | 5 | Library-first + server | Pre-built rails library; Colang DSL for non-Pythonists | No RBAC; no multi-config governance; no audit trails |
| opa | 9 | CNCF platform | Organizational voting governance; plugin system; bundle signing | No built-in RBAC UI; no multi-tenancy; plugin Stop not called |
| openai-agents-python | 7 | SDK platform | RunConfig as cross-cutting config bag; guardrail system | No built-in RBAC; OpenAI-centric defaults |
| opencode | 8 | CLI + SaaS + Enterprise | Three product tiers; Honeycomb observability; plugin SDK | CODEOWNERS coverage gaps; no explicit platform/feature API contracts |
| openhands | 7 | Dual-mode OSS/Enterprise | Dynamic config loading (OSS vs SaaS); permission-based auth; org-scoped settings | OSS-to-Enterprise migration gap; Enterprise is source-available not open |
| temporal | 8 | Microservices platform | Namespace isolation; pluggable authorizer; five-service separation | Static shard count; no built-in RBAC UI; complex operational model |

## Approach Models

The 13 repos cluster into five organizational models:

### 1. Solo Developer Tool (Score 2)
**aider** — No server, no multi-user support, no team concept. Architecture assumes single developer at single terminal. Evidence: `pyproject.toml` defines single CLI entry point; no API endpoints or auth middleware anywhere; git repo is local, session ephemeral.

### 2. Library-First Framework (Scores 5-7)
**nemo-guardrails**, **guardrails** — Primary API is a Python library; server mode is optional. These recognize team roles (library authors vs config authors) but lack tooling to enforce boundaries. guardrails has a Hub as a validator registry, creating a platform/consumer split; nemo-guardrails relies entirely on convention.

### 3. Platform Team Model (Scores 7-9)
**autogen**, **langfuse**, **langgraph**, **mastra**, **opa**, **openai-agents-python**, **openhands**, **temporal**, **opencode** — These systems explicitly distinguish platform vs feature/application development. They provide interfaces, configuration systems, or deployment tooling that lets platform teams manage infrastructure while feature teams build on top. OPA scores highest (9) due to CNCF multi-vendor governance and mature plugin ecosystem. autogen, mastra, and openai-agents-python implement platform models within a single company rather than a foundation.

### 4. Monorepo with Shared Layer (Scores 8)
**langfuse**, **hellosales** — The shared layer (`packages/shared/` or `platform/`) is the platform boundary. Dependency rules enforce that shared code never imports from application code. Both implement RBAC systems and both provide self-serve tooling (Langfuse's cloud dashboard; HelloSales's scaffold CLI).

### 5. Multi-Product Tier (Score 8)
**opencode**, **openhands** — These distinguish CLI/SaaS/Enterprise tiers with explicit platform infrastructure (SST/Cloudflare for opencode; Keycloak/Stripe for openhands). The Enterprise tier adds org-level governance on top of the OSS base.

## Pattern Catalog

### Pattern 1: Composition Root
**Problem**: Feature teams need to add capabilities without touching platform internals.
**Solution**: A single class or function (`AppContainer`, `build_app_container()`) assembles the full runtime graph. Feature teams register modules into the composition root rather than modifying platform code.
**Repos**: hellosales (`app_container.py:109-297`), langfuse (`packages/shared/` via AGENTS.md rules), temporal (five services assembled via fx DI at `temporal/fx.go`)
**Evidence**: `hellosales:app_container.py:91-107` — `AppContainer` dataclass holds all runtime components; `hellosales:app_container.py:109-297` — `build_app_container()` wires settings→DB→providers→modules→runtime

### Pattern 2: Declarative Configuration as Platform Boundary
**Problem**: How do platform teams provide self-serve capabilities without exposing runtime internals to feature teams?
**Solution**: Component/config systems let feature teams declare agents, validators, or workflows via YAML/JSON/DSL without writing code that touches the runtime.
**Repos**: autogen (`_component_config.py:18-41`), guardrails (config.py + `.guardrailsrc`), langgraph (`langgraph.json` with 30+ fields at `schemas.py:615-774`), openai-agents-python (`RunConfig` at `run_config.py:203-322`)
**Evidence**: `autogen:_component_config.py:18-41` — `ComponentModel` with `provider`, `config`, `component_type` fields; `langgraph:schemas.py:615-774` — 30+ config keys for deployment

### Pattern 3: Layered Package Architecture
**Problem**: How do you prevent a platform from accidentally depending on application code?
**Solution**: Physical package/directory boundaries with explicit dependency direction rules documented in per-package AGENTS.md or similar.
**Repos**: autogen (`autogen-core` → `autogen-agentchat` → `autogen-ext`), langfuse (`packages/shared` with `shared -> nothing from web/worker/ee` rule at `AGENTS.md:97`), mastra (`packages/core` as platform, adapter packages as feature layer)
**Evidence**: `langfuse:AGENTS.md:93-97` — explicit dependency rule: `@langfuse/shared` must not import from `web`, `worker`, or `ee`; `autogen:python/packages/autogen-core/pyproject.toml:9` describes core as "Foundational interfaces and agent runtime"

### Pattern 4: Three-Tier API Surface
**Problem**: How do you serve both framework developers and application developers with the same codebase?
**Solution**: Provide low-level APIs (StateGraph, protocol definitions), mid-level APIs (prebuilt agents, factory functions), and high-level APIs (SDK clients).
**Repos**: langgraph, autogen, openai-agents-python, mastra
**Evidence**: `langgraph:libs/prebuilt/langgraph/prebuilt/__init__.py:1-12` — three tiers from low-level (StateGraph) to prebuilt (create_react_agent) to SDK clients; `autogen:python/packages/autogen-core/src/autogen_core/_agent.py:13-64` — Agent protocol definition (low-level); `autogen:python/packages/autogen-agentchat/src/autogen_agentchat/agents/__init__.py:6-11` — pre-built agents (mid-level)

### Pattern 5: RBAC with Permission Granularity
**Problem**: How do you model real organizational roles in code?
**Solution**: Separate roles (OWNER, ADMIN, MEMBER, VIEWER) with per-permission grant sets rather than role-inheritance hierarchies.
**Repos**: langfuse (org+project level RBAC at `projectAccessRights.ts`, `organizationAccessRights.ts`), openhands (OWNER/ADMIN/MEMBER with `require_permission()` factory at `authorization.py:246-341`), mastra (four-tier EE RBAC at `defaults/roles.ts:24-54`), temporal (namespace-scoped Worker/Reader/Writer/Admin at `roles.go:8-13`)
**Evidence**: `openhands:authorization.py:94-173` — three roles mapped to `frozenset` of permissions, not a hierarchy; `langfuse:web/src/features/rbac/constants/orderedRoles.ts:3-9` — OWNER > ADMIN > MEMBER > VIEWER with ordered comparison

### Pattern 6: License-Gated Enterprise Features
**Problem**: How do you monetize platform features while keeping the core open?
**Solution**: Enterprise features live in a separate directory/package with an import-time license check.
**Repos**: langfuse (`ee/` directory with `ee-license-check/index.ts:3-5`), mastra (`packages/core/src/auth/ee/` with `isEEEnabled()` at `license.ts:35-59`)
**Evidence**: `langfuse:ee/src/ee-license-check/index.ts:3-5` — checks `NEXT_PUBLIC_LANGFUSE_CLOUD_REGION` or `LANGFUSE_EE_LICENSE_KEY`; `mastra:packages/core/src/auth/ee/license.ts:35-59` — `isEEEnabled()` with 1-minute cache, dev environment exempt

### Pattern 7: Self-Serve Tooling for Feature Teams
**Problem**: How do platform teams reduce their operational burden when supporting many feature teams?
**Solution**: Provide CLI generators, scaffold tools, and smoke test harnesses that let feature teams self-serve common tasks.
**Repos**: hellosales (scaffold-module CLI at `pyproject.toml:29`), opencode (agent/skill/plugin/command generation), langgraph (`langgraph dev` in-memory mode), mastra (create-mastra scaffolding)
**Evidence**: `hellosales:pyproject.toml:29` — `hello-sales-scaffold-module` CLI auto-generates module boilerplate; `hellosales:scripts/scaffold_module.py` — generates new bounded-context modules

### Pattern 8: Provider Abstraction with Replaceable Seams
**Problem**: How do you let feature teams swap infrastructure providers without touching application code?
**Solution**: Port/adapter pattern where platform defines abstract interfaces and feature teams provide or select implementations.
**Repos**: hellosales (LLM/auth/web search/voice providers with noop/fallback implementations), openai-agents-python (ModelProvider ABC at `models/interface.py:127-150`, multi-provider routing at `multi_provider.py:61-73`), temporal (pluggable Authorizer interface at `authorizer.go:54-56`)
**Evidence**: `openai-agents-python:src/agents/models/interface.py:127-150` — `ModelProvider` ABC any team can implement; `hellosales:app_container.py:31-34` imports from `providers.py` for LLM, auth, web search, voice

## Key Differences

### Governance Model: CNCF Foundation vs Company-Owned
OPA (CNCF-graduated) uses organizational voting where each company gets one vote regardless of maintainer count (`GOVERNANCE.md:9-18`). This prevents single-vendor capture. autogen, mastra, and openai-agents-python are company-owned (Microsoft, Mastra, OpenAI respectively) — governance is fiat-driven by the owning organization. langfuse and opencode operate as companies but use standard open-source governance (CLA, CONTRIBUTING.md).

### Dependency Enforcement: Tooled vs Convention
langfuse and OPA have explicit dependency rules enforced through AGENTS.md documentation and CI. hellosales uses convention only — `docs/architecture-philosophy.md:177` acknowledges "mixing product policy into platform code" as a "hardest change" but it is not technically prevented. mastra has per-package AGENTS.md files for AI coding agents but no CODEOWNERS file for human ownership.

### Deployment Complexity Range
At one end: aider (single `pip install`, zero infra). At the other: temporal (five Go services, Cassandra/MySQL/Postgres, Kubernetes, gRPC). langfuse requires Postgres + ClickHouse + Redis + S3 simultaneously. hellosales requires Docker + k8s + OTEL collector. nemo-guardrails and guardrails offer simple Docker deployment but can scale to server-mode with additional infra.

### Auth Model: Built-in RBAC vs Delegated to Platform
langfuse, openhands, mastra EE, and temporal build auth into the system — they provide role definitions and permission checks in the code. autogen, langgraph, openai-agents-python, and OPA provide interfaces (InterventionHandler, Authorizer, TracingProcessor) that require the deploying organization to implement. This is a spectrum from "ships with auth" to "ships auth interfaces."

## Tradeoffs

| Design Choice | Benefit | Cost | Best-Fit Context |
|---------------|---------|------|------------------|
| Library-first vs platform-managed | Lower barrier for individual devs; self-serve | No centralized governance; feature teams manage their own ops | Small teams; rapid prototyping |
| Monorepo with shared layer | Coordinated releases; shared types; easy refactor | CI complexity; all packages version-lockstep | 3+ teams with shared platform concerns |
| RBAC at org+project level | Mirrors real org structure; granular control | Configuration complexity; permission sprawl | Enterprises with compliance requirements |
| Declarative config-driven assembly | Platform team can modify infra without code; self-serve for feature teams | Runtime resolution; no compile-time safety | Platforms serving many independent teams |
| Plugin/extension system | Ecosystem growth; third-party contributions; specialization | Maintenance burden; security surface; discovery | Platforms with strong external developer ecosystems |
| Entitlement-gated enterprise features | Monetization without forking; clear OSS boundary | License enforcement complexity; dual-maintenance | Commercial open-source with enterprise tier |
| Dual-mode (OSS + Enterprise) | Serves both self-serve and enterprise markets | Two config systems; migration gaps; testing overhead | Products with both hobbyist and enterprise users |

## Decision Guide

**Should you use a library-first or platform-managed system?**

Choose **library-first** if:
- Your team is 1-3 developers
- You have no platform/infra engineering capacity
- You're building a prototype or internal tool
- You don't need centralized governance or audit trails
- Example: aider, nemo-guardrails (basic usage)

Choose **platform-managed** if:
- You have dedicated infra/platform engineers
- Multiple feature teams will build on the system
- You need centralized auth, RBAC, or audit trails
- You need coordinated deployments across teams
- Example: Temporal, OPA, Langfuse, hellosales

**How many layers should your architecture have?**

Minimum viable: **2 layers** (platform + feature). The platform owns runtime infrastructure; feature teams own business logic. Example: autogen (core + agentchat + ext is really 3 sub-layers within the platform).

Better for scale: **3 layers** (platform + application + modules). Add an intermediate "application" layer for shared policies, tools, or agent logic that isn't platform-owned but isn't per-module either. Example: hellosales (`platform/` + `application/` + `modules/`), langfuse (`packages/shared` + `web/worker` + `ee/`)

**When to add RBAC:**

Add RBAC when you have multiple users with different permission levels accessing the same system. Don't add it for single-user tools. The overhead of defining roles, permissions, and enforcement is only justified when you have org-level multi-user access.

**When to add a Hub or registry:**

Add a Hub when you have a plugin/extension ecosystem that grows beyond your team. The Hub serves as the distribution and discovery mechanism. Don't add it if you have a simple, bounded feature set.

## Practical Tips

1. **Start with two packages/directories**: A `platform/` (or `core/`) package and a `features/` (or `modules/`) package. Enforce that platform never imports from features. Use your language's module system as the boundary.

2. **Use a composition root for wiring**: A single function (`build_app_container()`, `createServer()`) that assembles the full runtime graph gives platform teams a single place to manage dependencies. Feature teams register into it.

3. **Make the config object the platform boundary**: `RunConfig`, `ComponentModel`, `AppConfig` — these objects carry platform concerns into application code. Feature teams configure them; platform teams define their schema.

4. **Provide self-serve tooling early**: CLI generators, scaffold scripts, and smoke test harnesses reduce platform team burden. Invest in these before you have more than 2-3 feature teams.

5. **Use RBAC at the right granularity**: Start with 3-4 roles (owner, admin, member, viewer). Add granular permissions only when you have compliance requirements. Over-granular permissions become a maintenance burden.

6. **Document dependency rules in AGENTS.md**: For monorepos, per-package AGENTS.md files that specify what each package may and may not import serve as both ownership charters and AI coding agent instructions.

7. **Separate what you ship from what you charge for**: If you have an enterprise tier, physically separate enterprise code in its own directory with a license check at the import boundary. Don't mix enterprise and OSS in the same files with conditional flags.

8. **Treat observability as a platform feature**: The most mature systems (langfuse, hellosales, opencode, temporal) all have structured observability built in — OpenTelemetry tracing, Prometheus metrics, structured logging. Feature teams should be able to opt into the platform's observability pipeline without configuration.

## Anti-Patterns / Caution Signs

1. **Platform code importing from feature code**: If `platform/` imports from `modules/`, the organizational boundary is broken. This is a hard architectural smell — it means platform and feature teams are not independent.

2. **Single maintainer with no succession plan**: aider has a bus factor of 1. The PyPI token, DockerHub credentials, and release workflows all belong to one individual (`paulgauthier`). Any system that matters to an organization needs a bus-factor mitigation strategy.

3. **RBAC that defaults to full access**: mastra's server "falls back to auth-only mode granting full access" if no RBAC provider is configured (`server-adapter/index.ts:463-467`). This is a dangerous default — teams may think they have access control when they don't.

4. **No auth by default in production systems**: OPA ships with `AuthenticationOff` and `AuthorizationOff` as defaults (`server/server.go:28`). Production deployments must explicitly enable auth — easy to miss.

5. **In-memory state with no persistence**: guardrails stores only 10 validation history entries in memory (`guardrails/guard.py:137,142`). Organizations needing audit trails must build their own persistence layer.

6. **Config that is code**: If your "declarative config" is actually Python code that runs at startup (like `config.py` for guardrails server mode), you haven't achieved the self-serve goal — feature teams still need to understand platform internals.

7. **Monorepo with version lockstep**: autogen locks all Python packages to the same version (`CONTRIBUTING.md:41`). A hotfix in one package forces version bumps everywhere. This is a trade-off worth understanding before adoption.

8. **No CODEOWNERS or ownership documentation**: mastra (~100 packages) has no CODEOWNERS file. opencode's CODEOWNERS covers only `packages/app/`, `packages/desktop/`, `packages/tauri/`. Most of the codebase has no documented owner.

## Notable Absences

Several organizational concerns were absent across nearly all repos:

1. **No deployment canary/rollback automation** — Most systems provide Docker/Kubernetes manifests but no automated rollout strategy. langfuse promotes `main` to production via `.github/workflows/promote-main-to-production.yml` but this is CI, not feature-flag-driven gradual rollout.

2. **No on-call or incident response documentation** — Only langfuse's Slack CI notifications at `pipeline.yml:793-840` hint at incident notification. No repo documents an on-call rotation, incident severity levels, or escalation paths.

3. **No formal team-sizing guidance** — The architectures imply certain team sizes (OPA needs multiple organizations; aider needs one person) but none document "if you have N engineers, here is how to structure the platform/feature team split."

4. **No cross-module dependency contract system** — hellosales acknowledges "module A depends on module B" as an undocumented contract. langfuse's AGENTS.md rules prevent circular dependencies but don't document explicit inter-package contracts.

5. **No cost attribution/showback** — For multi-team deployments, no system provides built-in usage attribution per team. langfuse's observability hosting guide discusses cost bands (`observability-hosting-guide.md:500-508`) but no per-org or per-team cost allocation.

6. **No disaster recovery documentation** — opencode's cloud console has no documented DR plan. hellosales has production k8s manifests but no backup/restore procedures.

## Per-Repo Notes

| Repo | Key Organizational Insight |
|------|---------------------------|
| **aider** | The absence of organizational architecture IS the architecture. Designed for a single developer; any multi-user need requires wrapping with external tooling. |
| **autogen** | Three-layer design is the clearest example of platform/app separation in the study. However, maintenance mode and version-lockstep release model are real constraints. |
| **guardrails** | Hub as validator registry is a strong platform/consumer pattern. Dual-mode (library/server) is pragmatic but in-memory history is a production gap. |
| **hellosales** | Three-layer agent split (mechanics/policy/exposure) is the most sophisticated organizational boundary found. Composition root pattern is clean and well-implemented. |
| **langfuse** | The most complete RBAC story — org+project levels with ordered role hierarchy. The `ee/` license isolation is the model for entitlement-gated features. |
| **langgraph** | Self-serve agent creation via `create_react_agent()` is excellent for feature teams. LangSmith coupling is the main concern for self-hosted governance. |
| **mastra** | Interface-based plugin system is architecturally sound. Per-package AGENTS.md is a model for AI coding agent instructions. No CODEOWNERS is a real gap. |
| **nemo-guardrails** | Colang DSL allows non-Pythonists to contribute flows — a genuine organizational innovation. But no RBAC and no audit trails limit enterprise use. |
| **opa** | The governance model (organizational voting) and plugin system (Factory pattern with Validate/New lifecycle) are the most mature in the study. CNCF graduation provides multi-vendor assurance. |
| **openai-agents-python** | `RunConfig` as a cross-cutting concern bag is an elegant pattern. Guardrail system is the governance mechanism. No built-in RBAC is the main gap. |
| **opencode** | Three product tiers with shared core is a strong model. Honeycomb observability is concrete, not aspirational. CODEOWNERS gaps are a real concern. |
| **openhands** | Dynamic config class loading (`OPENHANDS_CONFIG_CLS`) for OSS vs Enterprise is a clever pattern. Source-available Enterprise (Polyform) is a monetization model, not truly open source. |
| **temporal** | Five-service separation is the most explicit organizational boundary found. Namespace-scoped RBAC with pluggable Authorizer is production-grade. Static shard count is the main operational concern. |

## Open Questions

1. **How should platform teams handle cross-module dependencies?** HelloSales acknowledges this gap — module A may depend on module B, but there's no documented contract for these dependencies. How do other systems handle this?

2. **What is the right size ratio between platform team and feature teams?** The architectures imply small platform teams (2-5) serving larger feature teams (5-20). Is there empirical guidance for this ratio?

3. **How do organizations handle AI coding agent governance?** Several systems now include per-package AGENTS.md for AI agents. How does the platform team review and approve AI-generated code changes?

4. **When does a library-first system need to evolve into a platform-managed system?** The transition point seems to be around 5+ engineers, but is there a more concrete trigger?

5. **How should multi-tenant systems handle data residency?** langfuse has prod-eu, prod-us, prod-hipaa, prod-jp deployments. How do other systems approach cross-region data governance?

6. **What is the minimum viable observability stack for a platform team?** Every high-scoring system has OTEL or Prometheus, but no system documents "here's what your observability must capture for platform governance."

## HelloSales — Improvement Recommendations

Based on all 13 reference system patterns, HelloSales scores **8/10** — tied for highest in the study alongside langfuse, langgraph, opa, opencode, and temporal. The architecture is already well-designed for platform teams. The following recommendations address gaps and areas for hardening.

### Quick Wins (Low Effort, High Impact)

1. **Add import-linter to enforce platform/module boundaries**
   - Currently the boundary is convention only (`docs/architecture-philosophy.md:177`). Add `lint-factory` or custom AST checks to detect `platform.` imports in `modules.` code.
   - Evidence: hellosales:`docs/architecture-philosophy.md:177` acknowledges "mixing product policy into platform code" is a "hardest change"
   - Impact: Prevents accidental coupling; enforces the organizational split in code

2. **Add a CODEOWNERS file for `platform/` and `modules/`**
   - Currently no explicit ownership documentation. A CODEOWNERS file would formalize team ownership.
   - Evidence: mastra (`packages/core/src/auth/`) lacks explicit CODEOWNERS despite ~100 packages
   - Impact: Reduces review bottlenecks; clarifies who owns what

3. **Document the module dependency contract**
   - HelloSales has 12 modules but no documented "module A requires module B" relationships.
   - Evidence: `module_registry.py` assembles modules but doesn't document inter-module contracts
   - Impact: New feature teams understand boundaries before integrating

4. **Add a health check endpoint that verifies all provider connections**
   - Currently provider failures surface via diagnostics (`/api/system/diagnostics`). A startup health check that pings all configured providers would surface failures earlier.
   - Evidence: hellosales:`startup.py:12-131` validates partial config but not individual provider runtime health
   - Impact: Faster incident detection; better production reliability

### Long-Term Improvements (High Effort, Architectural)

5. **Implement module API versioning**
   - With 12 modules and growing, versioned contracts would let platform and feature teams release independently.
   - Evidence: langfuse uses Fern API specs (`fern/apis/`) for formally versioned public contracts
   - Impact: True feature team independence; reduced coordination overhead

6. **Add org-level RBAC with viewer role for external stakeholders**
   - HelloSales has permission-slug auth (WorkOS) but no org-level role hierarchy visible to external collaborators.
   - Evidence: langfuse's project VIEWER role (`web/src/features/rbac/constants/projectAccessRights.ts:5-80`) allows read-only access for external stakeholders
   - Impact: Enables external team members (contractors, auditors) without full access

7. **Build a developer portal / self-serve catalog**
   - HelloSales has CLI tooling (scaffold, smoke, verify-db) but no centralized catalog of available modules, their contracts, and ownership.
   - Evidence: langfuse's cloud dashboard provides self-serve project/API key management
   - Impact: Reduces platform team ticket burden; faster feature team onboarding

8. **Add feature flags for module-level rollout control**
   - No evidence of canary or gradual rollout mechanism exists in the analysis.
   - Evidence: langfuse has plan-based feature gating (`entitlements.ts`) but no per-feature rollout for internal teams
   - Impact: Safer deployments; reduced blast radius for feature failures

### Risks (What Could Go Wrong If Not Addressed)

9. **Platform team becomes a bottleneck** — All module wiring passes through `build_app_container()` (`hellosales:app_container.py:109-297`). If platform team velocity slows, all feature teams are blocked. The scaffold generator mitigates this but doesn't eliminate the risk.

10. **Module boundary erosion** — Python's import system doesn't enforce the platform/module split. A module importing `platform.agents.mechanics` directly bypasses the intended organizational boundary. Without tooling enforcement, this will happen over time.

11. **Settings sprawl** — 100+ `HELLO_SALES_*` environment variables (`hellosales:settings.py:35-113`) creates onboarding friction and misconfiguration risk. Feature teams may set conflicting values without understanding implications.

12. **WorkOS lock-in** — Auth provider seam supports "workos" or "dev" but WorkOS is the only production adapter. Switching auth providers requires implementing a new `AuthProviderPort` — no abstraction exists for this.

---

## Evidence Index

Every evidence reference in this report follows the `path/to/file.ts:NN` format.

### hellosales
- `platform/composition/app_container.py:91-107` — AppContainer dataclass
- `platform/composition/app_container.py:109-297` — build_app_container() wiring
- `platform/composition/startup.py:12-131` — Settings validation at startup
- `platform/auth/middleware.py:19-34` — WorkOS RBAC permission slugs
- `docs/architecture-philosophy.md:26-88` — Platform/module split documentation
- `docs/architecture-philosophy.md:139-148` — Three-layer agent split
- `docs/architecture-philosophy.md:177` — Acknowledged boundary risk
- `docs/observability-hosting-guide.md:500-508` — Cost bands discussion
- `platform/config/settings.py:35-113` — 100+ env vars

### langfuse
- `packages/shared/AGENTS.md:93-97` — Dependency direction rule
- `packages/shared/AGENTS.md:125-134` — Verification matrix
- `web/src/features/rbac/constants/orderedRoles.ts:3-9` — Role hierarchy
- `web/src/features/rbac/constants/organizationAccessRights.ts:5-15` — Org scopes
- `web/src/features/rbac/constants/projectAccessRights.ts:5-80` — Project scopes
- `web/src/features/entitlements/constants/entitlements.ts:51-171` — Plan-based entitlements
- `ee/src/ee-license-check/index.ts:3-5` — EE license check
- `pnpm-workspace.yaml:8` — minimumReleaseAge: 7200

### temporal
- `temporal/server.go:25-31` — Five named services
- `temporal/fx.go:551-556` — Internal frontend pattern
- `common/authorization/authorizer.go:54-56` — Pluggable authorizer
- `common/authorization/roles.go:8-13` — Worker/Reader/Writer/Admin
- `common/authorization/default_authorizer.go:35-65` — Default logic
- `cmd/server/main.go:203-209` — Noop authorizer with --allow-no-auth

### opa
- `GOVERNANCE.md:9-18` — Organizational voting
- `MAINTAINERS.md:5-16` — Maintainer areas of expertise
- `plugins/plugins.go:74-87` — Plugin Factory interface
- `plugins/bundle/plugin.go:17-23` — Bundle distribution
- `bundle/verify.go:12-22` — JWT bundle signing
- `runtime/runtime.go:14-20` — runtime.RegisterPlugin

### langgraph
- `repos/langgraph/AGENTS.md:1-36` — 9-sub-library structure
- `libs/cli/langgraph_cli/cli.py:165-170` — Runtime modes (combined vs distributed)
- `libs/cli/langgraph_cli/schemas.py:615-774` — 30+ config keys
- `libs/sdk-py/langgraph_sdk/runtime.py:28-33` — AccessContext
- `libs/cli/langgraph_cli/cli.py:289-292` — LangSmith coupling

### openhands
- `openhands/app_server/server_config/server_config.py:9-11` — AppMode default
- `enterprise/server/config.py:54` — SaaSServerConfig override
- `enterprise/server/auth/authorization.py:94-173` — RolePermission mapping
- `enterprise/server/auth/authorization.py:246-341` — require_permission() factory
- `enterprise/server/auth/org_context.py:37-78` — Org context resolution
- `enterprise/storage/org_member.py:17` — LLM key override per member

### openai-agents-python
- `src/agents/models/interface.py:127-150` — ModelProvider ABC
- `src/agents/models/multi_provider.py:61-73` — MultiProvider routing
- `src/agents/run_config.py:203-322` — RunConfig cross-cutting concerns
- `src/agents/run_config.py:242-246` — Global guardrails
- `src/agents/tracing/processor_interface.py:9-130` — TracingProcessor ABC
- `src/agents/sandbox/sandbox_agent.py:15-20` — Sandbox config at runtime

### opencode
- `packages/opencode/package.json:23-29` — 20+ packages in monorepo
- `infra/app.ts:13-69` — Cloudflare Workers deployment
- `infra/monitoring.ts:1-282` — Honeycomb triggers
- `.github/CODEOWNERS:1-5` — Limited CODEOWNERS coverage
- `CONTRIBUTING.md:182-210` — Issue-first, vouch system
- `packages/opencode/src/tool/registry.ts:136-208` — Plugin system

### mastra
- `pnpm-workspace.yaml:1-25` — 20+ directory globs
- `packages/core/package.json:13-30` — 50+ subpath exports
- `packages/core/src/auth/ee/interfaces/rbac.ts:101-158` — RBAC interface
- `packages/core/src/auth/ee/defaults/roles.ts:24-54` — Four-tier roles
- `packages/core/src/auth/ee/license.ts:35-59` — isEEEnabled()
- `packages/server/src/server/server-adapter/index.ts:463-467` — RBAC fallback to auth-only

### autogen
- `python/packages/autogen-core/pyproject.toml:9` — Core as "Foundational interfaces"
- `python/packages/autogen-core/src/autogen_core/_component_config.py:18-41` — ComponentModel
- `python/packages/autogen-core/src/autogen_core/_component_config.py:55-62` — Trusted namespaces
- `python/packages/autogen-core/src/autogen_core/_agent.py:13-64` — Agent protocol
- `CONTRIBUTING.md:41` — Version lockstep across packages
- `README.md:18-25` — Maintenance mode

### guardrails
- `guardrails/guard.py:178-180` — use_server flag
- `guardrails/cli/start.py:45-73` — Server mode dynamic install
- `guardrails/hub/install.py:37-63` — Hub validator installation
- `guardrails/api_client.py:16-43` — GuardrailsApiClient
- `guardrails/guard.py:137,142` — history_max_length=10

### nemo-guardrails
- `nemoguardrails/cli/__init__.py:121-199` — CLI server command
- `nemoguardrails/server/api.py:157-172` — CORS middleware, no auth
- `nemoguardrails/server/api.py:636-689` — Auto-reload feature
- `nemoguardrails/actions/action_dispatcher.py` — Action registry
- `CONTRIBUTING.md:189-206` — GitFlow branching

### aider
- `pyproject.toml` — Single CLI entry point
- `aider/main.py` — Sole entry point; no server code
- `.github/workflows/docker-release.yml:27-28` — Personal DockerHub secrets
- `aider/repo.py` — Local git operations only
- `aider/analytics.py:102-108` — PostHog init, opt-in sampling

---

Generated by protocol `study-areas/22-organizational-architecture.md`.