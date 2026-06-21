# Repo Analysis: openai-agents-python

## Extensibility Analysis (Protocol 21)

### Repo Info

| Field | Value |
|-------|-------|
| Name | openai-agents-python |
| Path | `repos/openai-agents-python` |
| Language / Stack | Python 3.10+, pydantic, OpenAI SDK, MCP SDK |
| Analyzed | 2026-05-17 |

## Summary

The OpenAI Agents SDK provides a **broad, well-structured extensibility architecture** organized around ABCs, protocols, and dataclass-based composition. Extension is primarily code-driven (implement an ABC, decorate a function, or instantiate a config class) with some configuration-driven surface (MCP connection params, prefix-based model routing, `ModelSettings`). The system supports **7+ distinct extension categories**: tools, model providers, MCP servers, guardrails, lifecycle hooks, tracing processors, session backends, and sandbox providers. Extension points are explicitly wired (no automatic discovery), which makes the system predictable but requires manual integration. Most public interfaces are marked `@abc.abstractmethod` or `Protocol`, providing stable contracts. The core runtime loop itself is intentionally NOT extensible.

## Rating

**8/10** — Well-defined extension interfaces with documentation, multiple extension categories, stable ABCs, and a dedicated `extensions/` directory for third-party integrations. Loses points for: (a) no formal plugin discovery mechanism (everything must be manually wired), (b) no extension versioning, (c) some extension interfaces (sandbox providers, memory backends) are in the `extensions/` directory rather than in the core package, and (d) the `CustomTool` type is OpenAI Responses API-specific, not a general-purpose abstraction.

Fast heuristic answer: **Yes** — you can add a new tool without touching the core agent code. Add a `@function_tool`-decorated function and append it to `agent.tools`. No core modification needed.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Tool extensibility — FunctionTool dataclass | Public dataclass with `name`, `description`, `params_json_schema`, `on_invoke_tool` callable | `src/agents/tool.py:282-418` |
| `@function_tool` decorator | Overloaded decorator wrapping any Python function into a `FunctionTool` | `src/agents/tool.py:1763-1826` |
| Tool union type | `Tool = FunctionTool \| FileSearchTool \| WebSearchTool \| ComputerTool \| HostedMCPTool \| CustomTool \| ShellTool \| ApplyPatchTool \| LocalShellTool \| ImageGenerationTool \| CodeInterpreterTool \| ToolSearchTool` | `src/agents/tool.py:1230-1243` |
| Model ABC | Abstract base class for all LLM models: `get_response()`, `stream_response()` | `src/agents/models/interface.py:37-124` |
| ModelProvider ABC | Abstract base for provider lookup: `get_model()` | `src/agents/models/interface.py:127-143` |
| MultiProvider | Prefix-based model routing (`openai/`, `litellm/`, `any-llm/`), customizable via `provider_map` | `src/agents/models/multi_provider.py:61-260` |
| MCPServer ABC | Base class for Model Context Protocol servers | `src/agents/mcp/server.py:223-380` |
| MCPServerStdio | Stdio transport implementation | `src/agents/mcp/server.py:1091-1182` |
| MCPServerSse | SSE transport implementation | `src/agents/mcp/server.py:1212+` |
| MCP tool filtering | Static (allowlist/blocklist) and dynamic (callable) tool filters | `src/agents/mcp/server.py:612-690` |
| RunHooksBase | Per-run lifecycle hooks: `on_llm_start`, `on_llm_end`, `on_agent_start`, `on_agent_end`, `on_handoff`, `on_tool_start`, `on_tool_end` | `src/agents/lifecycle.py:13-100` |
| AgentHooksBase | Per-agent lifecycle hooks: `on_start`, `on_end`, `on_handoff`, `on_tool_start`, `on_tool_end`, `on_llm_start`, `on_llm_end` | `src/agents/lifecycle.py:102-193` |
| InputGuardrail | Guardrail that runs before agent execution, with `@input_guardrail` decorator | `src/agents/guardrail.py:72-131` |
| OutputGuardrail | Guardrail that runs after agent output, with `@output_guardrail` decorator | `src/agents/guardrail.py:133-186` |
| ToolInputGuardrail | Guardrail before tool invocation, with `@tool_input_guardrail` decorator | `src/agents/tool_guardrails.py:152-177` |
| ToolOutputGuardrail | Guardrail after tool invocation, with `@tool_output_guardrail` decorator | `src/agents/tool_guardrails.py:181-206` |
| TracingProcessor ABC | Process traces/spans on start/end events | `src/agents/tracing/processor_interface.py:9-130` |
| TracingExporter ABC | Export traces/spans to external backends | `src/agents/tracing/processor_interface.py:132-142` |
| Session Protocol | Public protocol for session storage: `get_items()`, `add_items()`, `pop_item()`, `clear_session()` | `src/agents/memory/session.py:14-54` |
| SessionABC | Abstract base class for session implementations | `src/agents/memory/session.py:57-104` |
| Handoff dataclass | Composable handoffs with `is_enabled`, `input_filter`, `nest_handoff_history`, typed input | `src/agents/handoffs/__init__.py:94-181` |
| `handoff()` helper | Factory function creating `Handoff` from an `Agent` | `src/agents/handoffs/__init__.py:222-333` |
| Agent.as_tool() | Converts any agent into a `FunctionTool` for hierarchical composition | `src/agents/agent.py:508-936` |
| Computer lifecycle | `ComputerCreate`/`ComputerDispose` protocols and `ComputerProvider` for per-run computer lifecycle | `src/agents/tool.py:233-256` |
| Dynamic tool enablement | `FunctionTool.is_enabled` supports `bool` or callable `(context, agent) -> bool` | `src/agents/tool.py:314-317` |
| Dynamic handoff enablement | `Handoff.is_enabled` supports `bool` or callable | `src/agents/handoffs/__init__.py:153-161` |
| Tool namespace grouping | `tool_namespace()` function groups tools for Responses API tool search | `src/agents/tool.py:1247-1270` |
| CustomTool | Raw string-input tool for OpenAI Responses API | `src/agents/tool.py:1173-1211` |
| ShellTool extensibility | Plugable `ShellExecutor` and shell environments (local, hosted) | `src/agents/tool.py:1102-1147` |
| Extensions directory | Third-party model providers, memory backends, sandbox providers | `src/agents/extensions/` tree |
| LiteLLM provider | Model provider wrapping LiteLLM | `src/agents/extensions/models/litellm_provider.py` |
| AnyLLM provider | Model provider wrapping 100+ LLMs | `src/agents/extensions/models/any_llm_provider.py` |
| Plugin-optional deps | 20+ optional dependency groups in pyproject.toml | `pyproject.toml` |
| Schemas: `CURRENT_SCHEMA_VERSION` | Schema version tracking for serialized `RunState` | `src/agents/run_state.py` |

