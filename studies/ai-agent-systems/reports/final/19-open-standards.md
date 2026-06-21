# Open Standards Strategy Analysis - Combined Study Report

## Study Parameters

| Field | Value |
|-------|-------|
| Protocol | `study-areas/19-open-standards.md` |
| Repositories | 13 (12 reference + 1 target) |
| Date | 2026-05-17 |

## Repositories Studied

| # | Repo | Path |
|---|------|------|
| 1 | aider | `repos/aider` |
| 2 | autogen | `repos/autogen` |
| 3 | guardrails | `repos/guardrails` |
| 4 | langfuse | `repos/langfuse` |
| 5 | langgraph | `repos/langgraph` |
| 6 | mastra | `repos/mastra` |
| 7 | nemo-guardrails | `repos/nemo-guardrails` |
| 8 | opa | `repos/opa` |
| 9 | openai-agents-python | `repos/openai-agents-python` |
| 10 | opencode | `repos/opencode` |
| 11 | openhands | `repos/openhands` |
| 12 | temporal | `repos/temporal` |
| 13 | hellosales | `repos/hellosales` |

## Executive Summary

The 12 reference systems cluster into four tiers of open standards adoption. **Mastra and opencode** lead at 8/10 with dual MCP client+server, A2A or OpenAPI-first design, OpenTelemetry support, and JSON Schema normalization. **Autogen, langfuse, openai-agents-python, and openhands** follow at 7/10, each adopting MCP (client-only for some) and OpenTelemetry but lacking A2A or full protocol breadth. **Guardrails, hellosales, langgraph, nemo-guardrails, and temporal** sit at 5/10 — they adopt at least one standard (OpenTelemetry or JSON Schema) but core protocols remain bespoke, MCP is absent or partial, and no system approaches standards-first design. **Aider and opa** are at 2/10 and 4/10 respectively, with minimal or single-standard adoption. **A2A** is effectively absent across the entire sample — only mastra has a partial implementation, and it is for external agent calling only, not for receiving A2A requests. **MCP** is the dominant emerging standard, with 8 of 12 reference repos implementing it in some form. **OpenTelemetry** is the most widely adopted standard, present in 10 of 12 systems. **JSON Schema** is universal but nearly always derived from Pydantic or Zod rather than maintained as first-class schema files.

## Core Thesis

The AI agent ecosystem is converging on **MCP for tool interoperability** and **OpenTelemetry for observability**, while **A2A remains nascent**. No system in this study achieves a "standards-first" rating of 9-10. The ceiling is 8/10 (mastra, opencode), and the gap is primarily due to: (1) absence of A2A protocol support, (2) lack of formal capability advertisement beyond MCP's `listTools`, and (3) reliance on derived JSON Schema rather than spec-first schema files. For a system like HelloSales aiming to reach 8+, the path requires: MCP server exposure of agent tools, OpenTelemetry metrics (beyond tracing), formal OpenAPI spec export, and preparatory architecture for A2A when the standard matures.

## Rating Summary

| Repo | Score | Approach | Main Strength | Main Concern |
|------|-------|----------|---------------|--------------|
| aider | 2/10 | Bespoke-only | Provider abstraction via litellm | No MCP, no OTel, no plugin system |
| autogen | 7/10 | Multi-standard hybrid | Deep MCP client with 3 transports + full OTel | Custom gRPC for agent communication, no A2A |
| guardrails | 5/10 | Single-standard + custom | Full OTel with OpenInference | No MCP/A2A, custom RAIL format locks schema |
| langfuse | 7/10 | Multi-standard (MCP server) | Dual OTel (ingest + internal), Fern→OpenAPI pipeline | MCP only exposes prompts, no client impl |
| langgraph | 5/10 | Partial standard adoption | MCP client for tool exec + JSON Schema per graph | Client-only MCP, custom streaming protocol, no OpenAPI |
| mastra | 8/10 | Standards-first | MCP client+server, A2A external, OpenAPI 3.1 gen | A2A is external-only, no internal A2A composition |
| nemo-guardrails | 5/10 | Single-standard + custom DSL | Strong OTel with GenAI conventions | No MCP/A2A, Colang DSL creates lock-in |
| opa | 4/10 | Minimal standards | OTel tracing + metrics, internal JSON Schema | No MCP/A2A/OpenAPI, custom REST API |
| openai-agents-python | 7/10 | MCP-first + proprietary tracing | Deep MCP client (3 transports), strict JSON Schema | Proprietary tracing (not OTel), no A2A, no OpenAPI |
| opencode | 8/10 | Standards-first | MCP client+server+OAuth, OpenAPI 3.1, Effect layers | No A2A, OTel opt-in only |
| openhands | 7/10 | MCP-server + OTel | FastMCP server, WebSocket, auto OpenAPI | Laminar wraps OTel (vendor coupling), no A2A |
| temporal | 5/10 | Infrastructure standards | Full OTel, gRPC+Protobuf, Nexus for external | No MCP/A2A, bespoke orchestration protocol |
| hellosales | 5/10 | Observability standards | Full OTel pipeline (Collector→Tempo/Loki/Prometheus) | No MCP/A2A, bespoke agent protocols, no capability discovery |

