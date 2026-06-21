# Repo Analysis: opencode

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opencode |
| Path | `repos/opencode` |
| Language / Stack | TypeScript, Effect-TS, Bun |
| Analyzed | 2026-05-17 |

## Summary

OpenCode has two distinct plugin systems (V1 external, V2 internal), a typed hook/middleware layer with 17+ lifecycle hooks, file-based tool and agent auto-discovery, an MCP server integration framework, a skill system with local and remote discovery, and a config-driven extension model. Extension points are well-defined with documented interfaces, but the V1 plugin system lacks formal versioning and lifecycle management (no start/stop/health). V2 is Effect-native and more principled but internal only. Overall the architecture scores high for intentional extensibility design.

## Rating

**8/10** — Well-defined extension interfaces with documentation. Deducted for: no formal plugin lifecycle (start/stop/health), V2 plugins are internal-only and not exposed to external authors, and some extension points (tool.definition hook) are experimental.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| V1 Plugin interface | `Plugin` type is `(input: PluginInput, options?: PluginOptions) => Promise<Hooks>` | `packages/plugin/src/index.ts:74` |
| V1 Plugin hooks (full list) | 17 typed lifecycle hooks: event, config, tool, auth, provider, chat.message, chat.params, chat.headers, permission.ask, command.execute.before, tool.execute.before, tool.execute.after, shell.env, tool.definition, experimental.chat.messages.transform, experimental.chat.system.transform, experimental.session.compacting, experimental.text.complete | `packages/plugin/src/index.ts:222-333` |
| V2 Plugin interface (internal) | Effect-based: `define({ id, effect })` with provider.update, model.update, aisdk.language, aisdk.sdk hooks | `packages/core/src/plugin.ts:9-81` |
| V2 Plugin trigger with Immer drafts | Uses `createDraft`/`finishDraft` for mutable hook output | `packages/core/src/plugin.ts:102-134` |
| V2 Plugin boot | EnvPlugin, AuthPlugin, 30 ProviderPlugins, ModelsDevPlugin registered at boot | `packages/opencode/src/v2/plugin-boot.ts:36-41` |
| Built-in tool definition pattern | `Tool.define(id, Effect)` factory returns `Info<Parameters, Result>` | `packages/opencode/src/tool/tool.ts:132-150` |
| Tool registry — builtin init | 18 built-in tools initialized from individual modules | `packages/opencode/src/tool/registry.ts:213-232` |
| Tool registry — custom file tools | `{tool,tools}/*.{ts,js}` auto-discovered in config directories | `packages/opencode/src/tool/registry.ts:189-201` |
| Tool registry — plugin tools | Plugins' `tool` hook merged into custom tool list | `packages/opencode/src/tool/registry.ts:203-208` |
| Tool registry — tool.definition hook | Plugins modify tool descriptions/params at runtime | `packages/opencode/src/tool/registry.ts:327` |
| Plugin tool SDK for external authors | `tool()` function with Zod args, `ToolDefinition` type | `packages/plugin/src/tool.ts:46-55` |
| External plugin loading pipeline | PluginLoader.loadExternal: plan, resolve (npm install), load (dynamic import), compatibility check | `packages/opencode/src/plugin/loader.ts:60-173` |
| Plugin compatibility check | Validates `engines.opencode` semver range | `packages/opencode/src/plugin/shared.ts:194` |
| Plugin auto-discovery | `{plugin,plugins}/*.{ts,js}` scanned in config directories | `packages/opencode/src/config/plugin.ts:29-38` |
| Internal plugins (auth) | 8 built-in auth plugins imported directly | `packages/opencode/src/plugin/index.ts:60-69` |
| Plugin trigger mechanism | Sequential hook execution, each plugin mutates shared output object | `packages/opencode/src/plugin/index.ts:261-274` |
| Bus event subscription for plugins | All bus events streamed to every plugin's `event` hook | `packages/opencode/src/plugin/index.ts:246-255` |
| Agent config schema | `AgentSchema` with model, variant, temperature, prompt, permission, mode, tools, etc. | `packages/opencode/src/config/agent.ts:22-51` |
| Agent file-based discovery | `{agent,agents}/**/*.md` auto-discovered | `packages/opencode/src/config/agent.ts:107-136` |
| Built-in agents | 7 built-in: build, plan, general, explore, compaction, title, summary, (optional: scout) | `packages/opencode/src/agent/agent.ts:123-274` |
| Custom agent merging | User-defined agents from config merged with built-in, user overrides win | `packages/opencode/src/agent/agent.ts:277-304` |
| MCP config schema | `Local` (command), `Remote` (url, headers, oauth) server types | `packages/opencode/src/config/mcp.ts:4-54` |
| Skill system interface | `get()`, `all()`, `dirs()`, `available(agent)` | `packages/opencode/src/skill/index.ts:87-92` |
| Skill discovery — global dirs | `~/.claude/skills/` and `~/.agents/skills/` scanned | `packages/opencode/src/skill/index.ts:163-221` |
| Skill discovery — project-local | `{skill,skills}/**/SKILL.md` in config directories | `packages/opencode/src/skill/index.ts:24` |
| Skill discovery — remote URLs | Fetches `index.json` from `config.skills.urls`, caches locally | `packages/opencode/src/skill/discovery.ts:37-104` |
| Built-in skill | `customize-opencode` hardcoded, always available | `packages/opencode/src/skill/index.ts:32-34, 251-257` |
| Skill tool | Allows LLM to load a skill by name at runtime | `packages/opencode/src/tool/skill.ts:14` |
| Config schema — all extension keys | plugin, agent, provider, mcp, skills, experimental, permission, tools | `packages/opencode/src/config/config.ts:120-301` |
| Permissions system | Per-tool granular: read, edit, glob, grep, bash, task, etc. | `packages/opencode/src/config/permission.ts` |
| Subagent permission derivation | `deriveSubagentSessionPermission` combines parent rules | `packages/opencode/src/agent/subagent-permissions.ts:17` |
| Agent LLM generation | `generateAgent` creates agent config from description via LLM | `packages/opencode/src/agent/agent.ts:378-446` |
| Workspace adapter registration | Plugins can register workspace adapters via `experimental_workspace.register` | `packages/opencode/src/plugin/index.ts:141-143` |
| Plugin metadata tracking | Spec, target, source type, version, load count, timestamps, fingerprint | `packages/opencode/src/plugin/meta.ts` |

