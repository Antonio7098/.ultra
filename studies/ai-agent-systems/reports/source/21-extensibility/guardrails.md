# Repo Analysis: guardrails

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | guardrails-ai |
| Path | `repos/guardrails` |
| Language / Stack | Python 3.10+, Pydantic, LiteLLM |
| Analyzed | 2026-05-17 |

## Summary

Guardrails provides a well-defined, multi-layered extension architecture centered around a **validator registration system**, a **Validator Hub** for third-party distribution, **RAIL/pydantic schema integration**, and **LLM provider abstraction**. Extension is primarily code-driven (decorators, subclasses) but also supports configuration-driven extension via RAIL XML files and Pydantic field metadata. The system scores high on extensibility for validators (the primary unit of extension) but is intentionally rigid in core execution flow.

## Rating

**7/10** — Well-defined extension interfaces (validator registration, Hub, RAIL, LLM providers) with documentation, but no versioned plugin API, limited lifecycle management for extensions, and core execution flow is not overridable.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Validator registration API | `register_validator(name, data_type)` decorator registers classes or functions into `validators_registry` | `guardrails/validator_base.py:527-567` |
| Validator base class | `Validator` dataclass with `_validate()`, `_inference_local()`, `_inference_remote()` overridable methods | `guardrails/validator_base.py:92-508` |
| Validator Hub — install pipeline | `install()` function fetches manifest, runs pip/uv install, runs post-install scripts, registers in hub_registry.json | `guardrails/hub/install.py:37-186` |
| Validator Hub — registry | `ValidatorRegistry` model with per-validator import paths, exports, install timestamps | `guardrails/types/validator_registry.py:1-15` |
| Hub dynamic import | `guardrails.hub.__getattr__` lazily resolves installed validators from registry | `guardrails/hub/__init__.py:38-54` |
| Hub CLI commands | `guardrails hub install`, `list`, `uninstall`, `create-validator`, `submit` | `guardrails/cli/hub/install.py:18`, `guardrails/cli/hub/list.py:9`, `guardrails/cli/hub/uninstall.py:56`, `guardrails/cli/hub/create_validator.py:150` |
| Validator registry lookup | `get_validator_class()` resolves by name, falls back to Hub import | `guardrails/validator_base.py:581-596` |
| LLM provider abstraction | `PromptCallableBase` hierarchy: LiteLLMCallable, ManifestCallable, HuggingFaceModelCallable, HuggingFacePipelineCallable, ArbitraryCallable | `guardrails/llm_providers.py:88-502` |
| LLM auto-detection | `get_llm_ask()` factory auto-detects provider type (LiteLLM, Manifest, HuggingFace, arbitrary) | `guardrails/llm_providers.py:505-588` |
| Arbitrary callables | `ArbitraryCallable` wraps any callable with `**kwargs` as LLM provider (requires `**kwargs` and recommended `messages` kwarg) | `guardrails/llm_providers.py:434-502` |
| Guard composition API | `Guard.use()` appends validators on a property path; `Guard.for_string()`, `for_pydantic()`, `for_rail()` factory methods | `guardrails/guard.py:834-856`, `guardrails/guard.py:441-483`, `guardrails/guard.py:384-438` |
| RAIL schema extension | XML-based RAIL format with `validators` attribute and `on-fail-*` handlers per element | `guardrails/schema/rail_schema.py:41-55` |
| Pydantic field validators | Validators specified via `json_schema_extra={"validators": [...]}` on Pydantic model fields | `guardrails/schema/pydantic_schema.py:186-228` |
| On-fail action system | `OnFailAction` enum (reask, fix, filter, refrain, noop, exception, fix_reask, custom) | `guardrails/types/on_fail.py:6-31` |
| Custom on-fail handlers | `OnFailAction.CUSTOM` allows arbitrary callables per validator | `guardrails/validator_service/validator_service_base.py:96-99` |
| LangChain integration | `GuardRunnable` and `ValidatorRunnable` as LangChain-compatible Runnables | `guardrails/integrations/langchain/guard_runnable.py:8-25`, `guardrails/integrations/langchain/validator_runnable.py:6-22` |
| LlamaIndex integration | Custom chat and query engines | `guardrails/integrations/llama_index/guardrails_chat_engine.py`, `guardrails/integrations/llama_index/guardrails_query_engine.py` |
| Databricks integration | MLflow instrumentation | `guardrails/integrations/databricks/ml_flow_instrumentor.py` |
| Output formatter extension | `BaseFormatter` with JSON formatter; pluggable via `for_pydantic(output_formatter=...)` | `guardrails/formatters/base_formatter.py`, `guardrails/formatters/json_formatter.py` |
| Installer detection | Supports pip or uv with `GUARDRAILS_INSTALLER` env override | `guardrails/hub/validator_package_service.py:63-76` |
| Hub package naming | PEP 503 canonical names: `{org}-grhub-{name}` | `guardrails/hub/validator_package_service.py:337-343` |
| Server-side API | `GuardrailsApiClient` for cloud-based guard execution | `guardrails/api_client.py` |
| Schema generator | `generate_example()` for producing example values from JSON Schema | `guardrails/schema/generator.py` |

