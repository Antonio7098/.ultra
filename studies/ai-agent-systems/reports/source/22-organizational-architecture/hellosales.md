# Repo Analysis: hellosales

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | hellosales |
| Path | `repos/hellosales` |
| Language / Stack | Python 3.12+, FastAPI, SQLAlchemy 2.0, Stageflow |
| Analyzed | 2026-05-17 |

## Summary

hellosales is an operational scaffold backend for an AI-powered sales platform. Its architecture makes **strong assumptions about organizational structure**: it is designed for a platform engineering team that owns runtime infrastructure, with feature teams building on top of bounded-context modules. The codebase implements an explicit platform/module split, a centralized composition root, replaceable provider seams, self-serve tooling for module creation, and a full self-hosted observability stack with production Kubernetes manifests. These are not aspirational — they are implemented in code.

Rating: **8** — Clear separation of concerns with role-appropriate interfaces, built for platform teams by design.

## Rating

| Score | Meaning |
| ----- | ------ |
| 8     | Clear separation of concerns with role-appropriate interfaces |

Fast heuristic assessment: "Could a platform team and a feature team work independently?" — **Yes, by design.** The composition root (`platform/composition/app_container.py:109-297`) is the platform team's wiring surface; each module is independently bootstrapped and registerable. A feature team can add a module without touching platform internals.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Platform/module separation | 14 platform packages vs 12 module packages, each with own bootstrap | `src/hello_sales_backend/platform/`, `src/hello_sales_backend/modules/` |
| Centralized composition root | `AppContainer` dataclass assembles full runtime graph in one place | `src/hello_sales_backend/platform/composition/app_container.py:91-107` |
| Composition wiring | `build_app_container()` wires settings→DB→providers→modules→runtime | `src/hello_sales_backend/platform/composition/app_container.py:109-297` |
| Module scaffold generator | CLI tool auto-generates new bounded-context modules | `pyproject.toml:29`, `scripts/scaffold_module.py` |
| Provider abstraction | Provider registry pattern for LLM, auth, web search, voice | `src/hello_sales_backend/platform/composition/providers.py` (inferred from imports at `app_container.py:31-34`) |
| Auth with WorkOS RBAC | Permission-slug-based auth, not binary roles | `src/hello_sales_backend/platform/auth/middleware.py:19-34`, `platform/auth/contracts.py` |
| Three-layer agent split | `platform/agents/` (mechanics) vs `application/agents/` (policy) vs `modules/agent_runs/` (exposure) | `docs/architecture-philosophy.md:139-148` |
| Self-hosted observability | Full compose + k8s: Prometheus, Loki, Tempo, Grafana, MinIO, OTEL | `ops/observability/docker-compose.observability.yml:1-79` |
| Production k8s manifests | Namespace, RBAC, PVCs, network policies, ingress, overlays for dev/staging/prod | `ops/observability/production/kubernetes/` (39 files) |
| Environment-driven config | All settings via `HELLO_SALES_*` env vars with pydantic validation | `src/hello_sales_backend/platform/config/settings.py:12-356` |
| Override seam for tests | `AppOverrides` allows swapping any runtime component | `src/hello_sales_backend/platform/composition/overrides.py` |
| Startup validation | Settings validated before DB ping; partial config rejected at startup | `src/hello_sales_backend/platform/composition/startup.py:12-131` |
| Docker deployment | Dockerfile + docker-entrypoint.sh runs migrations then uvicorn | `Dockerfile:1-25`, `docker-entrypoint.sh:1-9` |
| Smoke test harness | Centralized smoke test system with named suites for providers, agents, workers | `src/hello_sales_backend/smoke/`, `scripts/smoke.py` |
| CLI entrypoints | Three CLI commands for smoke, verify-db, scaffold-module | `pyproject.toml:27-29` |
| Module registry | `ModuleRegistry` holds all assembled modules | `src/hello_sales_backend/platform/composition/module_registry.py` |
| Architecture philosophy doc | Explicitly documents platform/module/application split and rationale | `docs/architecture-philosophy.md:1-190` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