## Answers to Protocol Questions

**1. What are the primary extension points?**
- **Plugins (V1)**: External-facing system with 17 lifecycle hooks covering tool registration, auth, chat, permissions, config, shell, and experimental transforms (`packages/plugin/src/index.ts:222-333`). Plugins are loaded from npm packages or local files, auto-discovered via `{plugin,plugins}/*.{ts,js}` (`packages/opencode/src/config/plugin.ts:29-38`).
- **Plugins (V2)**: Internal-only Effect-based system for provider/model/SDK extensions (`packages/core/src/plugin.ts:9-81`). Boots EnvPlugin, AuthPlugin, 30 provider plugins, and ModelsDevPlugin (`packages/opencode/src/v2/plugin-boot.ts:36-41`).
- **Tools**: Built-in (18 tools via `Tool.define`), file-based (`{tool,tools}/*.{ts,js}`), and plugin-provided via the `tool` hook (`packages/opencode/src/tool/registry.ts:189-208`).
- **Agents**: Built-in (7+), file-based (`{agent,agents}/**/*.md`), and config-defined (`opencode.json` `agent` key) (`packages/opencode/src/config/agent.ts:107-136`).
- **Skills**: Global dirs, project-local dirs, remote URLs (`packages/opencode/src/skill/index.ts:163-221`).
- **MCP Servers**: Config-defined with Local (command) and Remote (URL) types (`packages/opencode/src/config/mcp.ts:4-54`).
- **Providers**: 30 built-in provider plugins + dynamic providers loaded at runtime + config-defined custom providers.

**2. How are custom tools/providers added?**
- **File-based tools**: Drop a `.ts` or `.js` file exporting `ToolDefinition` objects into `{tool,tools}/` in any config directory. Each export becomes a tool registered in the registry (`packages/opencode/src/tool/registry.ts:189-201`). Uses the simple `tool()` SDK from `packages/plugin/src/tool.ts:46-55`.
- **Plugin tools**: Define a `tool` key on the `Hooks` object returned by a plugin's `server()` function. The key is the tool name, value is a `ToolDefinition` (`packages/plugin/src/index.ts:225-227`).
- **Custom providers**: Add a `provider` entry in `opencode.json` with API endpoint and model definitions (`packages/opencode/src/config/config.ts:206-208`). Or write a provider plugin that hooks into the V2 `provider.update` and `aisdk.sdk` hooks.

