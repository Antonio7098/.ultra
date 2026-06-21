# Repo Analysis: openhands

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | openhands |
| Path | `repos/openhands` |
| Language / Stack | Python 3.12+ (Poetry) / TypeScript-React 19 (npm) |
| Analyzed | 2026-05-17 |

## Summary

OpenHands implements a **dual-mode organizational architecture**. In OSS mode, it assumes a solo developer or small team running locally with minimal infrastructure. In Enterprise (SaaS) mode — enabled by the `enterprise/` directory and `SaaSServerConfig` (`enterprise/server/config.py:54`) — it provides full multi-tenant organization management with RBAC, role hierarchies, org-scoped settings, and billing. The architecture clearly distinguishes app development (the OSS product, customizable through plugins and agents) from platform development (the SaaS infrastructure, integrations, and deployment concerns). The OSS side is self-serve with a simple Docker Compose deployment; the Enterprise side assumes a platform team managing K8s, databases, Keycloak, Stripe, and third-party integrations.

## Rating

**Score: 7** — Clear separation of concerns with role-appropriate interfaces. The OSS/Enterprise boundary (`openhands/app_server/config.py:239-419` and `enterprise/server/config.py:54`) cleanly separates self-serve from platform-managed. The Enterprise provides explicit org/role/permission model. Docked because the OSS mode has no organizational structure at all (single user, no teams), and the Enterprise multi-tenancy is only available under a commercial license.

Fast heuristic: "Could a platform team and a feature team work independently?" — **Yes, in Enterprise mode.** The platform team owns infrastructure (`ServerConfig`, `SaaSServerConfig`, database migrations, K8s manifests, CI/CD pipelines). Feature teams consume via APIs, org-scoped settings, and the web UI with permission-based access.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Dual-mode architecture (OSS vs SaaS) | `ServerConfig` sets `app_mode = AppMode.OPENHANDS` by default; `SaaSServerConfig` overrides to `AppMode.SAAS` | `openhands/app_server/server_config/server_config.py:9-11`; `enterprise/server/config.py:54` |
| Dynamic config loading via env var | `OPENHANDS_CONFIG_CLS` env var switches between OSS and Enterprise config at runtime | `openhands/app_server/server_config/server_config.py:10-11` |
| OSS deployment: single Docker Compose service | `docker-compose.yml` defines one service (`openhands`) with Docker socket mount | `docker-compose.yml:2-24` |
| K8s deployment infra (dev) | Kind cluster, deployment, service, RBAC roles, nginx ingress for dev K8s testing | `kind/manifests/deployment.yaml`; `kind/manifests/role.yaml:1-14` |
| Enterprise auth: Keycloak OAuth | `SaasUserAuth` uses Keycloak for OAuth; OSS uses user-provided PAT | `enterprise/server/auth/saas_user_auth.py`; comparison table in `enterprise/README.md:27-35` |
| Organization model (multi-tenant) | `Org` SQLAlchemy model with UUID PK, encrypted secrets, relationships to members, billing, settings | `enterprise/storage/org.py:1-161` |
| Org membership with roles | `OrgMember` junction table linking users to orgs with `role_id` FK, per-member LLM key overrides | `enterprise/storage/org_member.py:1-79` |
| Three-tier RBAC | `RoleName` enum: `OWNER`, `ADMIN`, `MEMBER` with hierarchical permissions via `ROLE_PERMISSIONS` | `enterprise/server/auth/authorization.py:94-173` |
| Permission-based access control | `require_permission()` FastAPI dependency factory for fine-grained permissions (MANAGE_SECRETS, INVITE_USER, etc.) | `enterprise/server/auth/authorization.py:246-341` |
| Org context resolution precedence | Effective org ID resolved: API key binding > X-Org-Id header > user.current_org_id | `enterprise/server/auth/org_context.py:37-78` |
| App-level permission system (frontend) | `createPermissionGuard` React Router `clientLoader` factory checks role permissions at route level | `frontend/src/utils/org/permission-guard.ts` (via search) |
| Frontend org hooks (17 org endpoints) | `organization-service.api.ts` provides full CRUD: orgs, members, invitations, settings, git claims | `frontend/src/api/organization-service/organization-service.api.ts` (via search) |
| Org UI components | 12 org components: org selector, member list, role context menu, invitations, git routing | `frontend/src/components/features/org/` (directory listing) |
| Settings scoping | `SettingsScope` type `"personal" | "org"` — settings may be personal or org-wide | `frontend/src/types/settings.ts:111` |
| CI/CD: 19 workflows | Build, test, lint, publish (PyPI/npm/Docker), PR review, stale management | `.github/workflows/` (19 files) |
| Deployment doc: single developer setup | `Development.md` guides individual developers through manual prerequisite install | `Development.md:1-331` |
| Makefile: self-serve build | `make build` checks system, Python, Node, Docker, Poetry, tmux; all local developer tooling | `Makefile:33-53` |
| Config template: infrastructure assumptions | 394-line `config.template.toml` with K8s, Docker sandbox, Redis, MCP, model routing sections | `config.template.toml:1-394` |
| Enterprise integrations: multi-provider | GitHub, GitLab, Bitbucket (Cloud + DC), Jira (Cloud + DC), Linear, Slack integration models | `enterprise/storage/` (directories for each) |
| Enterprise migration management | Alembic migrations directory for database schema changes | `enterprise/migrations/` |
| Billing: Stripe integration | `stripe_customer.py`, `subscription_access.py`, `billing_session.py` models | `enterprise/storage/stripe_customer.py`; `enterprise/storage/subscription_access.py` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