## Approach Models

The reference systems cluster into five distinct approach models for open standards adoption:

### Model A: MCP-First (mastra, opencode, openai-agents-python, openhands, langfuse)

These systems make MCP a primary integration mechanism. Mastra and opencode implement both MCP client and server; the others implement one side. Key characteristics:
- MCP SDK delegation (`@modelcontextprotocol/sdk` or `fastmcp`) rather than protocol reimplementation
- Multiple transport support (stdio, SSE, Streamable HTTP)
- Tool definitions derived from typed schemas (Zod, Pydantic, Effect Schema)
- Tool conversion layer between MCP tools and internal tool representation

### Model B: MCP-Client-Only (autogen, langgraph)

MCP is consumed but not served. Autogen has the most comprehensive client with three transports; langgraph connects MCP tools during graph execution only. Neither exposes its own capabilities via MCP.

### Model C: Observability-First (guardrails, hellosales, nemo-guardrails, temporal, opa)

OpenTelemetry is the primary standard adopted. These systems invest in tracing, metrics, and log export but have limited or no agent-protocol standardization:
- Guardrails: OTel + OpenInference semantic conventions
- HelloSales: Production OTel Collector pipeline (Tempo/Loki/Prometheus/Grafana)
- Nemo-Guardrails: OTel with GenAI semantic conventions via adapter pattern
- Temporal: Full OTel traces + metrics, gRPC-exported
- OPA: OTel tracing with both gRPC and HTTP exporters

### Model D: Bespoke-Dominant (aider)

No meaningful standard adoption beyond JSON Schema for function validation. CLI-only, no plugin system, no composability.

### Model E: Infrastructure-Standards (temporal)

gRPC + Protobuf for service mesh, OpenTelemetry for observability, Nexus for external task dispatch. The core workflow semantics remain bespoke, which is appropriate for an orchestration engine but limits agent ecosystem participation.

## Pattern Catalog

### Pattern 1: Dual Transport Fallback (opencode, mastra)

When connecting to remote MCP servers, try Streamable HTTP first, then fall back to SSE. Demonstrates at opencode `packages/opencode/src/mcp/index.ts:330-404` and mastra `packages/mcp/src/client/client.ts:393-463`.

**Why it works**: Not all MCP servers support Streamable HTTP yet. Dual transport maximizes compatibility without forcing all servers to implement both protocols.

**When to copy**: When building an MCP client that connects to third-party servers.

**When overkill**: If all servers in your ecosystem are known to support one transport.

### Pattern 2: Schema Conversion Layer (mastra, opencode, openhands)

A dedicated module converts between the system's internal schema language (Zod, Effect Schema, Pydantic) and JSON Schema for MCP/OpenAPI consumption.

- Mastra: `packages/schema-compat/src/zod-to-json.ts` handles Zod v3/v4 conversion
- Opencode: `packages/opencode/src/tool/json-schema.ts` normalizes Effect Schema to JSON Schema
- OpenHands: `openhands/sdk/tool/schema.py:179-198` converts Pydantic to MCP-compatible JSON Schema

**Why it works**: Decouples internal type definitions from wire protocol schemas. Schema changes in one layer don't cascade.

**When overkill**: Single-language, single-format systems where the internal schema language already produces compatible JSON Schema.

