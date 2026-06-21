# Repo Analysis: OPA

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | Open Policy Agent (OPA) |
| Path | `repos/opa` |
| Language / Stack | Go |
| Analyzed | 2026-05-17 |

## Summary

OPA is a CNCF-graduated project with a mature multi-vendor governance model that assumes a platform-team + feature-team organizational split. The architecture encodes clear ownership boundaries: platform/infra teams own OPA deployment and runtime infrastructure, while feature/domain teams own Rego policy content. A plugin system, bundle distribution, discovery API, and Go SDK enable independent operation by different teams.

## Rating

**Score: 9** — OPA is explicitly designed for platform teams with clear ownership boundaries and self-serve capabilities. The governance model prevents single-vendor capture. The plugin system, bundle management, discovery service, and SDK enable feature teams to operate independently from the platform team.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Multi-vendor governance | Organizational voting — one vote per company, not per maintainer | `GOVERNANCE.md:9-18` |
| Maintainer structure | Maintainers from Apple, Google, Microsoft with defined areas of expertise | `MAINTAINERS.md:5-16` |
| Maintainer renewal | Status expires after 1 year, self-renewal within 1 month of expiry | `GOVERNANCE.md:47-48` |
| Code review policy | PRs require approval from at least one member with area-of-expertise | `GOVERNANCE.md:32-33` |
| New maintainer election | 2/3 majority of organizations with that area of expertise | `GOVERNANCE.md:43-44` |
| Plugin system | `Factory` interface with Validate/New lifecycle, keyed by name | `plugins/plugins.go:74-87` |
| Plugin registration | `runtime.RegisterPlugin` for third-party plugin integration | `runtime/runtime.go:14-20` |
| Bundle distribution | Pull-based bundle loading via HTTP/disk with signing/verification | `plugins/bundle/plugin.go:17-23` |
| Bundle signing | JWT-based bundle signature verification with pluggable verifiers | `bundle/verify.go:12-22` |
| Bundle config | Multiple named bundle sources supported | `plugins/bundle/config.go:36-43` |
| Discovery service | Dynamic reconfiguration via discovery bundles | `plugins/discovery/discovery.go:20-23` |
| Decision logging | Pluggable decision log upload to remote HTTP endpoints | `plugins/logs/plugin.go` |
| Status reporting | Periodic status updates to remote endpoints with Prometheus metrics | `plugins/status/plugin.go:13-14` |
| Trigger modes | Periodic, Immediate, and Manual trigger modes for plugins | `plugins/plugins.go:119-131` |
| REST API surface | Full CRUD for policies, data, queries, config, status, health | `server/server.go:32-44` |
| AuthN/AuthZ schemes | Token, TLS, and basic auth; off by default | `server/server.go:15-30` |
| Go SDK | Embedded OPA instance for Go services | `sdk/opa.go:14-37` |
| WASM compilation | Policy compilation to WASM for non-Go environments | `cmd/features.go:10` |
| CLI surface | 13 subcommands: run, build, eval, test, check, fmt, exec, etc. | `cmd/commands.go:35-52` |
| Hooks system | Pluggable hooks for config inspection/rewriting at runtime | `hooks/hooks.go:11-46` |
| Capabilities versioning | 141 historical capability JSON files embedded for backwards compatibility | `capabilities/capabilities.go:1-16` |
| Storage abstraction | `Store` interface with in-mem + disk implementations | `storage/interface.go:15-17` |
| Docker deployment | Multi-arch, non-root user, static/dynamic variants, debug images | `Dockerfile:1-28` |
| CNCF graduated project | CNCF graduated project badge | `README.md:7` |
| Production adopters | 40+ organizations publicly listed | `ADOPTERS.md:1-310` |
| CI integration testing | Cross-repo tests with Gatekeeper, Regal, OCP, Envoy | `.github/workflows/test-gatekeeper-with-opa.yaml` |
| Bundle status lifecycle | Discovery -> Bundle -> Status before execution; Decision Logs after | `cmd/exec.go:47-50` |