## Answers to Protocol Questions

### 1. What are the primary extension points?

The primary extension points are:
- **Validators** — the fundamental unit of extension. Add via `@register_validator` decorator or Hub install. (`guardrails/validator_base.py:527`)
- **LLM providers** — pluggable callable wrappers for any LLM backend via `PromptCallableBase`. (`guardrails/llm_providers.py:88`)
- **On-fail actions** — configurable failure handling per validator via `OnFailAction` enum or custom callables. (`guardrails/types/on_fail.py:6`)
- **Output formatters** — pluggable formatters for structured output. (`guardrails/formatters/`)
- **Guard factory methods** — `for_rail()`, `for_rail_string()`, `for_pydantic()`, `for_string()` accept different schema representations. (`guardrails/guard.py:328-483`)
- **Integrations** — LangChain, LlamaIndex, Databricks as first-class framework adapters. (`guardrails/integrations/`)
- **Server-side API** — offloads execution to `guardrails-api` cloud service. (`guardrails/guard.py:1000-1039`)

### 2. How are custom tools/providers added?

**Custom validators** are added in two ways:
1. **Code-driven**: Decorate a `Validator` subclass or function with `@register_validator(name, data_type)` — it is added to the global `validators_registry` dict. (`guardrails/validator_base.py:527-567`)
2. **Hub-driven**: Run `guardrails hub install hub://org/name` which downloads a pip package, runs optional post-install, and registers in `.guardrails/hub_registry.json`. Validators are then importable via `from guardrails.hub import ValidatorName`. (`guardrails/hub/install.py:37-186`, `guardrails/hub/__init__.py:38-54`)

**Custom LLM providers** are added by passing any callable to `Guard.__call__()`. The system auto-detects provider type via `get_llm_ask()` (`guardrails/llm_providers.py:505-588`). For full compatibility, callables must accept `**kwargs`. The `ArbitraryCallable` (`guardrails/llm_providers.py:434`) wraps any callable that meets this contract. No registration step is needed.

### 3. Are there hooks/middleware for customization?

Guardrails has a limited hook system:
- **On-fail actions** per validator act as post-validation hooks: `reask`, `fix`, `filter`, `refrain`, `noop`, `exception`, `fix_reask`, or `custom` (user-provided function). (`guardrails/types/on_fail.py:6-31`)
- **Custom on-fail functions** receive `(value, FailResult)` and can return any transformed value. (`guardrails/validator_service/validator_service_base.py:96-99`)
- **Stream validation** via `validate_stream()` / `async_validate_stream()` with configurable chunking strategies. (`guardrails/validator_base.py:266-350`)
- **Metadata passing** via `validator.with_metadata({...})` enables context injection per invocation. (`guardrails/validator_base.py:497-500`)

There is no middleware pipeline for pre/post execution hooks at the Guard level. The `Runner` class (`guardrails/run/runner.py`) has a fixed step sequence: prepare → call → parse → validate → introspect → loop.

### 4. Is extension configuration-driven or code-driven?

**Both, with a clear split:**

- **Code-driven** (primary): Validator subclasses/functions with `@register_validator`, custom on-fail handlers, `PromptCallableBase` subclasses for LLM providers, `BaseFormatter` subclasses for output formatting.
- **Configuration-driven** (secondary, but first-class): RAIL XML files specifying prompts, output schemas, validators, and on-fail actions; Pydantic model field metadata (`json_schema_extra={"validators": [...]}`); `.guardrailsrc` for global settings (`guardrails/settings.py`).
- The RAIL parser (`guardrails/schema/rail_schema.py:41-55`) converts `validators="name: args"` attribute strings into `Validator` instances via `get_validator()` in `guardrails/utils/validator_utils.py:111`.

### 5. How stable are extension interfaces?

The interfaces have **mixed stability**:
- `Validator` base class (`validator_base.py:92`) and `register_validator` decorator (`validator_base.py:527`) are explicitly public (exported in `__init__.py:10`), but the TODO comment at line 1-4 indicates `validator_base.py` itself is slated for renaming in 0.5.x and removal in 0.6.x.
- `Guard` class and its factory methods are the public API surface and appear stable.
- `OnFailAction` enum (`types/on_fail.py:6`) is stable.
- The Hub protocol (manifest format, package naming, registry format) depends on external `guardrails-hub-types`, making it subject to the type package's versioning.
- Internal classes like `Runner` (`run/runner.py`) have a TODO comment at line 80 to be removed in >=0.6.x.
- `PromptCallableBase` and `ArbitraryCallable` work but `ArbitraryCallable.__init__` requires `**kwargs` on the wrapped function which is a hard constraint.

