# Repo Analysis: mastra

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | mastra |
| Path | `repos/mastra/` |
| Language / Stack | TypeScript (ES2022+), pnpm workspace monorepo, Turborepo |
| Analyzed | 2026-05-17 |

## Summary

Mastra is organized as a **platform-core + plugin-adapter** architecture designed for a platform team serving feature/application teams. The monorepo contains ~100+ packages with a clear separation between the core framework (`packages/core`, `packages/server`, `packages/deployer`) and swappable adapters (stores, deployers, auth providers, voice, server adapters, client SDKs). Organizational assumptions are strongly platform-team oriented: there is an explicit Enterprise Edition with RBAC/FGA/ACL that enables multi-tenant governance, while the open-source core assumes self-serve, single-team use. The architecture anticipates at minimum a dedicated infra/platform engineer and likely a 3-10 person team; it does not target solo developers.

## Rating

**7/10** — Clear separation of concerns between platform (`packages/core`) and adapters (stores, deployers, auth, voice, etc.), with role-appropriate interfaces (`IRBACProvider`, `ISessionProvider`, etc.). The EE RBAC system provides governance boundaries. However, the open-source tier lacks built-in multi-tenant isolation, the CLI/deployer split can confuse ownership, and there is no CODEOWNERS file or formal team boundary documentation in the repo itself.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Monorepo structure (platform vs adapters) | pnpm workspace defines 20+ directory globs for core packages, deployers, stores, auth, voice, client-sdks, server-adapters | `pnpm-workspace.yaml:1-25` |
| Core platform boundary | `@mastra/core` exports 50+ subpath entries (agent, workflows, memory, tools, mcp, voice, storage, auth) — this is the platform API surface | `packages/core/package.json:13-30` |
| Plugin/adapter dependency pattern | All adapter packages depend on `@mastra/core` as peer dependency, e.g. `@mastra/deployer-cloud` imports from `@mastra/core/mastra` | `deployers/cloud/src/index.ts:3` |
| Server-auth separation | Route permission checks skip if no RBAC provider configured; auth-only mode grants full access | `packages/server/src/server/server-adapter/index.ts:463-467` |
| Enterprise RBAC design | `IRBACProvider` interface with role mapping for IdP translation, wildcard permission patterns | `packages/core/src/auth/ee/interfaces/rbac.ts:101-158` |
| Default role hierarchy | Four-tier roles: owner (\*), admin (\*:read/\*:write/\*:execute), member (\*:read/\*:execute), viewer (\*:read) | `packages/core/src/auth/ee/defaults/roles.ts:24-54` |
| FGA support | Fine-grained authorization interface with `check()`, `require()`, `filterAccessible()` — requires EE license | `packages/core/src/auth/ee/interfaces/fga.ts:214-249` |
| Capability detection | `buildCapabilities()` returns feature flags including rbac, acl, fga — gates EE features | `packages/core/src/auth/ee/capabilities.ts:58-100` |
| Self-serve deployers | 3 deployer packages (Vercel, Netlify, Cloudflare) generate platform-specific output — user deploys externally via dashboard | `deployers/vercel/src/index.ts:167-169`, `deployers/cloudflare/src/index.ts`, `deployers/netlify/src/index.ts` |
| Platform-managed deployer | `CloudDeployer` injects `TEAM_ID`, `PROJECT_ID`, `BUILD_ID`, managed LibSQL storage, cloud logging with JWT auth | `deployers/cloud/src/index.ts:99-207` |
| Client SDKs for app developers | `@mastra/client-js`, `@mastra/react`, `@mastra/ai-sdk` — typed client libraries for consuming Mastra APIs | `client-sdks/` |
| Server adapters for framework integration | 5 adapters: Express, Fastify, Hono, Koa, NestJS — each wraps `@mastra/server` into respective framework | `server-adapters/` |
| CI/CD governance | 36 GitHub Actions workflows; Changesets for versioning; CodeRabbit required; Renovate for deps; automated alpha publishing | `.github/workflows/` |
| Code review policy | PRs must link issues; CodeRabbit comments must be addressed; `@dane-ai-mastra` bot handles fix commands for org members | `CONTRIBUTING.md:29-35,152-171` |
| Supply chain security | `minimumReleaseAge: 1440` for third-party deps, `trustPolicy: no-downgrade`, vulnerability alerts via Renovate | `pnpm-workspace.yaml:38-49`, `renovate.json` |
| Onboarding prerequisites | Node v22.13.0+, pnpm v10.18.0+, Docker for subset of tests; `ERR_WORKER_OUT_OF_MEMORY` mitigation documented | `DEVELOPMENT.md:7-10,40-45` |
| EE license enforcement | `isEEEnabled()` checks `MASTRA_EE_LICENSE` env var (min 32 chars), cached 1 minute; dev env exempt | `packages/core/src/auth/ee/license.ts:35-59,142-147` |
| AI coding agent instructions | Per-package `AGENTS.md` files with narrow build/test/typecheck commands; identifies module architecture | `AGENTS.md:22-30`, per-package `AGENTS.md` files |
| No CODEOWNERS | No `.github/CODEOWNERS` file found — no explicit team-to-directory ownership | (searched `.github/`, root) |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