**3. Are there hooks/middleware for customization?**
Yes, extensively through three systems:
- **V1 Plugin hooks** (17 hooks): event, config, tool, auth, provider, chat.message, chat.params, chat.headers, permission.ask, command.execute.before, tool.execute.before, tool.execute.after, shell.env, tool.definition, experimental.chat.messages.transform, experimental.chat.system.transform, experimental.session.compacting, experimental.text.complete (`packages/plugin/src/index.ts:222-333`). Hooks receive `(input, output)` and mutate output in place.
- **V2 Plugin hooks** (4 hooks): provider.update, model.update, aisdk.language, aisdk.sdk (`packages/core/src/plugin.ts:12-47`). Uses Effect + Immer drafts for immutable-style mutation.
- **Bus pub/sub**: All internal events are published to a typed bus that plugins can subscribe to via the `event` hook (`packages/opencode/src/plugin/index.ts:246-255`).
- **tool.definition hook**: Allows plugins to modify any tool's description and JSON schema parameters at runtime per-tool invocation (`packages/opencode/src/tool/registry.ts:327`).

**4. Is extension configuration-driven or code-driven?**
Both, with a clear split:
- **Configuration-driven**: Plugins (opencode.json `plugin` array), agents (opencode.json `agent` key), MCP servers (`mcp` key), providers (`provider` key), skills (`skills.paths` and `skills.urls`), permissions (`permission` key), experimental flags (`experimental` key) (`packages/opencode/src/config/config.ts:120-301`).
- **Code-driven**: File-based tools (`{tool,tools}/*.ts`), file-based agents (`{agent,agents}/*.md` with YAML frontmatter), file-based plugins (`{plugin,plugins}/*.ts`), and npm plugin packages (code modules with `server()` function).
- **Declarative auto-discovery**: Files dropped in conventions directories are automatically discovered without any config change.

**5. How stable are extension interfaces?**
- **V1 Plugin interface** (`packages/plugin/src/index.ts`): Published as `@opencode-ai/plugin` npm package. The `Plugin`, `Hooks`, `ToolDefinition`, and `WorkspaceAdapter` types are the public API. Stability is moderate — the `experimental.*` namespace explicitly signals instability. Non-experimental hooks (tool, config, auth, chat.params, chat.headers, permission.ask, shell.env) appear stable across releases.
- **V2 Plugin interface** (`packages/core/src/plugin.ts`): Internal, not exposed to external authors. Used by 30+ provider plugins and internal systems.
- **Tool SDK** (`packages/plugin/src/tool.ts`): Simple, stable interface (`tool({ description, args, execute })`). The Zod schema for args is stable.
- **Breaking change history**: Not explicitly documented in the examined code. Plugins can declare `engines.opencode` semver ranges (`packages/opencode/src/plugin/shared.ts:194`) for compatibility checking, which implies awareness of breaking changes.

**6. How are breaking changes managed?**
- **engines.opencode semver check**: Plugin package.json can declare `engines.opencode` to specify compatible opencode versions (`packages/opencode/src/plugin/shared.ts:194`). Loader checks compatibility before loading and skips incompatible plugins with a warning.
- **experimental namespace**: Hooks under `experimental.*` (`packages/plugin/src/index.ts:281-328`) are explicitly volatile and may change without notice.
- **Deprecation patterns**: The config system marks deprecated fields (e.g., `mode` -> `agent`, `maxSteps` -> `steps`, `tools` -> `permission`, `autoshare` -> `share`) and normalizes them transparently (`packages/opencode/src/config/agent.ts:78-97`). No formal API versioning on the plugin interface itself.
- **No formal deprecation policy**: The codebase does not document a deprecation lifecycle or migration guide for plugin authors.

**7. What is intentionally NOT extensible?**
- **Core agent loop**: The orchestrator that dispatches tool calls and manages the LLM conversation loop is intentionally opaque to plugins. There is no hook to replace the loop itself.
- **Effect system internals**: The dependency injection layer (`Layer`, `Context`, `Service`) and Effect runtime are internal. No plugin can override or substitute core services.
- **Permission model internals**: The permission evaluation logic (`Permission.evaluate`) is not pluggable. Plugins can only hook into `permission.ask` to override decisions for specific requests.
- **Session/persistence layer**: Data storage, session persistence, and compaction strategies are not extensible (though compaction prompt can be customized via `experimental.session.compacting`).
- **Security boundary**: File system access control, shell execution sandboxing, and environment isolation are not extensible.

