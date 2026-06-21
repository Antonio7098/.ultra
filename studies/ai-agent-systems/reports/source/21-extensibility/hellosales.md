# Repo Analysis: hellosales

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | hellosales |
| Path | `repos/hellosales` |
| Language / Stack | Python 3.12+ — FastAPI, SQLAlchemy, Pydantic, Stageflow |
| Analyzed | 2026-05-17 |

## Summary

hellosales is a backend CRM/sales assistant with a **protocol-based provider architecture** that mirrors a plugin system but lacks auto-discovery, formal plugin loading, or versioned APIs. Extension is accomplished through **code-driven composition** — every provider, agent, worker, tool, and module is explicitly imported and wired in a central composition root (`platform/composition/app_container.py:109`). The system exposes typed `Protocol` interfaces for replaceable seams (LLM, auth, web search, voice, persistence), and a scaffolding CLI for generating new modules. However, adding any new capability requires modifying at least one existing file in the composition root, and there is no runtime discovery mechanism.

## Rating

**Score: 6/10** — Ad-hoc extension through code modification, approaching well-defined interfaces.

The system has well-defined `typing.Protocol` interfaces for all provider types and clean data-class contracts for agents/workers/tools. But there is no plugin discovery, no versioned APIs, no formal lifecycle management for extensions, and every extension requires manual wiring in the composition root. The "add a tool without touching core agent code" heuristic fails: adding a tool requires editing `application/tools/__init__.py` and the agent definition bootstrap file.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Provider Protocols | `LLMProviderPort` protocol definition | `src/hello_sales_backend/platform/llm/contracts.py:91` |
| Provider Protocols | `AuthProviderPort` protocol definition | `src/hello_sales_backend/platform/auth/contracts.py:21` |
| Provider Protocols | `WebSearchProviderPort` protocol definition | `src/hello_sales_backend/platform/web_search/contracts.py:67` |
| Provider Protocols | `STTProviderPort`, `TTSProviderPort`, `RealtimeVoiceProviderPort` | `src/hello_sales_backend/platform/voice/contracts.py:223-308` |
| Provider Protocols | `AgentStorePort` persistence protocol | `src/hello_sales_backend/platform/agents/persistence.py:17` |
| Provider Registration | `build_provider_registry()` wires all providers from settings | `src/hello_sales_backend/platform/composition/providers.py:123` |
| Auth Provider Selection | `WorkOSAuthProvider` selected based on `HELLO_SALES_AUTH_PROFILE` | `src/hello_sales_backend/platform/composition/providers.py:136` |
| LLM Provider Selection | `OpenAICompatibleLLMProvider` selected based on `HELLO_SALES_GENERIC_AGENT_PROVIDER` | `src/hello_sales_backend/platform/composition/providers.py:154` |
| Web Search Selection | `TavilyWebSearchProvider` vs `NoopWebSearchProvider` | `src/hello_sales_backend/platform/composition/providers.py:171` |
| Agent Definitions | `AgentRegistry` assembled in `build_agent_registry()` | `src/hello_sales_backend/application/agents/bootstrap.py:20` |
| Worker Definitions | `WorkerRegistry` assembled in `build_worker_registry()` | `src/hello_sales_backend/application/workers/bootstrap.py:17` |
| Tool Catalog | `AgentToolCatalog` — list of `AgentToolDefinition` with Pydantic args | `src/hello_sales_backend/platform/agents/tools.py:149` |
| Tool Exports | Tool factory functions exported from `__init__.py` | `src/hello_sales_backend/application/tools/__init__.py:1` |
| Composition Root | `build_app_container()` — explicit wiring of all dependencies | `src/hello_sales_backend/platform/composition/app_container.py:109` |
| AppOverrides | Overrides dataclass for testing / environment-specific wiring | `src/hello_sales_backend/platform/composition/overrides.py:23` |
| Module Registry | Typed dataclass `ModuleRegistry` with per-module fields | `src/hello_sales_backend/platform/composition/module_registry.py:21` |
| Settings (Provider Whitelist) | `SUPPORTED_AUTH_PROVIDERS`, `SUPPORTED_WEB_SEARCH_PROVIDERS`, validators | `src/hello_sales_backend/platform/config/settings.py:23-25,200-234` |
| Settings (Provider Base URLs) | `PROVIDER_BASE_URLS` hardcodes known provider URL mappings | `src/hello_sales_backend/platform/config/settings.py:15-20` |
| Settings (API Key Mapping) | `resolved_generic_agent_api_key` hardcodes per-provider key names | `src/hello_sales_backend/platform/config/settings.py:281-291` |
| Scaffold Module CLI | `hello-sales-scaffold-module` command — renders module templates | `src/hello_sales_backend/cli/scaffold_module.py:1` |
| HTTP Route Mounting | Routes manually mounted in `router.py` | `src/hello_sales_backend/entrypoints/http/router.py:16-22` |
| Workflow Stages | `WorkflowStageSpec`, stage kinds: GUARD, WORK, TRANSFORM | `src/hello_sales_backend/platform/workflows/pipeline.py:1` |
| Workflow Interceptors | `StageScopedIdempotencyInterceptor` | `src/hello_sales_backend/platform/workflows/runtime.py:33` |
| Smoke Test Registry | Dict-based registry of suite name to callable | `src/hello_sales_backend/smoke/registry.py:1` |
| Architect Docs | `docs/codebase-map.md` — maps packages to responsibilities | `docs/codebase-map.md` |
| Entry Points | `hello-sales-smoke`, `hello-sales-verify-db`, `hello-sales-scaffold-module` | `pyproject.toml:26-29` |