**Two distinct profiles depending on mode:**

- **OSS mode**: Assumes **no team structure** — a single developer or small group running locally. No auth (PAT-based), no orgs, no roles, no multi-tenancy. The Docker Compose setup (`docker-compose.yml`) and Makefile are designed for a single machine, single user.
- **Enterprise mode**: Assumes a **platform team + feature teams** structure. The platform team manages infrastructure (K8s, PostgreSQL, Keycloak, Stripe, integrations); feature teams consume the platform through org-scoped settings and permission-gated routes. The three-tier role hierarchy (`owner > admin > member`) in `enterprise/server/auth/authorization.py:94-100` mirrors organizational reporting lines.

### 2. Is the system self-serve or platform-managed?

**OSS is self-serve.** The Makefile (`Makefile:33-40`) provides a single `make build` command that installs all dependencies, checks prerequisites, and builds the frontend. The `make run` command starts both backend and frontend. No external infrastructure is required beyond Docker.

**Enterprise is platform-managed.** The `SaaSServerConfig` (`enterprise/server/config.py:54`) wires in database-backed stores, Keycloak auth, and conditional integrations. The `enterprise/migrations/` directory assumes a DBA manages schema changes. The `SetAuthCookieMiddleware` (`enterprise/server/middleware.py:21-193`) enforces auth centrally. Feature flags (`ENABLE_BILLING`, `HIDE_LLM_SETTINGS`) are controlled by the platform operator.

### 3. How is ownership divided between platform and feature teams?

The architecture divides ownership through several mechanisms:

- **Code boundary**: The `enterprise/` directory is source-available under Polyform Free Trial License (`enterprise/README.md:3`), creating a legal ownership boundary. The core `openhands/` and `frontend/` are MIT.
- **Config inheritance**: `SaaSServerConfig` extends `ServerConfig` (`enterprise/server/config.py:54` via `openhands/app_server/server_config/server_config.py:9`). The platform team configures the base system; feature teams consume it.
- **Org-scoped settings**: Settings can be personal or org-wide (`frontend/src/types/settings.ts:111`). Platform sets defaults; org admins override for their teams; individuals override for themselves.
- **Permission model**: Feature team members cannot change org name, delete org, or change other roles (`enterprise/server/auth/authorization.py:103-173`). Those are platform/owner actions.
- **Org-level LLM key override**: `OrgMember._llm_api_key` (`enterprise/storage/org_member.py:17`) allows individual members to use their own LLM keys while org defaults apply otherwise.

### 4. What operational expertise is required?

| Role | Required Expertise | Evidence |
|------|-------------------|----------|
| OSS user | Docker, Python basics, Node.js | `Development.md:1-331` — walks through brew/apt install of Python, Node, Docker |
| Enterprise platform operator | Kubernetes, PostgreSQL, Keycloak, Alembic, Stripe, Redis, observability (OpenTelemetry, Datadog) | `config.template.toml` K8s section (`config.template.toml:301-343`); `pyproject.toml` deps for asyncpg, redis, opentelemetry (`pyproject.toml:27,65-66,92,228`); `enterprise/pyproject.toml` for keycloak, stripe, posthog, ddtrace |
| Enterprise feature team | Web UI usage, Git provider integration setup, org settings management | `frontend/src/routes/settings.tsx` — settings hub with permission-guarded routes |
| Integrations engineer | OAuth flows (GitHub, GitLab, Bitbucket, Jira, Linear, Slack), webhook management | `enterprise/server/auth/saas_user_auth.py` OAuth; `enterprise/storage/` integration stores |

### 5. How is governance enforced organizationally?

Governance is enforced at multiple layers:

