# Repo Analysis: guardrails

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | guardrails |
| Path | `repos/guardrails` |
| Language / Stack | Python 3.10+, Pydantic, Typer, OpenTelemetry, LiteLLM |
| Analyzed | 2026-05-17 |

## Summary

Guardrails is structured as a Python framework library with an optional server component (`guardrails-api`). The architecture assumes a **platform-team model** where a central team maintains the framework, Hub infrastructure, and server deployment, while application developers (feature teams) consume guards and validators via the Python SDK or REST API. The system explicitly distinguishes between library-mode (embedding guards directly in app code) and server-mode (deploying guards as a standalone service). The Guardrails Hub serves as a platform-side registry and distribution mechanism for validators, reinforcing the platform/consumer boundary.

## Rating

**7/10** — Clear separation of concerns between framework authors, Hub maintainers, and application developers. Role-appropriate interfaces exist (Python SDK for devs, CLI for ops, REST API for service consumers). The server mode enables platform-team managed validation services. However, RBAC/team-level governance is not built into the system itself—it relies on external API key management and deployment topology. Minimal team would need at least 2-3 roles (framework dev, infra/platform, app dev integrating guards).

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Framework vs Server split | Library mode: `Guard().__call__()` directly wraps LLM calls; Server mode: `settings.use_server = True` switches to REST API via `GuardrailsApiClient` | `guardrails/guard.py:178-180` |
| Server architecture | `guardrails start` dynamically installs `guardrails-api` (Flask/Gunicorn) and delegates to it | `guardrails/cli/start.py:45-73` |
| CLI as ops interface | `guardrails configure` writes `.guardrailsrc` with token, metrics, remote inferencing settings | `guardrails/cli/configure.py:110` |
| CLI as ops interface | `guardrails create` generates config.py with installed validators for server mode | `guardrails/cli/create.py:98-104` |
| Hub as validator registry | Validators installed from Hub URI (`hub://guardrails/regex_match`) via `ValidatorPackageService` | `guardrails/hub/install.py:37-63` |
| Hub registry file | Project-level `.guardrails/hub_registry.json` tracks installed validators | `guardrails/hub/registry.py:9-11` |
| Optional integrations | Separate extras for langchain, llama-index, databricks — each treated as pluggable integration | `pyproject.toml:77-99` |
| Telemetry infrastructure | OpenTelemetry-based tracing for guards, LLM calls, validators, runners | `guardrails/telemetry/__init__.py:1-22` |
| API client for server mode | `GuardrailsApiClient` communicates with guardrails REST API using API key auth | `guardrails/api_client.py:16-43` |
| Remote inference support | Validators can run remotely via Guardrails AI endpoints vs local models | `guardrails/hub/install.py:102-116` |
| Developer workflow | `make dev` + `make test` + `make type` + `make autoformat` — CI validates across 4 Python versions | `Makefile:33-34`, `.github/workflows/ci.yml:23` |
| Docker server deployment | Dockerfile with gunicorn, production environment vars | `server_ci/Dockerfile:1-50` |
| Minimal config for devs | Settings singleton (`settings.py`) + `.guardrailsrc` file — simple key=value format | `guardrails/settings.py:7-50` |
| Guard creation patterns | Multiple init patterns: `for_string`, `for_pydantic`, `for_rail`, `for_rail_string` | `guardrails/guard.py:86-103` |
| Separated validator execution | Validator service split into `sequential` and `async` variants | `guardrails/validator_service/` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

The architecture assumes a **three-tier team structure**:

1. **Platform / Framework team** — Maintains the guardrails Python library, Hub infrastructure, and `guardrails-api` server. This team owns `guardrails/`, `guardrails/hub/`, `guardrails/cli/`, and the Hub registry (`hub.api.guardrailsai.com`).
2. **Validator authoring team** — Contributes validators to the Hub. The `guardrails hub` CLI subcommands (`hub.py`, `submit.py`, `create_validator.py`, `install.py`) support this workflow.
3. **Application / Feature teams** — Consumers who either import `Guard` directly (library mode) or call a deployed server (server mode). They select, install, and configure validators from the Hub.

Evidence: The `guardrails/cli/hub/` directory (`hub.py`, `install.py`, `list.py`, `uninstall.py`, `submit.py`, `create_validator.py`) serves both validator publishers and consumers. The `guard start` command (`cli/start.py`) launches a separate API server. The `integrations/` directory (`langchain/`, `llama_index/`, `databricks/`) shows recognition of varied consumer environments.

### 2. Is the system self-serve or platform-managed?

**Both, depending on mode:**

- **Self-serve (library mode)**: A developer can `pip install guardrails-ai`, configure their token via `guardrails configure`, install validators via `guardrails hub install`, and immediately use `Guard().use(RegexMatch(...)).validate(...)` — all within a single application process (`guardrails/guard.py:86-180`). No platform team involvement required for basic guard usage.