## Answers to Protocol Questions

### 1. What are the primary extension points?

The primary extension points are: (a) **Tools** via `FunctionTool` + `@function_tool` decorator, (b) **Model providers** via `Model` + `ModelProvider` ABCs, (c) **MCP servers** via `MCPServer` ABC, (d) **Lifecycle hooks** via `RunHooksBase`/`AgentHooksBase`, (e) **Guardrails** via `InputGuardrail`/`OutputGuardrail`/`ToolInputGuardrail`/`ToolOutputGuardrail`, (f) **Tracing processors** via `TracingProcessor` ABC, (g) **Session backends** via `Session` protocol / `SessionABC`, (h) **Handoffs** via `Handoff` dataclass, (i) **Sandbox providers** (container-based execution environments), and (j) **Computer environments** via `ComputerCreate`/`ComputerProvider` protocols.

### 2. How are custom tools/providers added?

**Custom tools**: Decorate any function with `@function_tool` (`src/agents/tool.py:1763`), or manually construct a `FunctionTool` dataclass (`src/agents/tool.py:282`). Append to `agent.tools`. For non-function tools, implement any of the 12 tool types in the `Tool` union (`src/agents/tool.py:1230`).

**Custom model providers**: Implement `ModelProvider` ABC (`src/agents/models/interface.py:127`) and `Model` ABC (`src/agents/models/interface.py:37`). Register via `MultiProvider.add_provider()` (`src/agents/models/multi_provider.py:43`) or set as `agent.model` directly. Examples: `LitellmProvider` (`src/agents/extensions/models/litellm_provider.py`), `AnyLLMProvider` (`src/agents/extensions/models/any_llm_provider.py`).

**Custom MCP servers**: Subclass `MCPServer` ABC (`src/agents/mcp/server.py:223`), implement `connect()`, `cleanup()`, `list_tools()`, `call_tool()`. Or use built-in `MCPServerStdio` / `MCPServerSse`.

