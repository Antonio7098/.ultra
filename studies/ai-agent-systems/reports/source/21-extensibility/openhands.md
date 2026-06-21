# Repo Analysis: openhands

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | openhands |
| Path | `repos/openhands` |
| Language / Stack | Python 3.12 (SDK + FastAPI server), TypeScript/React (frontend) |
| Analyzed | 2026-05-17 |

## Summary

OpenHands has a **comprehensive, multi-layered extensibility architecture** spanning 10+ layers: polymorphic discriminated unions (`DiscriminatedUnionMixin`), global registries (tools, agents, skills, plugins), file-based discovery (markdown agents, skills, hooks, plugins), lifecycle hooks (pre/post tool, session events), the Model Context Protocol (MCP) for external tools, generic `InstallationManager[T]` for extension lifecycle, configuration-driven component selection, server-side ABC+Injector pattern, enterprise extensions via a separate package, and frontend plugin UI components. Extension is well-defined, discoverable, and documented.

## Rating

**8/10** — Well-defined extension interfaces with documentation. Plugin architecture exists but plugin APIs are not yet independently versioned (the extension lifecycle management is generic, but individual plugin formats follow external conventions like Claude Code's). Auto-discovery via file system is powerful but the server-side router aggregation remains manual.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Polymorphic dispatch core | `DiscriminatedUnionMixin` enables automatic subclass routing via `kind` field | `openhands/sdk/utils/models.py:141-174` |
| Tool registration API | `register_tool(name, factory)` — global thread-safe registry of tool resolvers | `openhands/sdk/tool/registry.py:147-198` |
| Tool ABC + Protocol | `ToolDefinition(DiscriminatedUnionMixin, ABC)` — base for all tools; `ToolExecutor` — callable interface | `openhands/sdk/tool/tool.py:184-228`, `openhands/sdk/tool/tool.py:132-164` |
| Tool auto-naming | `__init_subclass__` auto derives tool name from class name | `openhands/sdk/tool/tool.py:223-228` |
| Agent registration API | `register_agent(name, factory_func, description)` — global registry | `openhands/sdk/subagent/registry.py:85-121` |
| File-based agent discovery | Markdown agents from `.agents/agents/` and `.openhands/agents/` dirs | `openhands/sdk/subagent/registry.py:266-311` |
| Agent precedence order | Programmatic > Plugin > Project files > User files > SDK built-ins | `openhands/sdk/subagent/AGENTS.md` |
| Plugin system | `Plugin` bundles skills, hooks, MCP config, agents, commands from directory | `openhands/sdk/plugin/plugin.py:39-74` |
| Plugin loading | `Plugin.load(path)` loads from dir; `Plugin.load_all(dir)` bulk | `openhands/sdk/plugin/plugin.py:292-338` |
| Plugin fetch | `Plugin.fetch(source)` fetches from GitHub/git URL | `openhands/sdk/plugin/plugin.py:236` |
| Generic extension manager | `InstallationManager[T]` — install, uninstall, enable, disable, update, list, load | `openhands/sdk/extensions/installation/manager.py:27-323` |
| Extension protocol | `ExtensionProtocol` — requires `name`, `version`, `description` | `openhands/sdk/extensions/installation/interface.py:6` |
| Installation interface | `InstallationInterface[T](ABC)` — `load_from_dir(extension_dir)` | `openhands/sdk/extensions/installation/interface.py:24` |
| Hook system — event types | `PRE_TOOL_USE`, `POST_TOOL_USE`, `USER_PROMPT_SUBMIT`, `SESSION_START`, `SESSION_END`, `STOP` | `openhands/sdk/hooks/types.py:9-12` |
| Hook config | `HookConfig` — JSON file at `.openhands/hooks.json`; per-event matchers | `openhands/sdk/hooks/config.py:105-151` |
| Hook executor | Subprocess execution with JSON stdin/stdout; exit code 2 = DENY | `openhands/sdk/hooks/executor.py:140-156` |
| Hook event integration | `HookEventProcessor` creates observable `HookExecutionEvent`s | `openhands/sdk/hooks/conversation_hooks.py:46` |
| MCP tool creation | `create_mcp_tools()` — factory from MCP config dict | `openhands/sdk/mcp/tool.py` |
| MCP transports | SSE, SHTTP, stdio server config in `config.template.toml` | `config.template.toml:348-383` |
| MCP in agent base | `mcp_config` field on `AgentBase` | `openhands/sdk/agent/base.py:90-96` |
| Skill system | `Skill` model with markdown frontmatter; triggers for conditional injection | `openhands/sdk/skills/skill.py:107-159` |
| Skill loading priority | Public repo < User < Project | `openhands/sdk/skills/skill.py:1100` |
| Skills with MCP | Skills can bundle `.mcp.json` for tool support | `openhands/sdk/skills/skill.py:144-151` |
| Agent base — tool list | `AgentBase.tools: list[Tool]` — declarative tool reference | `openhands/sdk/agent/base.py:78-89` |
| Condenser selection | Config-driven plugable condenser strategies | `config.template.toml:242-299` |
| Security analyzer selection | Config-driven `security_analyzer` = "llm" or "invariant" | `config.template.toml:226-236` |
| Model routing selection | Config-driven router strategy | `config.template.toml:389-394` |
| Custom agent via classpath | `[agent.CustomAgent] classpath = "my_package.MyAgent"` | `config.template.toml:141-144` |
| Git provider registration | `service_class_map: dict[ProviderType, type[GitService]]` | `openhands/app_server/integrations/provider.py:128-135` |
| Server middleware | `BaseHTTPMiddleware` subclasses: CORS, CacheControl, RateLimit | `openhands/app_server/middleware.py:18-136` |
| API router aggregation | Manual `router.include_router(...)` in `v1_router.py` | `openhands/app_server/v1_router.py:24-37` |
| Server service injection | `Injector[T](ABC)` — generic DI with `DiscriminatedUnionMixin` | `openhands/app_server/services/injector.py:12` |
| Enterprise extension | Separate `pyproject.toml` depending on `openhands-ai`; adds Keycloak, Stripe, Jira, etc. | `enterprise/pyproject.toml:1-20` |
| Frontend plugin UI | Plugin launch modal, parameter input, parameter section components | `frontend/src/components/features/launch/` |
| Frontend action extensibility | `HANDLED_ACTIONS` array in chat-slice | `frontend/src/state/chat-slice.ts` |

## Answers to Protocol Questions

### 1. What are the primary extension points?

- **Tool system**: `register_tool()` + `ToolDefinition` subclasses with auto-discovery via `DiscriminatedUnionMixin`
- **Agent system**: `register_agent()` + file-based markdown agents
- **Plugin system**: Directory-based plugins bundling skills, hooks, MCP, agents, commands
- **Extension manager**: `InstallationManager[T]` with full lifecycle (install/uninstall/enable/disable/update)
- **Hook system**: Subprocess-based lifecycle hooks at 6 event points with pattern matching
- **MCP**: External tool servers via SSE/SHTTP/stdio transport
- **Skills**: Markdown files with trigger-based auto-injection
- **Server services**: ABC+Injector pattern for dependency injection
- **Configuration**: TOML-driven component selection (condenser, security, model routing)

### 2. How are custom tools/providers added?

Tools are added by creating a `ToolDefinition` subclass with an `Action`, `Observation`, and `ToolExecutor`, then calling `register_tool(name, factory)` (`openhands/sdk/tool/registry.py:147`). Tools auto-derive their name from the class name via `__init_subclass__` (`openhands/sdk/tool/tool.py:223`). Tool executors implement `ToolExecutor.__call__(action, conversation)` (`openhands/sdk/tool/tool.py:132`).

Git providers require: (1) implementing `GitService` protocol, (2) adding to `service_class_map` (`openhands/app_server/integrations/provider.py:128`), (3) adding `ProviderType` enum entry, (4) adding to `PROVIDER_DOMAINS`.

### 3. Are there hooks/middleware for customization?

**Yes — two distinct systems:**

1. **Lifecycle hooks** (`openhands/sdk/hooks/`): Subprocess-based hooks at 6 event points (`PRE_TOOL_USE`, `POST_TOOL_USE`, `USER_PROMPT_SUBMIT`, `SESSION_START`, `SESSION_END`, `STOP`). Configured via `.openhands/hooks.json` JSON file. Hooks communicate via JSON stdin/stdout. Exit code 2 blocks execution (`openhands/sdk/hooks/executor.py:140`). Supports pattern matching (exact, wildcard `*`, regex) per tool name (`openhands/sdk/hooks/config.py:59-102`). Async hooks are supported via `async_process_manager`.

2. **Server middleware** (`openhands/app_server/middleware.py`): Starlette `BaseHTTPMiddleware` subclasses — `LocalhostCORSMiddleware`, `CacheControlMiddleware`, `RateLimitMiddleware`.

### 4. Is extension configuration-driven or code-driven?

**Both, with a clear split:**

- **Configuration-driven**: Condenser type (`config.template.toml:250`), security analyzer (`config.template.toml:233`), model router (`config.template.toml:394`), MCP servers (`config.template.toml:348-383`), custom agent classpath (`config.template.toml:144`), tool enable/disable flags (`config.template.toml:107-139`).
- **Code-driven**: Tool registration (`register_tool`), agent registration (`register_agent`), plugin loading (`Plugin.load`), hook configuration.
- **File-driven (middle ground)**: Markdown agents, skills, hooks JSON, plugin directories — these are declarative files discovered by convention rather than code or config.toml.

### 5. How stable are extension interfaces?

The SDK tool and agent interfaces are well-defined ABCs/protocols. `ToolDefinition` and `AgentBase` use `DiscriminatedUnionMixin` for polymorphic serialization, meaning new subclasses integrate automatically. The SDK has a formal deprecation policy (5 minor releases before removal) enforced by `check_sdk_api_breakage.py` (`openhands/sdk/AGENTS.md`). The `install()` method on `InstallationManager` includes backward-compatible install with force flag that preserves `enabled` state (`openhands/sdk/extensions/installation/manager.py:53-130`). The hook config supports legacy PascalCase keys without deprecation warnings for interoperability with Claude Code plugin hook files (`openhands/sdk/hooks/config.py:212-214`). Schema evolution is handled via deprecated field validators (`handle_deprecated_model_fields`).

The server-side `v1_router.py` uses manual `include_router()` calls — a new feature router must be explicitly wired in (`openhands/app_server/v1_router.py:24-37`). This is a less stable pattern; router aggregation is not auto-discovered.

### 6. How are breaking changes managed?

Breaking changes follow the SDK deprecation policy: symbols must be marked deprecated with a `deprecated_in` version, and removal requires at least 5 minor releases after that. Enforced by `check_sdk_api_breakage.py` on release PRs and `check_deprecations.py` on every PR (`openhands/sdk/AGENTS.md`). Event schema changes use `handle_deprecated_model_fields` validators for backward-compatible loading of old serialized events. Old events must always load without error.

### 7. What is intentionally NOT extensible?

- **Server API router aggregation** (`openhands/app_server/v1_router.py:24-37`): Manual `include_router()` calls — no auto-discovery of new route modules.
- **Core security model**: The `SecurityAnalyzerBase` and `ConfirmationPolicyBase` ABCs exist but available backends are limited ("llm", "invariant" from config).
- **Runtime sandbox backend**: Limited to Docker and Kubernetes runtimes (configurable in `config.template.toml:71`).
- **Agent core loop**: The conversation orchestration is not exposed as an extension point; agents operate within the existing `LocalConversation` lifecycle.
- **Frontend extensibility**: Frontend action handling is via a static `HANDLED_ACTIONS` array; plugin UI supports configuring parameters but not injecting new UI components.

### 8. How discoverable are extension points?

**Highly discoverable for the SDK layer.** Key registries provide introspection:
- `list_registered_tools()` (`openhands/sdk/tool/registry.py:213`)
- `list_usable_tools()` (`openhands/sdk/tool/registry.py:218`)
- `get_factory_info()` (`openhands/sdk/subagent/registry.py:396`)
- `get_registered_agent_definitions()` (`openhands/sdk/subagent/registry.py:414`)
- `InstallationManager.list_installed()` (`openhands/sdk/extensions/installation/manager.py:222`)

Extension points are documented in `config.template.toml` with comments and examples for each section. The subagent system has dedicated `AGENTS.md` documenting precedence, file rules, and schema (`openhands/sdk/subagent/AGENTS.md`).

**Less discoverable**: MCP servers can be discovered dynamically via the list tools protocol; there is no registry of available MCP servers. The server-side router has no auto-discovery — you must read `v1_router.py` to know all available API routes.

## Architectural Decisions

1. **`DiscriminatedUnionMixin` as extension backbone** (`openhands/sdk/utils/models.py:141`): Instead of manual registry entries, every ABC extends this mixin which auto-derives a `kind` field from the class name. Subclasses are automatically discovered and routable for serialization. This is the most consequential architectural decision — it means any new `ToolDefinition`, `AgentBase`, `CondenserBase`, etc. subclass is automatically recognized by the serialization pipeline without registration.

2. **Global registries with first-writer-wins** (`openhands/sdk/tool/registry.py:191-198`, `openhands/sdk/subagent/registry.py:115-121`): Tools and agents use thread-safe global dicts with `RLock`. `register_agent` raises on duplicate; `register_agent_if_absent` silently skips. Plugin loading happens before file agent loading so plugins get priority. This means the order of imports matters — programmatic registration must happen before plugin/file loading takes effect.

3. **File-based discovery with precedence tiers** (`openhands/sdk/subagent/registry.py:266-311`): Agents, skills, and hooks are all discoverable via conventional file paths with priority ordering (project > user, `.agents/` > `.openhands/`). No code changes needed to add new agents — just drop a markdown file.

4. **Subprocess-based hooks over in-process** (`openhands/sdk/hooks/executor.py:140`): Hooks run as separate processes with JSON I/O rather than as in-process callbacks. This provides isolation (a crashing hook doesn't crash the agent) and language-agnostic integration (hooks can be any executable). The tradeoff is latency per hook invocation.

5. **Plugin format compatible with Claude Code** (`openhands/sdk/plugin/plugin.py:42-55`): The plugin system reuses the `.claude-plugin/plugin.json` convention for cross-platform compatibility, while adding OpenHands-specific extensions (skills, MCP, agents).

6. **Generic `InstallationManager[T]`** (`openhands/sdk/extensions/installation/manager.py:27`): Parameterized by a protocol type `T: ExtensionProtocol` and an `InstallationInterface[T]` that knows how to load `T` from a directory. Fetching, copying, and metadata bookkeeping are handled generically. Used for both skills and plugins.

7. **ABC+Injector pattern on the server** (`openhands/app_server/services/injector.py:12`): Each backend service defines an ABC + an `Injector` ABC (subclass of `DiscriminatedUnionMixin`). Concrete implementations are resolved at runtime. This makes server services pluggable but requires implementing the injector ABC.

## Notable Patterns

- **Polymorphic dispatch via `kind` field**: Every ABC extending `DiscriminatedUnionMixin` auto-serializes its class name. Deserialization routes to the correct concrete class (`openhands/sdk/utils/models.py:141-174`).
- **Priority-tiered loading**: Agents, skills, and plugins all follow the same pattern of programmatic > plugin > project > user > builtins.
- **Subprocess hook contract**: Hooks receive JSON on stdin, return JSON on stdout, use exit code 2 to block (`openhands/sdk/hooks/executor.py:140`).
- **MCP wrapping**: MCP tools are dynamically created as `ToolDefinition` subclasses at runtime via `create_mcp_tools()` (`openhands/sdk/mcp/tool.py`).
- **Configuration-driven component selection**: Condenser, security analyzer, model router — all selected by `type` key in config, using the `DiscriminatedUnionMixin` for dispatch.
- **Self-healing metadata**: `InstallationManager.list_installed()` syncs metadata to disk, removing entries for deleted directories and adding entries for manually-copied ones (`openhands/sdk/extensions/installation/manager.py:222-236`).

## Tradeoffs

| Tradeoff | Detail |
|----------|--------|
| Subprocess hooks vs in-process | Isolation and language-agnostic hooks vs higher latency per invocation. Exit code 2 blocking protocol is simple but limited to boolean deny/allow |
| Manual router aggregation vs auto-discovery | Explicit wiring in `v1_router.py` is simple and debuggable but requires manual updates when adding new API modules |
| Global registries vs dependency injection | Simple and familiar but creates global state that complicates testing and limits multi-tenant isolation |
| Plugin format compatibility with Claude Code | Reuses existing ecosystem of Claude Code plugins but inherits their design constraints (manifest format, hook contract) |
| File-based discovery vs code-based | Zero-code agent/skill creation is powerful but can lead to confusion about which agents/skills are actually registered (solved by `list_*` introspection functions) |
| Generic `InstallationManager[T]` | Clean separation of concerns but adds abstraction overhead; extensions must implement `ExtensionProtocol` + `InstallationInterface` |

## Failure Modes / Edge Cases

1. **Duplicate tool registration**: `register_tool` logs a warning but does not raise on duplicate (`openhands/sdk/tool/registry.py:193-194`). The later registration silently overwrites the earlier one.
2. **Agent registration race**: `_agent_factories` is protected by `_registry_lock`, but there's no read lock during lookup. Under extreme concurrent load, lookup could see an inconsistent state.
3. **Hook script crashes**: A hook script that crashes without producing valid JSON output is treated as non-blocking (the executor catches exceptions and returns a failure result) — it does not propagate to the agent loop.
4. **Plugin agent reloading**: Plugin agents are registered on load and never removed. Unloading a plugin does not unregister its agents (`openhands/sdk/subagent/registry.py:314-319`).
5. **MCP server availability**: If an MCP server is unreachable at tool creation time, the tool for that server is silently omitted. No retry or reconnection logic is visible at the registration layer.
6. **Missing file-based agent validation**: Tool names in markdown agent frontmatter are stored as strings and only validated at instantiation time, not at load time. A misspelled tool name in a markdown file won't fail until the agent tries to use it.
7. **Hook config merge order**: `HookConfig.merge()` concatenates matchers per event type. If multiple configs define hooks for the same matcher pattern, all hooks fire. There is no deduplication or priority ordering.

## Future Considerations

- **Server route auto-discovery**: Replace manual `include_router()` in `v1_router.py` with a plugin-based or filesystem-based route discovery to match the SDK pattern.
- **Plugin lifecycle improvements**: Plugin unloading should unregister agents/skills/tools to support hot-reload scenarios.
- **Versioned plugin APIs**: Plugin extension points currently follow convention (Claude Code format). A formal versioned plugin API contract would strengthen guarantees.
- **MCP server retry/reconnect**: Current MCP integration lacks reconnection logic for transient server failures.
- **Frontend plugin API**: Frontend extensibility is limited to parameter configuration; a formal plugin API for injecting UI components would complete the extension story.
- **Observability for extension registration**: Adding explicit events/metrics for when tools/agents/plugins are registered would aid debugging and monitoring.
- **Cross-extension dependency management**: `InstallationManager` handles installation independently but there's no dependency resolution between extensions.

## Questions / Gaps

- No clear evidence found for a formal extension versioning/upgrade mechanism beyond the SDK deprecation policy. Plugin versions are tracked in metadata but no compatibility checking is performed.
- No evidence found for extension signing or integrity verification on plugin installation.
- The frontend extensibility surface was not examined in detail — the analysis above is based on file listing observations.
- No evidence found for a formal breaking-change policy for the server API layer (only the SDK layer has documented deprecation policy).

---

Generated by `study-areas/21-extensibility.md` against `openhands`.