- **Platform-managed (server mode)**: A platform team deploys `guardrails start --config config.py` with Docker/Gunicorn (`server_ci/Dockerfile:50`). Application teams then call the REST API via `GuardrailsApiClient` (`guardrails/api_client.py:16-43`) or use `settings.use_server = True` (`guardrails/guard.py:178-180`). The platform team manages scaling, validator deployment, and access control via API keys.

### 3. How is ownership divided between platform and feature teams?

Ownership is divided along these boundaries:

| Boundary | Platform Team | Feature Team |
|----------|--------------|--------------|
| Validator implementation | Authors and publishes validators to Hub | Installs and configures validators via `guardrails hub install` (`hub/install.py:37-63`) |
| Server infrastructure | Deploys and maintains `guardrails-api` with Docker/Gunicorn (`server_ci/Dockerfile`, `cli/start.py:45-73`) | Consumes via REST API or `settings.use_server = True` |
| Guard configuration | May provide base config templates (`cli/hub/template_config.py.template`) | Customizes config files and parameter values (`cli/create.py:200-236`) |
| Validator registry | Maintains `hub.api.guardrailsai.com` and project-level `hub_registry.json` (`hub/registry.py:9-11`) | Reads registry to discover installed validators |
| Telemetry | Sets up OpenTelemetry collectors | Optionally contributes traces via existing infrastructure (`telemetry/__init__.py`) |
| Integration maintenance | Owns langchain, llama_index, databricks integration adapters (`integrations/`) | Uses integration adapters in their existing framework |

### 4. What operational expertise is required?

**Library mode (minimal ops):**
- Basic Python environment management
- API key/token management via `.guardrailsrc` (`cli/configure.py:22-46`)
- For remote inferencing: understanding that validators may call remote endpoints vs running locally (`hub/install.py:102-116`)

**Server mode (increased ops):**
- Docker and container orchestration (`server_ci/Dockerfile`, `.github/workflows/server_ci.yml:13-63`)
- WSGI server configuration (Gunicorn via `fastapi-entry.sh`)
- Environment variable management: `GUARDRAILS_API_KEY`, `GUARDRAILS_BASE_URL`, `OPENAI_API_KEY` (`api_client.py:24-33`)
- Telemetry pipeline setup if using OpenTelemetry exporters (`telemetry/default_otlp_tracer_mod.py`)
- Understanding of `guardrails-api` version compatibility (`cli/start.py:53-73`)

**Validator development (specialized ops):**
- Understanding of guardrail validation semantics (`validator_base.py`)
- Possible model/ML ops if validators require local models (`hub/install.py:122-131`)
- Hub submission workflow (`cli/hub/submit.py`)

### 5. How is governance enforced organizationally?

Governance is **lightweight and convention-based, not RBAC-enforced**:

- **Token-based access**: The `.guardrailsrc` token gates Hub access and remote inferencing (`cli/configure.py:119-139`, `cli/server/hub_client.py:19-25`). Tokens have expiration handling (`TOKEN_EXPIRED_MESSAGE`).
- **No team-level RBAC**: There is no built-in mechanism for team-scoped validator visibility, guard sharing, or approval workflows. The `classes/rc.py` stores only `id`, `token`, `enable_metrics`, `use_remote_inferencing` — no multi-tenant constructs.
- **Policy via server deployment**: In server mode, the platform team enforces governance by controlling which validators are installed in `config.py` and which API keys have access. This is an operational pattern, not a software feature.
- **Metrics opt-in**: Telemetry (`enable_metrics`) is user-configurable, not org-enforced (`cli/configure.py:59-63`).

### 6. What is the assumed scale of the team?

The architecture and tooling suggest:

- **Minimal**: 2-3 developers — one owning framework/infra, 1-2 consuming guards in application code.
- **Growth path**: Up to separate platform team (~3-5) maintaining server deployment, Hub interactions, and validator authorship, supporting 10-50+ application developers consuming guards via SDK or REST.
- **Enterprise gap**: No multi-tenant isolation, org-level config management, or audit logging. The `classes/history/` retains validation history per guard instance in memory with a `history_max_length` default of 10 (`guard.py:137,142`), suggesting individual developer scale, not enterprise audit.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, explicitly.**

The two-mode architecture (`use_server: bool` at `guard/guard.py:178-180`) is the primary distinction:

- **App dev mode** (`use_server=False`, default): `Guard().__call__(llm_api=openai.completions.create)` — the guard wraps the LLM call directly in-process. No infrastructure beyond the Python library required.

- **Platform dev mode** (`use_server=True`): The guard communicates with a remote `guardrails-api` server via `GuardrailsApiClient`. The platform team manages the server lifecycle, validator config, and API access. This is a separate package (`guardrails-api` in `pyproject.toml:89-91`) installed on-demand by `guardrails start` (`cli/start.py:45-48`).