## Answers to Protocol Questions

1. **What team structure does this architecture assume?**
   A platform/infra team manages OPA infrastructure (servers, bundles, discovery, status); feature/domain teams author and own policies in Rego. This is evidenced by the separation between OPA runtime configuration (`runtime/runtime.go`, `config/config.go`, `plugins/plugins.go`) and policy content (Rego files, bundles). The bundle system (`plugins/bundle/`) and REST API (`server/server.go`) are the interfaces between these two groups.

2. **Is the system self-serve or platform-managed?**
   Both. The plugin system with `runtime.RegisterPlugin` (`runtime/runtime.go:14-20`) and the Go SDK (`sdk/opa.go`) enable self-serve integration for development teams embedding OPA. The bundle distribution and discovery service (`plugins/discovery/discovery.go:20-23`) allow a platform team to centrally manage policy distribution. The `exec` command (`cmd/exec.go:47-50`) explicitly documents the lifecycle: Discovery -> Bundle -> Status -> Decision Logs.

3. **How is ownership divided between platform and feature teams?**
   Platform team owns: OPA binary/Docker deployment, runtime configuration, service discovery, bundle distribution infrastructure, status reporting, and decision log infrastructure. Feature team owns: Rego policy content, policy testing (`cmd/test.go`), schema definitions, and input data formats. The bundle signing mechanism (`bundle/verify.go`) enforces supply chain integrity — feature teams can sign bundles, platform teams verify before loading.

4. **What operational expertise is required?**
   - **Platform team**: Go (for custom plugins via `plugins.Factory`), Kubernetes/Docker, networking/TLS, OPA configuration (`config/config.go`), bundle server management, monitoring (Prometheus metrics in `plugins/status/metrics.go`)
   - **Feature team**: Rego language, policy design patterns, OPA data model (documents, rules, decisions), `opa test`/`opa check` workflow
   - **Integration dev**: REST API (`server/server.go:32-44`), Go SDK (`sdk/opa.go`), WASM embedding

5. **How is governance enforced organizationally?**
   Formal multi-vendor governance with organizational voting (`GOVERNANCE.md:9-18`). Each company gets one vote regardless of maintainer count. Areas of expertise defined per maintainer. Maintainers renewed annually. CNCF code of conduct (`CODE_OF_CONDUCT.md`). Security vulnerability process via dedicated email (`SECURITY.md`). Third-party security audit performed (`SECURITY_AUDIT.pdf`).

6. **What is the assumed scale of the team?**
   The governance model assumes 3+ organizations and 7+ maintainers (`MAINTAINERS.md:5-16`). The operational model (bundle distribution, discovery, decision logging) assumes dedicated infrastructure team. The plugin system and hooks suggest expectation of custom in-house development effort. This is not a single-developer project — it targets organizations with dedicated platform engineering resources.

7. **Does the architecture distinguish app dev vs platform dev?**
   Yes, clearly. Three distinct interfaces exist:
   - **Platform dev** -> OPA runtime configuration, plugin development (`plugins/plugins.go:74-87`), custom hooks (`hooks/hooks.go:11-46`), storage backends (`storage/interface.go:15-17`)
   - **App/feature dev** -> Rego policy writing, `opa eval`/`opa test` CLI, bundle creation (`bundle/bundle.go`)
   - **Integration dev** -> REST API client (`server/server.go`), Go SDK (`sdk/opa.go`), WASM runtime

## Architectural Decisions

1. **Plugin-based extensibility** (`plugins/plugins.go:74-87`): All major capabilities (bundle loading, discovery, decision logging, status) are plugins sharing a common `Factory`/`Plugin` interface with Validate-New-Reconfigure lifecycle. Enables third-party plugins without forking OPA.

2. **Organizational voting over individual voting** (`GOVERNANCE.md:9-18`): Prevents any single company from dominating project direction, critical for a CNCF-graduated infrastructure project.