## Answers to Protocol Questions

**1. What are the primary extension points?**

Six categories: (a) Provider implementations — LLM, Auth, Web Search, Voice via `typing.Protocol` interfaces; (b) Agent definitions — `AgentDefinition` data classes wired in `application/agents/bootstrap.py:20`; (c) Worker definitions — `WorkerDefinition` data classes wired in `application/workers/bootstrap.py:17`; (d) Agent tools — `AgentToolDefinition` instances collected into an `AgentToolCatalog` at `platform/agents/tools.py:149`; (e) Application modules — each module has a `build_*_module()` function and is stored in the typed `ModuleRegistry` at `platform/composition/module_registry.py:21`; (f) Workflow stages — `WorkflowStageSpec` pipeline specs at `platform/workflows/pipeline.py:1`.

**2. How are custom tools/providers added?**

Tools: Write a factory function returning `AgentToolDefinition` in `application/tools/<name>.py`, export it in `application/tools/__init__.py:1`, add it to the relevant agent definition in `application/agents/definitions/<name>/agent.py`. Providers: Implement the appropriate protocol (e.g., `LLMProviderPort`), add selection logic in `platform/composition/providers.py:123`, potentially update `PROVIDER_BASE_URLS` and `resolved_generic_agent_api_key` in `settings.py:15-20,281-291`, and add the provider name to the whitelist validator in `settings.py:23-25,200-234`.

**3. Are there hooks/middleware for customization?**

Yes, but they are infrastructure-focused, not extension-focused: `StageScopedIdempotencyInterceptor` at `platform/workflows/runtime.py:33` for workflow idempotency, `AuthenticationMiddleware` (FastAPI middleware) for HTTP auth, `RequestContextMiddleware` for correlation IDs, and OpenTelemetry instrumentation. There are no general-purpose user-facing hooks or plugin middleware interfaces.

**4. Is extension configuration-driven or code-driven?**

Overwhelmingly **code-driven**. Configuration (env vars) selects which provider implementation to use and sets API keys/URLs, but every new capability — tool, agent, worker, module, route, workflow stage — requires writing Python code and editing at least one existing file in the composition root.

**5. How stable are extension interfaces?**

Moderately stable but not versioned. Provider protocols (`LLMProviderPort`, `AuthProviderPort`, etc.) are simple `typing.Protocol` classes with few methods — they change infrequently. Agent/Worker definitions are `@dataclass(slots=True, frozen=True)` at `application/agents/contracts.py:33` and `application/workers/contracts.py:40`, meaning adding fields is a breaking change. Persistence protocols (`AgentStorePort` at `platform/agents/persistence.py:17`) have a broader surface area and would be more costly to implement. No interfaces carry version markers or deprecation annotations.