Additionally, the `integrations/` directory (`langchain/`, `llama_index/`, `databricks/`) provides adapter code specifically for app developers working within those frameworks, while `cli/hub/` and `hub/install.py` are used by both roles but from different angles (authors publish, consumers install).

## Architectural Decisions

| Decision | Rationale | File:Line |
|----------|-----------|-----------|
| Library + Server dual-mode | Low-friction for individual devs, scalable for orgs; server component is optional dependency | `guard/guard.py:178-180`, `pyproject.toml:89-91` |
| Hub as external registry | Validators are versioned packages installed via pip, not bundled; enables community contributions | `hub/install.py:37-63` |
| Pydantic for schema | Leverages existing Python ecosystem; structured data generation from LLMs uses Pydantic models | `guard/guard.py:154`, README `for_pydantic` |
| OpenTelemetry for tracing | Standard observability integration; allows orgs to plug into existing telemetry pipelines | `telemetry/guard_tracing.py` |
| Project-level validator registry | Per-project `.guardrails/hub_registry.json` avoids global state; multiple projects can have different validators | `hub/registry.py:9-11` |
| Typer CLI | Modern Python CLI framework; subcommands (`create`, `start`, `configure`, `hub`) map to team workflows | `cli/guardrails.py:1-3` |
| Litellm for LLM abstraction | Single integration for 100+ LLM providers; avoids per-provider adapter code | `pyproject.toml:29` |

## Notable Patterns

1. **Lazy dependency installation**: `guardrails start` installs `guardrails-api` at runtime if missing (`cli/start.py:45-48`), keeping base install lean.
2. **Dual sync/async support**: `Guard` and `AsyncGuard` (`async_guard.py`) are separate classes, not a unified interface — suggesting sync is the primary path.
3. **Remote inferencing opt-in**: Validators with cloud endpoints can run inference remotely or locally, configurable at install time (`hub/install.py:102-116`).
4. **Pydantic schema from LLM**: Structured generation falls back from function calling to prompt manipulation (`README` "Prompt optimization" path), showing pragmatic layering.
5. **Run patterns**: `Runner`, `StreamRunner`, `AsyncRunner`, `AsyncStreamRunner` (`run/`) are separated, not composed — favoring clarity over abstraction.

## Tradeoffs

| Tradeoff | Implication |
|----------|-------------|
| Library + Server = two codebases | `guardrails-api` is a separate package; version mismatches possible (`cli/start.py:53-73`). Platform team must track both repos. |
| Hub validators installed via pip | Version management and dependency conflicts are pushed to the consumer. No sandboxing per guard. |
| In-memory history only | `history_max_length=10` default; no persistence layer for audit. Production deployments need external logging. |
| No built-in multi-tenancy | Org-level governance is entirely operational (API keys, network policies). Each deployment is single-tenant. |
| Sync-first design | `AsyncGuard` is a separate class, not a mixin — more code duplication, less composability. |
| Telemetry is opt-in | `enable_metrics: bool` defaults to True but requires user confirmation during `configure`; adoption is voluntary. |

## Failure Modes / Edge Cases

1. **Expired Hub token**: User must re-run `guardrails configure` (`cli/server/hub_client.py:19-20`); all Hub operations (install, submit) fail silently or with auth errors.
2. **Invalid version guardrails-api**: Server fails to start if `guardrails-api` is too old for features like `env_override` (`cli/start.py:63-73`).
3. **Missing local models**: If `install_local_models` is not explicitly set, install blocks with `LocalModelFlagNotSet` error (`hub/install.py:31-34`).
4. **Registry corruption**: `.guardrails/hub_registry.json` can be invalid; `get_registry()` logs a warning and returns empty registry (`hub/registry.py:21-22`), which may cause silent validator failures.
5. **Cross-project token sharing**: Single `.guardrailsrc` in `$HOME` means all projects share the same token and config; no per-project granularity.

## Future Considerations

- Multi-tenant server mode with org-level guard catalogs and RBAC
- Persistent validation history for audit trails
- Guard composition / pipelines across multiple validators with shared context
- Per-project `.guardrailsrc` support for isolated configurations
- Declarative guard config in YAML/JSON (beyond the minimal config.py template)

## Questions / Gaps

- No evidence found for how the Hub validates author submissions (validator quality/review process). The `cli/hub/submit.py` exists but its governance model is unclear without examining the external Hub API.
- No clear evidence about deployment rollback strategy for server-mode guardrails-api. The Docker CI builds and tests but no canary/staging patterns are documented.
- The `server_ci/fastapi-entry.sh` script was not examined — it may contain additional operational assumptions about server startup.
- Minimal evidence about how `guardrails-api` itself handles multi-tenant request routing (if at all).

---

Generated by `study-areas/22-organizational-architecture.md` against `guardrails`.
