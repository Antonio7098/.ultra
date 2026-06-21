# Extensibility Analysis - Combined Study Report

## Study Parameters

| Field | Value |
|-------|-------|
| Protocol | `study-areas/21-extensibility.md` |
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

Extensibility across the 13 repos spans five distinct approach models. Temporal (9/10) leads with the most mature plugin architecture — formal Factory/Plugin interfaces, lifecycle management (Start/Stop/Reconfigure), and the broadest set of pluggable subsystems (persistence, visibility, archival, authorization, dynamic config, metrics, gRPC interceptors). OpenHands, opencode, and openai-agents-python (all 8/10) each have well-defined extension interfaces with some form of lifecycle management but lack versioned plugin APIs. Autogen (8/10) stands out for its Component mixin system with config-driven loading, trusted namespace enforcement, and dual-language architecture. The remaining systems (aider, guardrails, langfuse, langgraph, mastra, nemo-guardrails, opa) score 7/10 — they have well-defined interfaces but no formal plugin versioning, no runtime discovery, and limited lifecycle hooks. HelloSales (6/10) lags: it has typed Protocol interfaces but requires manual wiring in a central composition root for every extension, with no auto-discovery, no versioned interfaces, and hardcoded provider mappings.

The dominant convergence across repos is a **code-driven ABC/Protocol/interface pattern** — 11 of 13 use some form of abstract interface as the primary extension contract. Configuration-driven extension (YAML/JSON component descriptors) is less common but appears in autogen and nemo-guardrails. **File-based auto-discovery** (dropping files in convention directories) is used by opencode, openhands, and nemo-guardrails — a powerful pattern for lowering the extension barrier. **Plugin lifecycle management** is rare: only temporal and opa have full Start/Stop/Reconfigure with Manager orchestration; openhands has Install/Uninstall/Enable/Disable/Update. Every other system lacks lifecycle hooks.

## Core Thesis

Extensibility in agent and AI infrastructure systems converges on **ABC/Protocol-based interface contracts with code-driven registration**, but diverges sharply on **discovery mechanism, lifecycle management, and versioning**. Systems that serve as platforms (temporal, autogen, opencode) invest in formal plugin interfaces and lifecycle management. Systems that serve as frameworks (langgraph, openai-agents-python, mastra) prefer explicit wiring over discovery — trading ecosystem growth for predictability. The most important unaddressed gap is **extension versioning**: only 3 of 13 repos (opencode via `engines.opencode`, langgraph via scoped warnings, openhands via SDK deprecation policy) have any mechanism for managing breaking changes across extension interfaces.

## Rating Summary

| Repo | Score | Approach | Main Strength | Main Concern |
|------|-------|----------|---------------|--------------|
| temporal | 9/10 | Plugin + ServerOption DI | Formal Start/Stop/Reconfigure lifecycle; broadest extension surface (15+ ServerOptions) | SQL plugins require recompilation; 4 ServerOptions marked experimental |
| autogen | 8/10 | Component mixin + config loading | Type-safe Pydantic config round-trip; trusted namespace enforcement; dual-language | Config versioning mostly stubbed (`NotImplementedError`); no component discovery by type |
| opencode | 8/10 | Dual plugin (V1/V2) + file discovery | 17 lifecycle hooks; file-based auto-discovery of tools/agents/plugins/skills | No plugin lifecycle (start/stop); V2 plugins internal-only |
| openhands | 8/10 | Plugin bundles + file discovery + hooks | Generic InstallationManager with full lifecycle; DiscriminatedUnionMixin for auto-serialization | Plugin APIs not independently versioned; server router still manual |
| openai-agents-python | 8/10 | ABC/Protocol composition | 7+ extension categories; stable ABCs; extensions/ directory; decorator-first UX | No plugin discovery; extension interfaces in extensions/ not centrally documented |
| aider | 7/10 | Convention-based (subclass + cmd_*) | Simple, Pythonic extension without framework overhead | No plugin discovery; everything requires editing core files; monolithic commands.py |
| guardrails | 7/10 | Decorator registry + Validator Hub | Two-path extension (direct code + Hub); rich on-fail action system | validator_base.py slated for rename/removal; Hub requires private PyPI; no Guard-level middleware |
| langfuse | 7/10 | Enum + manual wiring + MCP registry | MCP ToolRegistry has the most structured plugin interface; generics-based route factory | Only MCP has structured plugin; LLM adapter requires touching multiple files; no formal versioning |
| langgraph | 7/10 | ABC interface | Clean ABCs for checkpointers/stores/channels; tool middleware via closure wrapping | No general graph-level middleware; no formal plugin discovery; ManagedValue undocumented |
| mastra | 7/10 | Central DI container + abstract interfaces | Broadest extension set (tools, storage, vector, memory, voice, processors, MCP, auth); composite storage | No plugin discovery; Integration class skeletal; pre-1.0 churn via changesets |
| nemo-guardrails | 7/10 | Decorator action + library directory | Auto-discovery of actions from convention directories; two-tier engine (IORails/LLMRails) | RailAction registry hardcoded; library/ integrations not pip-installable; engine fallback opaque |
| opa | 7/10 | Plugin interface + Go init() | Clean Plugin/Factory lifecycle; five typed hooks; per-query builtin injection | Global init() prevents runtime removal; no plugin dependency graph; discovery plugin reconfigures everything |
| hellosales | 6/10 | Protocol-based provider + manual DI | Typed Protocol interfaces; clean Port/Adapter pattern; test overrides dataclass | All wiring in one 188-line function; no auto-discovery; hardcoded provider whitelist/URLs/key mappings; no versioning |

## Approach Models

The 13 repos cluster into five distinct approach models:

### 1. Plugin-System-First (temporal, opencode, openhands, opa)

These systems define a formal plugin/extension interface with some form of lifecycle management.

