# Repo Analysis: opencode

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opencode |
| Path | `repos/opencode` |
| Language / Stack | TypeScript, SolidJS, Bun, SST (Cloudflare), Effect-TS |
| Analyzed | 2026-05-17 |

## Summary

Opencode is an AI-powered development tool with a multi-tier organizational architecture. It is designed as a **platform with self-serve and managed tiers**: a local CLI tool (self-serve), a SaaS cloud console (platform-managed), and an enterprise self-hosted offering. The monorepo uses Turborepo to manage 20+ packages with clear separation between core engine, UI surfaces (TUI, web, desktop), integration SDKs (plugin, script, SDK), managed cloud backend (console, function), and enterprise features. Organizational assumptions include the existence of a **platform/infra team** (managing SST/Cloudflare deployment), a **product/feature team** (building CLI, UI, agent), and an **ecosystem of external plugin developers**. The architecture scores an 8 on the rubric — clear separation of concerns with role-appropriate interfaces and self-serve capabilities, but the platform/feature team boundary is implicit rather than explicitly tooled.

## Rating

**8/10** — Clear separation of concerns with role-appropriate interfaces. The architecture distinguishes a platform team (infra via SST, monitoring via Honeycomb, CI/CD via GitHub Actions) from feature builders (CLI, web, desktop, plugins) and external developers (plugin SDK, script SDK). Self-serve plugin/script APIs are published as npm packages. Missing: explicit RBAC or team-structure tooling, limited CODEOWNERS coverage, and no documented platform engineering interface.

Fast heuristic: "Could a platform team and a feature team work independently?" — **Yes**, largely. Infra is entirely in `infra/` and `sst.config.ts`, platform monitoring in `infra/monitoring.ts`, and feature code in `packages/`. Plugin developers operate independently via `@opencode-ai/plugin`.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Monorepo package structure | 20 packages in `packages/` with Turborepo orchestration | `package.json:23-29`, `turbo.json:1-44` |
| Package: core CLI/agent | `packages/opencode` — main CLI, TUI, agent, server, session, tools | `packages/opencode/src/index.ts:1-251` |
| Package: shared core library | `packages/core` — providers, auth, filesystem, plugin, schema | `packages/core/src/` |
| Package: web UI | `packages/app` — SolidJS web app, shared UI components | `packages/app/src/app.tsx` |
| Package: desktop | `packages/desktop` — Electron wrapper around web app | `packages/desktop/src/` |
| Package: plugin SDK | `@opencode-ai/plugin` — npm package for external plugin authors | `packages/plugin/package.json:1-49` |
| Package: script SDK | `@opencode-ai/script` — npm package | `packages/script/package.json` |
| Package: JS SDK | `@opencode-ai/sdk` — generated client from OpenAPI spec | `packages/sdk/js/package.json:1-34` |
| Package: enterprise | `packages/enterprise` — self-hosted Teams offering (SolidStart + R2) | `packages/enterprise/src/` |
| Package: cloud console | `packages/console` — SaaS backend (auth, billing, stats, PlanetScale) | `packages/console/` |
| Package: Slack integration | `packages/slack` — Slack bot | `packages/slack/src/index.ts` |
| Package: containers | `packages/containers` — Docker images for CLI | `packages/containers/` |
| Infrastructure as code | SST config with Cloudflare Workers, R2, KV, Stripe, PlanetScale, Honeycomb | `sst.config.ts:1-32` |
| Infra: app deployment | Cloudflare Worker (API), Astro site (docs), StaticSite (web app) | `infra/app.ts:13-69` |
| Infra: enterprise deployment | SolidStart with R2 storage for Teams offering | `infra/enterprise.ts:6-17` |
| Infra: console deployment | SolidStart with PlanetScale, Stripe billing, auth worker, gateway KV | `infra/console.ts:9-305` |
| Infra: monitoring | Honeycomb triggers for model HTTP errors, TPS, provider errors, free-tier surge | `infra/monitoring.ts:1-282` |
| Infra: stage management | Production/dev/stage domains, Cloudflare regional hostname | `infra/stage.ts:1-19` |
| Team membership | 16 named team members | `.github/TEAM_MEMBERS:1-16` |
| CODEOWNERS | Only `packages/app/`, `packages/desktop/`, `packages/tauri/` have owners | `.github/CODEOWNERS:1-5` |
| Contribution governance | Issue-first policy, conventional commits, vouch system, no AI-generated PRs | `CONTRIBUTING.md:182-210` |
| Vouch/trust system | Trust management via vouch/denounce with `.github/VOUCHED.td` | `CONTRIBUTING.md:256-276` |
| Issue template enforcement | Automated template compliance check with 2-hour window | `CONTRIBUTING.md:284-299` |
| Plugin extensibility | Plugin SDK supports tool, shell, TUI extensions, loaded by `ToolRegistry` | `packages/opencode/src/tool/registry.ts:136-208` |
| OpenCode self-config | Agents, commands, skills, themes, plugins configurable via `.opencode/` | `.opencode/opencode.jsonc:1-10` |
| CLI commands | 20+ CLI commands: serve, web, agent, run, generate, mcp, session, etc. | `packages/opencode/src/cli/cmd/` |
| CI/CD: deploy | Auto-deploy on push to dev/production via SST | `.github/workflows/deploy.yml:1-45` |
| CI/CD: test | Unit tests on linux+windows, E2E via Playwright | `.github/workflows/test.yml:1-166` |
| CI/CD: publish | Multi-platform build + sign + publish to npm, Docker, AUR, GitHub Releases | `.github/workflows/publish.yml:1-490` |
| Nix support | Dev shell + NixOS package build for opencode + desktop | `flake.nix:1-76` |
| Docker support | Alpine-based Docker image with CLI binary | `packages/opencode/Dockerfile:1-18` |
| Editor extensions | Zed extension in `packages/extensions/zed/` | `packages/extensions/zed/` |
| Database schema | Drizzle ORM with SQLite local, PlanetScale for cloud, snake_case convention | `packages/opencode/src/storage/schema.sql.ts` |
| Code style guide | Detailed Effect-TS patterns, module shape, naming conventions in AGENTS.md | `repos/opencode/AGENTS.md` |
| Runtime platform abstraction | Platform-specific imports via `#db`, `#pty`, `#httpapi-server` | `packages/opencode/package.json:26-40` |