- **API-level**: `require_permission()` (`enterprise/server/auth/authorization.py:246-341`) is a FastAPI `Depends` factory — every protected endpoint declares the minimum permission required.
- **Route-level**: Frontend `createPermissionGuard` (`frontend/src/utils/org/permission-guard.ts`) prevents unauthorized navigation. Org-defaults routes use `requireOrgDefaultsRedirect` to ensure only team orgs (not personal) access them.
- **Conversation isolation**: `_apply_user_and_org_filter()` in `saas_app_conversation_info_injector.py` filters conversations by org_id, preventing cross-org data leakage.
- **API key binding**: `org_context.py:37-66` ensures API-key-authenticated requests can only access their bound org. If `X-Org-Id` header conflicts with the key's org, a 403 is raised.
- **Financial data access**: `require_financial_data_access` (`enterprise/server/auth/authorization.py:344-434`) restricts billing endpoints to admin/owner or @openhands.dev email.

### 6. What is the assumed scale of the team?

- **OSS mode**: 1–5 individuals. No organizational tooling exists. The Makefile assumes a single developer on a single machine.
- **Enterprise mode**: 5–500+ members. The org model supports many users per org. The paginated member listing (`getOrganizationMembers`), rate limiting (config.toml `max_concurrent_conversations = 3` at `config.template.toml:91`), and K8s resource requests/limits (`config.template.toml:317-325`) suggest production deployments serving many concurrent users.

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, explicitly.** The dual-mode architecture is a direct manifestation of this distinction:

- **App dev** focuses on the core agent loop, skills, frontend UI, and SDK — all in the MIT-licensed `openhands/` and `frontend/` directories. App devs build agents, tools, and user-facing features.
- **Platform dev** manages deployment infrastructure, auth, billing, database migrations, integrations, and analytics — largely in `enterprise/`. Platform devs configure `SaaSServerConfig`, manage Keycloak realms (`enterprise/allhands-realm-github-provider.json.tmpl`), run Alembic migrations, and set up the Stripe billing pipeline.
- The plugin/extension mechanism (SDK at `pyproject.toml:59-62`, MCP at `config.template.toml:344-383`, skills at `skills/`) further supports this: app devs extend the product without touching platform concerns.

## Architectural Decisions

| Decision | Rationale | File:Line |
|----------|-----------|-----------|
| Dynamic config class loading via `OPENHANDS_CONFIG_CLS` | Single binary (Docker image) serves both OSS and Enterprise; deployment chooses via env var | `openhands/app_server/server_config/server_config.py:10-11,47-55` |
| Org context resolution with strict precedence chain | Prevents org isolation bypass when multiple auth methods are in play | `enterprise/server/auth/org_context.py:37-78` |
| Three-tier role hierarchy with permission sets (not RBAC groups) | Simple enough for small teams, extensible for large; permission composition over role inheritance | `enterprise/server/auth/authorization.py:94-173` |
| Encrypted secrets at org and member level (`SecretStr` backed) | Multi-tenant security: each org's LLM keys, search keys, sandbox keys encrypted independently | `enterprise/storage/org.py:127-161` |
| Settings as diff layers (org defaults + member overrides) | Feature teams can customize without platform intervention; platform sets safe defaults | `enterprise/storage/org_member.py:24-25` (agent_settings_diff, conversation_settings_diff) |
| Source-available Enterprise under Polyform | Monetization strategy: full code visibility without open-source redistribution rights | `enterprise/LICENSE`; `enterprise/README.md:3` |
| V1 app server as the default path | Consolidates OSS and enterprise into one server architecture with pluggable injectors | `openhands/app_server/config.py:190-237` (AppServerConfig with injector pattern) |

## Notable Patterns

**Permission-based authorization over pure RBAC** (`enterprise/server/auth/authorization.py:47-173`): Instead of checking "is user admin?", the system checks "does user have `INVITE_USER_TO_ORGANIZATION` permission?" This is more granular and composable. Three roles (owner/admin/member) each map to a `frozenset` of permissions. Adding a new permission to a role is a dictionary change, not a code restructuring.

**Inheritable config override pattern** (`SaaSServerConfig` extends `ServerConfig` at `enterprise/server/config.py:54`): The Enterprise mode inherits all of OSS config and overrides specific stores (settings, secrets, auth). This minimizes duplication and ensures OSS fixes automatically flow to Enterprise.

**Injector-based dependency injection** (`openhands/app_server/config.py:213-236`): Services (sandbox, events, conversations, etc.) are pluggable via injectors selected by environment. This allows swapping local file storage for S3/GCP without code changes, and lets Enterprise override individual services.

**Parallel npm/Bun/Go/Python toolchains**: The repo manages four language ecosystems — Python (Poetry), TypeScript (npm), UI library (Bun), K8s (kind). This reflects an organizational assumption that different teams own different parts.

