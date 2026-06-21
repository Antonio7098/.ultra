# Repo Analysis: openai-agents-python

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | openai-agents-python |
| Path | `repos/openai-agents-python` |
| Language / Stack | Python 3.10+, OpenAI SDK, Pydantic |
| Analyzed | 2026-05-17 |

## Summary

The OpenAI Agents SDK reveals an architecture designed for **platform-team-to-feature-team separation**. The SDK itself is the platform layer (authored by OpenAI), and the consumer is expected to be an application team that configures agents, tools, and orchestration. The codebase is layered into core (`src/agents/`), optional extensions (`src/agents/extensions/`), and examples, with a provider model that decouples LLM backends, sandbox infrastructure, tracing, and session storage. The design assumes at minimum a team that can configure LLM providers and write agent code, and scales up to organizations with separate platform/infra and agent-building teams.

## Rating

**7** — Clear separation of concerns with role-appropriate interfaces. Platform teams and feature teams could work together with well-defined boundaries, though some areas require shared context.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Expected team structure | SDK documented as "lightweight framework for building multi-agent workflows" — 3 tiers: SDK authors, app developers, infra engineers | `README.md:1-3` |
| Model provider interface | `ModelProvider` ABC that any team can implement for custom LLM backends | `src/agents/models/interface.py:127-150` |
| Multi-provider routing | `MultiProvider` maps model name prefixes (openai/, litellm/, any-llm/) to providers — platform team configures once | `src/agents/models/multi_provider.py:61-73` |
| Extension model providers | LiteLLM and AnyLLM implementations in `extensions/models/` — loaded on demand only when prefix is used | `src/agents/extensions/models/litellm_provider.py` and `any_llm_provider.py` |
| Extension sandbox providers | 8 sandbox backends in `extensions/sandbox/` (Daytona, E2B, Modal, RunLoop, Vercel, Blaxel, Cloudflare, etc.) — optional dependencies | `src/agents/extensions/sandbox/` directory |
| Optional dependency pattern | Each extension is a `[project.optional-dependencies]` group — feature teams opt in to what they need | `pyproject.toml:37-60` |
| Agent lifecycle hooks | `RunHooks` and `AgentHooks` for observation — operations team can monitor without modifying agent code | `src/agents/lifecycle.py:13-199` |
| Tracing processor interface | `TracingProcessor` ABC — anyone can plug custom observability | `src/agents/tracing/processor_interface.py:9-130` |
| Default trace provider | `DefaultTraceProvider` with `SynchronousMultiTracingProcessor` — central pipeline, multiple processors | `src/agents/tracing/provider.py:78-171` |
| Session storage abstraction | `SessionABC` — custom session stores (SQLite included, Redis optional) | `src/agents/memory/session.py` |
| Guardrail system | `InputGuardrail` and `OutputGuardrail` — governance boundary enforced at runtime | `src/agents/guardrail.py:72-185` |
| Tool guardrails | `ToolInputGuardrail` and `ToolOutputGuardrail` — tool-level governance | `src/agents/tool_guardrails.py` |
| Human-in-the-loop approval | Tool-level `needs_approval` flag — separates approval decision from tool logic | `src/agents/agent.py:525-526` |
| Orchestration documentation | Explicit docs on LLM-vs-code orchestration — acknowledges different org maturity levels | `docs/multi_agent.md:1-40` |
| Sandbox agent abstraction | `SandboxAgent` delegates infra choices to `RunConfig` — platform team controls sandbox, agent team writes agents | `src/agents/sandbox/sandbox_agent.py:15-20` |
| RunConfig as platform boundary | All cross-cutting concerns (model, provider, tracing, guardrails, sandbox) set in `RunConfig` — separates agent definition from runtime configuration | `src/agents/run_config.py:203-322` |
| Agent as tool pattern | `Agent.as_tool()` — enables nested agent hierarchies with independent ownership | `src/agents/agent.py:508-936` |
| Workflow patterns documented | Deterministic chains, handoffs/routing, parallelization, LLM-as-judge — each maps to an org pattern | `examples/agent_patterns/README.md:1-62` |
| Durable execution integrations | Dapr, Temporal, Restate, DBOS — for orgs needing run reliability across process restarts | `docs/running_agents.md:504-523` |
| Public API surface | `__init__.py` explicitly lists all public exports via `__all__` — clear API contract | `src/agents/__init__.py:322-549` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

