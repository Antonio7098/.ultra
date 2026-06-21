# Repo Analysis: mastra

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | mastra |
| Path | `repos/mastra` |
| Language / Stack | TypeScript, pnpm monorepo (turborepo) |
| Analyzed | 2026-05-17 |

## Summary

Mastra is a TypeScript agent framework built as a pnpm monorepo with ~25 storage adapters, 4+ third-party integrations, and a well-defined set of abstract extension interfaces. The framework uses a **dependency-injection + composite-store** architecture: the central `Mastra` class (`packages/core/src/mastra/index.ts:515-530`) acts as a registry for agents, tools, workflows, storage, vectors, memory, voice, MCP servers, processors, channels, and gateways — all passed as config on construction. Extension happens through **code-driven** implementation of abstract base classes or interfaces (no plugin manifests, no dynamic discovery). The architecture scores well for interface stability and breadth of extension points, but lacks versioned plugin APIs and automatic extension discovery.

## Rating

**7/10** — Well-defined extension interfaces with documentation, but no plugin lifecycle management, no versioned extension APIs, and no runtime discovery mechanism.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Central DI container | `Mastra` class accepts `Config` with all component types | `packages/core/src/mastra/index.ts:215-480` |
| Tool interface | `ToolAction` type defines the contract for all tools | `packages/core/src/tools/types.ts:428-543` |
| Tool creation factory | `createTool()` wrapper for type-safe tool construction | `packages/core/src/tools/tool.ts:540-561` |
| Tool class with validation | `Tool` class wraps execute with input/output/suspend/resume validation | `packages/core/src/tools/tool.ts:70-434` |
| Tool execution context | `ToolExecutionContext` provides agent/workflow/MCP-specific context | `packages/core/src/tools/types.ts:385-426` |
| Tool provider abstraction | `ToolProvider` interface for external tool providers (e.g., Composio) | `packages/core/src/tool-provider/types.ts:91-127` |
| Integration base class | `Integration` abstract class with `listTools()` and `registerWorkflow()` | `packages/core/src/integration/integration.ts:4-51` |
| OpenAPI tool generation | `OpenAPIToolset` auto-generates tools from `baseClient` methods | `packages/core/src/integration/openapi-toolset.ts:6-59` |
| Storage composite pattern | `MastraCompositeStore` composes domains from multiple backends | `packages/core/src/storage/base.ts:225-404` |
| Storage domains | 17 storage domain interfaces (memory, workflows, scores, agents, etc.) | `packages/core/src/storage/domains/` |
| Storage domain base | `StorageDomain` abstract class with `init()` and `dangerouslyClearAll()` | `packages/core/src/storage/domains/base.ts:7-23` |
| Vector store abstraction | `MastraVector` abstract class for vector DB adapters | `packages/core/src/vector/vector.ts:72-197` |
| Memory abstraction | `MastraMemory` abstract class for conversation memory | `packages/core/src/memory/memory.ts:114-1059` |
| Voice abstraction | `MastraVoice` abstract class for TTS/STT providers | `packages/core/src/voice/voice.ts:31-226` |
| Processor interface | `Processor` interface with 8 lifecycle hooks | `packages/core/src/processors/index.ts:465-615` |
| Processor base class | `BaseProcessor` with `__registerMastra()` for Mastra service access | `packages/core/src/processors/index.ts:635-655` |
| Hook system | `AvailableHooks` enum + mitt-based event hub | `packages/core/src/hooks/index.ts:1-25` |
| PubSub abstraction | `PubSub` abstract class for event-driven communication | `packages/core/src/events/pubsub.ts:19-79` |
| MCP server config | `MCPServerConfig` for exposing tools/agents/workflows via MCP | `packages/core/src/mcp/types.ts:194-242` |
| Server middleware/routes | `ApiRoute` type for custom routes, `Middleware` type for custom middleware | `packages/core/src/server/types.ts:23-49` |
| Server error hooks | `onError` and `onValidationError` hooks | `packages/core/src/server/types.ts:182-181,401-433` |
| Server auth extension | `MastraAuthConfig` with custom `authenticateToken`, `authorize`, and RBAC/FGA | `packages/core/src/server/types.ts:59-108,356-366` |
| Channel abstraction | Channels config for platform messaging integrations | `packages/core/src/mastra/index.ts:445-446` |
| Simple integration pattern | Tavily integration uses plain `createTool()` factory functions | `integrations/tavily/src/tools.ts:7-14` |
| 25+ storage store impls | Separate packages for pg, libsql, chroma, pinecone, elasticsearch, etc. | `stores/` |
| Integration generator | CLI script `generate:integration` for scaffolding new integrations | `package.json:56` |
| Edge-case validation | Tool schemas nullable/etc. handled via `@mastra/schema-compat` | `packages/core/src/tools/validation.ts` |