**6. How are breaking changes managed?**

No formal mechanism. Evidence: no versioned contracts, no API deprecation headers, no semver for the package, no backward-compatibility wrappers. The `platform/providers/` directory contains backward-compatible re-exports (e.g., `platform/providers/llm/contracts.py` re-exports from `platform/llm/contracts.py`), suggesting an ad-hoc migration from a previous structure, but this pattern is not systematized.

**7. What is intentionally NOT extensible?**

(a) Provider whitelist — `settings.py:23-25` restricts auth, web search, and voice providers to known values; custom provider names are rejected at validation. (b) Provider base URL mappings — `settings.py:15-20` hardcodes `groq`, `openrouter`, `openai`, `openai-compatible`; new providers require a code change. (c) API key resolution — `settings.py:281-291` hardcodes which env var maps to each provider name. (d) Module registry shape — `module_registry.py:21` is a frozen typed dataclass; adding a module requires adding a field. (e) Workflow engine — `stageflow-core` is a hard dependency at `platform/workflows/runtime.py:254`.

**8. How discoverable are extension points?**

Low to medium. Provider protocols are not indexed in a central registry — a developer must read each `platform/*/contracts.py` file individually. The composition root (`app_container.py:109`) serves as a partial index but requires navigating a 188-line function. The settings file (`settings.py`) documents all env vars inline but offers no standalone schema doc. Key documentation exists at `docs/codebase-map.md` and `docs/architecture-philosophy.md`, but these describe structure rather than explicitly listing "how to extend X."

## Architectural Decisions

- **Protocol-based polymorphism over ABCs**: All provider interfaces use `typing.Protocol` (`platform/llm/contracts.py:91`, `platform/auth/contracts.py:21`) rather than abstract base classes. This allows duck-typing and avoids a rigid class hierarchy, but means there is no structural enforcement that a provider fully implements the protocol (no `@abstractmethod` checks at construction time).

- **Explicit composition over DI framework**: The system uses a hand-rolled dataclass-based DI container (`AppContainer`, `ProviderRegistry`, `ModuleRegistry`) rather than an IoC container like `dependency-injector` or `fastapi-depends`. This makes the wiring fully visible and debuggable but means every new dependency requires editing the composition root file.

- **All wiring in one file**: `platform/composition/app_container.py:109-297` is a single function that resolves every dependency. This is the "composition root" pattern from dependency injection, but the lack of a framework means it is verbose and fragile to merge conflicts.

- **Code-driven tool/agent/worker registration**: Rather than auto-discovery (e.g., scanning decorators or package `__init__.py`), everything is explicitly collected into lists/dicts in bootstrap files. This sacrifices discoverability for explicitness.

- **Settings-driven provider selection with hardcoded whitelist**: The env-var-based provider selection pattern (`settings.py:200-234`) is flexible within known bounds, but the whitelist validator intentionally prevents arbitrary provider strings from being accepted.

## Notable Patterns

- **Port/Adapter pattern**: Every replaceable capability (LLM, auth, web search, voice, persistence) follows the Port/Adapter pattern with a `ProductPort` protocol and `*Provider` implementations in a `providers/` subdirectory. See `platform/llm/` for the canonical example.

- **Builder functions returning frozen dataclasses**: Agent and worker definitions use `build_*()` factory functions returning `@dataclass(frozen=True)` objects. This provides immutability guarantees but makes dynamic extension (e.g., adding tools at runtime) impossible.

- **Overrides dataclass for test seam**: `platform/composition/overrides.py:23` provides an `AppOverrides` dataclass with optional fields for every major dependency type, allowing tests to replace implementations without modifying production code.

- **Module <-> route symmetry**: Each application module (`modules/<name>/`) has a corresponding HTTP route file in `entrypoints/http/routes/<name>.py`, and both are wired separately in their respective registries. This enforces separation of concerns but creates two registration points for one feature.

## Tradeoffs