The architecture assumes a **three-tier team structure**:

1. **SDK platform team** (OpenAI) — maintains `src/agents/`, defines interfaces (`ModelProvider`, `TracingProcessor`, `SessionABC`), ships the core runtime (`Runner`, `Agent`, `RunConfig`). Evidence: `src/agents/models/interface.py:37-150` defines the abstract interfaces; `src/agents/run.py:195-431` defines the `Runner` class.

2. **Platform/infra team** (adopting org) — configures `ModelProvider` (e.g., `MultiProvider` at `src/agents/models/multi_provider.py:61`), sets up tracing processors (`src/agents/tracing/processor_interface.py:9`), manages sandbox infrastructure (via `SandboxRunConfig` at `src/agents/run_config.py:170`), and defines global guardrails (`src/agents/run_config.py:242-246`).

3. **Agent/feature team** (adopting org) — writes agent definitions (`Agent` instances), creates function tools, defines handoffs, writes prompts, and implements business logic. Evidence: `examples/agent_patterns/routing.py:15-34` shows feature teams defining specialized agents without touching infrastructure.

### 2. Is the system self-serve or platform-managed?

**Both.** The architecture supports a spectrum:

- **Self-serve**: A single developer can write agents without any platform setup — just `pip install openai-agents` and set `OPENAI_API_KEY`. Evidence: `README.md:24-35` shows getting started with just pip install.

- **Platform-managed**: Organizations can layer on platform controls via `RunConfig` — set global model provider, tracing, guardrails, sandbox config. Evidence: `docs/running_agents.md:122-160` documents `RunConfig` as the per-run platform configuration point.

The `RunConfig` pattern (`src/agents/run_config.py:203-322`) is the key enabler: it allows a platform team to define defaults (model, provider, guardrails, tracing) while individual agent calls can still override.

### 3. How is ownership divided between platform and feature teams?

The division is layered:

| Ownership area | Platform team | Feature team |
|---|---|---|
| LLM provider configuration | `ModelProvider` setup, `MultiProvider` routing | Model name selection per agent |
| Tool implementation | Infrastructure tools (MCP, sandbox, shell) | Business logic tools (function tools) |
| Guardrails | Global input/output guardrails via `RunConfig` | Agent-specific guardrails |
| Observability | Tracing processors, export pipeline | Hooks for agent-level monitoring |
| Sandbox/infra | Sandbox client, manifest defaults, capabilities | Agent instructions and workspace entries |
| Session persistence | Session store (SQLite, Redis, custom) | Session IDs per conversation |

Evidence: `src/agents/run_config.py:203-322` collects platform concerns; `src/agents/agent.py:270-977` collects agent concerns. The separation is clean: an agent definition (`Agent`) contains no infrastructure configuration; `RunConfig` is passed at run time.

### 4. What operational expertise is required?

Three levels of expertise are required:

1. **Basic usage** (self-serve): Python knowledge, API key management. No infra expertise needed.

2. **Platform configuration**: Understanding of LLM providers, tracing backends, sandbox infrastructure (Docker, cloud VMs), session stores (SQLite, Redis, PostgreSQL via SQLAlchemy). Evidence: `pyproject.toml:37-60` shows 20+ optional dependency groups for different operational backends.

3. **Extension development**: Deep Python/async knowledge, understanding of the `Model`, `ModelProvider`, `TracingProcessor`, `SessionABC`, and `BaseSandboxClient` interfaces.

Operational knowledge required includes:
- Python async/await patterns (`src/agents/run.py` is entirely async)
- OpenAI API (Responses or Chat Completions)
- Optional: Docker, MCP protocol, websocket transport, durable execution frameworks (Dapr, Temporal)

### 5. How is governance enforced organizationally?

Governance is enforced through **multiple composable mechanisms**:

1. **Guardrails** — `InputGuardrail` and `OutputGuardrail` at `src/agents/guardrail.py:72-185`. Input guardrails run before LLM invocation; output guardrails run after final output. Tripwire mechanism halts execution immediately.

