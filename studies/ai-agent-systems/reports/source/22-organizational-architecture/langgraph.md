# Repo Analysis: langgraph

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | langgraph |
| Path | `repos/langgraph` |
| Language / Stack | Python (primary), TypeScript (JS SDK + UI) |
| Analyzed | 2026-05-17 |

## Summary

LangGraph is designed as a **platform-level orchestration framework** with a clear separation between three organizational roles: **platform/infra engineers** who deploy and operate the server, **AI application developers** who build agent graphs, and **API consumers** who interact with deployed agents. The monorepo structure (`libs/`) isolates nine sub-libraries with well-defined dependency chains, enabling parallel ownership and independent release cycles. Deployment assumes LangSmith as the governance plane and offers multiple runtime modes scaling from single-developer in-memory dev to distributed production deployments.

## Rating

**8/10** — Clear separation of concerns with role-appropriate interfaces. The architecture is designed for platform teams with a self-serve API surface for feature teams. The system explicitly distinguishes app development (`StateGraph` API / `create_react_agent`) from platform development (CLI, Docker, config management). What prevents a 9–10 is the strong coupling to LangSmith as the sole deployment platform — there's no self-hosted governance story outside the LangSmith ecosystem.

Fast heuristic: **"Yes, a platform team and a feature team could work independently."**

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Monorepo structure | 9 sub-libraries under `libs/` with explicit dependency map | `repos/langgraph/AGENTS.md:1-36` |
| Dependency chain | `checkpoint → langgraph/prebuilt`, `sdk-py → langgraph/cli` | `repos/langgraph/AGENTS.md:26-36` |
| Three-tier API surface | Low-level (`StateGraph`), mid-level (`create_react_agent`), high-level (SDK clients) | `repos/langgraph/libs/prebuilt/langgraph/prebuilt/__init__.py:1-12` |
| Runtime modes | `combined_queue_worker` (default) vs `distributed` (separate orchestrator + executor containers) | `repos/langgraph/libs/cli/langgraph_cli/cli.py:165-170` |
| Deployment paths | `langgraph dev` (in-memory) / `up` (Docker) / `build` (image) / `deploy` (LangSmith) | `repos/langgraph/libs/cli/langgraph_cli/cli.py:237-366, 405-457, 653-817` |
| Platform dependency | Production requires `LANGSMITH_API_KEY` or `LANGGRAPH_CLOUD_LICENSE_KEY` | `repos/langgraph/libs/cli/langgraph_cli/cli.py:289-292` |
| Config complexity | 30+ config keys in `Config` TypedDict for deployment | `repos/langgraph/libs/cli/langgraph_cli/schemas.py:615-774` |
| Auth access control | Four access contexts: `threads.create_run`, `threads.update`, `threads.read`, `assistants.read` | `repos/langgraph/libs/sdk-py/langgraph_sdk/runtime.py:28-33` |
| Auth/Encryption/Webhooks config | Each as first-class config sections | `repos/langgraph/libs/cli/langgraph_cli/schemas.py:308-353, 356-374, 575-591` |
| Checkpointer diversity | SQLite (dev) / Postgres (prod) / custom (via config path) | `repos/langgraph/libs/cli/langgraph_cli/schemas.py:193-233` |
| Reserved package names | Blocks local packages named `langgraph`, `langchain-core`, `pydantic`, etc. | `repos/langgraph/libs/cli/langgraph_cli/config.py:554-568` |
| JS/Node support | Node.js graphs detected by file extension (.ts, .js, .mjs, .cjs) | `repos/langgraph/libs/cli/langgraph_cli/config.py:144-159` |
| Example config | JSON config listing dependencies, graphs, env, pip config | `repos/langgraph/libs/cli/examples/langgraph.json:1-17` |
| Prebuilt agents | `create_react_agent()` is a self-serve API for feature teams | `repos/langgraph/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:1-80` |
| Factory pattern | Server calls graph factory in multiple contexts; `ServerRuntime` distinguishes execution vs introspection | `repos/langgraph/libs/sdk-py/langgraph_sdk/runtime.py:36-127` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

The architecture assumes at least **two distinct teams** (platform and feature) and optionally a **third** (API consumer/integrator). The monorepo layout with 9 sub-libraries (`libs/` in `repos/langgraph/AGENTS.md:1-36`) implies separate ownership boundaries — the dependency chain (`checkpoint → prebuilt/langgraph → sdk-py/cli → sdk-js`) maps directly to team boundaries. The `prebuilt` package provides a high-level `create_react_agent()` (`libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:4`) that shields application developers from the low-level `StateGraph` API.