- **temporal** (`temporal/server_option.go:24-207`): 15+ `ServerOption` functional options inject factories for persistence, visibility, archival, authorization, dynamic config, metrics, TLS, gRPC interceptors. SQL backends use a separate `Plugin` interface with `init()` registration (`common/persistence/sql/store.go:18-26`). The `Plugin` interface has three lifecycle methods: `Start(ctx)`, `Stop(ctx)`, `Reconfigure(ctx, config)` (`v1/plugins/plugins.go:106-110`). The `Manager` orchestrates lifecycle in a single goroutine (`v1/plugins/plugins.go:892-945`).

- **opencode** (`packages/opencode/src/plugin/loader.ts:60-173`): Two-plugin architecture. V1 is external-facing with 17 typed lifecycle hooks — `event`, `config`, `tool`, `auth`, `provider`, `chat.message`, `chat.params`, `chat.headers`, `permission.ask`, `command.execute.before`, `tool.execute.before`, `tool.execute.after`, `shell.env`, `tool.definition`, plus four `experimental.*` hooks (`packages/plugin/src/index.ts:222-333`). V2 is internal-only, Effect-based, with `provider.update`, `model.update`, `aisdk.language`, `aisdk.sdk` hooks (`packages/core/src/plugin.ts:9-81`). Plugin compatibility is checked via `engines.opencode` semver range (`packages/opencode/src/plugin/shared.ts:194`). Missing: Start/Stop/Health lifecycle methods.

- **openhands** (`openhands/sdk/plugin/plugin.py:39-74`): Directory-based plugin bundles that package skills, hooks, MCP config, agents, and commands together. `InstallationManager[T]` provides full lifecycle: install, uninstall, enable, disable, update, list, load (`openhands/sdk/extensions/installation/manager.py:27-323`). Compatible with Claude Code plugin format. File-based auto-discovery of agents via `.agents/agents/` and `.openhands/agents/` (`openhands/sdk/subagent/registry.py:266-311`). The `DiscriminatedUnionMixin` (`openhands/sdk/utils/models.py:141-174`) auto-derives `kind` from class names, making new subclasses automatically routable in the serialization pipeline.

- **opa** (`v1/plugins/plugins.go:89-110`): `Factory` (Validate/New) + `Plugin` (Start/Stop/Reconfigure) interfaces registered globally via `init()` and managed by `Manager`. Five typed hooks (`v1/hooks/hooks.go:70-98`): `ConfigHook`, `ConfigDiscoveryHook`, `InterQueryCacheHook`, `InterQueryValueCacheHook`, `BundlePreActivateHook`. Plugins are instantiated by config (`plugins.<name>`) through the discovery subsystem (`v1/plugins/discovery/discovery.go:606-704`).

### 2. Component-System (autogen, mastra)

Systems where extension is done by implementing components that are loaded from configuration descriptors.

- **autogen** (`python/packages/autogen-core/src/autogen_core/_component_config.py:18-407`): `ComponentModel` — a JSON-serializable Pydantic descriptor with `provider`, `component_type`, `version`, `config` fields. The `ComponentLoader.load_component()` dynamically imports the provider class, validates against trusted namespaces, and applies version-aware config loading. Component types: model, agent, tool, termination, token_provider, workbench, memory, code_executor, chat_completion_context, team. The `Component[T]` mixin combines `ComponentFromConfig` (deserialize), `ComponentToConfig` (serialize), `ComponentSchemaType` (Pydantic schema class), enabling config round-trips.

- **mastra** (`packages/core/src/mastra/index.ts:215-480`): Central `Mastra` class accepts a `Config` object with all component types (agents, tools, workflows, storage, vectors, memory, voice, MCP, processors, channels, gateways). Storage uses a composite pattern (`MastraCompositeStore`, `packages/core/src/storage/base.ts:225-404`) with 17 domain interfaces that can be mixed across backends. Abstract classes define contracts: `MastraVector` (vector DB), `MastraMemory` (conversation memory), `MastraVoice` (TTS/STT). The `Processor` interface provides 8 lifecycle hooks on agent execution (`packages/core/src/processors/index.ts:465-615`).

### 3. ABC/Protocol with Explicit Wiring (langgraph, openai-agents-python, aider)

Systems that define ABCs or Protocols for extension but require explicit code wiring at composition time.

- **langgraph**: Extend via ABC subclasses for checkpointers (`BaseCheckpointSaver`), stores (`BaseStore`), channels (`BaseChannel`), and managed values (`ManagedValue`). Tools are plain functions or `BaseTool` instances passed to `ToolNode`. Middleware via `wrap_tool_call` closures (`libs/prebuilt/langgraph/prebuilt/tool_node.py:202-282`). Dependency injection via type annotations (`InjectedState`, `InjectedStore`). No plugin discovery — everything is wired in graph construction code.

- **openai-agents-python**: 7+ ABC/Protocol extension categories: `Model`/`ModelProvider` ABCs, `FunctionTool` dataclass with `@function_tool` decorator, `MCPServer` ABC, `RunHooksBase`/`AgentHooksBase` lifecycle hooks, guardrails via decorators, `TracingProcessor` ABC, `Session` Protocol. All components are explicitly wired onto `Agent` dataclass fields (no auto-discovery). Extension interfaces in core (`src/agents/models/interface.py:37`); implementations in `src/agents/extensions/`.

- **aider**: Convention-based extension without formal interfaces. Subclass `Coder` (discovered via `coders/__init__.py:18-34` `__all__` list), add `cmd_*` methods to `Commands` class (`commands.py:276-285`), override `reply_completed()` hook (`coders/base_coder.py:1625`). Model/provider onboarding via YAML/JSON5 resource files (`models.py:1078-1126`). Extension is implicit (convention) rather than explicit (interface).

### 4. Decorator/Registry (guardrails, nemo-guardrails)

Systems where the primary extension point is a decorator that registers into a global runtime registry.