2. **Tool-level approval** — `needs_approval` flag on tools (`src/agents/agent.py:525-526`). Enables human-in-the-loop for sensitive operations.

3. **Tool guardrails** — `ToolInputGuardrail` and `ToolOutputGuardrail` (`src/agents/tool_guardrails.py`). Validate tool inputs and outputs at runtime.

4. **Lifecycle hooks** — `RunHooks` and `AgentHooks` (`src/agents/lifecycle.py:13-199`). Allow monitoring/auditing of all agent events (LLM calls, tool invocations, handoffs).

5. **Run-level error handlers** — `RunErrorHandlers` (`src/agents/run_error_handlers.py`). Governance of failure modes (max turns exceeded, model refusal).

6. **Tracing** — `TracingProcessor` abstraction at `src/agents/tracing/processor_interface.py:9-130`. Enables audit trails.

Notably, there is **no built-in RBAC or team-level access control** — governance is code-level (guardrails, approvals, hooks) rather than organizational (role-based). Organizations must layer their own auth/authz on top.

### 6. What is the assumed scale of the team?

The architecture supports teams from **1 developer to enterprise platform teams**:

- **Minimum viable team**: 1 developer. Self-serve model requires only Python and an API key. Evidence: `README.md:28-35` shows single-command setup.

- **Small team (2-5)**: One person configures providers/infra, others build agents. Evidence: the `RunConfig`/`Agent` split lets these roles work in different files.

- **Large org (10+)**: Platform team manages `ModelProvider`, `TracingProcessor`, sandbox infrastructure, and global guardrails. Feature teams independently build agents. Evidence: `docs/multi_agent.md:3-40` acknowledges LLM-vs-code orchestration as an organizational choice.

The `examples/agent_patterns/README.md` demonstrates the architectural patterns (deterministic chains, handoffs, parallelization, LLM-as-judge) that map to team structures — e.g., handoffs map to specialist sub-teams, parallelization maps to independent work streams.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, clearly.** The distinction is evidenced throughout:

- **Platform dev** works with: `src/agents/run_config.py` (RunConfig), `src/agents/models/interface.py` (ModelProvider), `src/agents/tracing/processor_interface.py` (TracingProcessor), `src/agents/memory/session.py` (SessionABC), `src/agents/sandbox/` (sandbox infrastructure). These are abstract interfaces and configuration.

- **App dev** works with: `src/agents/agent.py` (Agent), `src/agents/tool.py` (FunctionTool, function_tool), `src/agents/handoffs/__init__.py` (handoff), `src/agents/guardrail.py` (input_guardrail, output_guardrail). These are concrete, composable primitives.

The two layers communicate through well-defined contracts: `Agent` references `Model`/`Tool` by name/type, `RunConfig` wires providers and tracing at run time. An app dev never needs to implement `ModelProvider` or `TracingProcessor` directly.

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| Provider pattern for models | Decouples agent code from LLM backend; enables multi-provider routing | `src/agents/models/interface.py:127-150` |
| RunConfig as cross-cutting concern bag | Separates agent definition from runtime environment; platform team controls one config object | `src/agents/run_config.py:203-322` |
| Optional dependency groups | Each extension is opt-in; reduces dependency burden for orgs that don't need every backend | `pyproject.toml:37-60` |
| Generic context type (TContext) | App devs pass arbitrary state through the run; no framework-imposed context schema | `src/agents/run_context.py` |
| Agent as tool vs handoff | Two delegation patterns for different ownership models | `docs/multi_agent.md:24-29` |
| `Runner` as singleton with `AgentRunner` pluggability | Default runner is adequate for most orgs; advanced orgs can replace it | `src/agents/run.py:126-165` |
| Tracing on by default | Observability is a first-class concern, not an afterthought | `src/agents/tracing/provider.py:252-447` |
| Sandbox config at runtime, not on agent | Platform team controls sandbox infrastructure without touching agent code | `src/agents/sandbox/sandbox_agent.py:15-20` |

## Notable Patterns

1. **Interface-based extensibility**: `Model`, `ModelProvider`, `TracingProcessor`, `SessionABC`, `BaseSandboxClient` — all abstract interfaces that orgs can implement independently of the core framework.