### 6. How are breaking changes managed?

There is **no explicit breaking change policy or deprecation mechanism** visible in the code:
- The `@experimental` decorator (`guardrails/decorators/experimental.py`) is used sparsely (only on `Guard.response_format_json_schema()` at `guard.py:1080`).
- The `validator_base.py` file has a TODO about renaming in 0.5.x and removal in 0.6.x, but no deprecation warning is emitted for imports from the old path.
- Deprecation warnings are used for specific features (e.g., default temperature=0 at `llm_providers.py:516-520`, uninstantiated validator tuples at `validator_utils.py:128-134`).
- Version is tracked in `version.py` (0.10.0 from `pyproject.toml:3`), but there is no changelog or migration guide in the repo.
- Hub validator packages support version pinning (`hub://org/name~=1.4` at `hub/install.py:59`) with PEP 440 specifiers.

### 7. What is intentionally NOT extensible?

- **Core execution loop**: The `Runner.step()` -> `call()` -> `parse()` -> `validate()` -> `introspect()` pipeline (`run/runner.py:204-285`) is fixed. Users cannot inject custom steps or replace the loop logic.
- **Validator service orchestration**: `ValidatorServiceBase` (`validator_service/validator_service_base.py`) defines the fixed sequence of `execute_validator()` → `perform_correction()` with hardcoded OnFailAction branching.
- **Schema-to-RAIL conversion**: JSON Schema → RAIL output (`schema/rail_schema.py:903-920`) has "limited support" and is "only guaranteed to work for JSON Schemas derived from RAIL."
- **Hub private index**: All Hub packages must be hosted on `pypi.guardrailsai.com` — there is no support for custom PyPI registries (`validator_package_service.py:369`).
- **Server-side execution**: Only LiteLLM-compatible models are supported (`llm_providers.py:891-902`), as explicitly noted: "TODO: Support other models; requires server-side updates."

### 8. How discoverable are extension points?

- **Validator registration**: Discoverable via `validators_registry` dict (`validator_base.py:511`) which is inspectable at runtime.
- **Installed Hub validators**: Listed via `guardrails hub list` (`cli/hub/list.py:9`), stored in `.guardrails/hub_registry.json`.
- **Types registry**: `types_registry` (`datatypes.py:7-9`) tracks valid data types that validators can target.
- **Guard validators**: Queryable at runtime via `guard.get_validators(on)` (`guard.py:858-869`).
- **LLM providers**: Not explicitly registered — auto-detection via `get_llm_ask()` is opaque to users.
- **On-fail actions**: Documented in `OnFailAction` enum docstring and `ValidatorServiceBase.perform_correction()`.
- **No central extension registry**: There is no single registry that lists all extension points (validators, LLM providers, formatters, integrations) in one place.

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| Validator as primary extension unit | Keeps guard logic modular; each validator encapsulates one validation concern | `guardrails/validator_base.py:92` |
| Decorator-based validator registration | Simple, Pythonic, enables static analysis | `guardrails/validator_base.py:527` |
| Hub as external package manager | Avoids bundling all validators; enables community contributions without core releases | `guardrails/hub/install.py:37` |
| Registry file per project (.guardrails/hub_registry.json) | Avoids modifying site-packages; enables per-project validator sets | `guardrails/hub/registry.py:10-11` |
| RAIL as XML schema language | Human-readable; supports prompt, schema, and validators in one file | `guardrails/schema/rail_schema.py:338-402` |
| LiteLLM as default LLM provider | Single interface for 100+ LLM providers; async support; streaming | `guardrails/llm_providers.py:145-256` |
| ArbitraryCallable with `**kwargs` requirement | Ensures forward-compatibility with parameter passing | `guardrails/llm_providers.py:434-447` |
| On-fail action as per-validator config | Fine-grained failure handling without modifying validator logic | `guardrails/types/on_fail.py:6` |
| Server-side API for cloud execution | Offloads validation to managed infrastructure | `guardrails/guard.py:1000-1039` |

## Notable Patterns