### Pattern 3: Feature Module Registry for MCP Tools (langfuse, mastra, openhands)

Tools are registered via a plugin-like pattern rather than hardcoded.

- Langfuse: `web/src/features/mcp/server/registry.ts:72-190` with bootstrap at `bootstrap.ts:26-42`
- OpenHands: `@mcp_server.tool()` decorator at `openhands/app_server/mcp/mcp_router.py:147`
- Mastra: MCP tools wrapped from Mastra agents/workflows via `packages/mcp/src/shared/mastra-tool-meta.ts`

**Why it works**: Adding a new tool doesn't require modifying the MCP server core. Teams can add domain-specific tools independently.

**When overkill**: Small systems with fewer than 5 tools.

### Pattern 4: OTel Collector Pipeline (hellosales, autogen)

Deploying an OTel Collector as infrastructure between application and observability backends.

- HelloSales: `ops/observability/otel-collector/config.yaml:1-40` — Collector routes traces to Tempo, logs to Loki, metrics to Prometheus
- Autogen: OpenTelemetry propagation integrated at transport layer for gRPC and envelope messaging

**Why it works**: Decouples application instrumentation from backend configuration. Collector handles batching, retry, and routing.

**When overkill**: Single-service deployments with a single observability backend.

### Pattern 5: Namespaced MCP Proxy (openhands)

A proxy pattern where external services (e.g., Tavily search) are mounted under a namespace on the system's MCP server.

**Evidence**: `openhands/app_server/mcp/mcp_router.py:49-75` — Tavily MCP proxy hides API keys from sandbox while exposing search capability through a `tavily`-namespaced MCP server.

**Why it works**: MCP clients get unified access to both native and proxied tools through a single MCP server endpoint, with namespace isolation.

**When overkill**: Systems that directly integrate external tools without sandboxing concerns.

### Pattern 6: Stateless MCP Server Per Request (langfuse)

A fresh MCP server instance is created per request with context captured in closures.

**Evidence**: `web/src/features/mcp/server/mcpServer.ts:30-31` — "All relevant context is captured in closures, so this MUST stay stateless."

**Why it works**: Avoids session state, simplifies scaling, prevents cross-request contamination.

**When overkill**: Stateful MCP servers that benefit from persistent connections.

### Pattern 7: JSON Schema Strictness Enforcement (openai-agents-python, hellosales)

Schema normalization that enforces `additionalProperties: false` and strips unsupported keywords to improve LLM tool-calling accuracy.

- OpenAI Agents: `src/agents/strict_schema.py:18-149` — `ensure_strict_json_schema()` mutates schemas
- HelloSales: `src/hello_sales_backend/platform/agents/tools.py:49-80` — `_strict_tool_schema()` normalizes for provider

**Why it works**: LLMs produce more reliable structured outputs with strict schemas. Stripping `$defs`, `allOf`, `anyOf` prevents provider rejection.

**When overkill**: Providers that already support full JSON Schema 2020-12.

## Key Differences

### MCP Client vs Server Orientation

| Orientation | Repos | Implication |
|-------------|-------|-------------|
| Client-only | autogen, langgraph, openai-agents-python | Can consume external tools but cannot expose own capabilities to MCP ecosystem |
| Server-only | langfuse, openhands | Expose capabilities but cannot consume third-party MCP tools |
| Both | mastra, opencode | Bidirectional interoperability — can both expose and consume |
| Neither | aider, guardrails, hellosales, nemo-guardrails, opa, temporal | Excluded from MCP ecosystem entirely |

### OpenTelemetry Integration Depth

| Depth | Repos | Pattern |
|-------|-------|---------|
| SDK-level (create/export spans) | autogen, guardrails, hellosales, langfuse, nemo-guardrails, opa, opencode, openhands, temporal | Configure TracerProvider, OTLP exporter, batch processor |
| Dependency-only (libs present, not configured) | langgraph | Packages in lock file but no direct span creation |
| Proprietary replacement | openai-agents-python | Own tracing format exported to OpenAI endpoint |
| None | aider | No observability instrumentation |

### OpenAPI Approach