## Answers to Protocol Questions

### 1. What are the primary extension points?

- **Tools** (`packages/core/src/tools/tool.ts:70-434`): The most fundamental extension point. Any function wrapped by `createTool()` with a Zod input schema becomes available to agents and workflows.
- **Storage** (`packages/core/src/storage/base.ts:225-404`): `MastraCompositeStore` with 17 domain slices. Each domain is an interface; 25+ adapter packages exist.
- **Vector stores** (`packages/core/src/vector/vector.ts:72-197`): `MastraVector` abstract class with query/upsert/createIndex/list/describe/delete operations.
- **Memory** (`packages/core/src/memory/memory.ts:114-1059`): `MastraMemory` abstract class with thread/message/working-memory/semantic-recall operations.
- **Voice** (`packages/core/src/voice/voice.ts:31-226`): `MastraVoice` abstract class for speech synthesis and recognition.
- **Processors** (`packages/core/src/processors/index.ts:465-615`): `Processor` interface with hooks at every stage of the agent loop (input, output, stream, step, LLM request/response, errors).
- **MCP Servers** (`packages/core/src/mcp/types.ts:194-242`): `MCPServerConfig` to expose tools, agents, and workflows as MCP endpoints.
- **Integrations** (`packages/core/src/integration/integration.ts:4-51`): `Integration` class or plain `createTool()` factories for external services.
- **Server routes/middleware** (`packages/core/src/server/types.ts:23-49`): `ApiRoute` and `Middleware` for HTTP-level extension.
- **Auth/RBAC/FGA** (`packages/core/src/server/types.ts:59-108`): `MastraAuthConfig`, `IRBACProvider`, `IFGAProvider`.
- **Channels** (`packages/core/src/mastra/index.ts:445-446`): Platform messaging integrations.
- **PubSub** (`packages/core/src/events/pubsub.ts:19-79`): Abstract `PubSub` class for event-driven workflows.
- **Gateways** (`packages/core/src/mastra/index.ts:373-374`): Custom model router gateways.
- **Workflows** (`packages/core/src/workflows/`): Step-based, suspendable, schedulable.

### 2. How are custom tools/providers added?

Custom tools are added via the `createTool()` factory (`packages/core/src/tools/tool.ts:540-561`). The pattern is:

```typescript
const myTool = createTool({
  id: 'my-tool',
  description: 'Does something',
  inputSchema: z.object({ /* ... */ }),
  execute: async (inputData, context) => { /* ... */ },
});
```

Tools are registered in the `Mastra` constructor via the `tools` config key (`packages/core/src/mastra/index.ts:349`), or attached to an `Agent`'s `tools` array.

For **external tool providers** (e.g., Composio), the `ToolProvider` interface (`packages/core/src/tool-provider/types.ts:91-127`) provides `listTools()` and `resolveTools()` methods.

For **integrations** (e.g., Tavily), the pattern is simpler: just export `createTool()` factory functions (`integrations/tavily/src/tools.ts:7-14`).

### 3. Are there hooks/middleware for customization?

Yes — three hook/middleware layers exist:

1. **Server middleware** (`packages/core/src/server/types.ts:49`): Hono-style middleware handlers on HTTP routes. Supports path-scoped middleware.
2. **Agent Processors** (`packages/core/src/processors/index.ts:465-615`): Eight lifecycle hooks: `processInput`, `processOutputStream`, `processOutputResult`, `processInputStep` (per-step), `processLLMRequest` (pre-provider), `processLLMResponse` (post-provider), `processOutputStep` (per-step post-LLM), `processAPIError`. Processors can abort, retry, modify messages, swap models, change tools — full control.
3. **Hooks (mitt-based)** (`packages/core/src/hooks/index.ts:1-25`): Three hooks: `ON_EVALUATION`, `ON_GENERATION`, `ON_SCORER_RUN`. Executed asynchronously via `setImmediate`. Much lighter-weight than processors.

### 4. Is extension configuration-driven or code-driven?

**Almost exclusively code-driven.** There is no plugin manifest system, no YAML/JSON-based extension registration, and no runtime discovery. Extensions require:

- Importing and instantiating classes in code
- Passing them into the `Mastra` constructor config
- Or attaching them directly to agents/workflows at construction time