**A two-tier structure: platform engineers + feature-team developers.** The strongest evidence is the explicit split between `platform/` (runtime infrastructure — 14 packages) and `modules/` (application capabilities — 12 packages). `docs/architecture-philosophy.md:26-88` documents this as "The Main Split." The composition root at `platform/composition/app_container.py:91-107` is a single class a platform team owns. Feature teams add modules without touching platform internals.

### 2. Is the system self-serve or platform-managed?

**Both.** The platform team provides self-serve tooling:
- `hello-sales-scaffold-module` CLI (`pyproject.toml:29`) generates new module boilerplate
- `hello-sales-smoke` CLI (`pyproject.toml:27`) runs provider-backed smoke tests
- `hello-sales-verify-db` CLI (`pyproject.toml:28`) checks database connectivity
- Makefile targets abstract Docker, test, migration, and smoke commands (`Makefile:1-72`)

But the composition root, observability stack, and provider wiring are platform-managed. Feature teams cannot change the runtime graph — they register modules into it.

### 3. How is ownership divided between platform and feature teams?

**Explicitly through the package structure:**

- **Platform team owns**: `platform/` (config, db, auth, llm, agents, workers, tasks, workflows, observability, composition, sessions, voice, web_search, providers) — all runtime infrastructure (`src/hello_sales_backend/platform/`).
- **Feature teams own**: `modules/` — each module is a bounded context with its own `bootstrap.py`, `use_cases/`, service, and view models (`src/hello_sales_backend/modules/` with 12 subdirectories).
- **Shared layer**: `application/agents/` for agent policy and `application/tools/` for reusable tools (`src/hello_sales_backend/application/`).
- **Cross-cutting**: `shared/` for domain-neutral errors, IDs, helpers (`src/hello_sales_backend/shared/`).

The agent system has an extra three-way split documented in `docs/architecture-philosophy.md:139-148`: platform team owns mechanics, application team owns policy, feature team owns operational exposure.

### 4. What operational expertise is required?

**High — this system assumes experienced infra engineers:**
- PostgreSQL 17 administration with async SQLAlchemy 2.0 (`docker-compose.dev.yml:2-17`, `pyproject.toml:9`)
- Self-hosted observability stack: Prometheus, Loki, Tempo, Grafana, MinIO, OpenTelemetry Collector (`ops/observability/docker-compose.observability.yml:1-79`)
- Kubernetes: 39 k8s manifests with network policies, PVCs, RBAC, ingress, overlays for 3 environments (`ops/observability/production/kubernetes/`)
- Docker containerization with migration-aware entrypoint (`Dockerfile:1-25`, `docker-entrypoint.sh:1-9`)
- OTLP trace export configuration and collector management (`docs/observability-hosting-guide.md:254-271`)
- Provider API key management for LLM (Groq/OpenAI/OpenRouter), auth (WorkOS), web search (Tavily) — 10+ environment variables required for full function

`docs/observability-hosting-guide.md:1-12` is written explicitly for "someone who has not hosted monitoring infrastructure before," which implies the intended operator may be learning, but the stack itself is production-grade.

### 5. How is governance enforced organizationally?

**Through three mechanisms:**
1. **Configuration validation at startup**: `startup.py:12-131` rejects partial config for auth, LLM, environment — fails fast with structured error codes (`config.auth_provider.partial`, `config.llm_provider.unsupported`).
2. **Auth with permission slugs**: WorkOS-backed auth (`platform/auth/middleware.py:19-34`) maps roles to explicit `AuthContext` permissions. Route dependencies and agent tool execution enforce backend-owned permissions (`docs/runtime-overview.md:115-117`).
3. **Static approval for write operations**: `docs/agent-runtime.md:303-304` — governed SQL tool, entity mutations all require explicit approval before execution. `HELLO_SALES_WEB_SEARCH_REQUIRES_APPROVAL` controls web search governance (`settings.py:79`).