## Answers to Protocol Questions

1. **What team structure does this architecture assume?**
   A platform/infra team plus feature teams plus external plugin developers. The evidence: infra code (`infra/`, `sst.config.ts`) is entirely separate from feature code (`packages/opencode`, `packages/app`, `packages/desktop`). The plugin SDK (`packages/plugin/`) and tool registration system (`packages/opencode/src/tool/registry.ts:136-208`) assume external developers build on top. The `.opencode/` directory allows user customization of agents, commands, and skills. Team membership (`TEAM_MEMBERS`) shows 16 people.

2. **Is the system self-serve or platform-managed?**
   **Both.** The CLI is self-serve (install via npm/binary, run locally, configure via `.opencode/`). The cloud console is platform-managed (SST deploys to Cloudflare Workers, runs on infrastructure managed by the platform team). The enterprise tier is self-hosted but provides a managed storage backend via R2 (`infra/enterprise.ts:6-17`).

3. **How is ownership divided between platform and feature teams?**
   Implicitly divided by directory boundaries: `infra/` and `sst.config.ts` for platform/infra, `packages/*/src/` for feature code. Platform owns: Cloudflare Workers, Planetscale, Stripe, Honeycomb, CI/CD pipelines, Docker images, Nix packages. Feature teams own: CLI agent, TUI, web UI, desktop app, plugin SDK, script runner. External developers own: plugins, custom tools, custom agents, skills loaded from the filesystem. CODEOWNERS (`CODEOWNERS:1-5`) only covers app/desktop/tauri explicitly — most of the codebase has no explicit owner.