- **guardrails**: `@register_validator(name, data_type)` decorator (`guardrails/validator_base.py:527-567`) registers into `validators_registry` dict. The Validator Hub adds a second path: `guardrails hub install hub://org/name` downloads pip packages, runs post-install scripts, and registers in `hub_registry.json` (`guardrails/hub/install.py:37-186`). Validators lazily resolved via `guardrails.hub.__getattr__`. LLM providers pluggable via `ArbitraryCallable` wrapping any callable with `**kwargs`.

- **nemo-guardrails**: `@action` decorator (`nemoguardrails/actions/actions.py:41-82`) attaches `ActionMeta` metadata. The `ActionDispatcher` auto-discovers actions by walking the `library/` directory tree, current working directory, and config paths for `actions.py` and `actions/` directories (`nemoguardrails/actions/action_dispatcher.py:58-118`). Library integrations are self-contained directories with `actions.py` + `flows.co`. Separate registries for embedding providers (`EmbeddingProviderRegistry`), LLM frameworks (`register_framework()`), and tracing adapters (`LogAdapterRegistry`).

### 5. Enum-Based (langfuse)

langfuse (`packages/shared/src/server/llm/types.ts:252-259`) uses a different model: LLM providers are an enum value (`LLMAdapter`) with per-provider model lists and config schemas. The MCP system is the closest thing to a structured plugin system — `ToolRegistry` singleton with `register()`, `getToolDefinitions()`, `getTool()`, name conflict detection, and conditional enablement (`web/src/features/mcp/server/registry.ts:72-182`). Queue processors, tRPC routers, public API routes use ad-hoc manual wiring.

## Pattern Catalog

### Pattern 1: File-Based Auto-Discovery

Drop files in a convention directory → they are automatically registered.

| Repo | Discovery Pattern | File:Line |
|------|------------------|-----------|
| opencode | `{tool,tools}/*.{ts,js}` → tools; `{agent,agents}/**/*.md` → agents; `{plugin,plugins}/*.{ts,js}` → plugins; `{skill,skills}/**/SKILL.md` → skills | `packages/opencode/src/tool/registry.ts:189-201`, `packages/opencode/src/config/agent.ts:107-136`, `packages/opencode/src/config/plugin.ts:29-38` |
| openhands | `.agents/agents/` and `.openhands/agents/` → agents; `.openhands/hooks.json` → hooks | `openhands/sdk/subagent/registry.py:266-311` |
| nemo-guardrails | `library/<name>/actions.py` + `flows.co` → library integrations; cwd `actions.py` + `actions/` → custom actions | `nemoguardrails/actions/action_dispatcher.py:58-118` |

**What problem it solves**: Lowers the extension barrier to zero-config — users write a file, drop it in the right place, and the system picks it up.

**Why it works**: Builds on filesystem conventions that developers already understand (directories, file naming). No manifest editing, no CLI commands, no config changes.

**When to copy**: When the target users are developers comfortable with file management. Particularly effective for tools (small, single-file extensions) and agents (declarative markdown).