**8. How discoverable are extension points?**
- **Plugin system**: Well-documented. The `@opencode-ai/plugin` npm package exports clear TypeScript types. Plugins are auto-discovered from convention directories. Config-driven plugin spec in `opencode.json` is straightforward.
- **Tool creation**: Highly discoverable — drop a file in `{tool,tools}/`. The `tool()` SDK from `@opencode-ai/plugin` is simple (one function). 
- **Agent creation**: Highly discoverable — drop a markdown file with YAML frontmatter in `{agent,agents}/`. Or add to `opencode.json`.
- **Skill creation**: Discoverable but requires understanding the frontmatter format. Remote skill discovery via HTTP is documented.
- **MCP server config**: Standard MCP protocol, well-documented schema.
- **Hook documentation**: The `Hooks` interface in `packages/plugin/src/index.ts:222-333` has inline JSDoc comments on each hook, explaining its input/output shape. However, there is no centralized guide or tutorial tying hooks together into common patterns.
- **Experimental hooks**: Marked with `experimental.*` prefix, signaling instability but also providing early access to advanced extension points.

## Architectural Decisions

1. **Two-plugin architecture**: V1 for external authors (Promise-based, simpler), V2 for internal (Effect-based, more principled with Immer drafts). This keeps the external API surface small and stable while allowing internal optimization.
2. **Hook mutation pattern**: Plugins receive `(input, output)` and mutate `output` in place rather than returning new values. This avoids ownership complexity but makes it harder to reason about hook ordering effects (`packages/opencode/src/plugin/index.ts:261-274`).
3. **Config over code for discovery**: Convention-based file placement (`{tool,tools}/`, `{agent,agents}/`, `{plugin,plugins}/`) reduces configuration overhead. Users drop files in directories vs. editing config files (`packages/opencode/src/config/plugin.ts:29-38`, `packages/opencode/src/config/agent.ts:107-136`, `packages/opencode/src/tool/registry.ts:189-201`).
4. **Effect-TS throughout**: Every extensibility point (tool registry, plugin system, config loading, agent management) is built on Effect-TS. This provides structured concurrency, dependency injection, and error handling as first-class primitives.
5. **Bus event streaming**: Instead of direct callbacks, plugins receive all internal events through a unified bus subscription (`packages/opencode/src/plugin/index.ts:246-255`). This decouples plugin logic from internal event producers.
6. **Permission as composable rulesets**: Agent permissions are built by merging defaults + user config + agent-specific rules using `Permission.merge`, not overridden wholesale (`packages/opencode/src/agent/agent.ts:128-135`).

## Notable Patterns

1. **File-based auto-discovery**: Tools (`packages/opencode/src/tool/registry.ts:189-201`), agents (`packages/opencode/src/config/agent.ts:107-136`), plugins (`packages/opencode/src/config/plugin.ts:29-38`), and skills (`packages/opencode/src/skill/index.ts:163-221`) all use the same convention: drop a file in the right directory, and it's automatically registered. No config changes needed.
2. **Layered config merging**: Config is loaded from multiple sources (global, project, remote, env) and merged with `mergeDeepConcatArrays` (`packages/opencode/src/config/config.ts:49-58`). Later sources override earlier ones, arrays are concatenated.
3. **Plugin as function composition**: A plugin is just an async function `(input, options) => Hooks`. No class instantiation, no lifecycle methods. This is intentionally simple for external authors.
4. **Experimental prefix as stability signal**: The `experimental.*` hook namespace clearly marks unstable APIs and allows the team to ship early access features without commitment.
5. **Workspace adapter pattern**: Plugins can register workspace adapters (VSCode, JetBrains, etc.) through a dedicated API (`packages/opencode/src/plugin/index.ts:141-143`), keeping editor integration out of core.
6. **Provider as plugin**: All 30+ LLM providers are implemented as V2 plugins (`packages/opencode/src/v2/plugin-boot.ts:38-40`), making the provider system itself an example of the extensibility pattern.
7. **Subagent delegation via TaskTool**: The TaskTool (`packages/opencode/src/tool/task.ts:32`) spawns child sessions with filtered permissions, enabling multi-agent orchestration without coupling.

## Tradeoffs

