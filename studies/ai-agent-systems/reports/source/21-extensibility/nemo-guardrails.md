# Repo Analysis: nemo-guardrails

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | nemo-guardrails |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/nemo-guardrails` |
| Language / Stack | Python 3.10+ / Poetry / Pydantic / Colang DSL |
| Analyzed | 2026-05-17 |

## Summary

nemo-guardrails achieves extensibility through a layered architecture with multiple independent extension systems. The primary extension mechanisms are (1) an auto-discovered action system with decorator-based registration, (2) a plugin-like `library/` directory of 30 pre-built guardrail integrations (each self-contained with Python actions + Colang flow files), (3) pluggable registries for LLM frameworks, embedding providers, and tracing adapters, and (4) a configuration-driven YAML model system backed by Pydantic. The Colang DSL itself serves as a user-extensible flow language. Extension discovery is primarily convention-based (directory + file name scanning) rather than manifest-based. Several subsystems — notably the IORails `RailAction` classes and the `EngineRegistry` — remain intentionally rigid with hardcoded registries, creating a clear boundary between what is user-extensible and what requires core code changes.

## Rating

**7/10** — Well-defined extension interfaces with automated discovery for actions and library integrations. The library/ plugin system, action decorator, and provider registries are documented and stable. However, the engine-level rail actions are hardcoded, there is no formal plugin versioning or lifecycle management, and extending some subsystems (LLM provider with custom auth, new `RailAction` subclass) requires touching core code.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Action decorator (`@action`) | Decorator that marks functions/classes with `ActionMeta` metadata | `nemoguardrails/actions/actions.py:41-82` |
| Action auto-discovery | `ActionDispatcher.load_actions_from_path()` scans `actions.py` and `actions/` dirs | `nemoguardrails/actions/action_dispatcher.py:102-118` |
| Action discovery search scope | Walks `library/` tree; also scans cwd, config_path, import_paths for action files | `nemoguardrails/actions/action_dispatcher.py:58-88` |
| Action registration API | `register_action()` and `register_actions()` for programmatic registration | `nemoguardrails/actions/action_dispatcher.py:120-153` |
| Generic Registry ABC | Abstract base for all registries with `add()`, `get()`, `list()`, `validate()` | `nemoguardrails/registry.py:23-87` |
| Embedding provider registry | `EmbeddingProviderRegistry` validates `encode()` + `encode_async()` methods | `nemoguardrails/embeddings/providers/registry.py:22-34` |
| Embedding model ABC | `EmbeddingModel` with `engine_name`, abstract `encode`/`encode_async` | `nemoguardrails/embeddings/providers/base.py:20-50` |
| LLM framework registry | Module-level dict `_frameworks` with `register_framework()`, `get_framework()` | `nemoguardrails/llm/frameworks/registry.py:26-108` |
| LLMFramework Protocol | Structural typing: `create_model`, `register_provider`, `get_provider_names`, `reset` | `nemoguardrails/types.py` (protocol definition) |
| DefaultFramework | Maps provider names to base URLs + API keys; creates `OpenAICompatibleClient` | `nemoguardrails/llm/frameworks/default.py:60-174` |
| LLM provider registration | `register_provider()` delegates to active framework | `nemoguardrails/llm/providers/__init__.py:26-28` |
| LLM model initialization | `init_llm_model()` uses framework to create an `LLMModel` | `nemoguardrails/llm/models/initializer.py:28-56` |
| Tracing adapter registry | `LogAdapterRegistry` validates `InteractionLogAdapter` subclass | `nemoguardrails/tracing/adapters/registry.py:21-33` |
| Tracing adapter ABC | `InteractionLogAdapter` with abstract `transform()` and `transform_async()` | `nemoguardrails/tracing/adapters/base.py:22-45` |
| Library plugin structure | 30 directories under `library/`, each with `actions.py` + `flows.co` + `flows.v1.co` | `nemoguardrails/library/` |
| Sample integration: jailbreak_detection | `actions.py` exports `@action`-decorated functions; auto-discovered by ActionDispatcher | `nemoguardrails/library/jailbreak_detection/actions.py:55-200` |
| Sample integration: topic_safety | `flows.co` defines Colang flow that calls Python action | `nemoguardrails/library/topic_safety/flows.co:1-12` |
| Guardrails AI dynamic validator loading | Registry maps validator names to hub paths; lazy import + `lru_cache` | `nemoguardrails/library/guardrails_ai/registry.py:23-142` |
| IORails hardcoded flow set | `IORAILS_INPUT_FLOWS` and `IORAILS_OUTPUT_FLOWS` are fixed sets | `nemoguardrails/guardrails/guardrails.py:41-42` |
| RailAction hardcoded registry | `_ACTION_CLASSES` dict maps flow names to concrete RailAction subclasses | `nemoguardrails/guardrails/rails_manager.py:52-60` |
| RailAction template method | Abstract base with `run() → _extract → _create_prompt → _get_response → _parse` | `nemoguardrails/guardrails/rail_action.py:47-195` |
| EngineRegistry per-model setup | Creates one engine per configured model; coupled to `ModelEngine`/`APIEngine` | `nemoguardrails/guardrails/engine_registry.py:53-306` |
| Colang v2 standard library | Built-in `.co` files in `colang/v2_x/library/` (core.co, guardrails.co, llm.co, etc.) | `nemoguardrails/colang/v2_x/library/core.co:1-321` |
| COLANGPATH env var | `COLANGPATH` environment variable adds custom colang search directories | `nemoguardrails/rails/llm/config.py:61-73` |
| Config model: RailsConfig | Pydantic model with typed fields; imports from YAML | `nemoguardrails/rails/llm/config.py:1499-1698` |
| Config model: RailsConfigData | 15 typed integration config models (content_safety, jailbreak_detection, etc.) | `nemoguardrails/rails/llm/config.py:1100-1187` |
| config_path + import_paths | Additional search paths for flows, actions, and YAML configs | `nemoguardrails/rails/llm/config.py:1555-1565` |
| LangChain integration | `RunnableRails`, middleware, safe tools, LLM adapter, provider wrappers | `nemoguardrails/integrations/langchain/runnable_rails.py:42-60` |
| Actions server | External action server via `actions_server_url` config | `nemoguardrails/rails/llm/config.py:1535-1538` |
| `custom_data` dict | Arbitrary config passthrough in `RailsConfig` | `nemoguardrails/rails/llm/config.py:1583-1586` |

## Answers to Protocol Questions

### 1. What are the primary extension points?

The system has six distinct extension points:

1. **Actions** (`actions.py` + `actions/` directories) — The primary mechanism for adding new guardrail behavior. Functions/classes decorated with `@action` are auto-discovered by `ActionDispatcher` (`action_dispatcher.py:58-88`) from four search scopes: the package `actions/` folder, every `library/<integration>/` directory, the current working directory, and any `config_path`/`import_path` directories.

2. **Library/ integrations** (`library/`) — A directory of 30 self-contained guardrail integrations. Each subdirectory bundles Python action code (`actions.py`) and Colang flow definitions (`flows.co`, `flows.v1.co`). Adding a new integration means creating a new subdirectory under `library/` with the standard files.

3. **LLM providers** (`llm/providers/`) — Registerable via `register_provider()` (`llm/providers/__init__.py:26`), scoped to a framework. The `DefaultFramework` (`llm/frameworks/default.py:60`) natively supports OpenAI-compatible endpoints and maps well-known provider names (`openai`, `nim`, `ollama`) to default base URLs. Custom providers can be registered programmatically.

4. **Embedding providers** (`embeddings/providers/`) — Registered via `EmbeddingProviderRegistry` (`embeddings/providers/registry.py:22`). Must implement `EmbeddingModel` ABC (`embeddings/providers/base.py:20`) with `encode()` and `encode_async()`.

5. **Tracing adapters** (`tracing/adapters/`) — Registered via `LogAdapterRegistry` (`tracing/adapters/registry.py:21`). Must subclass `InteractionLogAdapter` (`tracing/adapters/base.py:22`) and implement `transform()`/`transform_async()`.

6. **LLM Frameworks** (`llm/frameworks/`) — Registerable via `register_framework()` (`llm/frameworks/registry.py:30`). Must satisfy the `LLMFramework` Protocol (`types.py`). Two built-in: `DefaultFramework` (OpenAI-compatible HTTP) and `LangChainFramework`.

Secondary extension points include:
- **Colang flows** — Custom `.co` files loaded from config paths and `COLANGPATH`.
- **Config models** — `RailsConfigData` (`config.py:1100`) has 15 typed integration configs; `RailsConfig`'s `custom_data` dict (`config.py:1583`) allows arbitrary passthrough.
- **Server datastores** — Pluggable via `memory_store.py` and `redis_store.py`.

### 2. How are custom tools/providers added?

**Adding a custom guardrail action/library** (most common path):
1. Create a directory `my_guardrail/` with `actions.py` containing functions decorated with `@action()` and optionally `flows.co` defining Colang flows.
2. Place it in the config directory, or add the path to `config_path` or `import_paths`.
3. The `ActionDispatcher` auto-discovers it at initialization (`action_dispatcher.py:58-88`).
4. Configure it via YAML config (e.g., `config.yml`).

**Adding a custom LLM provider:**
1. Use the `DefaultFramework` and set `parameters.base_url` in the model config (`llm/frameworks/default.py:111`), or
2. Register a provider class via `register_provider("my_provider", MyProviderClass)` (`llm/providers/__init__.py:26`), or
3. Switch to `NEMOGUARDRAILS_LLM_FRAMEWORK=langchain` and use the corresponding `langchain-<provider>` package (`llm/frameworks/registry.py:63-66`).

**Adding a custom embedding provider:**
1. Subclass `EmbeddingModel` (`embeddings/providers/base.py:20`), implement `encode()` and `encode_async()`.
2. Register via `EmbeddingProviderRegistry().add("my_provider", MyModel())` (`embeddings/providers/registry.py:22`).

### 3. Are there hooks/middleware for customization?

There is no generic middleware/hooks system comparable to web framework middleware. Instead, customization happens through these mechanism:

- **Action output mapping** — The `@action` decorator accepts an `output_mapping` callback (`actions/actions.py:44`) to transform the return value.
- **Colang flows as interception** — Custom Colang flows can intercept events (`match UtteranceUserActionFinished`, `match ColangError()`, etc.) and inject custom behavior (see `core.co:222-257` for examples).
- **RailAction template method** — The abstract `RailAction` class (`guardrails/rail_action.py:47`) defines a pipeline with overridable hooks: `_extract_messages`, `_create_prompt`, `_get_response`, `_parse_response`. Subclasses override individual steps.
- **Tracing adapters** — Act as post-processing hooks on interaction logs, transforming them into backend-specific formats.
- **LangChain middleware** — The LangChain integration exposes middleware (`integrations/langchain/middleware.py`) that wraps LLM calls with rails.

No generic "before/after" hook system exists at the engine level. All interception is through the Colang event system or through the rail pipeline.

### 4. Is extension configuration-driven or code-driven?

Both, with a strong bias toward **configuration-driven** for common cases:

- **Configuration-driven**: Library integrations are configured through YAML with typed Pydantic models (`config.py:1100-1187`). Each integration (content_safety, jailbreak_detection, etc.) has its own sub-config model. The `RailsConfig` is loaded from `config.yml` files.
- **Code-driven**: Custom actions require writing Python code with `@action` decorator. Custom providers require subclassing ABCs. Custom frameworks require implementing the `LLMFramework` protocol.
- **Hybrid (Colang flows)**: A custom DSL that is declarative but embedded in code files (`.co` files loaded from config paths).

The pattern is: **configure the behavior in YAML, implement the logic in Python actions or Colang flows**.

### 5. How stable are extension interfaces?

- **Action decorator** (`@action`) — Very stable. Core interface used across all 30 library integrations. Has not changed structurally (the `ActionMeta` TypedDict schema) based on CHANGELOG evidence.
- **`EmbeddingModel` ABC** — Stable. Two abstract methods (`encode`, `encode_async`) unchanged.
- **`InteractionLogAdapter` ABC** — Stable. Two abstract methods (`transform`, `transform_async`).
- **`Registry` ABC** — Stable base class used by multiple registries.
- **`LLMFramework` Protocol** — New in this version (2026 copyright dates in `llm/frameworks/`). May change.
- **`RailAction` class** — Relatively new. Template method interface is stable but has few subclasses.
- **Config models** — Change regularly. `RailsConfigData` at `config.py:1100` adds new integrations per release. Deprecated fields exist with migration paths (e.g., `JailbreakDetectionConfig` has `nim_url` → `nim_base_url` at `config.py:761-770`).

The most stable interfaces are the older ones (actions, embeddings, tracing). The newer ones (frameworks, IORails) are still evolving.

### 6. How are breaking changes managed?

- **Deprecation warnings**: Used extensively. For example, `register_llm_provider()` at `llm/providers/__init__.py:38-50` issues `DeprecationWarning` with a removal version.
- **Config field deprecation**: Pydantic `deprecated` parameter on fields (`config.py:761-770`).
- **Migration guide**: `docs/migration/` directory documents version-to-version migrations.
- **CHANGELOG**: Standard changelog at `CHANGELOG.md` plus Colang-specific changelog `CHANGELOG-Colang.md`.
- **Backward-compatible moves**: The HuggingFace provider was moved from `llm/providers/huggingface/` to `integrations/langchain/providers/huggingface/` with a stub that raises `ImportError` with migration instructions (`llm/providers/huggingface/__init__.py:17-20`).
- **Env-var-driven defaults**: `NEMOGUARDRAILS_LLM_FRAMEWORK` env var (`frameworks/registry.py:27`) allows opting into the new framework system.

Breaking changes are managed gradually with deprecation windows. The project uses semver via git-cliff at `cliff.toml`.

### 7. What is intentionally NOT extensible?

- **IORails engine flow set** — The IORails engine supports only a fixed set of flows (`guardrails.py:41-42`): `{content safety check input, topic safety check input, jailbreak detection model}` for input and `{content safety check output}` for output. Other flows fall back to the slower `LLMRails` engine.
- **`RailAction` registry** — The `_ACTION_CLASSES` dict in `rails_manager.py:52-60` is hardcoded. Adding a new rail type requires modifying this dict and creating a `RailAction` subclass in the core code.
- **`EngineRegistry`** — Tightly coupled to `ModelEngine` and `APIEngine` concrete types. Not designed for user-provided engine types.
- **Core Colang runtime** — The v2.x runtime (`colang/v2_x/runtime/`) is internal. User-defined flows are loaded through configuration, not runtime extension.
- **Server datastore types** — Only memory and Redis are supported. No datastore registry for user-provided backends.

### 8. How discoverable are extension points?

- **Well-documented**: Actions (`docs/getting-started/tutorials/`), library integrations (`docs/configure-rails/guardrail-catalog/`), config schema (`docs/configure-rails/yaml-schema/`), tracing (`docs/observability/tracing/`).
- **Self-documenting library catalog**: The `library/` directory has a `README.md` and 30 named subdirectories.
- **Explicit in config**: The `import_paths` field and `COLANGPATH` env var explicitly tell users where extension code can go.
- **Weak discoverability for registries**: The embedding provider registry, LLM framework registry, and tracing adapter registry are not documented as "extension points" — they appear as internal plumbing. A developer would need to find them through source exploration.
- **CLI support**: `cli/providers.py` provides `nemoguardrails providers` CLI command for listing available providers.
- **No plugin manifest or registry metadata**: There is no `setup.py` entry point or plugin metadata file. Extensions are discovered purely through directory/file scanning.

## Architectural Decisions

1. **Convention over configuration for action discovery** (`action_dispatcher.py:53-88`): Actions are auto-discovered from well-known paths and naming conventions (`actions.py` / `actions/`). No plugin manifest, entry point, or registration call is needed for basic use. This makes adding a new guardrail as simple as dropping files in the right place.

2. **Library/ as a flat plugin directory** (`library/__init__.py` is empty): The entire `library/` is just a namespace package. Each integration is a self-contained directory. This is a deliberate choice to keep integrations decoupled from core code but avoids any formal plugin infrastructure (versioning, dependencies, lifecycle).

3. **Dual Registry pattern** (`registry.py:23`): The abstract `Registry` class (Singleton + ABC) provides uniform `add/get/list/validate` semantics. Subclass registries add type-specific validation. This pattern is used consistently across embedding providers, tracing adapters, and potentially others.

4. **Framework-based LLM provider indirection** (`llm/frameworks/`): Rather than a single provider registry, providers are scoped to a "framework" (default or LangChain). This allows the LangChain integration to own its own provider ecosystem without polluting the core. The `NEMOGUARDRAILS_LLM_FRAMEWORK` env var controls the active framework.

5. **Two-tier engine architecture** (`guardrails/guardrails.py:67-68`): `Guardrails` wraps either `IORails` (fast, but limited to a fixed set of flows) or `LLMRails` (flexible, full Colang runtime). The user writes config and the system picks the right engine. This optimizes for the common case while preserving a full escape hatch.

6. **Pydantic config as the extension contract** (`rails/llm/config.py`): Every integration has a typed Pydantic model. The config models serve as both documentation (with `description` fields) and runtime validation. Adding a new integration means adding a new config model.

7. **Colang DSL for flow definition** rather than Python-only: Guardrail behavior is expressed in Colang .co files (a declarative event-driven language). Actions bridge Python logic into Colang flows. This separates policy (Colang) from implementation (Python).

## Notable Patterns

| Pattern | Description | Evidence |
|---------|-------------|----------|
| Auto-discovery by convention | Actions discovered from well-known file/dir names without manifests | `action_dispatcher.py:102-118` |
| Decorator + metadata | `@action` attaches `ActionMeta` via `setattr` for later discovery | `actions/actions.py:79` |
| Registry + Singleton | `Registry` uses Singleton metaclass for global state | `registry.py:23` |
| Template method | `RailAction` defines abstract pipeline with overridable hooks | `guardrails/rail_action.py:77-148` |
| Lazy framework loading | Frameworks ("langchain", "default") are loaded on first access | `frameworks/registry.py:62-73` |
| Protocol-based plugin | `LLMFramework` uses structural typing (Protocol) not inheritance | `types.py` (protocol) |
| Config models per integration | Each library integration gets a Pydantic sub-config model | `config.py:1100-1187` |
| Env-var-driven defaults | `NEMOGUARDRAILS_LLM_FRAMEWORK`, `OPENAI_API_KEY`, `NVIDIA_API_KEY` | `frameworks/default.py:34-38`, `frameworks/registry.py:27` |
| Dual version support | Colang v1.0 and v2.x language support side by side | `colang/v1_0/`, `colang/v2_x/` |
| Directory-based library scanning | ActionDispatcher walks tree looking for `actions.py` and `actions/` dirs | `action_dispatcher.py:63-69` |
| Deprecation-with-warning | Breaking changes phased via `DeprecationWarning` and Pydantic `deprecated` | `llm/providers/__init__.py:38-50`, `config.py:761` |
| Dynamic import + cache | Guardrails AI validators loaded lazily with `lru_cache` | `guardrails_ai/actions.py:214-244` |

## Tradeoffs

1. **Convention-based discovery vs. explicit registration**: Auto-discovery from directory scanning is convenient but opaque — there is no way to enumerate "what extensions are installed?" at runtime. Contrast with setuptools entry points or Python namespace packages where `importlib.metadata` can list plugins.

2. **Two engines (IORails vs LLMRails)**: Optimizes performance for common flows but creates a sharp distinction — if you add a custom flow that IORails doesn't support, it silently falls back to a slower engine. This is documented but not always obvious.

3. **Plugin directory (library/) vs. pip-installable packages**: Library integrations are vendored in-tree. They cannot be installed independently via pip, versioned independently, or have their own dependency trees. Contrast with Guardrails AI's approach of installing validators from a hub.

4. **Colang DSL vs. pure Python**: Colang provides a clean separation of policy and implementation, but adds a learning curve and a compilation/interpretation step. Debugging requires understanding both the Python runtime and the Colang event system.

5. **Pydantic config model coupling**: Each integration's config is a Pydantic model in the core config module (`config.py`). This means adding a new integration requires modifying the core code to add the config model. The `custom_data` dict (`config.py:1583`) mitigates this by allowing arbitrary passthrough, but bypasses validation.

6. **Framework-based LLM indirection**: Clean separation between default and LangChain providers, but code must check which framework is active before using provider names. The `llm/providers/__init__.py:22-23` shows the indirection: `_active_framework()` must be called on every access.

## Failure Modes / Edge Cases

1. **Action name collisions**: `ActionDispatcher._registered_actions` is a flat dict. If two library integrations define an action with the same name, the last one loaded wins (with warning). No namespacing. The `override` parameter in `register_action()` (`action_dispatcher.py:120`) defaults to `True`, so later registrations silently overwrite.

2. **Circular imports in library actions**: Several library integrations import from each other (e.g., topic_safety → actions.llm.utils). The tracing adapter registry defers imports (`tracing/adapters/registry.py:28`) to avoid circular imports, but not all paths handle this.

3. **Framework reset leaks state**: `_reset_frameworks()` (`frameworks/registry.py:108`) clears all frameworks and re-reads the env var. If an application has a custom framework registered, it is lost on reset.

4. **Embedding provider validation requires bidirectional encoding**: `EmbeddingProviderRegistry.validate()` (`embeddings/providers/registry.py:30-34`) checks both `encode()` and `encode_async()`. A provider that only implements one will fail validation.

5. **Config field deprecation without migration**: Some deprecated config fields (like `JailbreakDetectionConfig.embedding` at `config.py:771`) have no migration path — they are simply ignored. This can cause silent misconfigurations if users rely on them.

6. **IORails silently falling back to LLMRails**: The `Guardrails` constructor at `guardrails.py:67` selects IORails only when `_has_only_iorails_flows()` returns True. If a user adds a flow that is not in the supported set, the engine silently switches to LLMRails, which may have different performance characteristics.

## Future Considerations

1. **Formal plugin system with entry points**: Moving to a pip-installable plugin model (e.g., `pyproject.toml` entry points) would enable independent versioning, dependency management, and discovery via `importlib.metadata`.

2. **RailAction registry should be extensible**: Currently hardcoded in `rails_manager.py:52`. A registry pattern (similar to `EmbeddingProviderRegistry`) would allow external packages to register new `RailAction` subclasses without core patches.

3. **Namespaced actions**: Using dotted names like `namespace.action_name` would prevent collisions in the flat action registry.

4. **Metadata/discovery API**: A runtime API to list installed extensions (actions, library integrations, providers) would improve tooling and debugging.

5. **Plugin lifecycle hooks**: `on_load`, `on_unload`, `on_config_change` callbacks for library integrations would enable cleaner state management.

6. **Dynamic provider registration without env vars**: The `DefaultFramework` maps providers to env-var-based API keys. Supporting dynamic provider registration with per-call credentials would unlock more deployment flexibility.

## Questions / Gaps

1. **No evidence found** for how the LLM framework Protocol (`LLMFramework` in `types.py`) is defined — I found usage (`frameworks/registry.py:46-56`) and method name checks, but the Protocol class itself wasn't located in the source exploration. It may be defined through duck-typing conventions rather than a formal `typing.Protocol` class.

2. **No evidence found** for a formal breaking change policy or API stability guarantees (beyond semver from `cliff.toml`). The changelog exists but does not explicitly call out which APIs are stable vs. experimental.

3. **No evidence found** for extension conflict detection — if two library integrations both require the same model name or register the same flow, the error messages may be unclear.

4. **No clear evidence found** of a performance benchmark for the IORails vs LLMRails fallback — the performance implications of adding unsupported flows are mentioned but not quantified.

---

Generated by `study-areas/21-extensibility.md` against `nemo-guardrails`.
