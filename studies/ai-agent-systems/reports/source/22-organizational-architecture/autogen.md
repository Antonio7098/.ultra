# Repo Analysis: autogen

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | autogen |
| Path | `repos/autogen` |
| Language / Stack | Python 3.10+, .NET 8.0/9.0 |
| Analyzed | 2026-05-17 |

## Summary

AutoGen is a Microsoft Research-originated multi-agent AI framework now in maintenance mode. The repo reveals a **three-tier platform engineering model**: a core runtime layer (`autogen-core`) provides foundational abstractions (agents, messaging, subscriptions, serialization) that a higher-level agents-and-teams layer (`autogen-agentchat`) builds on, while an extensions layer (`autogen-ext`) provides ecosystem integrations (model providers, tools, code executors). A separate no-code GUI (`autogen-studio`) and CLI tool (`magentic-one-cli`) sit as developer tools. The .NET sub-project mirrors this architecture with its own `Microsoft.AutoGen.*` NuGet packages. The entire monorepo is managed as a `uv` workspace with `poe` task runner, cookiecutter templates for new packages, and a component configuration system that allows declarative assembly of agents from config files.

## Rating

**7** — Clear separation of concerns with role-appropriate interfaces. A platform team could maintain the core runtime and extensions independently from feature teams building agents, though the maintenance-mode status and single-package-per-release process limit self-serve capabilities.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Layered package architecture | Three explicit layers: Core API, AgentChat API, Extensions API | `README.md:181-183` |
| Package dependency chain | `autogen-agentchat` depends on `autogen-core==0.7.5` | `python/packages/autogen-agentchat/pyproject.toml:18` |
| Extension dependency chain | `autogen-ext` depends on `autogen-core==0.7.5` | `python/packages/autogen-ext/pyproject.toml:18` |
| UV workspace management | All Python packages managed as single workspace | `python/pyproject.toml:47-49` |
| Component config system | Declarative provider-based instantiation with well-known providers | `python/packages/autogen-core/src/autogen_core/_component_config.py:18-41` |
| Trusted provider namespaces | Whitelist of namespaces for config-safe loading | `python/packages/autogen-core/src/autogen_core/_component_config.py:55-62` |
| Agent runtime protocol | `AgentRuntime` protocol defines send/publish/subscribe lifecycle | `python/packages/autogen-core/src/autogen_core/_agent_runtime.py:21-295` |
| Single-threaded runtime | In-process `SingleThreadedAgentRuntime` for dev/standalone | `python/packages/autogen-core/src/autogen_core/_single_threaded_agent_runtime.py:149-269` |
| Agent protocol definition | `Agent` protocol with `on_message`, `save_state`, `load_state`, `close` | `python/packages/autogen-core/src/autogen_core/_agent.py:13-64` |
| Pre-built agent types | `AssistantAgent`, `CodeExecutorAgent`, `SocietyOfMindAgent`, `UserProxyAgent`, `MessageFilterAgent` | `python/packages/autogen-agentchat/src/autogen_agentchat/agents/__init__.py:6-11` |
| Team orchestration types | `RoundRobinGroupChat`, `SelectorGroupChat`, `Swarm`, `MagenticOneGroupChat` | `python/packages/autogen-agentchat/src/autogen_agentchat/teams/__init__.py:14-17` |
| Model client abstraction | `ChatCompletionClient` in core models module | `python/packages/autogen-core/src/autogen_core/models/_model_client.py` |
| Model provider implementations | OpenAI, Azure, Anthropic, Ollama, Gemini, llama.cpp, Semantic Kernel | `python/packages/autogen-ext/src/autogen_ext/models/` |
| gRPC runtime for distributed | Cross-language runtime via protobuf/gRPC | `python/packages/autogen-ext/src/autogen_ext/runtimes/grpc/` |
| Cross-language support | gRPC protos for .NET/Python interop; `.NET` sub-project with `Microsoft.AutoGen.*` packages | `protos/`, `dotnet/src/Microsoft.AutoGen/` |
| .NET parallel structure | `AutoGen.Core`, `AutoGen.OpenAI`, `AutoGen.Gemini` etc. mirror Python extensions | `dotnet/src/AutoGen.Core/`, `dotnet/src/` |
| Deployment: PyPI | `single-python-package.yml` allows manual tag-based deploy of any package | `.github/workflows/single-python-package.yml:1-44` |
| Deployment: NuGet | `dotnet-release.yml` pushes to NuGet on release/dotnet/* branches | `.github/workflows/dotnet-release.yml:1-77` |
| Deployment: Docker | `autogen-studio` has Dockerfile for gunicorn/uvicorn ASGI | `python/packages/autogen-studio/Dockerfile:1-17` |
| CI matrix across packages | Tests run per package: autogen-core, autogen-ext, autogen-agentchat | `.github/workflows/checks.yml:127-133` |
| Code quality tooling | `ruff`, `mypy`, `pyright`, `pytest` with coverage | `python/pyproject.toml:61-103` |
| New package template | cookiecutter template for scaffolding new packages | `python/README.md:219-221` |
| Triage process | Weekly triage with labels, `proj-*` per-project labels, async response tracking | `CONTRIBUTING.md:57-83` |
| Governance | Microsoft CLA, Microsoft Code of Conduct, MSRC for security | `CONTRIBUTING.md:13-25`, `SECURITY.md:1-41` |
| Maintenance mode | Explicitly in maintenance mode; recommends Microsoft Agent Framework | `README.md:18-25` |
| CLI for Studio | `autogenstudio ui` and `autogenstudio serve` commands | `python/packages/autogen-studio/autogenstudio/cli.py:25-122` |
| Telemetry integration | OpenTelemetry tracing through core runtime | `python/packages/autogen-core/src/autogen_core/_telemetry/` |
| OpenTelemetry dependency | `opentelemetry-api>=1.34.1` in core deps | `python/packages/autogen-core/pyproject.toml:22` |
| Intervention handlers | Middleware-like interceptors for send/publish/response | `python/packages/autogen-core/src/autogen_core/_single_threaded_agent_runtime.py:691-791` |
| State save/restore | Both agent-level and runtime-level state persistence | `python/packages/autogen-core/src/autogen_core/_agent_runtime.py:217-266` |

## Answers to Protocol Questions

**1. What team structure does this architecture assume?**

The architecture assumes a **platform team + multiple feature/application teams** structure. The layered package design (`autogen-core` → `autogen-agentchat` → `autogen-ext`) mirrors organizational layers: a platform team owns the core runtime and messaging substrate, while application teams build agents and teams on top. The extension system (`autogen-ext`) allows third-party teams to provide model providers, tools, and code executors without modifying core code. Evidence: `README.md:181-183` explicitly documents the three-layer design, and `python/packages/autogen-core/pyproject.toml:9` describes core as "Foundational interfaces and agent runtime."

**2. Is the system self-serve or platform-managed?**

**Both.** The component configuration system (`_component_config.py:18-41`) makes the system self-serve for teams that want to declare agents via config. The `ComponentModel` with `provider`, `config`, and `component_type` fields allows declarative instantiation. The trusted provider namespaces (`_component_config.py:55-62`) gate what providers can be loaded—this is a platform-team control. Additionally, the release workflow (`single-python-package.yml`) is manually triggered per-package, meaning the platform team controls what versions ship.

**3. How is ownership divided between platform and feature teams?**

Ownership is divided by package boundary:
- **Platform team** owns `autogen-core` (runtime, messaging, serialization, component config) and shared tooling (uv workspace, CI, code quality). Evidence: `python/packages/autogen-core/pyproject.toml:9`.
- **Feature/app teams** own agents and teams built with `autogen-agentchat`. Evidence: `python/packages/autogen-agentchat/pyproject.toml:9`.
- **Integration teams** own `autogen-ext` for provider-specific implementations. Evidence: `python/packages/autogen-ext/pyproject.toml:9` describes it as "extensions library."
- **.NET team** operates as a parallel platform team. Evidence: `dotnet/src/Microsoft.AutoGen/` contains its own `Contracts/`, `Core/`, `Core.Grpc/`, `RuntimeGateway.Grpc/`.
- Package versions are all locked together (`CONTRIBUTING.md:41`), suggesting centralized release coordination.

**4. What operational expertise is required?**

- **Python developers** for agent development (standard Python 3.10+)
- **OpenTelemetry** knowledge for observability (`pyproject.toml:22`)
- **gRPC/protobuf** for cross-language or distributed deployments (`pyproject.toml:131-133`)
- **Docker** for deploying `autogen-studio` (`Dockerfile:1-17`)
- **.NET 8/9** developers for the .NET ecosystem (`dotnet-build.yml:79-86`)
- **Cloud infrastructure** for Azure OpenAI, OpenAI API access, or other model providers
- **uv/poe** familiarity for local development

**5. How is governance enforced organizationally?**

- **Code quality gates**: `ruff`, `mypy`, `pyright` run per-package in CI (`checks.yml`)
- **Per-package test matrices**: core, ext, agentchat all tested independently (`checks.yml:127-133`)
- **Proto change enforcement**: CI checks for uncommitted proto changes (`checks.yml:335-358`)
- **Security**: Microsoft MSRC process for vulnerabilities (`SECURITY.md:11-14`)
- **Contributor license**: Microsoft CLA required for all contributions (`CONTRIBUTING.md:13-15`)
- **Release control**: Manual workflow dispatch for PyPI; branch-based for NuGet (`single-python-package.yml`, `dotnet-release.yml`)
- **Triage process**: Weekly with label taxonomy (`proj-*`, `dotnet`, `x-lang`) (`CONTRIBUTING.md:57-83`)

**6. What is the assumed scale of the team?**

The architecture assumes **multiple teams of moderate size** (5-15 engineers each). Evidence:
- Separate Python and .NET teams implied by parallel package structures
- Weekly triage rotation suggests at least 3-5 committers
- per-package CI matrix suggests ownership distributed across at least 3 groups (core, agentchat, ext)
- NuGet + PyPI + Docker three-channel release process requires release engineering support

**7. Does the architecture distinguish app dev vs platform dev?**

**Yes, strongly.** The three-layer architecture is the primary mechanism:
- **Platform devs** work in `autogen-core` on `AgentRuntime`, `Agent`, `Subscription`, `ComponentConfig`, `MessageSerializer` — these are protocol/interface-level concerns.
- **App devs** work in `autogen-agentchat` composing `AssistantAgent`, `RoundRobinGroupChat`, `Swarm` — these are high-level primitives.
- The component config system (`_component_config.py`) allows app devs to assemble agents declaratively (config-driven) without touching runtime code.
- The extension system (`autogen-ext`) creates a third role: **integration devs** who implement model clients, tool backends, and code executors against the core interfaces.
- The .NET project mirrors this split: `Microsoft.AutoGen.Contracts` (platform) vs `Microsoft.AutoGen.Core` (app-facing).

## Architectural Decisions

| Decision | Evidence | Rationale |
|----------|----------|-----------|
| Monorepo with uv workspace | `python/pyproject.toml:47-49` | Single version lockstep across all packages |
| Protocol-based agent interface | `_agent.py:13-64` | Enables multiple runtime implementations (single-threaded, gRPC distributed) |
| Publish-subscribe messaging model | `docs/design/01 - Programming Model.md:5-6` | Decouples agent communication; enables dynamic subscription |
| Component config system with trusted namespaces | `_component_config.py:55-62` | Allows config-driven assembly while preventing arbitrary code execution |
| CloudEvents-compliant events | `docs/design/01 - Programming Model.md:9-14` | Cross-language/interop standard |
| gRPC for cross-language runtime | `dotnet-build.yml`, `protos/` | Enables .NET agents to communicate with Python agents |
| OpenTelemetry for observability | `pyproject.toml:22`, `_telemetry/` | Vendor-neutral tracing, aligns with cloud-native observability |
| Manual package release workflow | `single-python-package.yml:4-5` | Controlled releases per package; safety over speed |
| Cookiecutter for new packages | `python/README.md:219-221` | Standardizes scaffolding, lowers barrier for new package creation |

## Notable Patterns

- **Layered dependency inversion**: `autogen-core` has no knowledge of `autogen-agentchat` or `autogen-ext`. All higher-layer packages depend on core, never vice versa.
- **Provider pattern for extensions**: Model clients, tools, and code executors all follow a `Component[...Config]` pattern, making them swappable at config time.
- **Intervention handler chain**: The runtime supports middleware-style hooks on send/publish/response (`_single_threaded_agent_runtime.py:691-791`), enabling cross-cutting concerns (logging, auth, rate-limiting) without modifying agent code.
- **Dual-language ecosystem**: Python and .NET are treated as peer runtimes sharing protobuf-defined protocols, not as primary/secondary.
- **Config-as-code boundary**: The `ComponentModel` approach (`_component_config.py:18-41`) bridges platform (code) and app (config) concerns.
- **Dev tooling as separate packages**: AutoGen Studio and AutoGen Bench ship as their own packages, not embedded in core.

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| Monorepo coordination cost vs integrated releases | All Python packages share a version, meaning a bugfix in `autogen-ext` requires a coordinated release of all packages. See `CONTRIBUTING.md:41`. |
| Protocol-based runtime vs concrete implementation | The `AgentRuntime` protocol enables multiple backends but adds indirection; the single-threaded runtime is simple but explicitly not for production (`_single_threaded_agent_runtime.py:156-157`). |
| Config-driven assembly vs type safety | `ComponentModel` allows YAML/JSON config but bypasses static type checking at assembly time; providers are resolved at runtime by string lookup (`_component_config.py:43-44`). |
| Trusted namespace security vs extensibility | The provider whitelist (`_component_config.py:55-62`) prevents malicious configs but requires platform team to add new namespaces via `AUTOGEN_ALLOWED_PROVIDER_NAMESPACES`. |
| Manual release vs automated CD | The `workflow_dispatch` trigger on `single-python-package.yml` gives control but requires human in loop for every PyPI publish. |

## Failure Modes / Edge Cases

- **Package version drift**: Since all packages share a version (`CONTRIBUTING.md:41`), a hotfix for one package forces version bumps on all — could lead to unnecessary downstream churn.
- **Runtime state serialization gap**: `save_state` explicitly does NOT save subscriptions (`_single_threaded_agent_runtime.py:438`), meaning state restore is incomplete.
- **Single-threaded runtime bottleneck**: Explicitly documented as unsuitable for production workloads (`_single_threaded_agent_runtime.py:156-157`), but new users may miss this and use it in production.
- **gRPC runtime maturity**: Only gRPC-based distributed runtime exists (`autogen_ext/runtimes/grpc/`); no HTTP/REST transport documented as alternative.
- **Maintenance mode risk**: No new features or enhancements per `README.md:18-25`. Community-managed going forward. Existing issues may not be addressed.

## Future Considerations

- The migration to Microsoft Agent Framework (`README.md:18-25`) signals that organizational ownership has already shifted — the repo is maintained for compatibility, not growth.
- The cookiecutter template system (`python/README.md:219-221`) is well-positioned for third-party extension development but is underutilized while in maintenance mode.
- The `.NET` + gRPC cross-language story is architecturally sound but the community management model may limit its adoption.

## Questions / Gaps

- No clear evidence of RBAC or team-structured authorization in the runtime. The `InterventionHandler` could support it but no built-in implementation is provided.
- The docs directory (`docs/design/`) contains design documents but they are sparse and incomplete (e.g., "Insert other types here" in `docs/design/01 - Programming Model.md:29`).
- No evidence of multi-tenancy support or namespace isolation beyond `AgentId` key separation.
- No deployment manifests (Kubernetes, Helm, etc.) found for production deployment guidance.
- The .NET `AutoGen.Core` and `Microsoft.AutoGen.*` package relationship vs the Python packages is not explicitly documented as a cross-language platform boundary.

---
Generated by `22-organizational-architecture.md` against `autogen`.
