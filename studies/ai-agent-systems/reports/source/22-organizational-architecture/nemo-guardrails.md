# Repo Analysis: nemo-guardrails

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | nemo-guardrails |
| Path | `repos/nemo-guardrails` |
| Language / Stack | Python, Colang, YAML, Docker |
| Analyzed | 2026-05-17 |

## Summary

NeMo Guardrails is an open-source toolkit from NVIDIA for adding programmable guardrails to LLM-based conversational systems. It is designed as a library-first toolkit rather than a managed platform. The architecture assumes a **small team of developer-generalists** who can work across Python (actions), YAML (configuration), Colang (dialog flows), and DevOps (server deployment). It does not enforce organizational boundaries through code — there is no RBAC, no multi-tenant isolation, and no workspace concept. Instead, organizational structure is implied through its modular boundaries: the core engine, the actions server, the library of pre-built rails, and the server API each create natural separation points where different roles or teams could take ownership.

## Rating

**Rating: 5/10** — NeMo Guardrails recognizes team structures (it distinguishes between devs who write actions, devs who configure rails, and operators who run servers) but provides no tooling to enforce or manage those boundaries. There are no RBAC primitives, no multi-config governance, no deployment workflows, and no audit trails. The separation of concerns exists in the codebase structure but is entirely convention-based.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| CLI server command | Server started via CLI, config path as argument, defaults to `./config` directory | `nemoguardrails/cli/__init__.py:121-199` |
| CLI chat command | Interactive chat loads config from local path, no multi-config support | `nemoguardrails/cli/__init__.py:50-117` |
| CLI actions-server | Separate process for custom actions on port 8001 | `nemoguardrails/cli/__init__.py:245-262` |
| Dockerfile | Single container, all-in-one deployment, exposes port 8000 | `Dockerfile:18-59` |
| No RBAC | Server has CORS middleware but zero auth/authorization primitives | `nemoguardrails/server/api.py:157-172` |
| Config-driven | Config structure: `config.yml` + `actions.py` + `config.py` + `.co` files | `README.md:139-150` |
| Plugin library | Pre-built rails organized as sub-packages under `library/` (30+ modules) | `nemoguardrails/library/` |
| Action dispatcher | Actions registered at runtime via `ActionDispatcher`, loaded from config dirs | `nemoguardrails/actions/action_dispatcher.py` |
| Provider extensibility | LLM providers registered via framework registry | `nemoguardrails/llm/providers/__init__.py:26-27` |
| LangChain integration | Opt-in, environment-flag-gated | `README.md:287` |
| QA directory | Separate QA tooling with its own Dockerfile | `qa/Dockerfile.qa` |
| Extras system | Optional dependency groups for server, eval, tracing, jailbreak detection, etc. | `pyproject.toml:114-143` |
| Auto-reload server | File watcher for config changes in server mode | `nemoguardrails/server/api.py:636-689` |
| GitFlow branching | GitFlow branching model with main, develop, feature, release, hotfix branches | `CONTRIBUTING.md:189-206` |
| DCO + GPG signing | Developer Certificate of Origin and GPG-signed commits required | `CONTRIBUTING.md:378-420` |
| Multi-config server | Server can load multiple config directories, config selector via Chainlit UI | `nemoguardrails/server/app.py:46-61,81-90` |
| OpenAI-compatible API | Server exposes `/v1/chat/completions` mimicking OpenAI API | `nemoguardrails/server/api.py:440-598` |
| Telemetry / OTEL | OpenTelemetry tracing for LLM and API calls | `nemoguardrails/guardrails/telemetry.py`, `pyproject.toml:82-83` |
| CI workflows | GitHub Actions: PR tests, full tests, lint, Docker build, PyPI publish | `.github/workflows/` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

The architecture assumes either a **single developer-generalist** or a **small team** (2–5 people) where each member can work across the full stack. Evidence:

- The `config.yml` structure bundles runtime config, custom actions (`actions.py`), and initialization code (`config.py`) in one directory, implying one person/team owns the full config (`README.md:139-150`).
- There is no multi-tenant isolation, no workspace concept, and no RBAC. The server is either single-config or loads all configs from a flat directory (`nemoguardrails/server/api.py:197-212`).
- The `qa/` directory with its own Dockerfile (`qa/Dockerfile.qa`) hints at a separate QA function, but it's co-located in the same repo.

### 2. Is the system self-serve or platform-managed?