**When it is overkill or risky**: When extensions have complex dependencies, need version pinning, or require multi-file packaging. File-based discovery makes it hard to express "extension A depends on extension B." Name collisions are resolved silently (last writer wins in opencode's tool registry at `packages/opencode/src/tool/registry.ts:203-208`).

### Pattern 2: Plugin Lifecycle Management

Formal Start/Stop/Reconfigure lifecycle for extensions, managed by a central orchestrator.

| Repo | Lifecycle | File:Line |
|------|-----------|-----------|
| temporal | Plugin: Start(ctx), Stop(ctx), Reconfigure(ctx, config); Manager orchestrates | `v1/plugins/plugins.go:106-110, 892-945` |
| opa | Plugin: Start(ctx), Stop(ctx), Reconfigure(ctx, config); Manager.Start/Stop iterate all | `v1/plugins/plugins.go:106-110, 892-947` |
| openhands | InstallationManager: install, uninstall, enable, disable, update, list, load | `openhands/sdk/extensions/installation/manager.py:27-323` |
| autogen | Component loading with version-aware config; no lifecycle hooks on components | `_component_config.py:204-307` |
| opencode | No lifecycle — loading and hook registration are atomic; no Start/Stop | Architectural inference (no lifecycle methods in Plugin interface) |

**What problem it solves**: Ensures plugins clean up resources (connections, goroutines, file handles) on shutdown, handle config changes gracefully, and report health.

**Why it works**: A small, stable interface (3 methods) is easy for plugin authors to implement. The Manager handles ordering, error propagation, and concurrent access.

**When to copy**: When extensions own long-lived resources (database connections, background goroutines, network listeners).

**When it is overkill or risky**: When extensions are stateless (e.g., simple data transformations). Lifecycle adds complexity without benefit. opencode's approach — stateless plugins that only respond to hooks — is simpler and sufficient for many use cases.

### Pattern 3: Config-Driven Component Loading

Extensions are configured via JSON/YAML descriptors, dynamically loaded at runtime.

| Repo | Mechanism | File:Line |
|------|-----------|-----------|
| autogen | `ComponentModel` JSON descriptor → `ComponentLoader.load_component()` dynamically imports | `_component_config.py:18-41, 204-307` |
| nemo-guardrails | YAML config with typed Pydantic models → RailsConfig | `rails/llm/config.py:1499-1698` |
| opa | Config `plugins.<name>` section → discovery plugin → Factory.New() | `v1/config/config.go:93`, `v1/plugins/discovery/discovery.go:606-704` |
| mastra | Central `Config` object (code, not file-based) | `packages/core/src/mastra/index.ts:215-480` |

**What problem it solves**: Enables operators to reconfigure extensions without code changes. Decouples deployment from development.

**Why it works**: A serializable component descriptor creates a clean boundary between "what to load" (config) and "how it works" (code). autogen's `ComponentModel` is the most rigorous — every component must support `_to_config()`/`_from_config()` round-trip through a Pydantic model.

**When to copy**: When non-developer operators need to enable/disable/configure extensions, or when extensions need to be loaded from a remote source (like OPA's discovery bundles).

**When it is overkill or risky**: Adds indirection and runtime failure modes (malformed YAML → startup failure; missing provider → runtime error). autogen's trusted namespace enforcement (`_component_config.py:55-81`) shows the security concerns that arise with dynamic loading.

### Pattern 4: Middleware/Hooks Pipeline

A chain of interceptors that wrap agent or tool execution.

| Repo | Pipeline | Scope | File:Line |
|------|----------|-------|-----------|
| opencode | 17 V1 hooks + 4 V2 hooks | Agent execution, tool execution, chat, config, shell, auth | `packages/plugin/src/index.ts:222-333` |
| openhands | 6 subprocess-based hooks (PRE/POST tool, session, user prompt) | Tool execution, session lifecycle | `openhands/sdk/hooks/types.py:9-12` |
| openai-agents-python | RunHooksBase + AgentHooksBase (7 events each) | Agent execution, tool execution, LLM, handoff | `src/agents/lifecycle.py:13-193` |
| autogen (.NET) | IMiddleware LIFO pipeline | Agent execution | `dotnet/src/AutoGen.Core/Middleware/IMiddleware.cs:12` |
| autogen (Python) | InterventionHandler (on_send, on_publish, on_response) | Message passing | `_intervention.py:20-66` |
| mastra | Processor interface (8 hooks) | Agent loop (input, output, stream, LLM, errors) | `packages/core/src/processors/index.ts:465-615` |
| langgraph | wrap_tool_call middleware | Tool execution only | `libs/prebuilt/langgraph/prebuilt/tool_node.py:202-282` |
| temporal | gRPC interceptor chain (20+ interceptors) | Server request/response | `service/frontend/fx.go:67-135` |
| opa | 5 typed hooks (Config, Cache, Bundle) | Config, cache, bundle lifecycle | `v1/hooks/hooks.go:70-98` |
| guardrails | On-fail action system | Post-validation only | `guardrails/types/on_fail.py:6-31` |
| langfuse | tRPC middleware chain | API request/response | `web/src/server/api/trpc.ts:17-80` |

**What problem it solves**: Cross-cutting concerns (logging, metrics, auth, rate limiting, content filtering) can be applied without modifying every extension or tool.

**Why it works**: A well-defined hook interface lets third parties intercept execution at natural boundaries (before tool call → after tool call, before LLM request → after LLM response).

**When to copy**: When you need observability, security, or policy enforcement across all extensions. Start with openai-agents-python's model (per-run + per-agent hooks at major lifecycle events) — it's the simplest pattern that covers the common cases.

**When it is overkill or risky**: Too many hooks (opencode's 17 V1 hooks) create a large surface area that's hard to document and easy to misuse. OpenHands' subprocess-based hooks have high per-invocation latency. Guardrails' on-fail-only hooks are too limited for most cross-cutting needs.

### Pattern 5: Interface Versioning / Deprecation Management

| Repo | Mechanism | File:Line |
|------|-----------|-----------|
| opencode | `engines.opencode` semver check on plugin load | `packages/opencode/src/plugin/shared.ts:194` |
| openhands | SDK deprecation policy (5 minor releases before removal), enforced in CI | `openhands/sdk/AGENTS.md` |
| langgraph | `LangGraphDeprecatedSinceV05`, `LangGraphDeprecatedSinceV10` warning classes | `libs/langgraph/langgraph/graph/state.py:224-248` |
| nemo-guardrails | Pydantic `deprecated` field parameter, `DeprecationWarning`, migration docs | `rails/llm/config.py:761-770` |
| opa | `capabilities/` versioned JSON files for builtins; shim packages for v0→v1 | `capabilities/v1.16.2.json`, `plugins/plugins.go:73` |
| autogen | Config versioning (`_from_config_past_version`) — mostly stubbed | `_component_config.py:286-298` |
| openai-agents-python | RunState schema versioning; positional compatibility guarantee | `src/agents/run_state.py` |
| temporal | `experimental` doc comments on 4 ServerOption APIs | `temporal/server_option.go:145,159,167,175` |
| guardrails | TODO comments about future rename/removal (no actual deprecation warnings) | `guardrails/validator_base.py:1-4` |
| aider | No formal deprecation mechanism | Not found |
| langfuse | No formal deprecation mechanism | Not found |
| hellosales | No formal deprecation mechanism | Not found |
| mastra | changesets (pre-1.0); no formal deprecation | `.changeset/` |

Only **three repos** have a working breaking-change management mechanism: opencode (semver range checking), openhands (5-release deprecation policy with CI enforcement), and langgraph (version-scoped warning classes). This is the most significant gap across the study set.

### Pattern 6: Tool Registration Patterns

| Approach | Repos |
|----------|-------|
| Decorator wrapping any Python function | openai-agents-python (`@function_tool`), guardrails (`@register_validator`), nemo-guardrails (`@action`) |
| ABC/Protocol subclass | langgraph (`BaseTool`), autogen (`BaseTool` + `Component[Config]`) |
| File-based auto-discovery | opencode (`{tool,tools}/*.ts`), openhands (tool system via DiscriminatedUnionMixin) |
| Convention method naming | aider (`cmd_*` methods on `Commands` class) |
| Factory function | mastra (`createTool()`), opencode (`tool()` SDK) |
| Config descriptor | autogen (`ComponentModel` with provider string) |
| Attribute annotation | autogen (.NET) (`[FunctionAttribute]`) |

The **decorator pattern** is the lowest-friction for Python systems — a single-line addition to an existing function. The **file-based discovery pattern** (opencode, openhands) is the lowest-friction overall — no code changes in the core repo at all.

### Pattern 7: Provider Abstraction Strategies

| Strategy | Repos | Tradeoff |
|----------|-------|----------|
| Delegate to a third-party library | aider (litellm), guardrails (LiteLLM), openai-agents-python (LiteLLM via extensions) | Reduces own provider surface but couples reliability to the library's API stability |
| Framework-based indirection | nemo-guardrails (DefaultFramework vs LangChainFramework) | Clean separation but code must check active framework before accessing providers |
| Enum + switch statements | langfuse (LLMAdapter enum) | Type-safe but requires touching multiple files for new providers; no dynamic loading |
| Component model with config | autogen (Component[T] + dynamic import) | Most flexible but requires runtime import and trusted namespace enforcement |
| Protocol/ABC with explicit wiring | openai-agents-python (ModelProvider ABC), hellosales (LLMProviderPort Protocol) | Predictable but requires code changes for new providers |
| Plugin-based | opencode (30 provider plugins via V2) | Most scalable for many providers but V2 is internal-only |

## Key Differences

### What Converges

1. **ABC/Protocol as extension contract**: 11 of 13 repos use some form of abstract interface (ABC, Protocol, Go interface, TypeScript interface) as the primary extension contract. The specific mechanism varies but the principle is universal.

2. **Explicit over magic for critical paths**: Even repos with auto-discovery (opencode, openhands) use explicit wiring for core subsystems (auth, persistence). Auto-discovery is reserved for tools, agents, and skills — the "user-facing" extensions.

3. **Separate package for implementations**: openai-agents-python (`extensions/`), autogen (`autogen-ext/`), mastra (`stores/`, `integrations/`), langgraph (`checkpoint-sqlite`, `checkpoint-postgres`), openhands (`enterprise/`) all isolate extension implementations from core interfaces.

4. **Decorator for low-friction extension**: Python repos consistently use decorators for the most common extension path (tools, validators, actions). TypeScript repos prefer file-based discovery or factory functions.

### Why They Diverge

1. **Plugin lifecycle maturity correlates with deployment model**: temporal (long-running server), opa (sidecar/policy server), and openhands (server agent) need lifecycle because they manage long-lived resources. Agent frameworks (langgraph, openai-agents-python) don't — agent runs are ephemeral. This is not a quality difference; it's a product-shaped difference.

2. **Discovery mechanism reflects audience**: File-based discovery (opencode, openhands) targets developers who want to drop in a tool without learning a package manager. Config-driven discovery (autogen) targets operators who configure from YAML manifests. Decorator-based discovery (guardrails, nemo-guardrails) targets Python developers who prefer code-level extension. The right choice depends on who writes the extensions.

3. **Plugin versioning rigor correlates with ecosystem ambition**: Temporal invests in stable interfaces because operators expect zero-downtime upgrades. OpenCode has semver checking because it distributes plugins via npm/pip. Systems without third-party package distribution (aider, langgraph, mastra) have no formal versioning because they don't need it.

4. **Middleware breadth tracks framework vs application distinction**: Server frameworks (temporal, opa) invest in middleware chains because they serve multiple tenants with different requirements. Agent frameworks (langgraph, openai-agents-python) invest less in middleware because each agent run is single-tenant. Applications (hellosales, langfuse) have the least middleware because they control their own deployment.

## Tradeoffs

| Design Decision | Benefit | Cost | Best-Fit Context | Failure Mode | Alternative Seen In |
|-----------------|---------|------|-----------------|--------------|---------------------|
| Formal plugin lifecycle (Start/Stop/Reconfigure) | Clean resource management, graceful shutdown, health visibility | Implementation overhead for simple stateless extensions | Long-running server processes | Plugin blocks Start() → entire server stalls | opencode's stateless-pure-hook approach |
| File-based auto-discovery | Zero-config extension; no code changes in core | Name collisions silently resolved; no dependency management | Single-repo, single-team tools | Accidental overwriting of tools with same name | autogen's explicit ComponentModel config |
| Config-driven component loading (JSON/YAML descriptors) | Operator-friendly; no code changes needed to reconfigure | Runtime import failures; security concerns with dynamic loading | Platform products with operator personas | Malformed config → hard startup failure | openai-agents-python's all-code explicit wiring |
| ABC with Protocol | Strong contract enforcement; type checking | More boilerplate than duck-typing | Stable interfaces with third-party implementors | Breaking ABC changes require all implementations to update simultaneously | nemo-guardrails' duck-typed LLMFramework protocol |
| Decorator-based registration | Minimal code per extension point; Pythonic | Only works in Python; import-time side effects | Python ecosystems where extensions are code | Import order determines registration order; @register_validator before or after imports? | opencode's file-based registration (no import order issue) |
| Subprocess-based hooks | Process isolation; language-agnostic; crash isolation | High latency per hook; limited I/O protocol (JSON stdin/stdout) | Security-critical policy enforcement | Hook script crashes → no side effects but no clear error to user | opencode's in-process hook mutation |
| Global init() registration (Go) | Compile-time safety; no runtime discovery overhead | Cannot add/remove at runtime; imports determine registry | Go monoliths with known backends | Duplicate registration → panic at startup | opencode's file-based discovery (no panic) |
| Protocol (structural typing) over ABC | Duck-typing allows non-class implementors | No structural enforcement at construction time | Flexible interfaces where runtime duck-typing is acceptable | Incomplete implementation only fails at use, not at registration | autogen's ABC-heavy Component system |
| Versioned capabilities JSON | Machine-readable compatibility checks | Manual maintenance; must be kept in sync with code | Large builtin surface that evolves across versions | Stale capabilities → false positive/negative on compatibility check | openhands' CI-enforced deprecation policy |

## Decision Guide

### When to Use Each Approach

**Choose formal plugin system (temporal/opa model)** when:
- Your system runs as a long-lived server
- Extensions manage resources (connections, goroutines, files)
- You need graceful shutdown and health checking
- Operators need to add/remove extensions without code changes

**Choose component system (autogen model)** when:
- Extensions need to be serializable and loadable from config
- You have multiple extension types (model, tool, agent, memory, etc.)
- You want config-driven composition
- You can enforce security boundaries on dynamic imports

**Choose ABC/Protocol with explicit wiring (openai-agents-python/langgraph model)** when:
- Your system is a library/framework, not a server
- Agent runs are ephemeral (no long-lived resources)
- You prioritize type safety and IDE discoverability
- Third-party extensions are expected but not the primary distribution channel

**Choose decorator+registry (guardrails/nemo-guardrails model)** when:
- You're in a Python ecosystem
- The primary extension unit is a function or small class
- You want simple, discoverable extension points
- Global import-time registry is acceptable

**Choose file-based auto-discovery (opencode/openhands model)** when:
- Your users are developers comfortable with filesystem conventions
- Extensions are single-file or small
- You want zero-config "just drop a file" UX
- Name collisions are rare or acceptable

### Anti-Patterns to Avoid

1. **Monolithic composition root** (hellosales' `app_container.py:109-297`): A single 188-line function wiring every dependency violates the Open/Closed principle — every new extension requires editing this file. This is tolerable at small scale but becomes a merge-conflict magnet as the team grows.

2. **Flat action/tool registry without namespacing** (nemo-guardrails' `action_dispatcher.py`, opencode's tool registry at `packages/opencode/src/tool/registry.ts:203-208`): Silent overwriting on name collision is the most common extensibility bug. Even a simple namespace convention (e.g., `provider.tool_name`) prevents this.

3. **Stubbed versioning infrastructure** (autogen's `_from_config_past_version` at `_component_config.py:286-298`): Adding config versioning infrastructure without implementing migration for most components creates false confidence. Either version or don't — stubs that raise `NotImplementedError` are worse than no versioning.

4. **Enum-based provider extension** (langfuse's `LLMAdapter` at `types.ts:252-259`): Adding a new enum value requires touching multiple switch statements. An interface-based registry prevents this brittleness.

5. **Hardcoded provider mappings** (hellosales' `PROVIDER_BASE_URLS` at `settings.py:15-20` and `resolved_generic_agent_api_key` at `settings.py:281-291`): Every new provider requires a code change in three separate locations. A generalized map (provider name → URL template + key env var name) would eliminate this friction.

## Practical Tips

### Patterns to Copy

1. **File-based auto-discovery for tools/agents** (opencode's `{tool,tools}/*.ts` at `packages/opencode/src/tool/registry.ts:189-201`, openhands' markdown agents at `openhands/sdk/subagent/registry.py:266-311`): Lowest-friction extension pattern across all 13 repos. Zero-config, discoverable via filesystem.

2. **Engineered deprecation policy** (openhands' 5-release policy, `openhands/sdk/AGENTS.md`): The only repo with a CI-enforced deprecation cadence. Symbols marked `deprecated_in` trigger CI blockers at removal time. Every platform should copy this.

3. **Functional options for server extension** (temporal's `ServerOption` at `temporal/server_option.go:24-207`): Backward-compatible, discoverable (all in one file), and composition-friendly. The canonical Go pattern for good reason.

4. **Component serialization round-trip** (autogen's `_to_config()`/`_from_config()` at `_component_config.py:84-170`): Enables declarative YAML/JSON agent definitions, debugging (dump/resume agent state), and test fixtures. The Pydantic integration makes this type-safe.

5. **Plugin as function composition** (opencode's `(input, options) => Hooks` at `packages/plugin/src/index.ts:74`): Simpler than class-based plugins. No instantiation, no lifecycle — just a function returning hooks. Works well for stateless extensions.

6. **Decorator-first UX for common cases** (openai-agents-python's `@function_tool` at `src/agents/tool.py:1763-1826`, guardrails' `@register_validator` at `guardrails/validator_base.py:527-567`): The most common extension path should be a one-liner. Complex extensions (custom providers, custom models) can require ABC implementation; the 80% case should be a decorator.

### Patterns to Avoid or Delay

1. **Subprocess-based hooks** (openhands' hook executor at `openhands/sdk/hooks/executor.py:140-156`): Process isolation is valuable for security, but the latency cost (spawn process per event) limits throughput. Use only for security-critical policy enforcement where isolation justifies cost.

2. **Global `init()` registration** (opa's `init()` at `v1/runtime/runtime.go:1138-1142`, temporal's SQL plugin `init()` at `common/persistence/sql/store.go:18-26`): Can't add/remove at runtime; duplicates cause panics. Acceptable in Go monorepos but fragile for plugin ecosystems.

3. **Single-file composition root** (hellosales' `app_container.py:109-297`): Works at small scale but doesn't scale. Replace with registry pattern or DI framework before the team grows past 3-4 developers.

### HelloSales-Specific Recommendations

#### Quick Wins (Low Effort, High Impact)

1. **Add entry_points-based plugin discovery for providers** (effort: 2-3 days): Add `[project.entry-points."hello_sales.providers"]` to `pyproject.toml`. This would allow third-party packages to register provider implementations (LLM, auth, web search, voice) without modifying the composition root (`app_container.py:109`). This is the standard Python approach (used by pytest, flake8). The composition root would scan entry points at startup and merge discovered providers with hardcoded ones.

2. **Replace hardcoded `PROVIDER_BASE_URLS` and API key resolution** (effort: 1-2 days): Replace `settings.py:15-20` and `settings.py:281-291` with a generic `ProviderEndpointConfig` dataclass that maps provider name to `(base_url_template, api_key_env_var)`. Store in a config file or dict. Adding a new provider becomes a config change, not a code change across 3 locations.

3. **Create `EXTENSION_POINTS.md`** (effort: 0.5 day): Document every extension point with: (a) what protocol/contract to implement, (b) where to register it, (c) an example, (d) what env vars are needed. Currently this information is distributed across `contracts.py`, `providers.py`, `settings.py`, and `app_container.py` — no single source of truth.

4. **Add interface version markers** (effort: 1 day): Add `LLMProviderPortV1`, `AuthProviderPortV1`, etc. as type aliases or subclass markers. Currently (`hellosales` analysis at `platform/llm/contracts.py:91`) all protocols are unversioned — a breaking change to `LLMProviderPort` silently breaks all implementations. Even a simple `V1`/`V2` suffix pattern (like temporal's experimental markers) would provide a migration path.

5. **Make agent tool catalogs configurable** (effort: 2-3 days): Replace hardcoded tool lists in agent definitions (`application/agents/definitions/<name>/agent.py`) with a config that references tools by name. This would allow adding tools to agents without editing agent definition files. Pattern from autogen's `AssistantAgentConfig` (`assistant_agent.py:70`) where tools are listed as `ComponentModel` references.

#### Long-Term Improvements (High Effort, Architectural)

1. **Replace hand-rolled DI with component system** (effort: 2-4 weeks): The current explicit wiring in `build_app_container()` (`app_container.py:109-297`) with `AppContainer`, `ProviderRegistry`, and `ModuleRegistry` dataclasses is fragile and grows linearly with extension count. Adopt autogen's `Component[T]` pattern or a DI framework. The key requirement: adding a new provider type should not require editing the composition root.

2. **Add extension lifecycle hooks** (effort: 1-2 weeks): Implement `ExtensionLifecycle` protocol with `on_startup()`, `on_shutdown()`, and optional `health_check()` methods. Call `on_startup()` on all registered extensions at app boot, `on_shutdown()` at graceful shutdown. Currently (`hellosales` analysis) there is no mechanism for extensions to initialize or clean up.

3. **Replace whitelist validators with pluggable registry** (effort: 1-2 weeks): The provider whitelist validators in `settings.py:200-234` restrict auth, web search, and voice providers to known values. Replace with a `ProviderRegistry` that can be extended at runtime (via entry points or programmatic API) without modifying `settings.py`. Pattern from autogen's `WELL_KNOWN_PROVIDERS` + `AUTOGEN_ALLOWED_PROVIDER_NAMESPACES` env var (`_component_config.py:47-81`).

4. **Add runtime capability discovery** (effort: 3-5 days): After implementing entry-point-based plugin discovery, add `mastra.list_extension_points()`-style introspection: "what providers are registered?" "what tools does agent X support?" Currently (`hellosales` analysis) there is no runtime enumeration API.

5. **Implement config-driven agent definitions** (effort: 2-3 weeks): Allow agents to be defined in YAML/JSON files (like autogen's `ComponentModel`), not just Python code. This would decouple agent composition from code deployment, enabling operators to reconfigure agents without redeploying.

#### Risks

1. **Composition root as single point of failure**: If `build_app_container()` (`app_container.py:109-297`) continues to grow, it will become a merge-conflict bottleneck as the team scales. Mitigation: split into per-module `build_*_module()` functions called from the root, not inline in a single function.

2. **Frozen dataclass evolution**: Adding a required field to `AgentDefinition` or `WorkerDefinition` silently breaks all existing definitions until they are updated. Mitigation: use optional fields with defaults, or implement autogen-style versioning (`_from_config_past_version`).

3. **Late provider initialization failures**: Selecting a provider via env var that fails initialization (wrong API key, unavailable service) only fails on first use, not at startup. Mitigation: implement a startup health check that verifies all configured providers are reachable (like temporal's plugin `Start()` call).

4. **Provider whitelist as adoption barrier**: The whitelist in `settings.py:200-234` is intentionally restrictive but will frustrate developers who want to experiment with new providers. Mitigation: add an escape hatch like `AUTOGEN_ALLOWED_PROVIDER_NAMESPACES` env var or a `HELLO_SALES_ALLOW_ALL_PROVIDERS=1` dev flag.

5. **Third-party extensions bypassing whitelist**: If entry-point-based plugin discovery is added without security boundaries, any pip-installed package could register a provider. Mitigation: implement a trust model like autogen's trusted namespace enforcement (`_component_config.py:55-81`) with an allowlist.

## Notable Absences

- **No repo has an automated API compatibility test suite** for extension interfaces. OpenHands has `check_sdk_api_breakage.py` but it checks deprecation annotations, not interface compatibility. No repo compares interfaces across versions with a tool like `pytest-analogous` or `api-compat`.

- **No repo has a plugin marketplace or registry UI** beyond command-line tools (`guardrails hub list`, `nemoguardrails providers`). OpenCode's `@opencode-ai/plugin` npm package comes closest but has no discoverable registry of available plugins.

- **No repo has runtime plugin hot-reload** (detect file changes → reload plugin without restart). Several repos have the infrastructure to support it (opencode's file-based discovery, openhands' InstallationManager) but none implement file watching.

- **No repo has extension-level permission modeling** beyond simple enable/disable. If a plugin needs different permissions than the user (e.g., read-only vs read-write), there's no mechanism to declare or enforce this.

- **No repo has cross-extension dependency resolution**. If extension A depends on extension B being loaded first, the developer must manage ordering manually.

## Open Questions

1. **How do extension interfaces evolve without breaking existing implementations?** Only openhands has a documented deprecation policy. Most repos rely on "be careful" — which doesn't scale to an ecosystem. What's the right tradeoff between interface stability and evolution speed?

2. **When is file-based auto-discovery better than config-based loading?** OpenCode and openhands prove file-based discovery works well for tools and agents. But autogen's component model provides stronger contract enforcement and serialization. What makes a system pick one over the other? The evidence suggests it correlates with deployment model (library vs server) rather than technical superiority.

3. **Is subprocess-based hook execution worth the latency cost?** OpenHands is the only repo using subprocess isolation for hooks. Is the process isolation benefit (crash isolation, language independence) worth the spawn latency? Or is in-process hook execution (opencode's approach) sufficient for most use cases?

4. **Can enum-based extension (langfuse) ever be as extensible as interface-based (autogen)?** Enum-based extension provides exhaustiveness checking (the compiler checks all cases) but requires touching multiple files for new providers. Interface-based extension supports dynamic loading but loses exhaustiveness. Is there a hybrid that preserves both?

5. **What is the minimum viable extension lifecycle?** Temporal and opa have full Start/Stop/Reconfigure. OpenCode has nothing. OpenHands has Install/Enable/Disable/Uninstall. What lifecycle methods are essential for an extension system, and what are nice-to-haves?

## Evidence Index

Every evidence reference in this report follows the `path/to/file.ts:NN` format. Below is a consolidated index by repo.

**aider**: `coders/base_coder.py:124-201` (coder factory), `coders/__init__.py:18-34` (coder registry), `commands.py:276-285` (command discovery), `models.py:1078-1126` (model settings YAML/JSON5), `models.py:120-143` (ModelSettings dataclass)

**autogen**: `_component_config.py:18-407` (component system), `_component_config.py:204-307` (dynamic loader), `_component_config.py:55-81` (trusted namespaces), `_agent.py:1-64` (Agent protocol), `_intervention.py:20-66` (intervention handlers), `tools/_base.py:96-97` (BaseTool), `_serialization.py:14` (MessageSerializer)

**guardrails**: `guardrails/validator_base.py:527-567` (validator registration), `guardrails/hub/install.py:37-186` (Hub install), `guardrails/llm_providers.py:505-588` (LLM auto-detection), `guardrails/types/on_fail.py:6-31` (on-fail actions)

**hellosales**: `platform/composition/app_container.py:109` (composition root), `platform/composition/providers.py:123` (provider registry), `platform/llm/contracts.py:91` (LLM protocol), `platform/config/settings.py:15-20,281-291` (hardcoded mappings), `application/agents/bootstrap.py:20` (agent definitions)

**langfuse**: `web/src/features/mcp/server/registry.ts:72-182` (MCP ToolRegistry), `worker/src/queues/workerManager.ts:127-185` (queue registration), `packages/shared/src/server/llm/types.ts:252-259` (LLM adapter enum), `web/src/server/api/root.ts:64-121` (tRPC router registry)

**langgraph**: `libs/prebuilt/langgraph/prebuilt/tool_node.py:743-786` (ToolNode), `libs/langgraph/langgraph/channels/base.py:19-121` (BaseChannel), `libs/checkpoint/langgraph/checkpoint/base/` (checkpointer ABC), `libs/prebuilt/langgraph/prebuilt/tool_node.py:202-282` (tool middleware)

**mastra**: `packages/core/src/mastra/index.ts:215-480` (Mastra config), `packages/core/src/tools/tool.ts:540-561` (createTool), `packages/core/src/storage/base.ts:225-404` (composite store), `packages/core/src/processors/index.ts:465-615` (Processor interface), `packages/core/src/integration/integration.ts:4-51` (Integration class)

**nemo-guardrails**: `nemoguardrails/actions/actions.py:41-82` (@action decorator), `nemoguardrails/actions/action_dispatcher.py:58-118` (auto-discovery), `nemoguardrails/library/` (30 library integrations), `nemoguardrails/rails/llm/config.py:1499-1698` (RailsConfig), `nemoguardrails/guardrails/rails_manager.py:52-60` (hardcoded RailAction registry)

**opa**: `v1/plugins/plugins.go:89-110` (Plugin/Factory interfaces), `v1/runtime/runtime.go:93-97` (plugin registration), `v1/hooks/hooks.go:70-98` (5 hook types), `v1/ast/builtins.go:22-40` (builtin registration), `v1/topdown/builtins.go:91-93` (builtin implementation), `v1/storage/interface.go:19-44` (Store interface), `capabilities/` (versioned capabilities)

**openai-agents-python**: `src/agents/tool.py:1763-1826` (@function_tool), `src/agents/models/interface.py:37-124` (Model ABC), `src/agents/lifecycle.py:13-193` (hooks), `src/agents/guardrail.py:72-186` (guardrails), `src/agents/mcp/server.py:223-380` (MCPServer ABC), `src/agents/tracing/processor_interface.py:9-130` (TracingProcessor)

**opencode**: `packages/plugin/src/index.ts:222-333` (V1 hooks), `packages/core/src/plugin.ts:9-81` (V2 plugins), `packages/opencode/src/plugin/loader.ts:60-173` (plugin loader), `packages/opencode/src/tool/registry.ts:189-208` (tool discovery), `packages/opencode/src/config/agent.ts:107-136` (agent discovery), `packages/opencode/src/skill/index.ts:163-221` (skill discovery)

**openhands**: `openhands/sdk/utils/models.py:141-174` (DiscriminatedUnionMixin), `openhands/sdk/tool/registry.py:147-198` (tool registration), `openhands/sdk/subagent/registry.py:266-311` (file-based agent discovery), `openhands/sdk/plugin/plugin.py:39-74` (Plugin), `openhands/sdk/hooks/types.py:9-12` (6 hook events), `openhands/sdk/hooks/executor.py:140-156` (subprocess hook executor), `openhands/sdk/extensions/installation/manager.py:27-323` (InstallationManager)

**temporal**: `temporal/server_option.go:24-207` (15+ ServerOptions), `common/persistence/sql/store.go:18-26` (SQL plugin registry), `common/persistence/sql/sqlplugin/interfaces.go:31-36` (Plugin interface), `common/authorization/authorizer.go:54-56` (Authorizer), `service/frontend/fx.go:67-135` (gRPC interceptor chain), `common/dynamicconfig/client.go:12-32` (dynamic config)

---

Generated by `study-areas/21-extensibility.md`.