Mastra assumes a **platform-team + feature-team structure**. The core packages (`packages/core`, `packages/server`, `packages/deployer`) are clearly the "platform" — they define interfaces, orchestration, and the deployment pipeline. The adapter packages (stores, auth providers, voice, deployer targets, server adapters, client SDKs) are either maintained by the platform team or contributed by the ecosystem. The EE RBAC system (`packages/core/src/auth/ee/interfaces/rbac.ts:101-158`) with its role hierarchy (owner > admin > member > viewer) explicitly models a multi-user organization. The Cloud deployer (`deployers/cloud/src/index.ts:120-124`) injects `teamId` and `projectId`, proving multi-team tenancy is a first-class concern at the platform level.

### 2. Is the system self-serve or platform-managed?

**Both.** The architecture supports two modes:

- **Self-serve (open source)**: Users scaffold via `create-mastra`, develop agents, deploy via Vercel/Netlify/Cloudflare deployers, and consume via client SDKs (`client-sdks/client-js/`, `client-sdks/react/`). The CLI (`packages/cli/`) provides `build`, `dev`, `deploy` commands.
- **Platform-managed (Mastra Cloud)**: The Cloud deployer generates entrypoints with managed LibSQL storage (`process.env.MASTRA_STORAGE_URL` + `MASTRA_STORAGE_AUTH_TOKEN`), cloud logging via HTTP transport with JWT auth, and readiness checkpoints with team/project/build IDs (`deployers/cloud/src/index.ts:99-207`).

The Vercel and Cloudflare deployers explicitly deprecate the `deploy()` method, directing users to use the respective dashboard — reinforcing that deployment infrastructure is managed externally, not by Mastra itself.

### 3. How is ownership divided between platform and feature teams?

Ownership is divided through **interface contracts**. The platform (`packages/core`) defines abstractions: `IStorageProvider`, `IVectorProvider`, `IRBACProvider`, `ISessionProvider`, `ISSOProvider`, `ICredentialsProvider`. Feature/application teams implement these interfaces or choose from pre-built adapters (`stores/*`, `auth/*`, `voice/*`). The server auth middleware enforces this boundary at runtime: if no RBAC provider is configured, permission checks are skipped entirely (`packages/server/src/server/server-adapter/index.ts:463-467`), meaning the platform stays agnostic to the feature team's auth decisions unless RBAC is explicitly plugged in.

There is **no CODEOWNERS file** in the repository, so formal ownership boundaries are not documented at the repo level. However, the physical directory layout serves as the de facto ownership map.

### 4. What operational expertise is required?

**High.** Running Mastra requires:

- **Node.js v22.13.0+** and **pnpm v10.18.0+** (`DEVELOPMENT.md:7-9`)
- **Docker** for local dev services (pgvector, Qdrant, Redis) (`DEVELOPMENT.md:9`)
- Understanding of **Turborepo** build topology and **pnpm workspace** conventions
- Ability to diagnose `ERR_WORKER_OUT_OF_MEMORY` and configure `NODE_OPTIONS="--max-old-space-size=4096"` (`DEVELOPMENT.md:40-45`)
- For platform team: knowledge of the deployer abstraction, bundler config (Rollup/esbuild via `packages/deployer/`), and server adapter patterns
- For feature teams: knowledge of the chosen adapter's configuration surface
- For self-serve deployment: familiarity with Vercel/Netlify/Cloudflare dashboards, environment variable management
- For enterprise: `MASTRA_EE_LICENSE` env var setup (`packages/core/src/auth/ee/license.ts:35-39`), IdP configuration (Clerk, Auth0, Okta, etc.)

### 5. How is governance enforced organizationally?

Governance is enforced through multiple layers:

- **Technical (EE only)**: RBAC with four default roles (`packages/core/src/auth/ee/defaults/roles.ts:24-54`), FGA for fine-grained access (`packages/core/src/auth/ee/interfaces/fga.ts:214-249`), license validation (`packages/core/src/auth/ee/license.ts:35-59`), convention-based permission derivation from HTTP routes (`packages/server/src/server/server-adapter/routes/permissions.ts:1-160`).
- **CI/CD**: 36 GitHub Actions workflows enforce linting, testing, type-checking, peer dependency validation, bundle validation, and AGENTS.md format checks. Changesets enforce versioning discipline. CodeRabbit provides mandatory AI code review. Renovate manages dependency updates with security gates.
- **Process**: PRs must link issues (`CONTRIBUTING.md:31`), CodeRabbit comments must be resolved (`CONTRIBUTING.md:35`), bot commands restricted to Mastra org members (`CONTRIBUTING.md:152-171`).
- **Supply chain**: `minimumReleaseAge: 1440` (1 day) for third-party deps, `trustPolicy: no-downgrade`, `blockExoticSubdeps: true` (`pnpm-workspace.yaml:38-49`).

### 6. What is the assumed scale of the team?

The architecture assumes a **minimum 2-3 person team** (at least one platform/infra engineer and one or more feature engineers), scaling to **10+ person organizations** with distinct platform, feature, and governance roles.

Evidence: The EE RBAC with 4 role tiers, the platform/adapter split requiring specialized knowledge of both core internals and integration surfaces, the CI/CD complexity (36 workflows, multiple bots, changesets), and the prerequisite knowledge (Turborepo, pnpm, Docker, cloud deployment). The `create-mastra` scaffolding tool (`packages/create-mastra/`) and templates (`templates/`) lower the barrier for solo developers, but operating the full system requires a team.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, clearly.** The physical directory layout is the primary signal:

- **Platform dev** works in `packages/core/`, `packages/server/`, `packages/deployer/`, `packages/auth/` — defining interfaces, orchestration, build pipeline, and server infrastructure.
- **App dev** works with adapter packages (`stores/*`, `auth/*`, `voice/*`, `server-adapters/*`, `client-sdks/*`) — implementing or configuring integrations.
- **Tooling dev** works in `packages/cli/`, `packages/create-mastra/`, `packages/playground-ui/`, `packages/playground/` — developer experience and UI.

The per-package `AGENTS.md` files reinforce this by giving AI coding agents narrow, package-scoped build/test commands, which assumes that contributors work within a single package boundary most of the time.

The EE auth layer further distinguishes roles: the `owner` role gets `*` permissions, `admin` gets read/write/execute, `member` gets read/execute, `viewer` gets read-only (`packages/core/src/auth/ee/defaults/roles.ts:24-54`), mapping to platform-admin, app-developer, and read-only consumer personas.

## Architectural Decisions

| Decision | Rationale | File:Line |
|----------|-----------|-----------|
| Interface-based plugin system | Adapters implement core interfaces (storage, vector, auth, voice) — enables swappability without core changes | `packages/core/src/` (interface dirs across storage, vector, auth, voice) |
| RBAC as separate concern from auth | Auth providers and RBAC providers can be mixed independently (BetterAuth + StaticRBAC, Clerk for both, etc.) | `packages/core/src/auth/ee/interfaces/rbac.ts:5-10` |
| Convention-based permission derivation | Route permissions derived from HTTP method + path (GET /agents → agents:read) — reduces configuration surface | `packages/server/src/server/server-adapter/routes/permissions.ts:1-160` |
| Cloud deployer forces external deps | `externals: true` for cloud deployments to avoid circular module deadlocks | `deployers/cloud/src/index.ts:27-36` |
| Supply chain hardening | 1-day minimum release age, no-downgrade trust policy, exotic subdep blocking | `pnpm-workspace.yaml:38-49` |
| EE features gated by license | `isEEEnabled()` checks env var, cached, dev environment exempt | `packages/core/src/auth/ee/license.ts:35-59,142-147` |

## Notable Patterns

1. **Plugin-as-directory convention**: Each plugin domain (stores, auth, voice, deployers) gets its own top-level directory with a consistent package naming scheme (`@mastra/store-name`, `@mastra/deployer-name`, etc.). This is an organizational pattern, not enforced by code.

2. **Per-package AGENTS.md**: Every package has AI coding agent instructions with narrow, package-specific build/test commands. This assumes AI-assisted development and enforces module-level ownership.