### 2. Is the system self-serve or platform-managed?

**Both.** Framework users self-serve by calling `create_react_agent()` or building `StateGraph` objects. Deployment is platform-managed via the CLI (`libs/cli/langgraph_cli/cli.py:237-366`) and requires a `langgraph.json` config file with 30+ fields (`libs/cli/langgraph_cli/schemas.py:615-774`). On the LangSmith platform, deployment is fully managed — the CLI handles Docker builds, registry pushes, and revision polling (`libs/cli/langgraph_cli/deploy.py:852-1028`).

### 3. How is ownership divided between platform and feature teams?

**Platform team** owns: deployment config (`langgraph.json`), Docker images, Postgres/checkpointer setup, auth/encryption config, CORS, webhooks, infrastructure. **Feature team** owns: graph logic (Python files), state schemas, tools, conditional edges, prebuilt agent configuration. The `langgraph build` command (`libs/cli/langgraph_cli/cli.py:405-457`) builds a Docker image from the feature team's code — this is the handoff boundary.

### 4. What operational expertise is required?

Substantial. Production deployment requires:
- Docker and Docker Compose (`libs/cli/langgraph_cli/cli.py:352-365`)
- Postgres database administration (`DEFAULT_POSTGRES_URI` at `libs/cli/langgraph_cli/docker.py:15-17`)
- LangSmith platform access (`libs/cli/langgraph_cli/cli.py:289-292`)
- Understanding of `langgraph.json` schema with all its config sections (`libs/cli/langgraph_cli/schemas.py:615-774`)
- Optionally: custom auth (`AuthConfig`), encryption (`EncryptionConfig`), webhook setup (`WebhooksConfig`)

### 5. How is governance enforced organizationally?

Governance is enforced through the **LangSmith platform**, not the framework itself. The CLI requires `LANGSMITH_API_KEY` or `LANGGRAPH_CLOUD_LICENSE_KEY` (`libs/cli/langgraph_cli/cli.py:289-292`). The SDK differentiates access levels via `AccessContext` (`libs/sdk-py/langgraph_sdk/runtime.py:28-33`) — distinguishing run execution, state reads, updates, and introspection. Custom auth can be injected at the server level (`AuthConfig` at `libs/cli/langgraph_cli/schemas.py:308-353`). There is no org-level RBAC in the framework itself; that is delegated to the deployment platform.

### 6. What is the assumed scale of the team?

The architecture supports **1–dozens of developers**. The `combined_queue_worker` runtime mode (`libs/cli/langgraph_cli/cli.py:167`) assumes small teams and simple deployments. The `distributed` mode (separate orchestrator+executor containers, `libs/cli/langgraph_cli/cli.py:166-170`) targets larger platform teams running multi-tenant infrastructure. The monorepo structure with 9 libraries assumes enough headcount to maintain each sub-project independently.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, explicitly.** Three evidence points:
1. **Tiered API surface**: Low-level `StateGraph`/`Pregel` for framework developers, mid-level `create_react_agent()` (`libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:4`) for application developers, SDK clients for API consumers.
2. **Server config vs graph code**: `langgraph.json` (platform) is separate from `graphs/*.py` (app dev) — the config references graph code by file path (`libs/cli/examples/langgraph.json:13-14`).
3. **Graph factory pattern**: The `ServerRuntime` abstraction (`libs/sdk-py/langgraph_sdk/runtime.py:36-127`) distinguishes execution contexts from introspection contexts — platform code configures this, while app devs just provide the graph factory function.

## Architectural Decisions

| Decision | Evidence | Rationale |
|----------|----------|-----------|
| Monorepo with 9 libs | `repos/langgraph/AGENTS.md:1-36` | Enables independent ownership, release cycles, and testing |
| CLI as gateway to deploy | `repos/langgraph/libs/cli/langgraph_cli/cli.py:237-366`, `libs/cli/langgraph_cli/deploy.py:852-1028` | Separates development from operations; CLI owns Docker/config |
| LangSmith coupling | `repos/langgraph/libs/cli/langgraph_cli/cli.py:289-292` | Offloads governance, monitoring, deployment management |
| Dual runtime modes | `repos/langgraph/libs/cli/langgraph_cli/cli.py:165-170` | Single-container for small teams, distributed for platform teams |
| Prebuilt agents as abstraction | `repos/langgraph/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:1-80` | Lowers barrier for feature teams; self-serve agent creation |
| Config-driven deployment | `repos/langgraph/libs/cli/langgraph_cli/schemas.py:615-774` | Platform ops can modify infra without touching application code |
| Checkpointer diversity | SQLite, Postgres, custom (`libs/checkpoint*`, `libs/cli/langgraph_cli/schemas.py:193-233`) | Dev (SQLite) vs prod (Postgres) separation; custom for specialized needs |
| Auth as pluggable config | `repos/langgraph/libs/cli/langgraph_cli/schemas.py:308-353` | Organization-specific auth (OAuth2, SAML, etc.) without framework changes |