4. **What operational expertise is required?**
   - For self-serve CLI users: basic terminal usage, understanding of AI providers (API keys), optional knowledge of Docker for containerized usage.
   - For cloud console operators: expertise in Cloudflare Workers, Planetscale/MySQL, Stripe billing, Honeycomb observability, SST framework.
   - For enterprise operators: Cloudflare R2, solid-start deployment.
   - For contributors: Bun runtime, TypeScript, Effect-TS patterns, SolidJS (for UI), SST (for infra changes).
   - The build system demands handling platform-specific binaries (detecting AVX2, musl vs glibc, in `bin/opencode:76-124`), macOS signing, Windows Authenticode signing, and multi-arch Docker builds.

5. **How is governance enforced organizationally?**
   Through multiple mechanisms:
   - **Issue-first PR policy**: PRs must reference an existing issue (`CONTRIBUTING.md:182-183`).
   - **Template enforcement**: Issues must use templates; automated checks enforce compliance with 2-hour edit window (`CONTRIBUTING.md:284-299`).
   - **Vouch system**: Trust management via vouch/denounce in `.github/VOUCHED.td` (`CONTRIBUTING.md:256-276`).
   - **Conventional commits**: Required PR title format (`feat:`, `fix:`, etc.) (`CONTRIBUTING.md:214-236`).
   - **No AI-generated PRs**: Long AI-generated descriptions explicitly rejected (`CONTRIBUTING.md:204-210`).
   - **Design review**: UI and core features require design review with core team (`CONTRIBUTING.md:13`).
   - **CI gates**: Tests (linux + windows), typecheck, and HttpApi exerciser must pass.

6. **What is the assumed scale of the team?**
   **Small to medium (5-20 engineers).** Evidence: 16 team members listed, single CODEOWNERS file with limited coverage, single CI/CD pipeline for all packages. The vouch system suggests a growing open-source contributor base that needs trust management. The monorepo with a single root `package.json` and shared configs suggests coordination overhead is still manageable.

7. **Does the architecture distinguish app dev vs platform dev?**
   **Yes, implicitly.** Platform development occurs in `infra/` (SST infrastructure definitions), `sst.config.ts` (Cloudflare, PlanetScale, Stripe, Honeycomb providers), and CI/CD workflows. Application/feature development occurs in `packages/*/src/`. However, there are no formal API contracts, service catalogs, or developer portals separating these roles — the boundary is directory-level convention. The plugin SDK (`@opencode-ai/plugin`) does provide a formal interface for external developers, which is the closest thing to a platform boundary.

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| CLI + SaaS + Enterprise tiers | Addresses different market segments (individual devs, teams, enterprises) with shared core | `packages/opencode/`, `packages/console/`, `packages/enterprise/` |
| Turborepo monorepo | Manages 20+ packages with dependency graph, caching, parallel builds | `turbo.json:1-44` |
| SST for cloud infra | Single framework for Cloudflare Workers, R2, KV, PlanetScale, Stripe, monitoring | `sst.config.ts:1-32` |
| Effect-TS for core logic | Type-safe, composable effect system for complex async flows | `packages/opencode/src/effect/`, `repos/opencode/AGENTS.md` |
| Plugin system via filesystem + npm | Plugins can be local files (`tool/*.ts`) or npm packages; no centralized registry required | `packages/opencode/src/tool/registry.ts:188-208` |
| Multiple UI surfaces (TUI, web, desktop) | Same core engine exposed through terminal, browser, and native desktop interfaces | `packages/opencode/src/cli/cmd/tui/`, `packages/app/`, `packages/desktop/` |
| Platform-specific runtime abstraction | Conditional imports (`#db`, `#pty`, `#httpapi-server`) for Bun vs Node compatibility | `packages/opencode/package.json:26-40` |
| OpenAPI-generated SDK | Auto-generated client SDK from HTTP API spec | `packages/sdk/js/package.json` + `packages/sdk/openapi.json` |
| Honeycomb-based observability | Platform-managed monitoring with structured events, SLO tracking, Discord alerts | `infra/monitoring.ts:1-282` |

## Notable Patterns