| Approach | Repos | Method |
|----------|-------|--------|
| Auto-generated from routes | hellosales (FastAPI), openhands (FastAPI), nemo-guardrails (FastAPI), mastra (H+OpenAPI 3.1) | Runtime generation from Python/TS types |
| Explicit DSL → OpenAPI | langfuse (Fern) | Fern DSL generates OpenAPI and SDKs |
| Design-first | opencode (Effect OpenApi) | OpenAPI as first-class concern via Effect's HttpApi |
| None | aider, autogen, guardrails, langgraph, opa, openai-agents-python, temporal | No machine-readable API spec |

### JSON Schema Strategy

| Strategy | Repos |
|----------|-------|
| Derived from Pydantic/Zod at runtime | guardrails, hellosales, langfuse, langgraph, mastra, nemo-guardrails, openhands, opencode |
| Dedicated validator library | aider (Draft7Validator), opa (internal gojsonschema) |
| Conversion with normalization | mastra (schema-compat), opencode (ToolJsonSchema), openhands (_process_schema_node) |

### A2A Protocol Status

Only **mastra** has any A2A implementation, and it is client-only (calling external A2A agents). No system implements A2A as a server or for internal agent composition. The `langchain-protocol` dependency in langgraph (`libs/langgraph/uv.lock:1378`) hints at future A2A support, but no implementation exists.

## Tradeoffs

### MCP Adoption vs Bespoke Protocols

| Choice | Benefit | Cost | Best Context | Failure Mode |
|--------|---------|------|-------------|--------------|
| Full MCP (client+server) | Ecosystem interoperability, tool extensibility | Schema conversion complexity, MCP version tracking | Systems that both consume and expose tools | MCP SDK version incompatibility |
| MCP client-only | Can use MCP ecosystem tools | Cannot expose own capabilities | Agent systems that need external tools | No benefit to other systems |
| MCP server-only | Can be consumed by MCP clients | Cannot consume external tools | Tool/service providers | Limited to being a dependency |
| Bespoke protocols | Full control, no external coupling | No ecosystem interoperability | Closed/internal systems | Rewrite cost when interop becomes necessary |

### OpenTelemetry Standard vs Proprietary Tracing

| Choice | Benefit | Cost | Best Context | Failure Mode |
|--------|---------|------|-------------|--------------|
| OpenTelemetry SDK | Vendor-neutral, switch backends freely | SDK complexity, initialization cost | Multi-backend or multi-cloud | OTLP endpoint unreachable → span loss |
| Proprietary tracing (OpenAI) | Zero configuration, OpenAI-native | Vendor lock-in, cannot use Datadog/Grafana | OpenAI-only deployments | Cannot migrate observability stack |
| Laminar-wrapped OTel | Enhanced session semantics | Vendor coupling on top of standard | Teams already using Laminar | Migration requires unwrapping |

### JSON Schema Derivation vs First-Class Files

| Choice | Benefit | Cost | Best Context | Failure Mode |
|--------|---------|------|-------------|--------------|
| Runtime derivation (Pydantic/Zod) | No schema drift, automatic with code | Cannot share schemas cross-language | Single-language monoliths | Non-Python consumers cannot use schemas |
| First-class schema files | Language-agnostic, contract testing | Manual sync with implementations | Multi-language ecosystems | Schema-to-code drift |

### OpenAPI Auto-Generation vs Spec-First

| Choice | Benefit | Cost | Best Context | Failure Mode |
|--------|---------|------|-------------|--------------|
| Auto-generated | Always in sync with code | No spec review before API changes | Internal APIs, rapid iteration | Breaking changes invisible until deployed |
| Spec-first | Contract review, client generation | Spec can diverge from implementation | Public APIs, SDK generation | Outdated specs mislead consumers |

## Decision Guide

### Should I adopt MCP?

**Adopt MCP if:** Your system needs to consume external tools (MCP client) or be consumed as a tool source (MCP server), or if you want bidirectional interoperability with the agent ecosystem.

**Skip MCP if:** Your system is a closed/internal application with no external integration needs, or if you're building a domain-specific engine (like OPA or Temporal) where MCP adds no value.

**Decision rule:** If you have a `tools/` or `plugins/` directory, you should implement MCP. If your integration surface is limited to REST APIs, MCP is optional but beneficial.

### OpenTelemetry: SDK or Wrapper?