3. **Bundle-based policy distribution** (`plugins/bundle/plugin.go`, `bundle/verify.go`): Pull-based model with cryptographic signing separates policy authorship from policy deployment, enabling platform teams to enforce supply chain security.

4. **Discovery-driven reconfiguration** (`plugins/discovery/discovery.go:20-23`): OPA can dynamically reconfigure itself from a discovery bundle, enabling centralized management without restart.

5. **v1/ package split** (nearly every top-level package delegates to `v1/`): Clean API versioning strategy that allows internal restructuring without breaking public interfaces.

## Notable Patterns

- **Delegate pattern everywhere**: Top-level packages (server, runtime, plugins, config, SDK, storage, bundle, hooks, etc.) are thin wrappers around `v1/` implementations. This allows versioned public APIs while keeping implementation details internal.
- **Manager lifecycle**: `plugins.Manager` is the central lifecycle coordinator — plugins register with it, get access to storage/compiler/config, and follow Validate-New-Reconfigure states (`plugins/plugins.go:139-141`).
- **Capabilities as versioned assets**: 141 JSON files in `capabilities/` track built-in function availability per OPA version, enabling forward/backward compatibility checking.
- **Cross-ecosystem testing**: CI workflows test OPA against Gatekeeper, Regal, OCP, and Envoy — acknowledging OPA's role as a platform dependency for many projects.
- **Config over CLI**: Heavy use of `--set` and `--config-file` patterns (`cmd/flags.go:26-36`) for flexible deployment configuration.

## Tradeoffs

| Tradeoff | Choice | Consequence |
|----------|--------|-------------|
| Policy distribution | Pull (bundle) model | Requires bundle server infrastructure; push would be simpler for small teams |
| Plugin lifecycle | Start only, no Stop | Plugins cannot cleanly shut down; acknowledged in docs (`plugins/plugins.go:82`) |
| AuthN/AuthZ | Off by default | Simplifies initial adoption; risk of misconfiguration in production |
| API surface | Large REST API + Go SDK + CLI | Multiple integration paths, but increases maintenance surface |
| WASM support | Build-tag gated (`opa_wasm`) | Reduces binary size for non-WASM users; requires Docker for WASM build |
| Bundle config | Legacy single-bundle + new multi-bundle | Backwards compatible but dual maintenance |

## Failure Modes / Edge Cases

1. **No auth by default** (`server/server.go:28`): `AuthenticationOff` and `AuthorizationOff` are the defaults. Production deployments must explicitly enable auth.
2. **Plugin Stop not called** (`plugins/plugins.go:82`): "Currently OPA will not call Stop on plugins." Long-running plugins (HTTP servers, connection pools) cannot rely on OPA-managed cleanup.
3. **Discovery dependency chain**: If discovery plugin fails, downstream reconfiguration halts. Documented in `cmd/exec.go:47-50`.
4. **Bundle verification gap**: Custom `Verifier` implementations (`bundle/verify.go:34`) could create inconsistent security posture if not properly audited.
5. **WASM build requires Docker** (`Makefile:221-227`): WASM library build (for non-Go embedding) fails silently if Docker is unavailable.

## Future Considerations

- Multi-bundle support is actively evolving (deprecated single-bundle config in `plugins/bundle/config.go:14-19`)
- v1 API surface cleanup — v1/ package migration is largely complete but internal restructuring continues
- WASM target expansion beyond Go embedding

## Questions / Gaps

- No evidence found about RBAC role definitions inside the OPA server — authorization is basic (off/basic only), not fine-grained RBAC
- No evidence found about multi-tenancy — OPA assumes single-tenant deployment per instance
- No evidence found about team onboarding documentation — the CONTRIBUTING.md just links to external docs
- The `internal/` directory (38 subdirectories) contains substantial implementation detail not publicly documented

---

Generated by `study-areas/22-organizational-architecture.md` against `opa`.