The only configuration-driven aspect is the `StorageDomains` composition config (`packages/core/src/storage/base.ts:105-166`), where users can declaratively specify which domains go to which store. But even that is configured in code.

### 5. How stable are extension interfaces?

The core abstractions (`MastraVector`, `MastraMemory`, `MastraVoice`, `ToolAction`, `MastraCompositeStore`) are stable across versions — they sit in `packages/core/src/` and have dedicated `exports` in `package.json:13-715`. The processor interface (`Processor` in `processors/index.ts:465-615`) is newer but also in core.

However, the `Integration` class (`packages/core/src/integration/integration.ts:4-51`) is notably thin — its `listTools()` and `listStaticTools()` methods throw `'Method not implemented.'` by default. The simpler integration pattern used by Tavily (`integrations/tavily/`) uses plain `createTool()` factories, bypassing `Integration` entirely. This suggests the `Integration` class may still be evolving.

The `PackageInfo` type in MCP types (`packages/core/src/mcp/types.ts:171-183`) has many optional fields and multiple `string` union types (e.g., `registry_name`), indicating this area may still be in flux.

### 6. How are breaking changes managed?

Through **changesets** — `.changeset/` directory and `@changesets/cli` (`package.json:5`). The `packages/core/package.json:717-728` shows version `1.33.1-alpha.0`, indicating active pre-1.0 development. Breaking changes are possible, but the extensive `__tests__` directories in most packages and `e2e-tests/` at root suggest a safety net.

Notable: the `MastraStorage` → `MastraCompositeStore` rename with deprecation aliases (`packages/core/src/storage/base.ts:407-414`) shows awareness of migration pain. But no explicit "breaking change policy" document was found beyond `CLAUDE.md` and `AGENTS.md` references.

### 7. What is intentionally NOT extensible?

- **The `Mastra` class itself** cannot be subclassed or extended at the class level — it uses `#private` fields for all internals. Extension is through passing implementations into its constructor, not inheritance.
- **Agent internals** (the agentic loop, LLM routing, tool execution pipeline) are not extensible via subclassing — they are modified through Processors, which is the sanctioned extension path.
- **Workflow execution engine** (`packages/core/src/workflows/execution-engine.ts`): There is no WorkflowProcessor or workflow middleware.
- **Schema validation**: Uses Zod at the core (`packages/core/src/schema/`), limited to standard JSON Schema inputs via `@mastra/schema-compat`.
- **No plugin registry/ecosystem**: There's no equivalent of a Maven/Gradle/Go-plugin for dynamic loading.

### 8. How discoverable are extension points?

**Moderately discoverable**:

- The `Mastra` constructor's `Config` interface (`packages/core/src/mastra/index.ts:215-480`) has JSDoc on every field — good DX.
- The `packages/core/src/index.ts` exports only `Mastra` and `Config`, so users are guided to the constructor first.
- The `packages/core/package.json` exports map shows which subpath exports are available.
- `AGENTS.md` files at repo root and `packages/core/AGENTS.md` document the build/test structure.
- **Weaknesses**: No auto-generated extension catalog, no runtime `listExtensionPoints()` method, no `getCapabilities()` on the Mastra instance. Discovering the available storage domains requires reading `StorageDomains` type (`packages/core/src/storage/base.ts:24-42`). Processor hooks must be found by reading the `Processor` interface in `processors/index.ts`.

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| Composite storage over single interface | Users can mix Postgres for memory + LibSQL for workflows + filesystem for editor configs | `packages/core/src/storage/base.ts:252-298` |
| Code-driven over config-driven extension | Avoids dynamic loading complexity; keeps dependency graph explicit for TypeScript | No plugin manifest files exist anywhere in the repo |
| Processor chain over event bus for agent loop | Synchronous, composable, state-sharing pipeline (state object passed between hooks) | `packages/core/src/processors/index.ts:121-123` (per-processor state) |
| `#private` fields on Mastra | Enforces encapsulation — all extension goes through constructor config, not subclassing | `packages/core/src/mastra/index.ts:531-575` |
| Tool validation wrappers | Every tool gets auto-wrapped validation for input, output, suspend, resume, requestContext | `packages/core/src/tools/tool.ts:280-431` |

## Notable Patterns

1. **Adapter proliferation** — 25+ storage store packages, each implementing domain interfaces. This may lead to maintenance burden if interfaces change.