### 3. Are there hooks/middleware for customization?

Yes, there are four hook/middleware systems:

- **Run-level hooks**: `RunHooksBase` (`src/agents/lifecycle.py:13`) — `on_llm_start`, `on_llm_end`, `on_agent_start`, `on_agent_end`, `on_handoff`, `on_tool_start`, `on_tool_end`. Passed to `Runner.run()`.
- **Agent-level hooks**: `AgentHooksBase` (`src/agents/lifecycle.py:102`) — same events but scoped to a specific agent. Set via `agent.hooks`.
- **Guardrails**: Pre/post execution checks for agent input/output and tool input/output. Configurable per-agent or per-tool.
- **Handoff input filters**: `HandoffInputFilter` (`src/agents/handoffs/__init__.py:86`) — transforms data passed to the next agent during a handoff.

There is no general-purpose middleware pipeline (no "before/after every step" hook), but the lifecycle hooks cover the major lifecycle events.

### 4. Is extension configuration-driven or code-driven?

**Predominantly code-driven**, with some configuration-driven elements:

- **Code-driven**: Tools (`@function_tool`), guardrails (`@input_guardrail`), custom models (ABC subclasses), hooks (subclass `RunHooksBase`/`AgentHooksBase`), tracing processors (subclass `TracingProcessor`), session backends (implement `Session` protocol).
- **Configuration-driven**: MCP server connection params (`MCPServerStdioParams`, `MCPServerSseParams`), `ModelSettings` (temperature, top_p, etc.), `MultiProvider` prefix mapping, tool approval policies on MCP servers, tool filtering (static allowlist/blocklist).
- **Hybrid**: Tool `is_enabled` and `needs_approval` accept either a bool (config) or a callable (code). Handoff `is_enabled` and `input_filter` follow the same pattern.

### 5. How stable are extension interfaces?

Most public extension interfaces are **stable**:

- `Model` and `ModelProvider` ABCs use `@abc.abstractmethod` and are well-documented (`src/agents/models/interface.py`). These are foundational interfaces unlikely to break.
- `FunctionTool` is a public dataclass with documented fields; positional parameter order is preserved for compatibility (noted at `src/agents/tool.py:319`).
- `TracingProcessor` and `TracingExporter` ABCs are stable with documented method contracts (`src/agents/tracing/processor_interface.py`).
- `Session` protocol is explicitly marked as the public contract for third-party libraries (`src/agents/memory/session.py:64`).
- `MCPServer` ABC is stable; `_MCPServerWithClientSession` (the implementation base) is semi-internal (underscore prefix).
- Extension interfaces in `src/agents/extensions/` (LiteLLM, AnyLLM, sandbox providers, memory backends) vary in stability; the `experimental/` subdirectory is explicitly unstable.

### 6. How are breaking changes managed?

Breaking changes are managed through: (a) **SDK versioning** in `src/agents/version.py`, (b) **RunState schema versioning** via `CURRENT_SCHEMA_VERSION` in `src/agents/run_state.py` with `SCHEMA_VERSION_SUMMARIES` for historical tracking, (c) **positional compatibility guarantees** for public constructors (`AGENTS.md` in the repo explicitly states: "Do not insert new constructor parameters or dataclass fields in the middle of existing public order"), (d) **optional dependencies** for extension modules (voice, realtime, various sandbox providers, memory backends) so breaking changes in those don't affect core users. There is no formal deprecation policy or API stability annotation system.

### 7. What is intentionally NOT extensible?

Several things are intentionally rigid: (a) The **core runtime loop** (`src/agents/run_internal/run_loop.py`) — single-turn execution and streaming are not pluggable. (b) The **agent-to-agent handoff protocol** — handoff semantics (tool call → transfer messages) are fixed. (c) **Input guardrail execution timing** — input guardrails always run only on the first turn of the starting agent. (d) **The OpenAI Responses API wire format** — tool serialization follows OpenAI's schema. (e) **Trace/span data structures** (`src/agents/tracing/span_data.py`) — you can add processors but not change the span data model. (f) **Agent cloning** is shallow copy only (`dataclasses.replace` at `src/agents/agent.py:488`). (g) Error handling within the runtime loop is not user-configurable (though per-tool error functions are).

### 8. How discoverable are extension points?

Extension points are **moderately discoverable**:

- **Well-documented**: `README.md` covers tools, model providers, MCP, guardrails, tracing, and handoffs. The `examples/` directory has 100+ examples across all extension categories.
- **Type-checked**: All extension interfaces use ABCs, protocols, and TypedDicts with comprehensive type hints, making them discoverable via IDE autocompletion.
- **Explicit wiring**: All extensions must be manually registered (e.g., `agent.tools = [...]`, `agent.mcp_servers = [...]`, `agent.hooks = ...`). There is no plugin auto-discovery, `entry_points`, or registration system — this makes the system transparent but requires reading the `Agent` dataclass fields to find all wiring points.
- **Public API exports**: `src/agents/__init__.py` re-exports all major types (549 lines), providing a single import surface.
- **Documentation gaps**: The `extensions/` directory is not centrally documented; you need to explore the directory tree to discover available extensions. Some ABCs (like `SandboxClient` or computer protocols) are discovered through the code rather than docs.

## Architectural Decisions

- **ABCs over Protocols for stable interfaces**: `Model`, `ModelProvider`, `MCPServer`, `TracingProcessor` use ABCs with abstract methods (`src/agents/models/interface.py`, `src/agents/mcp/server.py`, `src/agents/tracing/processor_interface.py`). `Session` uses a `Protocol` (`src/agents/memory/session.py:14`) with an ABC version (`SessionABC` at line 57) — the docstring explicitly says third parties should implement the Protocol, not subclass the ABC. This is a deliberate choice: ABCs provide stronger contract enforcement at definition time; Protocols allow duck-typing for simpler integrations.

- **Dataclass composition over inheritance**: `Agent` (`src/agents/agent.py:270`) is a dataclass with list fields for tools, MCP servers, guardrails, and handoffs. Extension is through list appending, not subclassing. Even `AgentBase` (`src/agents/agent.py:174`) is a dataclass. This makes composition straightforward but means there is no "custom agent" extension point.

- **Separate extensions package**: Third-party integrations live in `src/agents/extensions/` rather than in the core package. This keeps the core small (no heavy dependencies) and isolates breakage. Extensions are loaded via optional dependency groups in `pyproject.toml` (20+ groups).

- **Decorator-first UX for common cases**: The most common extension — adding a tool — is a one-liner decorator (`@function_tool`). Guardrails follow the same pattern. Custom model providers require more work (implement two ABCs) because they are less common.

- **MCP as a primary extension mechanism**: The SDK deeply integrates MCP (`src/agents/mcp/`), treating it as a first-class tool source alongside native function tools. MCP servers are wired through `agent.mcp_servers` and their tools are merged at runtime via `AgentBase.get_mcp_tools()` (`src/agents/agent.py:224`). The MCP transport layer supports stdio, SSE, and StreamableHTTP.

## Notable Patterns

- **Callable-based dynamic configuration**: Tool enablement, approval requirements, and handoff enablement can all be callables evaluated at runtime, not just static booleans. This enables context-dependent extension behavior without modifying core code.

- **Hierarchical agent composition via `as_tool()`**: `Agent.as_tool()` (`src/agents/agent.py:508`) wraps one agent as a `FunctionTool` for another agent, enabling nested agent trees. This is distinct from handoffs (where the child agent takes over the conversation) — `as_tool()` agents run as tools and return results to the parent.

- **Weak reference caching for resource lifecycle**: The `ComputerTool` caches resolved computer instances per `(tool, run_context)` using `weakref.WeakKeyDictionary` (`src/agents/tool.py:638-647`), automatically cleaned up when references are dropped.

- **Tool namespace grouping**: `tool_namespace()` (`src/agents/tool.py:1247`) groups `FunctionTool`s into namespaces for OpenAI Responses API tool search, enabling lazy loading of tool definitions.

- **Graceful error handling via failure error functions**: Tools and MCP servers accept an optional `failure_error_function` that converts exceptions into model-visible error messages, allowing the LLM to retry or adapt rather than failing the run.

- **`_UNSET` sentinel pattern**: MCP server (`src/agents/mcp/server.py:200-204`) and tool (`src/agents/tool.py:89`) code uses sentinel objects to distinguish "not set" from `None` (which means "no error function"), allowing agent-level defaults to cascade through.

## Tradeoffs