## Notable Patterns

1. **Dependency injection via factory**: The graph factory pattern (`libs/sdk-py/langgraph_sdk/runtime.py:36-127`) injects `ServerRuntime` context into graph construction, allowing conditional resource setup (MCP, DB connections) without coupling app code to infrastructure.

2. **Build-time/Docker hygiene**: The CLI generates Dockerfiles that strip build tools from the final image (`libs/cli/langgraph_cli/config.py:951-97`), blocks dangerous shell characters in build commands (`libs/cli/langgraph_cli/config.py:19-32`), and reserves package names (`libs/cli/langgraph_cli/config.py:554-568`). This is platform-team concern, invisible to feature teams.

3. **Faux package support**: For local Python directories without `pyproject.toml`, the CLI dynamically generates packaging metadata (`libs/cli/langgraph_cli/config.py:1179-1201`). This accommodates orgs that don't enforce Python packaging standards.

4. **Three deployment channels**: `dev` (in-memory, no infra), `up` (Docker Compose), `deploy` (LangSmith managed) — maps to dev→staging→production progression.

## Tradeoffs

| Tradeoff | Detail |
|----------|--------|
| LangSmith lock-in vs operational simplicity | Production deployment effectively requires LangSmith. Self-hosted alternatives exist (Docker Compose) but lack governance features. |
| Monorepo complexity vs clean ownership | 9 libs with uv workspace dependencies (`repos/langgraph/libs/langgraph/pyproject.toml:83-89`) require CI maturity but enable clean team boundaries. |
| Config complexity vs flexibility | 30+ config keys create a steep learning curve for new platform engineers but enable extensive customization. |
| Python-only framework vs polyglot orgs | Core is Python; JS support exists (SDK, UI) but JS graphs are second-class (`libs/cli/langgraph_cli/config.py:144-159`). |
| In-memory dev vs prod parity | `langgraph dev` (`libs/cli/langgraph_cli/cli.py:653-817`) skips Docker/Postgres, reducing iteration time but risking environment mismatch. |

## Failure Modes / Edge Cases

1. **Reserved package name collision**: If a feature team names their package `langgraph`, deployment fails silently (`libs/cli/langgraph_cli/config.py:554-568`). No clear error message in the build output.

2. **Missing config file**: `langgraph up` with no `langgraph.json` causes opaque failures. Validation (`libs/cli/langgraph_cli/config.py:170-402`) is thorough but happens late in the CLI pipeline.

3. **Cross-platform graph paths**: The config-to-Docker path rewriting (`libs/cli/langgraph_cli/config.py:669-766`) works for Python but JSON notebooks/unusual structures may produce incorrect container paths.

4. **Auth middleware ordering**: The `middleware_order` config (`libs/cli/langgraph_cli/schemas.py:511-520`) can cause auth bypasses if misconfigured (auth after custom middleware).

## Future Considerations

- A self-hosted governance dashboard would reduce the LangSmith dependency for orgs with compliance requirements.
- The `distributed` runtime mode (`libs/cli/langgraph_cli/cli.py:166-170`) is still maturing; additional tooling for orchestrator/executor management would benefit platform teams.
- More prebuilt templates (beyond `create_react_agent`) would further lower the barrier for feature teams.

## Questions / Gaps

1. **No evidence found** for how LangGraph handles multi-tenant resource isolation (CPU/memory per graph) — this appears entirely delegated to the platform layer (Kubernetes/Docker Compose resource limits).
2. **No evidence found** for org-level team management or multi-workspace RBAC within the SDK — governance is entirely outsourced to LangSmith.
3. The `prebuilt` package is the clearest self-serve API, but it only covers ReAct agents. Other common patterns (tool-use-only, supervisor/swarm) are documented in examples but not prebuilt.
4. **No evidence found** for how the framework would fit into an existing enterprise CI/CD pipeline (e.g., staging vs production config promotion). This is left entirely to the adopting organization.

---
Generated by `study-areas/22-organizational-architecture.md` against `langgraph`.