**Use OTel SDK directly if:** You need vendor-neutral observability, support multiple backends, or want to avoid vendor lock-in.

**Use a wrapper (Laminar, OpenInference) if:** You need AI-specific semantic conventions and are comfortable with the wrapper's vendor dependency.

**Decision rule:** Start with OTel SDK. Add wrapper only if you need AI-specific span types not covered by OTel semantic conventions.

### JSON Schema: Derived or First-Class?

**Derive at runtime if:** Single-language Python/TypeScript stack, Pydantic/Zod is your schema source of truth, you don't need cross-language schema sharing.

**Maintain first-class files if:** Multi-language stack, OpenAPI spec-first workflow, public API consumers need standalone schemas.

**Decision rule:** If you have both Python and TypeScript consumers, maintain first-class JSON Schema files. Otherwise, runtime derivation is simpler.

### OpenAPI: Auto-Generate or Spec-First?

**Auto-generate if:** Rapid iteration, internal API, FastAPI/Hono-based routes.

**Spec-first if:** Public API, API versioning, contract testing, SDK generation.

**Decision rule:** Auto-generate for internal APIs, spec-first for anything public.

## Practical Tips

1. **Start with MCP client, add server later.** The client-side integration is simpler and immediately unlocks the MCP tool ecosystem. langgraph's approach at `libs/sdk-py/langgraph_sdk/runtime.py:106-120` — connecting MCP only during execution — is a lightweight starting point.

2. **Use Streamable HTTP as default MCP transport.** It is the most widely supported and doesn't require SSE fallback for most use cases. The mastra MCP client at `packages/mcp/src/client/client.ts:414-425` defaults to Streamable HTTP.

3. **Normalize JSON Schema before sending to LLM providers.** Hellosales' `_strict_tool_schema()` at `src/hello_sales_backend/platform/agents/tools.py:49-80` and OpenAI Agents' `ensure_strict_json_schema()` at `src/agents/strict_schema.py:18-149` demonstrate that LLM providers reject non-strict schemas. Normalize before registration, not at runtime.

4. **Deploy OTel Collector as infrastructure, not as a library dependency.** Hellosales' approach at `ops/observability/otel-collector/config.yaml:1-40` — Collector handles routing, batching, and retry — separates concerns and makes observability stack changes configuration-only.

5. **Consider an explicit API contract tool.** Langfuse uses Fern (`fern/apis/server/definition/api.yml`) to define APIs beyond FastAPI's auto-generation. This enables SDK generation, contract testing, and spec reviews.

## Anti-Patterns / Caution Signs

1. **Custom schema language without export.** Guardrails' RAIL format (`nemoguardrails/schema/rail_schema.py:338-402`) converts to JSON Schema but loses validator metadata. Any custom DSL should have a lossless standard format exporter.

2. **Proprietary tracing with no OTel option.** OpenAI Agents' tracing at `src/agents/tracing/processors.py:33-149` exports to OpenAI's proprietary endpoint. This prevents users from using tools like Grafana, Datadog, or Jaeger.

3. **Single MCP orientation.** LangGraph (client-only) and Langfuse (server-only) limit their MCP utility. Client-only cannot be consumed; server-only cannot consume. Dual orientation maximizes value.

4. **No capability discovery.** Systems like aider, opa, and hellosales hardcode capabilities in code. When capabilities grow beyond 5-10, MCP's `listTools` or OpenAPI spec becomes necessary.

5. **Deprecated code paths left in tree.** Aider retains deprecated coder classes (`EditBlockFunctionCoder`, `WholeFileFunctionCoder`) that raise `RuntimeError("Deprecated")` on init. Dead code increases maintenance surface.

## Notable Absences

- **A2A protocol**: Present in only 1 of 12 repos (mastra, and only as external caller). This is the biggest gap in standards adoption across all systems.
- **gRPC as primary agent transport**: Only autogen and temporal use gRPC internally. Most systems rely on HTTP+SSE.
- **Protocol Buffers**: Only autogen (CloudEvents proto), openai-agents-python (through MCP SDK), and temporal (full protobuf service definitions) use `.proto` files.
- **Metrics via OpenTelemetry**: Most OTel adopters export traces and logs but not metrics. Temporal and opa are exceptions.
- **Formal capability registry**: Beyond MCP's `listTools`, no system implements a registry or discovery mechanism like A2A Agent Cards.