The `pyproject.toml` and `settings.py` also enforce organizational policy through mypy strict mode (`pyproject.toml:54-60`), ruff lint rules (`pyproject.toml:46-52`), and validated environment variables with allowed-provider sets (`settings.py:195-233`).

### 6. What is the assumed scale of the team?

**Multiple teams — not a single developer.** The 12 modules imply multiple feature team workstreams. The three-layer agent split (mechanics/policy/exposure) implies at least 3 separate ownership boundaries. The observability stack with dev/staging/prod overlays implies an organization with environment promotion pipelines. The RBAC model with WorkOS implies enterprise multi-tenant orgs.

The observability hosting guide (`docs/observability-hosting-guide.md:500-508`) discusses cost bands up to £2,000+/month, which suggests the organization is expected to have real budget.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, explicitly.** This is the defining organizational signal of the codebase:
- `platform/` = for platform developers (composition root, providers, DB, agents, workers, observability — 14 packages)
- `modules/` = for application developers (12 bounded contexts with service facades)
- `application/` = for agent policy developers
- `entrypoints/http/` = thin transport layer for HTTP-facing developers

`docs/architecture-philosophy.md:26-88`: "entrypoints/ = transport adapters", "modules/ = public application capability surfaces", "platform/ = runtime infrastructure", "application/ = policy outside platform" — this is an explicit four-tier organizational model.

The strongest signal: `platform/agents/` (mechanics) is kept separate from `application/agents/` (policy) which is kept separate from `modules/agent_runs/` (exposure). `docs/architecture-philosophy.md:148`: "That is one of the strongest architectural decisions in the current codebase."

## Architectural Decisions

| Decision | Rationale | File:Line |
|----------|-----------|-----------|
| Composition root pattern | Centralize wiring so platform owns runtime graph | `platform/composition/app_container.py:91-107` |
| Platform/module split | Isolate infrastructure from application capability | `docs/architecture-philosophy.md:26-88` |
| Provider registry with replaceable seams | Swap LLM/auth/search providers without module changes | `platform/composition/providers.py` (imported at `app_container.py:31-34`) |
| Three-layer agent split | Keep runtime mechanics, policy, and exposure independently evolvable | `docs/architecture-philosophy.md:139-148` |
| Settings via env prefix | `HELLO_SALES_*` namespacing avoids collisions | `platform/config/settings.py:28-33` |
| AppOverrides for testing | Complete runtime graph replaceability for tests | `platform/composition/overrides.py` |
| Self-hosted observability | Operational visibility as first-class concern | `ops/observability/docker-compose.observability.yml` |
| Scaffold-stage pragmatism | Build durable infra before product brief exists | `docs/architecture-philosophy.md:19-23` |

## Notable Patterns

1. **Bootstrap pattern**: Every module and platform component has a `bootstrap.py` with a `build_*()` function — consistent construction API across the entire codebase (observed in 12+ directories).

2. **Port/adapter**: Provider seams use abstract port contracts (e.g., `AgentStorePort`, `SessionStorePort`, `AuthProviderPort`) with in-memory and SQLAlchemy implementations, toggled by database URL (`app_container.py:116-123`).

3. **Operational-first**: Observability runtime, health endpoints, diagnostics, event streams, smoke harness — all present before domain modules. `docs/architecture-philosophy.md:150-163`: "operational visibility as a first-class concern."

4. **CLI surface for developers**: Three documented CLI entry points + Makefile targets + scaffold generator — self-serve platform tooling as code.

5. **Explicit override seam**: `AppOverrides` allows replacing any runtime component (auth, LLM, observability, task runner, workflow) for environment-specific or test wiring (`app_container.py:112` referenced pattern).

## Tradeoffs