**Self-serve** for developers. The architecture is a **library first, server second**:

- The primary API is `LLMRails.generate()` called directly from Python code (`README.md:88-98`).
- The server is an optional add-on (`pyproject.toml:121` under `[tool.poetry.extras] server`).
- The Dockerfile and `nemoguardrails server` CLI enable a platform-managed mode, but there is no managed control plane, no dashboard for non-technical users, and no admin API.

### 3. How is ownership divided between platform and feature teams?

Ownership division is **implicit, not enforced**:

- **Config owners** (feature teams) own the `config/` directory: `config.yml`, `actions.py`, `rails.co` files. They can define dialog flows, custom actions, and LLM model selection.
- **Platform team** owns the server deployment (Docker, `nemoguardrails server`), the core engine (`nemoguardrails/rails/llm/llmrails.py`), and the shared library of guardrails (`nemoguardrails/library/`).
- Separation is by convention (folder boundaries) rather than API contracts. Nothing prevents a config from importing from another config's directory.
- The config loading code in `nemoguardrails/server/api.py:296-360` does enforce a path-safety check (`re.search(r"[\\/]|(\.\.)", config_id)`) to prevent directory traversal, but this is a security measure, not an ownership boundary.

### 4. What operational expertise is required?

**Medium-to-high** operational expertise:
- Python environment management (Poetry, `pyproject.toml:228-229` build system)
- Docker for containerized deployment (`Dockerfile:18-59`)
- LLM provider API keys and model configuration (`README.md:113-114`)
- For on-premise LLMs: NVIDIA Triton Inference Server or compatible infrastructure
- Optional: OpenTelemetry for tracing (`pyproject.toml:82-83`), Redis/postgres for datastore (`nemoguardrails/server/api.py:88-92`)
- Colang knowledge for defining custom dialog flows

### 5. How is governance enforced organizationally?

**No code-level governance enforcement.** Governance is entirely process-based:
- GitFlow branching model (`CONTRIBUTING.md:189-206`) creates review gates
- DCO and GPG-signing (`CONTRIBUTING.md:378-420`) provide attestation
- Pre-commit hooks (`CONTRIBUTING.md:307-311`) enforce code style
- CI pipeline runs tests and linting (`.github/workflows/`)
- The server exposes a `register_logger()` function for audit logging (`nemoguardrails/server/api.py:631-633`), but it is opt-in with no default implementation

There is no approval workflow for config changes, no schema validation of configs at deploy time, and no enforcement of which teams can modify which configs.

### 6. What is the assumed scale of the team?

**Small team (1–5 developers).** Evidence:
- The `pyproject.toml` has a single `authors` field (`pyproject.toml:4`)
- No service mesh, no Kubernetes manifests, no multi-region deployment configs
- The server is a single FastAPI process with no sharding or partitioning
- The auto-reload feature (`nemoguardrails/server/api.py:636-689`) is designed for local development iteration, not production multi-team workflows
- Single Dockerfile, all-in-one container

### 7. Does the architecture distinguish app dev vs platform dev?

**Partially.** The distinction exists in the codebase structure but is not formalized:
- **Platform dev** owns: `nemoguardrails/` core, `nemoguardrails/library/` (30+ pre-built rail modules), `nemoguardrails/server/`, `nemoguardrails/actions_server/`
- **App dev** owns: `config/` directory (colang flows, actions.py, config.yml)
- The `integrations/langchain/` directory provides an opinionated path for app devs using LangChain
- However, both roles use the same Python toolkit — no separate SDK, no API gateway, no versioned contracts between platform and app layers

## Architectural Decisions

1. **Async-first core** (`nemoguardrails/rails/llm/llmrails.py:110`, README `:108-110`): The runtime is built on Python async, supporting both sync and async public APIs. This implies developers must understand async Python patterns.

2. **Colang as a DSL** (`README.md:215-225`): Custom dialog modeling language creates a learning curve but allows non-Pythonists to author flows. Two versions (1.0 and 2.0-alpha) imply evolving standards but also fragmentation risk.

3. **Library of pre-built rails** (`nemoguardrails/library/`): 30+ modules (ActiveFence, jailbreak detection, topic safety, etc.) ship as optional extras. This reduces the need for app teams to build guardrails from scratch.