| Tradeoff | Choice | Implication |
|----------|--------|-------------|
| Plugin discovery vs. explicit wiring | Explicit wiring (list fields on Agent) | Predictable and debuggable, but requires manual setup for every agent |
| Code-driven vs. config-driven | Predominantly code-driven | Flexible and type-safe, but harder to configure from YAML/JSON |
| Extension interfaces in core vs. separate package | Mix: ABCs in core, implementations in `extensions/` | Core stays lightweight with minimal deps; but users may not discover available extensions |
| Positional compatibility vs. flexibility | Preserve positional arg order | Stable constructors but harder to add new optional fields |
| Protocol vs. ABC for Session | Both `Session` (Protocol) and `SessionABC` | Protocol allows duck-typing; ABC provides implementation base. Slightly confusing dual-interface choice |
| MCP as first-class vs. SDK-specific tools | Both coexist | Rich tool ecosystem but two parallel tool sources with different capabilities (MCP doesn't support guardrails natively) |
| Schema version tracking | Manual `CURRENT_SCHEMA_VERSION` bumps in run_state.py | Precise control but error-prone if forgotten |

## Failure Modes / Edge Cases

- **Tool name collision**: `_validate_codex_tool_name_collisions()` (`src/agents/agent.py:95-118`) catches duplicate tool names across FunctionTools and MCP tools. But tool name collisions between `agent.tools` and `agent.mcp_servers` are not explicitly validated — the last one wins silently.
- **MCP tool call failures**: When an MCP server disconnects, `call_tool()` raises `UserError` with a generic message (`src/agents/mcp/server.py:860-895`). The LLM receives this and may retry, but there is no automatic reconnection.
- **Shallow copy in Agent.clone()**: Documented at `src/agents/agent.py:490-493` — mutable fields (tools, handoffs) are shared between the original and clone unless explicitly overridden. Users modifying the clone's tools list inadvertently affect the original.
- **Guardrail parallel execution**: Input guardrails with `run_in_parallel=True` run concurrently with the agent. If they mutate shared state, behavior is undefined.
- **Server-managed conversations disable handoff filtering**: Documented at `src/agents/handoffs/__init__.py:137-139`. If a user enables server-managed conversations and handoff input filters simultaneously, the filter is silently ignored.
- **MCP tool approval policy with callable**: `_get_needs_approval_for_tool()` falls back to `True` if a callable policy is configured but no agent reference is provided (`src/agents/mcp/server.py:500-502`). This is fail-closed (safe) but may surprise users who wire MCP tools without agent context.

## Future Considerations

- **Plugin discovery system**: No auto-discovery mechanism exists. An `entry_points`-based plugin system or a registry pattern could allow third-party extensions (sessions, providers, tools) to be discovered without manual wiring.
- **Extension API versioning**: No formal API stability annotations (e.g., `@beta`, `@experimental`, `@stable`). As the SDK grows, annotating the stability level of each extension interface would help extension developers plan for upgrades.
- **Unified tool contract**: The `Tool` union (`src/agents/tool.py:1230`) has 12 members with different constructors. A unified `Tool` ABC or Protocol with standard `name`/`description`/`invoke` could simplify third-party tool creation.
- **Middleware pipeline**: Adding a general-purpose middleware chain (before/after every step) would enable orthogonal cross-cutting concerns (logging, rate limiting, caching) without subclassing hooks.
- **Sandbox provider stability**: The sandbox subsystem in `src/agents/sandbox/` is large (~100+ files) and the `SandboxClient` interface should be explicitly extracted as a public ABC for third-party sandbox providers.

## Questions / Gaps

- **No clear evidence found** for how `SandboxClient` base interface is defined as a public extension point. The sandbox subsystem (`src/agents/sandbox/`) has many internal types but no single exported ABC for third-party sandbox providers — integration appears to happen through the `extensions/sandbox/` directory instead.
- **No clear evidence found** for formal deprecation policy or API lifecycle annotations. The README and AGENTS.md mention positional compatibility but don't document a deprecation process.
- **No clear evidence found** for breaking change detection in CI. The test suite covers behavior but there's no API-compat testing (e.g., `pytest-analogous` to `compatibility_suite`).
- **No clear evidence found** for how the `voice/` pipeline model providers can be extended. The voice subsystem has `models/openai_model_provider.py` but the base interface is not explicitly exported.
- **No clear evidence found** for how extension documentation is generated or maintained. The `extensions/` tree has no central index or documentation file.

---

Generated by `study-areas/21-extensibility.md` against `openai-agents-python`.