- **Service layering via Effect**: Every subsystem (Config, Plugin, Agent, Session, Tool, Git, etc.) is an Effect `Service` with a `defaultLayer`. Layers compose declaratively at the application root (`packages/opencode/src/tool/registry.ts:360-383`).
- **InstanceState for per-project state**: Uses `ScopedCache` keyed by directory to manage per-instance state with automatic cleanup (`repos/opencode/AGENTS.md` — InstanceState section).
- **Self-extending agent**: The `.opencode/` directory lets users define custom commands, agents, skills, and plugins — the tool is its own platform.
- **Filesystem-based tool discovery**: Tools are loaded from `{config,tool}/*.{js,ts}` directories and npm-plugin-packaged tools (`packages/opencode/src/tool/registry.ts:188-208`).
- **Platform-adaptive binary distribution**: Uses AVX2 detection, musl/glibc detection, and OS sniffing to select the correct precompiled binary (`bin/opencode:76-169`).
- **Convention over config**: CODEOWNERS only explicitly covers 3 areas; most ownership follows directory structure convention.

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| Monorepo complexity vs coordination | Monorepo with 20+ packages requires Turborepo, shared version catalog, and CI coordination. Simpler than multi-repo but still complex. Root-level testing is blocked (`"test": "echo 'do not run tests from root' && exit 1"`). |
| Platform boundary by convention vs tooling | The app-vs-platform distinction is directory-level convention, not enforced through API contracts or service catalogs. This works at current scale but won't scale to large platform teams. |
| Multiple UI surfaces vs maintenance cost | TUI (SolidJS+opentui), Web (SolidJS), Desktop (Electron), and Console (SolidStart) share core but each has independent UI code — duplication risk in UI features. |
| Self-serve plugin system vs security | Plugin tools execute arbitrary code. Mitigated by `--pure` mode flag and permission system, but plugins still run in-process. |
| Broad provider ecosystem vs maintenance | 20+ AI provider integrations (`@ai-sdk/*` packages) provide broad compatibility but create ongoing maintenance burden as provider APIs change. |
| Vouch system for open-source trust | Scales contributor trust management but requires active maintainer oversight and can create friction for new contributors. |

## Failure Modes / Edge Cases

- **Root test blocker**: `package.json:21` blocks running tests from root, meaning CI must run per-package. A misconfigured CI step could silently skip tests.
- **Platform binary fallback failure**: The binary resolution logic (`bin/opencode:76-169`) has fallback chains but could fail on uncommon platform/arch combinations, leaving users with a cryptic error message.
- **Filesystem-based plugin loading**: `Glob.scanSync` for `{tool,tools}/*.{js,ts}` may load unintended files if users have non-plugin files matching this pattern in config directories.
- **No explicit feature flags for cloud vs local**: The same codebase serves CLI, cloud, and enterprise tiers, but there's no documented feature flag system — differences are handled via conditional environment variables and SST stage.
- **CODEOWNERS blind spots**: Most packages have no explicit code owners, creating risk of unreviewed changes in critical areas (auth, security, database schema).

## Future Considerations

- Formalize the platform/feature team boundary with explicit service APIs or a developer portal.
- Expand CODEOWNERS coverage to critical packages (auth, provider, session, storage).
- Introduce feature flags to cleanly separate CLI-only, cloud-only, and enterprise-only features.
- Add per-package CI test sharding as the monorepo grows.
- Consider a plugin registry or marketplace for community-contributed tools and skills.
- Add explicit platform engineering documentation (how to add a new Cloudflare Worker, how to deploy a new service).

## Questions / Gaps

- How are feature teams structured day-to-day? The code shows 16 team members but no squad/team breakdown.
- What is the release process? There's a `publish.yml` workflow but no documented release cadence or criteria.
- How are breaking changes in core (`@opencode-ai/core`) communicated to dependent packages? The workspace dependency `"@opencode-ai/core": "workspace:*"` means everything is in lockstep.
- What is the disaster recovery plan for the cloud console? No evidence found.
- How is the enterprise offering different from the cloud console beyond storage backend? Minimal documentation.

---

Generated by `study-areas/22-organizational-architecture.md` against `opencode`.