**AI-powered code review** (`pr-review-by-openhands.yml`): The project uses its own product (OpenHands) to review PRs. This is a dogfooding pattern that also suggests an ops team comfortable with AI tooling.

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| OSS simplicity vs Enterprise complexity | OSS mode is trivially deployable (`docker compose up`) but has no teams, auth, or persistence guarantees. Enterprise mode has full multi-tenancy but requires K8s, PostgreSQL, Keycloak, Stripe — significant operational burden. |
| Source-available vs fully open | Enterprise code is visible but not usable for free beyond 30 days. This creates friction for teams evaluating the product but protects the business model. |
| Permission granularity vs mental model | 20+ permissions (`authorization.py:47-91`) give fine control but require admins to understand permission semantics. The three-role hierarchy simplifies this but loses granularity for edge cases. |
| Config template bloat vs flexibility | `config.template.toml` (394 lines) covers every option — K8s, MCP, model routing, condensation strategies. Powerful but intimidating for new users. |
| Dual config loading via env var vs explicit | `OPENHANDS_CONFIG_CLS` is a powerful abstraction but makes it non-obvious which config is active. Debugging requires checking env vars. |

## Failure Modes / Edge Cases

1. **Org context mismatch**: If `X-Org-Id` header specifies an org the user doesn't belong to, a 403 is returned (`org_context.py:54-65`). But if the header is omitted entirely and the user has no `current_org_id`, the system returns 404 — a potentially confusing distinction (the org exists, but you're not in it).

2. **OSS-to-Enterprise migration**: The OSS mode has no org model, so migrating a single-user OSS deployment to Enterprise requires creating orgs, inviting users, and mapping settings. No migration path is documented; the two config classes are incompatible by design.

3. **Permission escalation via API keys**: `org_context.py:42-53` binds API keys to a single org with 403 enforcement. But if an API key is compromised, the attacker has all permissions of the key's role within that org. The system relies on the Stripe billing/customer model for abuse detection.

4. **Member with no org**: `maybe_resolve_effective_org_id()` returns `None` (line 69-78), which cascades through `get_org_info()`. Routes that check permissions without handling the `None` case could produce opaque errors.

5. **Enterprise vs OSS frontend confusion**: The frontend checks `config.app_mode === "saas"` to decide which features to show. If `config.app_mode` doesn't match the actual backends (e.g., misconfigured `OPENHANDS_CONFIG_CLS`), users may see broken routes or missing features.

6. **Concurrent config loading**: `ServerConfig` is loaded via `load_server_config()` (`openhands/app_server/server_config/server_config.py:47-55`) which reads `OPENHANDS_CONFIG_CLS` once at startup. Changing the env var requires a restart. This is fine for production but surprising during development.

## Future Considerations

- **Org hierarchy (sub-orgs)**: The current flat org model could be extended with parent-child orgs for large enterprises. The `Org` model already has `org_version` and rich configuration columns that support hierarchical extensions.
- **Custom roles**: The `Role` model (`enterprise/storage/role.py`) allows arbitrary role names with rank. The current code only uses three roles, but the architecture supports custom role creation.
- **Cross-org collaboration**: Conversation sharing (`shared-conversation.tsx` route exists) could be extended to cross-org sharing with explicit permission grants.
- **Audit logging**: The permission infrastructure exists but no audit trail for admin actions (role changes, org deletions) is visible. A `Permission.CHANGE_USER_ROLE_ADMIN` is defined, but no event log captures who did what.
- **Self-serve org creation**: Currently, orgs are likely created through the billing pipeline. A self-serve "create team" flow in the frontend would reduce platform team burden.

## Questions / Gaps

1. **How are orgs created in Enterprise?** No frontend route or API endpoint for org creation was found in the evidence. Org creation may be a backend/admin-only operation triggered via Stripe checkout or manual DB seeding.
2. **What is the personal org model?** The frontend distinguishes personal vs team orgs (`use-org-type-and-access.ts`), but the `Org` model doesn't have an `is_personal` field visible in the storage schema. This may be inferred (e.g., user count == 1) or stored elsewhere.
3. **How does the `x-api-key` auth work with org binding?** The `require_permission()` function validates API key org binding (`authorization.py:273-280`), but the API key creation flow and org-binding mechanism were not fully traced.
4. **No evidence of deployment documentation for production Enterprise K8s.** The `kind/` directory is for development. Production K8s manifests (Helm charts, Terraform) are not in this repo — they may live in OpenHands-Cloud.
5. **SDK credentials inheritance gap**: The sandbox settings API uses `LookupSecret` for credential inheritance, but how this maps to org-level vs personal-level secrets was partially traced. The `org_member._llm_api_key` field suggests per-member overrides exist, but the full inheritance chain is unclear.

---

Generated by `study-areas/22-organizational-architecture.md` against `openhands`.