- **Double dispatch for validation**: `Validator.validate()` calls user-overridable `_validate()`, wrapping it with pre/post processing. (`guardrails/validator_base.py:206-213`)
- **Stream accumulation**: Validators implement `_chunking_function()` for streaming validation; chunks are accumulated until the function returns a split point. (`guardrails/validator_base.py:254-264`)
- **Lazy Hub imports**: `guardrails.hub` module uses `__getattr__` for lazy import resolution from the registry file, avoiding imports of all validators at module load time. (`guardrails/hub/__init__.py:38-54`)
- **Multi-hop validator resolution**: `get_validator_class()` first checks `validators_registry`, then attempts Hub import, then warns. (`guardrails/validator_base.py:581-596`)
- **Validator as LangChain Runnable**: Both `Guard` and individual `Validator` implement `to_runnable()` for LCEL integration. (`guardrails/guard.py:1070-1074`, `guardrails/validator_base.py:502-507`)
- **Pydantic + RAIL dualism**: The system supports two parallel schema paths (RAIL XML and Pydantic models) that converge into a common `ProcessedSchema`. (`guardrails/schema/rail_schema.py`, `guardrails/schema/pydantic_schema.py`)

## Tradeoffs

1. **Code-driven vs configuration-driven split**: Validators must be code (Python classes/functions), while their *application* to schemas can be configuration-driven (RAIL, Pydantic metadata). This means writing a new validator always requires Python code — there is no pure-config validator DSL.

2. **Hub ecosystem dependency**: The Hub relies on a private PyPI registry (`pypi.guardrailsai.com`), a JWT token for auth, and the `guardrails-hub-types` manifest package. Without network access to this registry, Hub-based extension is impossible.

3. **`**kwargs` requirement for custom LLMs**: `ArbitraryCallable.__init__` (`llm_providers.py:435-438`) raises `ValueError` if the callable does not accept `**kwargs`. This is a hard constraint that may not be obvious to users wrapping existing libraries.

4. **Server-side model lock-in**: `model_is_supported_server_side()` (`llm_providers.py:891-902`) only accepts LiteLLM-based models for server-side execution, explicitly noting "TODO: Support other models."

5. **No plugin lifecycle**: Validators have no hooks for initialization, teardown, or configuration validation beyond `__init__`. The Hub's `post_install` script (`validator_package_service.py:289-334`) is the closest thing to lifecycle management but only runs at install time.

6. **Validator base class TODOs**: The file has a planned rename/removal (lines 1-4), indicating instability in the core extension interface.

7. **Limited middleware hooks**: There is no middleware pipeline for Guard-level pre/post execution. On-fail actions are the only hook mechanism, and they only fire on validation failure.

## Failure Modes / Edge Cases

- **RAIL argument parsing uses `literal_eval`**: `parse_rail_arguments()` in `validator_utils.py:19-44` uses `ast.literal_eval` with a FIXME comment calling it "incredibly insecure!" — Python expressions in curly braces are evaluated.
- **Failed Hub imports degrade silently**: `try_to_import_from_hub()` (`validator_base.py:570-577`) catches `ImportError` and `KeyError`, logging an error but continuing. Missing Hub validators produce a warning but no hard failure until runtime.
- **No validator version resolution**: The Hub registry (`validator_registry.py`) tracks install timestamps but does not store version info in the registry; `importlib.metadata.version` is called on display only.
- **Registry file is per-project**: `.guardrails/hub_registry.json` is written to `os.getcwd()` (`registry.py:10-11`), meaning different working directories have different validator sets — this could cause non-reproducible behavior in monorepo or multi-project setups.
- **Pull-based validation invocation**: The pull-based approach (used to move message verification to `__init__`) requires `settings.rc` to be configured; missing `.guardrailsrc` raises `ValueError` in `Validator.__init__()` (`validator_base.py:116-120`).

## Future Considerations

- Replace `validator_base.py` with `validator.py` (planned for 0.5.x/0.6.x per lines 1-4).
- Remove `Runner` class in favor of functional Guard execution (planned for >=0.6.x per `run/runner.py:80`).
- Support more models server-side (noted in `llm_providers.py:898`).
- RAIL choice-case discriminator implementation uses JSON Schema conditional subschemas rather than OpenAPI discriminated unions — the comment at `rail_schema.py:240-252` asks for verification that LLMs understand this.

## Questions / Gaps

- **No test coverage of extensibility patterns examined**: The unit tests directory (`tests/unit_tests/`) was not examined — actual test coverage of registration, Hub install, and Guard composition scenarios is unknown.
- **No documentation or examples examined**: The `docs/` directory and `README.md` were not reviewed. The analysis is based on source code only.
- **No manifest format analysis**: The `guardrails-hub-types` package (external dependency) defines `Manifest` — the exact manifest schema was not examined.
- **Plugin discovery ordering**: When both `validators_registry` and Hub have the same name, `validators_registry` wins (`validator_base.py:587-590`) — but it's unclear if this is intentional or a potential source of shadowing.

---

Generated by `study-areas/21-extensibility.md` against `guardrails`.
