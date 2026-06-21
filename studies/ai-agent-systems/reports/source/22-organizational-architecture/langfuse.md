# Repo Analysis: langfuse

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | langfuse |
| Path | `repos/langfuse` |
| Language / Stack | TypeScript, Next.js, Express, Prisma, ClickHouse, React |
| Analyzed | 2026-05-17 |

## Summary

Langfuse is a mature open-source LLM engineering platform built around a clear **platform-team model**. Its monorepo structure (`web`, `worker`, `packages/shared`, `ee`) enforces strict dependency direction and isolates enterprise features behind both code boundaries and license checks. The system explicitly models multi-team organizational needs through RBAC (roles at org + project level), plan-based entitlements, and multiple deployment targets (Cloud multi-region + self-hosted). The architecture assumes at minimum 3-4 team roles (frontend, backend/worker, shared infrastructure, enterprise) and provides well-defined interfaces between them.

## Rating

**8** — Clear separation of concerns with role-appropriate interfaces. The platform team model is concretely realized through shared code contracts, dependency enforcement, plan-gated entitlements, and enterprise feature isolation. Self-serve works for cloud users; self-hosted operators need infra expertise.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Monorepo structure | pnpm workspace with web, worker, packages/**, ee | `pnpm-workspace.yaml:2-6` |
| Dependency direction | web -> `@langfuse/shared` + `@langfuse/ee`, worker -> `@langfuse/shared`, ee -> `@langfuse/shared`, shared -> nothing from web/worker/ee | `AGENTS.md:93-97` |
| RBAC roles | OWNER, ADMIN, MEMBER, VIEWER, NONE with ordered hierarchy | `web/src/features/rbac/constants/orderedRoles.ts:3-9` |
| Organization-level scopes | projects:create, org CRUD, orgMembers CUD, billing, auditLogs | `web/src/features/rbac/constants/organizationAccessRights.ts:5-15` |
| Project-level scopes | 40+ granular scopes including traces, scores, prompts, evals, LLM keys, datasets, dashboards | `web/src/features/rbac/constants/projectAccessRights.ts:5-80` |
| Entitlements system | Plans (cloud:hobby/core/pro/team/enterprise, oss, self-hosted:pro/enterprise) with feature gating | `web/src/features/entitlements/constants/entitlements.ts:51-171` |
| Enterprise feature isolation | `ee/` directory with separate license check, consumed by `web/src/ee/` | `ee/README.md:3`, `ee/src/ee-license-check/index.ts:3-5` |
| Enterprise EE features | admin-api, audit-log-viewer, billing, multi-tenant-sso, sso-settings, ui-customization, verified-domains | `web/src/ee/features/` |
| Cloud deployment model | ECS deployment across staging, prod-eu, prod-us, prod-hipaa, prod-jp | `.github/workflows/deploy.yml:23-27` |
| Self-hosted deployment | Docker compose, Kubernetes Helm, Terraform (AWS/Azure/GCP) | `README.md:119-133` |
| Infrastructure dependencies | Postgres, ClickHouse, Redis/Valkey, S3-compatible storage | `docker-compose.yml:7-178` |
| Release model | Cloud: promote main -> production branch triggers ECS deploy; OSS: tag-based Docker release | `.github/workflows/promote-main-to-production.yml:48-49`, `.github/workflows/pipeline.yml:850-879` |
| CI/CD pipeline | Lint, typecheck, web tests (3 matrix modes), worker tests, E2E, Docker build test | `.github/workflows/pipeline.yml:90-757` |
| Staging environment | Auto-deployed on every push to main at staging.langfuse.com | `CONTRIBUTING.md:365-367` |
| Package ownership | Each package has AGENTS.md defining local rules, entry points, and commands | `web/AGENTS.md`, `worker/AGENTS.md`, `packages/shared/AGENTS.md`, `ee/AGENTS.md` |
| Verification matrix | Change-scoped minimum verification commands per package | `AGENTS.md:125-134` |
| SSO providers | Google, GitHub, GitLab, Azure AD, Okta, Auth0, Cognito, Keycloak, WorkOS, custom OIDC, JumpCloud | `.env.prod.example:58-152` |
| License model | MIT (core), enterprise license for `ee/` directory | `LICENSE`, `ee/LICENSE` |
| Agent tooling infra | Shared agent config, generated MCP shims for multiple tools (Claude, Cursor, Codex, VS Code) | `CONTRIBUTING.md:162-193` |
| Initial org provisioning | Automated bootstrap via env vars for new deployments | `.env.prod.example:182-191` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

Langfuse assumes a **platform-team model** with at minimum the following roles:

- **Platform/infra team** owns `packages/shared/` (domain models, DB schemas, queue contracts) and the deployment infrastructure (Docker, Helm, ECS)
- **Web/API team** owns `web/` — Next.js UI, tRPC endpoints, public REST API
- **Worker/background team** owns `worker/` — queue consumers, async processors, operational scripts
- **Enterprise team** owns `ee/` — SSO, billing, audit logs, admin API, UI customization

The strict dependency direction (`AGENTS.md:93-97`) enforces that `shared` is a platform layer that web and worker teams consume but cannot modify from their packages. The verification matrix (`AGENTS.md:125-134`) formalizes cross-package coordination by requiring `pnpm run lint + pnpm run typecheck + targeted tests per impacted package` for cross-package refactors.

### 2. Is the system self-serve or platform-managed?

**Both, with clear separation:**

- **Langfuse Cloud** is fully self-serve — users sign up, create projects, generate API keys, and start ingesting. The freemium model (`cloud:hobby` plan with 2-member limit, 30-day data access) supports self-service onboarding.
- **Self-hosted deployments** are platform-managed — operators must provision PostgreSQL, ClickHouse, Redis, S3 storage, configure env vars, and manage migrations. Self-hosted is explicitly "for production" via Kubernetes/Helm (`README.md:131`).
- **Enterprise features** (SSO, audit logs, RBAC project roles, admin API) are gated behind plan/entitlement checks (`web/src/features/entitlements/constants/entitlements.ts:51-171`) and require either Cloud enterprise or self-hosted enterprise license.

### 3. How is ownership divided between platform and feature teams?

Ownership is divided through several mechanisms:

- **Code boundaries**: `packages/shared/` owns all cross-cutting contracts (domain models, DB schemas, queue payloads). The `AGENTS.md:93-97` rule — `@langfuse/shared -> no imports from web, worker, or ee` — prevents platform code from depending on feature code.
- **Package-level AGENTS.md files**: Each package (`web/`, `worker/`, `packages/shared/`, `ee/`) has its own AGENTS.md defining entry points, conventions, and quick commands. These act as ownership charters.
- **RBAC permissions model**: The system itself models ownership division. Organization roles (`web/src/features/rbac/constants/organizationAccessRights.ts:20-43`) distinguish OWNER (full control including billing), ADMIN (ops without billing), MEMBER (read-only org), and VIEWER/NONE.
- **Entitlements**: Feature ownership is gated. For example, `"rbac-project-roles"` is only available on `cloud:team` and above or `self-hosted:enterprise` (`web/src/features/rbac/constants/entitlements.ts:95,155`).

### 4. What operational expertise is required?

Operational expertise varies by deployment model:

- **Cloud users**: Minimal — sign up, create API keys, instrument applications. No infrastructure expertise needed.
- **Self-hosted operators**: Need expertise in PostgreSQL, ClickHouse, Redis/Valkey, S3-compatible storage, Docker, and networking. The docker-compose.yml (`docker-compose.yml:7-178`) requires configuring 6+ services with health checks, secrets, and volume management.
- **Kubernetes operators**: Need Helm chart familiarity, cluster management, and knowledge of ClickHouse clustering for production scale.
- **Internal platform team**: Needs TypeScript/Node.js expertise, Prisma ORM, Next.js, Express, BullMQ queue management, ClickHouse query optimization, and OpenTelemetry instrumentation.

### 5. How is governance enforced organizationally?

Governance is enforced through multiple layered mechanisms:

- **RBAC**: Five roles (OWNER, ADMIN, MEMBER, VIEWER, NONE) at both org and project levels with granular scope definitions. For example, `"organization:delete"` is OWNER-only (`web/src/features/rbac/constants/organizationAccessRights.ts:25`).
- **Entitlements**: Feature availability is governed by plan (`web/src/features/entitlements/constants/entitlements.ts`). Limits are enforced on resource counts (e.g., `"organization-member-count": 2` for hobby plan at line 61).
- **License enforcement**: Enterprise features are code-isolated in `ee/` directory and gated by `isEeAvailable` check (`ee/src/ee-license-check/index.ts:3-5`), which requires either `NEXT_PUBLIC_LANGFUSE_CLOUD_REGION` or `LANGFUSE_EE_LICENSE_KEY`.
- **Audit logs**: Available as enterprise feature (`entitlements.ts:15`), recording organizational actions.
- **SSO enforcement**: Domain-restricted SSO via `AUTH_DOMAINS_WITH_SSO_ENFORCEMENT` (`env.prod.example:59`).
- **Sign-up controls**: `AUTH_DISABLE_SIGNUP` and `AUTH_DISABLE_USERNAME_PASSWORD` toggleable (`env.prod.example:61-62`).
- **Admin API**: Separate admin API key for operational governance (`env.prod.example:310`), gated by `"admin-api"` entitlement (`entitlements.ts:19`).
- **Allowed organization creators**: Only enterprise self-hosted can restrict which users create orgs (`entitlements.ts:156`).

### 6. What is the assumed scale of the team?

The architecture signals a **medium-to-large engineering organization**:

- At minimum 3-4 distinct ownership groups (web, worker, shared, enterprise). The package-local AGENTS.md files and shared skills system signals a team that needs to coordinate across specializations.
- The verification matrix (`AGENTS.md:125-134`) formalizes cross-package change protocols, which is overhead justified only by teams where different people own different packages.
- The RBAC system (org OWNER, ADMIN, MEMBER, VIEWER, NONE + project-level roles) mirrors real-world org structures with managers, ICs, contractors, and external collaborators.
- The Cloud deployment supports multiple production environments (EU, US, HIPAA, JP) split across different AWS accounts/regions, implying at least an SRE/infra sub-team.
- The enterprise features (SSO providers, audit logs, billing) indicate enterprise sales/support team.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, explicitly.** The architecture embodies platform-team thinking:

- `packages/shared/` is the **platform layer** — it owns schemas, types, queue contracts, and domain models. It is the "source of truth" for the entire platform. Its dependency rule (`shared -> no imports from web, worker, or ee` at `AGENTS.md:97`) means platform devs publish contracts that app devs consume, not the other way around.
- `web/` and `worker/` are the **application layers** that consume platform contracts. Web devs build UI and API surfaces; worker devs build background processing.
- `ee/` is a separate **enterprise product layer** that extends the platform with commercial features.
- The Fern API specs (`fern/apis/`) serve as a formally versioned **public contract** that external app devs (SDK users) consume. The `generated/` directory contains auto-generated clients from these specs.
- The agent/MCP tooling infra (`CONTRIBUTING.md:162-193`) with shared agent config and generated tool-specific configs is itself a platform-dev artifact — the platform team provides shared tooling infra so app devs don't need to configure it.

## Architectural Decisions

| Decision | Rationale | File:Line |
|----------|-----------|-----------|
| Strict dependency direction | Prevents shared platform from leaking app concerns; enforces contract-first development | `AGENTS.md:93-97` |
| Plan-based entitlements | Allows self-serve Cloud tiers while monetizing enterprise features; gating is code-level not just docs | `entitlements.ts:51-171` |
| ee/ code isolation + license check | Enterprise features are physically separated (not `if/else` in core code); license key gates at import boundary | `ee/src/ee-license-check/index.ts:3-5` |
| Separate web + worker Docker images | Web and worker scale independently; worker can have different resource profiles | `web/Dockerfile`, `worker/Dockerfile` |
| Multi-region Cloud + self-hosted | Serves both managed (Cloud) and on-premise (self-hosted) markets from same codebase | `.github/workflows/deploy.yml:23-27` |
| RBAC at org AND project level | Mirrors real org structures where projects need cross-team access with separate roles | `projectAccessRights.ts`, `organizationAccessRights.ts` |
| pnpm + Turbo monorepo | Enables fast parallel builds across packages; workspace protocol enforces internal dependency freshness | `turbo.json`, `pnpm-workspace.yaml` |
| Shared agent/MCP infra | Platform team provides tooling abstractions so all engineers get consistent agent environment | `CONTRIBUTING.md:162-193` |

## Notable Patterns

1. **Contract-first platform boundary**: `packages/shared/` owns queue payload schemas (`queues.ts`), Prisma schema, ClickHouse migrations, and domain models. Both web and worker consume these contracts, ensuring no interface drift.

2. **Two-tier RBAC**: Organization-level roles govern cross-project access (create projects, manage members, billing); project-level roles govern resource operations (traces, evals, prompts). The `NONE` role at project level allows explicit opt-in: "Do not override the organization role for this project" (`projectAccessRights.ts:254`).

3. **Entitlement-gated UI**: The `web/src/features/entitlements/hooks.ts` client-side hooks make entitlements available to React components, enabling dynamic feature visibility without server round-trips for every toggle.

4. **Environment-specific configuration matrix**: The CI tests across 3 modes (default, Azure, Redis Cluster) and 2 Postgres versions (12, 15), reflecting real deployment diversity in the Cloud offering (`pipeline.yml:293-295`).

5. **Provisioning-as-code**: The `LANGFUSE_INIT_*` env vars (`env.prod.example:182-191`) automate first-run organization, project, user, and API key creation — essential for both Cloud signup flow and self-hosted bootstrap.

## Tradeoffs

1. **Complexity vs flexibility**: The architecture requires operating PostgreSQL, ClickHouse, Redis, and S3 simultaneously. This is intentional for the observability use case but is a significant operational burden for self-hosted users with simple needs.

2. **Monorepo overhead**: The pnpm+Turbo setup requires disciplined dependency management. The `minimumReleaseAge: 7200` in `pnpm-workspace.yaml:8` and the exclusion list (`pnpm-workspace.yaml:12-34`) show ongoing maintenance burden for supply-chain security.

3. **Enterprise feature leakage risk**: While the `ee/` directory is physically separate, the `web/src/ee/features/` directory imports enterprise features. The license check (`ee/src/ee-license-check/index.ts:3-5`) is the gate. This relies on the import not being tree-shaken incorrectly or accidentally bundled in OSS builds.

4. **Next.js Pages Router vs App Router**: The codebase uses Pages Router (`CONTRIBUTING.md:45`) while Next.js has been pushing App Router. This creates a potential migration cliff for the web team.

5. **Separate release cadences**: Cloud deploys from production branch (frequent); OSS Docker releases are tag-based (less frequent). This means self-hosted users may lag behind Cloud features, and the `ee/` code is still shipped in OSS Docker images (just gated).

## Failure Modes / Edge Cases

1. **Entitlement check bypass**: If the `isEeAvailable` check (`ee/src/ee-license-check/index.ts:3-5`) returns false due to misconfigured env, enterprise features silently disappear from UI. No error, just missing UI elements.

2. **Self-hosted upgrade path**: The entitlements system (`entitlements.ts:132-170`) for self-hosted plans (`oss`, `self-hosted:pro`, `self-hosted:enterprise`) has sparser entitlements than Cloud equivalents. An `oss` user migrating from Cloud might lose features.

3. **Cross-package refactor coordination**: The verification matrix (`AGENTS.md:125-134`) requires package-specific test commands, but there is no single "verify all" command that simulates the full CI pipeline locally.

4. **Multi-tenant isolation in self-hosted**: The RBAC system assumes organizations as tenants, but the self-hosted deployment model (`docker-compose.yml`) runs a single instance. There is no VM-level isolation between orgs in self-hosted mode.

5. **Database migration ordering**: The CI runs `db:migrate` and `ch:up` in sequence alongside the dev containers (`pipeline.yml:371-373`). Migration errors during deployment could cause version mismatches between web and worker services.

## Future Considerations

1. **App Router migration**: The codebase uses Pages Router; migrating to Next.js App Router (`next.config.mjs`) would align with Next.js 16 defaults but requires significant refactoring of routing patterns.

2. **ee/ to packages/ promotion**: As the enterprise surface grows, `ee/` might benefit from being a proper package under `packages/` with its own CI pipeline.

3. **ClickHouse cluster as default**: Currently ClickHouse cluster mode is opt-in (`CLICKHOUSE_CLUSTER_ENABLED`). As scale demands grow, this may need to become the default.

4. **Centralized entitlement registry**: Entitlements are currently split between `entitlements.ts`, `ee-license-check`, and Cloud-specific env vars. A unified entitlement registry could reduce configuration surface.

5. **Cross-region data governance**: With deployments in EU, US, HIPAA, JP (`.github/workflows/deploy.yml:23-27`), data residency controls may become more complex.

## Questions / Gaps

1. **No evidence found** for how the team structured emergency access (break-glass procedures) beyond the admin API key (`env.prod.example:310`).

2. **No evidence found** for rate limiting tiers per plan (the `LANGFUSE_RATE_LIMITS_ENABLED` flag at `env.prod.example:319` exists but entitlement mapping was not located).

3. **No evidence found** for how feature flags are managed during rollout (canary deployments, gradual feature enablement).

4. **No evidence found** for on-call rotation or incident response procedures in the repository (beyond Slack CI notifications at `pipeline.yml:793-840`).

5. **No evidence found** for API versioning strategy beyond the Fern-generated OpenAPI spec (`fern/apis/`). The version is bumped globally (`package.json:4`).

---

Generated by `study-areas/22-organizational-architecture.md` against `langfuse`.