2. **Lazy/delayed provider resolution**: Model providers (`OpenAIProvider._get_client()` at `src/agents/models/openai_provider.py:126-127`) create clients lazily, so orgs without an API key can import the SDK without errors.

3. **Nested delegation with ownership boundaries**: `Agent.as_tool()` (`src/agents/agent.py:508-936`) creates a FunctionTool that runs a sub-agent with its own context, run config, and approval state — effectively a sub-org within the agent hierarchy.

4. **Dependency injection through `RunConfig`**: All cross-cutting concerns are injected at run time rather than baked into agent definitions, enabling platform teams to change infrastructure without touching agent code.

5. **Pattern library for org maturity**: `examples/agent_patterns/` documents deterministic chains, routing, parallelization, LLM-as-judge — each pattern corresponds to increasing org sophistication.

## Tradeoffs

1. **OpenAI-centric by default**: The `MultiProvider` defaults to OpenAI (`src/agents/models/multi_provider.py:61`). Non-OpenAI backends require additional setup and may lack feature parity (e.g., server-managed conversations only work with OpenAI).

2. **No built-in RBAC/authz**: Governance is code-level (guardrails, approvals) rather than organizational (roles, teams). Organizations needing multi-tenant access control must build their own layer.

3. **Async-first adds operational complexity**: The entire runtime is async (`src/agents/run.py:197`). Teams without async Python expertise face a learning curve.

4. **Sandbox complexity requires platform investment**: Sandbox agents (`src/agents/sandbox/` with 25+ files) require significant infra setup. A dedicated platform team is needed for production sandbox usage.

5. **Extension discovery is manual**: Extensions in `src/agents/extensions/` are not auto-discovered; teams must know about them and install the optional dependency. No plugin registry exists.

## Failure Modes / Edge Cases

1. **Provider mismatch**: A team configures agents for OpenAI Responses API but the platform team switches to a non-OpenAI provider — features like `conversation_id` break silently. Evidence: `docs/running_agents.md:252-254` warns about mixing strategies.

2. **Token/context window governance**: No built-in token budget management. Agent teams can exhaust context windows without platform-team visibility. `call_model_input_filter` (`src/agents/run_config.py:289`) is the mitigation hook but requires manual implementation.

3. **Escalation ambiguity**: With `Agent.as_tool()` and handoffs, the ownership tree can grow deep. There's no built-in mechanism for a parent agent to override or audit a deeply nested sub-agent.

4. **Responsibility gaps**: Guardrails are per-agent (`src/agents/agent.py:322-329`). If a team forgets to add guardrails to a new agent, there's no global enforcement mechanism beyond `RunConfig.input_guardrails`.

5. **Shared mutable state**: `TContext` is a mutable object passed through all tools, handoffs, and hooks. Competing agents or tools could mutate shared state unexpectedly.

## Future Considerations

1. **Plugin registry** for auto-discovering extensions rather than manual import and optional dependency management.

2. **Built-in RBAC/team management** that maps to the platform/feature team model already expressed in the architecture.

3. **Token/context budget management** at the `RunConfig` level, giving platform teams control over LLM costs.

4. **Cross-agent audit trails** that trace decisions through nested agent-as-tool and handoff chains, supporting org compliance requirements.

5. **Declarative agent configuration** that separates agent definitions from code (building on the `Prompt` system at `src/agents/agent.py:299-300`).

## Questions / Gaps

1. How does an org enforce that all agents use approved LLM providers? The `MultiProvider` can restrict, but agents can set arbitrary `model` strings (`src/agents/agent.py:311`).

2. How does a platform team enforce global guardrail policies across all agents in an org? `RunConfig.input_guardrails` exists but is per-call, not organization-wide.

3. Is there a recommended way to share agent definitions across teams? No package/release mechanism is documented beyond publishing as a Python package.

4. No clear evidence found for deployment responsibility boundaries — the SDK documents deployment integrations (Dapr, Temporal, Restate, DBOS) but does not prescribe who in the org manages them.

---

Generated by `study-areas/22-organizational-architecture.md` against `openai-agents-python`.