| Tradeoff | Choice | Implication |
|----------|--------|-------------|
| Composition mechanism | Hand-rolled dataclass DI vs IoC framework | Fully visible wiring but verbose; every new dependency touches `app_container.py`; merge conflicts on the composition root are likely with multiple contributors |
| Plugin discovery | Explicit registration vs auto-discovery | No runtime scanning overhead, no import-order bugs; but adding any extension modifies existing files, creating friction for third-party extensions |
| Interface stability | Protocol contracts without versioning | Easier to evolve initially, but no way to support multiple interface versions simultaneously; breaking changes ripple through all implementations at once |
| Provider selection | Env-var + whitelist validation | Runtime-configurable within known bounds; adding a completely new provider type requires code changes in 3+ locations |
| Tool registration | Collected in `__init__.py` + agent bootstrap | Single import catalog is easy to audit, but adding a tool to an agent requires editing the agent definition file rather than a config |
| Dataclass immutability | `frozen=True` on definitions | Safe from accidental mutation but prevents runtime extension (e.g., injecting additional tools per-request) |

## Failure Modes / Edge Cases

- **Uninitialized provider**: If a provider is selected via env var but its dependencies (API key, base URL) are not configured, the system may fail at runtime when the provider is first used rather than at startup. Example: selecting `tavily` as web search provider without setting the API key — `TavilyWebSearchProvider` is instantiated but only fails on first `search()` call.

- **Provider whitelist rejects legitimate extension**: The whitelist validators in `settings.py:200-234` prevent a developer from quickly pointing the system at a new LLM provider without modifying the source code. This is a deliberate guard but creates friction for experimentation.

- **Composition root as a bottleneck**: `build_app_container()` at `app_container.py:109` is a 188-line function that wires every dependency. Any misordering or missing parameter causes a runtime startup failure, and the error messages may not clearly indicate the root cause.

- **Frozen dataclass version skew**: If `AgentDefinition` gains a new required field, all existing definition factories silently break until updated. There is no lint rule or test enforcing that all definitions are updated.

- **No graceful degradation for missing providers**: If `stageflow-core` is missing and stageflow is required, startup fails hard (`platform/workflows/runtime.py:254`). There is no fallback or degraded-mode behavior for optional extensions.

## Future Considerations

- **Plugin discovery via entry points**: Adding a `[project.entry-points."hello_sales.providers"]` group in `pyproject.toml` would allow third-party packages to register provider implementations without modifying the composition root (`app_container.py:109`). This is the standard Python approach (used by pytest, flake8, etc.).

- **Breaking change policy**: Introduce interface version markers (e.g., `LLMProviderPortV1`, `LLMProviderPortV2`) or use `@deprecated` decorators with migration windows to manage evolution of provider protocols.

- **Tool injection via config**: Allow agent definitions to reference tools by name from a config file rather than hardcoding tool lists, so that agents can be extended without code changes.

- **Centralized extension index**: Create a `EXTENSION_POINTS.md` or docstring-based index that enumerates every extension point, what protocol/contract to implement, and where to register it. This would significantly improve discoverability.

- **Provider URL/API key generalization**: Replace the hardcoded `PROVIDER_BASE_URLS` and `resolved_generic_agent_api_key` in `settings.py:15-20,281-291` with a generic map from provider name -> (base_url_field, api_key_field) to support arbitrary providers without code changes.

## Questions / Gaps

- No evidence of how provider whitelist validation handles the case where a user configures both `SUPPORTED_AUTH_PROVIDERS` and selects an unsupported provider. The validator at `settings.py:200-234` likely raises a `ValidationError`, but the exact error message and UX for the developer is unclear.

- No evidence of `platform/providers/` backward-compat re-exports being tested — unclear if they are still used or if they are dead code from a migration.

- The relationship between `smoke/` test suites and the actual extension points is unclear — is the smoke test registry intended as a pattern for runtime extension, or purely for testing?

## Gaps

- No explicit developer guide for adding a new provider type — the information is distributed across `contracts.py`, `providers.py`, and `settings.py` with no single "how to add a provider" document.
- No automated tests verifying that all agent/worker definitions are syntactically valid against their contracts.
- No evidence of extension lifecycle management (startup hooks, shutdown hooks, health checks for extensions).

---

Generated by `study-areas/21-extensibility.md` against `hellosales`.