4. **Separate actions server** (`nemoguardrails/actions_server/actions_server.py:1-83`): Custom Python actions run in a separate process, enabling independent scaling and lifecycle management. Implies a microservices-oriented ops model.

5. **OpenAI-compatible server API** (`nemoguardrails/server/api.py:440-598`): The `/v1/chat/completions` endpoint means teams can swap out a direct OpenAI call for a guardrailed version with minimal code changes.

6. **Opt-in integrations** (`pyproject.toml:114-143`, README `:287`): LangChain and other integrations are environment-flag-gated, allowing teams to choose their LLM framework without lock-in.

## Notable Patterns

- **Extras-driven modularity**: The `pyproject.toml` uses optional dependency groups (sdd, eval, gcp, tracing, jailbreak, multilingual, server, chat-ui) to let teams pull only what they need. This is a "batteries included but removable" pattern.

- **Dual public API surface**: Both `LLMRails.generate()` (Python API) and the HTTP server (`POST /v1/chat/completions`) are first-class. This allows the same config to be used in embedded and server modes.

- **Registry pattern for extensibility**: LLM providers (`nemoguardrails/llm/providers/__init__.py:26-27`), embedding providers, frameworks (`nemoguardrails/llm/frameworks/registry.py`), and actions (`nemoguardrails/actions/action_dispatcher.py`) all use runtime registries. This encourages a plugin ecosystem.

- **Convention over configuration for config loading**: The server auto-detects single vs multi-config mode by checking for `config.yml` at the root vs subdirectory level (`nemoguardrails/server/api.py:107-114`).

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| **Rich vs complex** | Colang DSL enables powerful dialog control but adds a domain language that not all team members will know. |
| **Flexible vs boilerplate** | The config structure is unopinionated (any YAML, any structure within conventions), which means teams must develop their own standards. |
| **Library vs platform** | Library-first design gives developers full control but puts operational burden on the team — no managed dashboard, no usage analytics built-in. |
| **All-in-one vs separated** | Single Docker image with everything is easy to start but conflates guardrails engine, actions server, and chat UI into one process. Production deployments likely need to split them. |
| **Extensible vs fragmented** | 30+ library modules plus plugin registries mean teams can tailor the system, but the knowledge required to select, tune, and maintain these modules grows. |

## Failure Modes / Edge Cases

1. **No isolation between configs**: Multi-config server mode loads all configs into the same process. A bug in one config's `actions.py` can crash the server for all configs (`nemoguardrails/server/api.py:250-251` uses a shared `llm_rails_instances` dict).

2. **Implicit ownership breaks at scale**: Without RBAC or workspace isolation, there is no mechanism to prevent one team from reading or modifying another team's configs on a shared server.

3. **Observability gap**: The `register_logger()` hook (`nemoguardrails/server/api.py:631-633`) requires teams to implement their own audit logging. Default is no logging — violations are invisible.

4. **Colang v1→v2 migration**: Two active versions of Colang (1.0 and 2.0-alpha) with a migration CLI (`nemoguardrails/cli/__init__.py:203-242`) imply organizational overhead: teams must track which version they use and manage migrations.

5. **Secrets management**: Configs include LLM API keys in `config.yml`. The library stores them as `SecretStr` (Pydantic) but there's no built-in vault integration or encryption at rest for config files.

## Future Considerations

- Multi-tenant server with configuration-level isolation and per-config RBAC
- Declarative config schema validation at deploy time
- Managed dashboard for non-technical governance reviewers
- Audit log defaults (not just hooks)
- Kubernetes Operator or Helm chart for production deployment patterns
- Versioned API contracts between config layer and core engine

## Questions / Gaps

1. **No evidence found** of how multi-team collaboration is handled at the platform level (shared servers, config distribution, change management). The repo assumes a single-team workflow.

2. **No evidence found** of how incidents (e.g., a guardrail failing to block a jailbreak) are attributed and rolled back. The auto-reload feature (`nemoguardrails/server/api.py:636-689`) supports hot-reload but no canary or staged rollout mechanism.

3. **No evidence found** of a formal on-call or escalation model. The server logs errors but provides no health check endpoints beyond `GET /` returning `{"status": "ok"}` (`nemoguardrails/server/api.py:732-734`).

4. **No evidence found** of how the platform team manages the lifecycle of the 30+ library rails across configs — are they pinned by version? Overridable? Checked for compatibility?

---

Generated by `study-areas/22-organizational-architecture.md` against `nemo-guardrails`.