## HelloSales — Improvement Recommendations

### Current State

HelloSales scores **5/10** — strong on observability (OTel Collector pipeline, Prometheus metrics, OpenAPI passive), weak on agent-protocol standards (no MCP, no A2A, no capability discovery, bespoke LLMProviderPort protocol).

### Quick Wins (Low Effort, High Impact)

1. **Expose MCP server layer** for agent tools. The existing `AgentToolCatalog` (`src/hello_sales_backend/platform/agents/tools.py:149-173`) already records tool definitions with JSON Schema. Wrapping this as an MCP server via `fastmcp` or `@modelcontextprotocol/sdk` would take days, not weeks. External agents (Claude Desktop, IDEs) could list and call HelloSales tools without custom adapters.

2. **Export OpenAPI spec as a committed file.** FastAPI auto-generates OpenAPI at `/openapi.json`. Commit this as `openapi.yaml` to the repo for API contract review and third-party client use. Hellosales already has the generation infrastructure — it just needs export.

3. **Add OTel metrics export** to the existing `PrometheusMetricsRuntime` (`src/hello_sales_backend/platform/observability/metrics.py:323-611`). OTel metrics (via `opentelemetry-api`) would enable the existing OTel Collector to export metrics alongside traces and logs, completing the observability standard stack.

4. **Publish structured MCP tool documentation** like openhands' `@mcp_server.tool()` decorator pattern. Add a MCP registration decorator that extracts descriptions from existing Pydantic models, making tool documentation consistent and automatically servable.

### Long-Term Improvements (High Effort, Architectural)

5. **Adopt MCP for bidirectional tool integration.** The current architecture has LLM→tool→action flow via `LLMProviderPort` + `AgentToolCatalog`. Adding an MCP server would expose tools externally; adding an MCP client would allow the agent system to consume external MCP servers. Model after mastra's dual MCP client+server (`packages/mcp/src/client/client.ts`, `packages/mcp/src/server/server.ts`).

6. **Implement A2A card-based agent discovery.** When multi-agent orchestration becomes a requirement, implement A2A Agent Cards (`packages/core/src/a2a/a2a-agent.ts:41-46` pattern from mastra). The card would advertise HelloSales agent capabilities, endpoints, and authentication requirements.

7. **Replace bespoke `OperationalEvent` with CloudEvents envelope.** The current event schema (`src/hello_sales_backend/platform/observability/events.py:8-18`) is custom Pydantic. Adding a CloudEvents-compliant envelope (`ce-specversion`, `ce-type`, `ce-source`, `ce-id`) enables routing through CloudEvents-capable buses (Knative, Eventarc, Google Cloud Events).

8. **Add gRPC transport option** for internal agent communication. As agent communication scales, HTTP+SSE may not suffice. Autogen's gRPC worker runtime (`autogen-ext/src/autogen_ext/runtimes/grpc/_worker_runtime.py:1-856`) and CloudEvents protobuf (`protos/cloudevent.proto:21-57`) provide a reference pattern.

9. **Schema contract testing with OpenAPI spec-first.** The current FastAPI auto-generation produces OpenAPI from code. Shift to spec-first for public agent endpoints: define `openapi.yaml`, validate against it in CI. This prevents breaking changes to public API clients.

### Risks (What Could Go Wrong If Not Addressed)

- **Agent ecosystem irrelevance**: If MCP continues its current trajectory (8 of 12 reference repos already adopt it), systems without MCP will be invisible to the growing ecosystem of MCP-native tools and agent frameworks. External consumers will use custom adapters or skip HelloSales entirely.

- **OperationalEvent lock-in**: Without a standard event schema, integrating with enterprise event buses (Kafka, EventBridge) requires event translation middleware. This adds latency and maintenance overhead with every new event consumer.

- **No capability discovery**: As the agent surface expands (more tools, workflows, data sources), the lack of dynamic capability discovery (MCP `listTools` or A2A Agent Cards) will require manual documentation and client updates.

- **Observability silo**: Without OTel metrics export, the existing Grafana dashboards can only show traces and logs, not the quantitative metrics (request rates, error rates, latency distributions) needed for SLO monitoring and cost attribution.