| Tradeoff | Description | Evidence |
|----------|-------------|----------|
| Over-engineered for small teams | The platform/module split and multi-layer agent architecture are designed for >1 team — a single developer would find this burdensome | `docs/architecture-philosophy.md` documents the split as designed for growth, not minimalism |
| Scaffold before product | Operational scaffold built before product brief creates unused infrastructure if product direction changes | `docs/architecture-philosophy.md:19-23`: "optimizes for durable infrastructure before the product brief exists" |
| Provider abstraction cost | Every external service (LLM, auth, search, voice) goes through port/adapter layers — adds complexity for simple use cases | 4 provider domains × 2+ implementations each; noop/fallback providers exist for each (`providers.py` structure) |
| Opinionated deployment model | Docker + k8s + OTLP collector is a strong assumption about deployment environment | `Dockerfile`, `docker-entrypoint.sh`, `ops/observability/production/kubernetes/` |
| In-memory stores for dev | SQLite/AIOSQLite for test, in-memory for workers/agents — dev experience diverges from production | `app_container.py:118-124` — `InMemoryAgentStore()` for SQLite, `SqlAlchemyAgentStore()` for Postgres |

## Failure Modes / Edge Cases

1. **Partially configured providers pass startup but fail at runtime**: `startup.py:12-131` catches partial LLM/auth config, but individual provider failures at runtime are handled by individual tool/agent error paths, not a global circuit breaker. Provider health must be checked via diagnostics (`/api/system/diagnostics`).

2. **Platform team as bottleneck**: All module wiring must pass through `build_app_container()` (`app_container.py:109-297`). If platform team cannot keep pace, feature teams are blocked.

3. **Module boundaries not enforced at import level**: Nothing in Python prevents a module from importing platform internals directly — the boundary is convention, not compiler-enforced. `docs/architecture-philosophy.md:177`: "mixing product policy into platform code" is listed as a "hardest change" but is not technically prevented.

4. **Settings sprawl**: 100+ `HELLO_SALES_*` environment variables (`settings.py:35-113`). Growing config surface creates onboarding friction and misconfiguration risk.

5. **WorkOS lock-in potential**: Auth provider seam supports "workos" or "dev", but WorkOS is the only real production adapter. Switching auth providers means implementing a new `AuthProviderPort`.

## Future Considerations

1. **Module boundary enforcement**: Consider adding import-linter or architecture-test tooling to prevent platform→module leakage.

2. **Provider health checks**: A global `ProviderHealthCheck` that runs at startup and is exposed via `/api/system/diagnostics` would surface partial provider failures earlier.

3. **Environment overlay for observability**: The ops observability k8s overlays (dev/staging/prod) suggest the DevOps practice is maturing — this will likely become a separate team concern.

4. **Module API versioning**: With 12 modules and growing, versioned module contracts would help platform/feature team independence.

5. **Documentation for feature teams**: Currently only architecture docs oriented toward platform audience (`docs/architecture-philosophy.md`, `docs/runtime-overview.md`, `docs/codebase-map.md`). A feature-team onboarding guide would reduce the learning curve.

## Questions / Gaps

1. What mechanism prevents modules from importing platform internals? Current evidence suggests convention only — no linter or architecture test. (Searched for: import linter, arch tests, `import-linter`, `lint`, architecture enforcement in `pyproject.toml` — no evidence found.)

2. Is there an on-call rotation or incident response procedure defined? No documentation found in repo.

3. What is the expected ratio of platform team to feature team headcount? The architecture implies a small platform team serving multiple feature teams, but no sizing guidance exists.

4. How are cross-module dependencies managed? Module services can wire through composition root, but there is no documented "module A depends on module B" contract.

5. Is there a cost budget for the observability stack in production? The `docs/observability-hosting-guide.md` discusses cost bands generally but no budget guidance specific to HelloSales.

---

Generated by `study-areas/22-organizational-architecture.md` against `hellosales`.