2. **Simple integrations** — The trend in actual integrations (Tavily, BrightData, Perplexity, Opencode) is away from the `Integration` class toward plain `createTool()` factories (`integrations/tavily/src/tools.ts:7-14`). The `Integration` class may be deprecated in practice.

3. **Domain decomposition** — Storage is decomposed into 17 narrow interfaces rather than one monolithic interface, enabling mix-and-match composition.

4. **MCP as a universal bridge** — MCP servers can expose agents as `ask_<name>` tools and workflows as `run_<name>` tools (`packages/core/src/mcp/types.ts:204-210`). This effectively allows recursive composition.

5. **Thin wrapper over AI SDK** — `CoreTool` (`packages/core/src/tools/types.ts:274-324`) is explicitly designed to match the AI SDK's `Tool` interface, with `CoreToolBuilder` as adapter layer.

## Tradeoffs

1. **Code-driven vs plugin discovery** — All extensions require imports. No plugin registry means no `mastra plugin add` experience. Users must know what they want and import it explicitly. This is good for type safety and bundle size, but bad for ecosystem discoverability.

2. **Composite store complexity** — Mixing storage backends per domain is powerful but requires understanding the domain decomposition (`StorageDomains` at `packages/core/src/storage/base.ts:24-42`). The `editor` shorthand helps but adds another abstraction layer.

3. **Processor power vs overhead** — Processors provide unprecedented control (swap models per step, cache LLM responses, guardrail system) but each processor runs on every call. The `state` object pattern (`processors/index.ts:121-123`) helps, but the overhead of running 8 optional hooks per processor per step is non-trivial.

4. **MCP integration maturity** — `MCPServerConfig` (`packages/core/src/mcp/types.ts:194-242`) has many optional fields and loosely typed `string` unions for registry names, suggesting this API is still stabilizing.

5. **Integration class churn** — The `Integration` base class (`packages/core/src/integration/integration.ts:4-51`) is skeletal with `throw 'Method not implemented.'` defaults. The community seems to prefer standalone factories. This creates confusion about the "right" way to write an integration.

## Failure Modes / Edge Cases

1. **Undefined/null config values** — The `Mastra` constructor explicitly handles spread-config undefined values with `createUndefinedPrimitiveError()` (`packages/core/src/mastra/index.ts:67-91`), which suggests this is a known user pain point.

2. **Circular storage init** — `MastraCompositeStore.init()` initializes domains in parallel (`packages/core/src/storage/base.ts:331-399`). If two domains depend on each other's tables, initialization may race.

3. **Processor hook explosion** — 8 optional hooks × N processors × M steps = potentially many function calls per agent turn. No built-in profiler for processor overhead.

4. **Tool context ambiguity** — `ToolExecutionContext` (`packages/core/src/tools/types.ts:385-426`) handles agent, workflow, and MCP contexts simultaneously via optional nested objects. A tool executing in an agent context that accidentally accesses `context.workflow` will get `undefined`, not a type error at compile time.

5. **Missing storage domain errors** — Memory, workflows, and other features eagerly throw errors when a required storage domain is missing (`packages/core/src/memory/memory.ts:691-696`), but the init-required-domains check is manual per-feature rather than centralized.

## Future Considerations

1. **Plugin ecosystem** — A `mastra-plugin` registry with dynamic loading could enable `mastra add plugin @mastra/github-workflow`.
2. **Versioned extension APIs** — Currently no semver for the `ToolAction` or `MastraVector` contracts.
3. **Runtime capability discovery** — `mastra.listExtensionPoints()` or per-component `getCapabilities()` would improve discoverability.
4. **Integration standardization** — The split between `Integration` class and simple factories needs resolution.
5. **Workflow middleware** — Processors exist for agents but not for workflow steps. Workflows have no `processStepStart`/`processStepEnd` hooks.

## Questions / Gaps

1. How are tools between the tool-provider abstraction (`ToolProvider`) and direct `createTool()` reconciled at runtime? The relationship between `ToolProvider.resolveTools()` and the `tools` config on `Mastra` is not fully clear from the code examined.
2. The `@mastra/schema-compat` package's role in schema evolution is not fully explored — does it handle breaking JSON Schema changes across Zod v3/v4?
3. Are there any plans to formalize a "Mastra plugin" package format with versioned exports?
4. The `packages/core/src/storage/domains/` has separate directories for `memory`, `workflows`, `scores`, `observability`, etc. — how are cross-domain transactions handled (e.g., saving a message with an associated score)?

---

Generated by `study-areas/21-extensibility.md` against `mastra`.