## Per-Repo Notes

**aider (2/10)**: CLI tool with litellm-based LLM abstraction. No MCP, no OTel, no composability. Custom `write_file`/`replace_lines` function schemas validated with Draft7Validator (`aider/coders/base_coder.py:533-538`). Deprecated coder classes left in tree.

**autogen (7/10)**: Comprehensive MCP client with three transports (`autogen-ext/src/autogen_ext/tools/mcp/`). Full OTel with GenAI semantic conventions. Custom gRPC AgentRpc service for internal communication (`protos/agent_worker.proto:127-134`). CloudEvents for event serialization. No A2A.

**guardrails (5/10)**: Strong OTel with OpenInference (`guardrails/telemetry/open_inference.py:49-163`). Custom RAIL XML format for validator specification (`guardrails/schema/rail_schema.py:338-402`). MCP and A2A dependencies exist but unused. No interface for agent-to-agent communication.

**langfuse (7/10)**: MCP server with Streamable HTTP transport (`web/src/features/mcp/server/transport.ts:65-69`). Dual OTel (internal telemetry + public ingestion API). Fern for API definition generating OpenAPI. MCP only exposes prompts, no client implementation.

**langgraph (5/10)**: MCP client via SDK runtime context (`libs/sdk-py/langgraph_sdk/runtime.py:106-120`). JSON Schema generation from Pydantic (`libs/langgraph/langgraph/pregel/main.py:992-1059`). Custom streaming protocol v1/v2. No OpenAPI, no server-side MCP. OpenTelemetry is dependency-only.

**mastra (8/10)**: MCP client+server with StreamableHTTP/SSE/Stdio (`packages/mcp/`). A2A client for external agent communication (`packages/core/src/a2a/a2a-agent.ts`). OpenAPI 3.1 generation (`packages/server/src/server/server-adapter/openapi-utils.ts:207-235`). Schema-compat package for Zod↔JSON Schema.

**nemo-guardrails (5/10)**: Strong OTel adapter with GenAI semantic conventions (`nemoguardrails/tracing/adapters/opentelemetry.py:76`). Custom Colang DSL for guardrail flows. No MCP or A2A. LangChain integration for chains. Limited transport (HTTP only).

**opa (4/10)**: OTel tracing + metrics with both gRPC and HTTP exporters (`internal/distributedtracing/distributedtracing.go:18-19`). Internal JSON Schema validator (draft-04/06/07). Custom REST API without OpenAPI. No MCP, A2A, or standardized protocol surface.

**openai-agents-python (7/10)**: Deep MCP client with three transports and lifecycle management (`src/agents/mcp/server.py:223-1667`). Strict JSON Schema enforcement (`src/agents/strict_schema.py:18-149`). Proprietary tracing to OpenAI endpoint. No A2A, no OpenAPI, no OTel SDK.

**opencode (8/10)**: MCP client+server+OAuth (`packages/opencode/src/mcp/index.ts:238-263`). OpenAPI 3.1 from Effect's HttpApi (`packages/opencode/src/server/server.ts:4`). OTel via `@effect/opentelemetry` (`packages/core/src/effect/observability.ts:70-96`). LLM provider abstraction. No A2A, gRPC.

**openhands (7/10)**: MCP server via FastMCP (`openhands/app_server/mcp/mcp_router.py:43`). OpenTelemetry with OTLP gRPC exporter (`pyproject.toml:63-64`), wrapped by Laminar. Auto-generated OpenAPI via FastAPI. WebSocket for real-time. No A2A, MCP client only in SDK.

**temporal (5/10)**: Full OTel with gRPC-exported traces/metrics (`temporal/fx.go:929-931`). gRPC+Protobuf internal communication. Nexus for external task dispatch (`common/nexus/nexusrpc/api.go`). No MCP/A2A. Bespoke orchestration protocol by design.

**hellosales (5/10)**: Production OTel Collector pipeline (`ops/observability/otel-collector/config.yaml:1-40`). Prometheus metrics with `hello_sales_*` prefix. JSON Schema via Pydantic (`src/hello_sales_backend/platform/agents/tools.py:49-80`). FastAPI auto-generates OpenAPI. No MCP, A2A, gRPC, WebSocket, or Protobuf. Bespoke LLMProviderPort + AgentToolCatalog.