3. **Deprecated deploy methods with dashboard redirect**: `deploy()` in Vercel and Cloudflare deployers is a no-op that tells users to use the respective dashboard — the code generates the build artifact, deployment platform handles the rest.

4. **Generated permissions from routes**: `MastraFGAPermissions` constants (60+ permissions) are auto-generated from server routes via `pnpm generate:permissions` (`packages/core/src/auth/ee/interfaces/permissions.generated.ts:336-455`), keeping the permission model in sync with the API surface.

5. **Mixed OSS + EE licensing**: EE auth code lives in `packages/core/src/auth/ee/` with dual license (Apache-2.0 for core, Mastra Enterprise License for EE). This is the same directory, split by subdirectory — a convention that requires discipline to maintain.

## Tradeoffs

1. **Monorepo complexity vs. modularity**: ~100 packages under one roof maximizes code sharing and coordinated releases but requires significant CI infrastructure, Turborepo knowledge, and memory for local builds (documented OOM issues at `DEVELOPMENT.md:40-45`).

2. **Self-serve freedom vs. platform lock-in**: The open-source tier can deploy anywhere, but Mastra Cloud (deployer-cloud) uses managed LibSQL storage and proprietary logging — migrating off the platform requires replacing these integrations.

3. **EE features in OSS repo**: RBAC/FGA/ACL interfaces are public in the open-source core but require a paid license to use in production. This increases code complexity and requires careful license boundary enforcement (`packages/core/src/auth/ee/license.ts:142-147` dev exemption is a potential gap).

4. **No formal team ownership map**: Despite clean directory boundaries, there is no CODEOWNERS file or equivalent. Ownership relies on contributor judgment and per-package AGENTS.md rather than enforced GitHub ownership.

5. **High barrier for solo developers**: The prerequisites (Node v22, pnpm v10, Docker, Turborepo mental model) and documented OOM issues make this unfriendly for individual hobbyists, despite `create-mastra` scaffolding.

## Failure Modes / Edge Cases

1. **License bypass in production**: `isEEEnabled()` checks dev environment via `NODE_ENV !== 'production'` or `MASTRA_DEV=true` (`packages/core/src/auth/ee/license.ts:142-147`). If either is accidentally set in production, EE features activate without a license.

2. **RBAC misconfiguration**: If RBAC provider is not configured, the server falls back to auth-only mode granting full access to all authenticated users (`packages/server/src/server/server-adapter/index.ts:463-467`). Teams may not realize their access controls are effectively disabled.

3. **Dependency supply chain bypass**: The `minimumReleaseAgeExclude` list exempts `@mastra/*`, `@internal/*`, and `mastra` packages (`pnpm-workspace.yaml:43-49`), meaning freshly-published malicious Mastra packages could be installed without the 1-day cooldown.

4. **Incomplete deployer abstraction**: Each deployer requires platform-specific config and behavior (Cloudflare needs `wrangler.json` + `nodejs_compat`, Netlify needs Frameworks API config, etc.) — the abstraction leaks platform details.

5. **EE and OSS drift**: EE interface files live in the same packages as OSS code. If the EE interfaces change without updating the OSS defaults or vice versa, adapter packages targeting one version could break with the other.

## Future Considerations

1. Formal team ownership via CODEOWNERS or similar would reduce ambiguity about who owns each adapter domain.
2. A non-EE simple RBAC provider (even static role mapping) for the open-source tier would reduce the auth-only security gap.
3. Cloud deployer independent of managed storage — allow bring-your-own-database on Mastra Cloud.
4. Slimmed-down distribution of just the core platform packages to lower the barrier for solo developers.
5. Documentation of the team model assumptions and recommended org structures for adopters.

## Questions / Gaps

- No CODEOWNERS file found — who maintains each adapter domain (stores, auth, voice, etc.)? Ownership relies on convention and contributor history.
- No documentation of the recommended team structure for adopters. The architecture implies a platform team model but does not explicitly state it.
- The open-source auth layer (non-EE) has interfaces but no RBAC — is there an intent to add non-EE RBAC, or is it permanently EE-only?
- How does Mastra Cloud handle cross-team isolation? `teamId` and `projectId` are injected in the entrypoint (`deployers/cloud/src/index.ts:120-124`), but the open-source core has no multi-tenant enforcement.
- The `deploy()` no-op in Vercel/Cloudflare deployers suggests deployment responsibility is fully offloaded to those platforms — what happens when a user needs deployment features not supported by the generated artifact?

---

Generated by `22-organizational-architecture.md` against `mastra`.