1. **V1 hook mutation vs. immutability**: Using mutable `output` parameters (`packages/opencode/src/plugin/index.ts:268-272`) simplifies sequential hook composition but makes it harder to audit which plugin changed what. V2's Immer approach (`packages/core/src/plugin.ts:102-134`) is more principled but only used internally.
2. **No formal plugin lifecycle vs. simplicity**: Plugins lack start/stop/health lifecycle methods. Loading and hook registration are atomic. This is simpler for authors but means plugins cannot manage long-lived resources or handle graceful shutdown.
3. **Bus subscription coupling**: Every plugin receives every bus event (`packages/opencode/src/plugin/index.ts:246-255`). This maximizes reach but means plugins compete for event processing and must filter events themselves. No event routing or priority system.
4. **Two plugin systems**: Having both V1 (public) and V2 (internal) creates conceptual overhead. Authors targeting deep integration (providers, models) must understand that some extension points are inaccessible.
5. **Code-generated agents vs. file-based agents**: Agents can be defined via config, markdown files, or LLM-generated (`packages/opencode/src/agent/agent.ts:277-304, 378-446`). This flexibility comes at the cost of multiple representation formats that must be kept in sync.
6. **File scanner breadth**: `{agent,agents}`, `{tool,tools}`, `{plugin,plugins}`, `{skill,skills}` — each scans multiple glob patterns. The combinatorial explosion of scanned directories increases startup time proportionally to the number of config layers.

## Failure Modes / Edge Cases

1. **Plugin compatibility mismatch**: An incompatible plugin (`engines.opencode` doesn't match) silently logs a warning and is skipped (`packages/opencode/src/plugin/loader.ts:189-215`). No user-facing error or fallback mechanism.
2. **Plugin loading failures**: Plugins that fail to load are silently caught and logged (`packages/opencode/src/plugin/index.ts:217-232`). A failing plugin disables itself but doesn't block others. However, partial plugin loading may leave the system in an inconsistent state.
3. **Tool namespace collisions**: File-based tools use filename as namespace, plugin tools use string keys. If two plugins register the same tool name, the later one wins silently (`packages/opencode/src/tool/registry.ts:203-208`).
4. **Hook execution order**: Hooks run sequentially in registration order (`packages/opencode/src/plugin/index.ts:268-272`). Internal plugins register first, then external. An external plugin's `config` hook runs after all plugins load, but `chat.params` hooks run in registration order — no priority system exists.
5. **Skill name collisions**: Skills from different sources (global, local, remote) are merged into a single map. A local skill with the same name as a global skill silently overrides it (`packages/opencode/src/skill/index.ts:163-221`). No deduplication or conflict resolution.
6. **Missing agent error cascading**: If `default_agent` points to a missing or hidden agent, the system throws an error (`packages/opencode/src/agent/agent.ts:341-344`). No fallback to `build` agent.
7. **Plugin side effects during import**: Dynamic imports of plugin modules (`packages/opencode/src/tool/registry.ts:197`) can execute arbitrary code at import time. If a plugin crashes during import (not during `server()`), it bubbles up as an unhandled error.
8. **MCP server lifecycle**: MCP servers are configured declaratively but there's no explicit reconnection strategy or health checking visible in the config layer. A failing MCP server may silently disconnect.

## Future Considerations

1. Formal plugin lifecycle (start/stop/health) would enable long-lived background services and graceful shutdown.
2. Plugin hook priority/ordering would resolve conflicts when multiple plugins modify the same hook output.
3. A plugin manifest or registry (like `opencode.json` but auto-generated) could improve discoverability of installed extensions.
4. Remote plugin registries (analogous to the skill system's remote URLs) would allow plugin distribution without npm.
5. Unifying V1 and V2 plugin systems would reduce conceptual overhead and expose V2 hooks (provider, model, SDK) to external authors.
6. A visual extension manager (already hinted at by the console app) would lower the barrier for non-technical users.
7. Tool registry currently has no middleware/chaining — the `tool.definition` hook modifies descriptions but doesn't allow wrapping tool execution. Adding execution middleware would enable cross-cutting concerns like rate limiting or audit logging.

## Questions / Gaps

1. No clear evidence of formal breaking change documentation or migration guides for plugin authors beyond `engines.opencode` semver checking (`packages/opencode/src/plugin/shared.ts:194`).
2. The plugin metadata module (`packages/opencode/src/plugin/meta.ts`) tracks load metrics but it's unclear how this data is surfaced to users or plugin authors.
3. No evidence found for plugin testing utilities or a sandbox for plugin development.
4. The relationship between V1 plugin hooks and V2 hooks is not formally specified — it's unclear if/when both sets of hooks fire on the same event.

## Questions / Gaps

No clear evidence found for a formal plugin testing framework, official plugin registry/index, or published extension interface versioning policy beyond the inline TypeScript types.

---

Generated by `study-areas/21-extensibility.md` against `opencode`.