## Open Questions

1. **A2A timeline**: When will A2A stabilize and see production adoption? Only mastra has any A2A support, and it is client-only. The langchain-protocol dependency in langgraph hints at future work but nothing concrete.

2. **MCP resource vs tool**: Most MCP implementers focus on tools (callable functions) and ignore resources (data sources) and prompts (templates). Is this because resources overlap with existing REST APIs, or because MCP's resource model is insufficient?

3. **gRPC vs HTTP for agent communication**: Autogen and temporal bet on gRPC. Everyone else uses HTTP+SSE. Is gRPC over-engineered for agent communication, or will high-throughput multi-agent systems need it?

4. **OpenTelemetry metrics adoption gap**: Why do so many systems (guardrails, hellosales, nemo-guardrails, opencode) export traces but not metrics? Is the OTel metrics API less mature, or is Prometheus's native format sufficient?

5. **JSON Schema version fragmentation**: Systems use draft-04 (opa), draft-07 (aider), draft 2020-12 (guardrails), and draft-07 via Zod (mastra, langfuse). Will the ecosystem converge on 2020-12?

## Evidence Index

All evidence references follow `path/to/file:NN` format. Below is a consolidated index of the most significant findings.

| Claim | Source Report | Primary Evidence |
|-------|--------------|------------------|
| MCP client with 3 transports | autogen | `autogen-ext/src/autogen_ext/tools/mcp/_stdio.py:18-74`, `_sse.py:18-116`, `_streamable_http.py:18-121` |
| MCP client+server+OAuth | opencode | `packages/opencode/src/mcp/index.ts:238-263`, `oauth-provider.ts:12` |
| MCP dual client+server | mastra | `packages/mcp/src/client/client.ts:10-14`, `packages/mcp/src/server/server.ts:21-24` |
| A2A external client | mastra | `packages/core/src/a2a/a2a-agent.ts:2` |
| FastMCP server | openhands | `openhands/app_server/mcp/mcp_router.py:43` |
| MCP stateless pattern | langfuse | `web/src/features/mcp/server/mcpServer.ts:30-31` |
| OTel Collector pipeline | hellosales | `ops/observability/otel-collector/config.yaml:1-40` |
| OTel GenAI conventions | nemo-guardrails | `nemoguardrails/tracing/constants.py:90-126` |
| OTel SDK initialization | opencode | `packages/core/src/effect/observability.ts:70-96` |
| OpenAPI 3.1 generation | mastra | `packages/server/src/server/server-adapter/openapi-utils.ts:207-235` |
| OpenAPI from Effect | opencode | `packages/opencode/src/server/server.ts:4` |
| Fern→OpenAPI pipeline | langfuse | `fern/apis/server/definition/api.yml:1-50` |
| JSON Schema normalization | hellosales | `src/hello_sales_backend/platform/agents/tools.py:49-80` |
| Strict JSON Schema enforcement | openai-agents-python | `src/agents/strict_schema.py:18-149` |
| Schema-compat package | mastra | `packages/schema-compat/src/zod-to-json.ts:1-30` |
| Custom gRPC agent protocol | autogen | `protos/agent_worker.proto:127-134` |
| CloudEvents proto | autogen | `protos/cloudevent.proto:21-57` |
| gRPC+Protobuf communication | temporal | `common/rpc/grpc.go:111` |
| Custom RAIL format | guardrails | `guardrails/schema/rail_schema.py:338-402` |
| Colang DSL | nemo-guardrails | `nemoguardrails/colang/` |
| Litellm LLM abstraction | aider | `aider/llm.py:21-47` |
| AgentToolCatalog | hellosales | `src/hello_sales_backend/platform/agents/tools.py:149-173` |
| Namespaced MCP proxy | openhands | `openhands/app_server/mcp/mcp_router.py:49-75` |
| Prometheus metrics | hellosales | `src/hello_sales_backend/platform/observability/metrics.py:323-611` |
| Feature module registry | langfuse | `web/src/features/mcp/server/registry.ts:72-190` |
| Deprecated coder classes | aider | `aider/coders/editblock_func_coder.py:61` |

---

Generated by `study-areas/19-open-standards.md`.
