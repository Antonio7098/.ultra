# Patchwork — Entrypoints & Platform Integrations

## Overview

Patchwork is a **patch tracking system** for community-based projects, primarily the Linux kernel. It is not an AI code review agent — it is a web-based database that tracks patches submitted to mailing lists. Patches enter via email (mailing list integration), are stored with metadata (state, delegate, tags), and exposed through a web UI, REST API, and XML-RPC API.

## Supported Entrypoints

### 1. Mail Ingestion (Primary Entrypoint)

Patches and comments arrive via email. This is the core entrypoint and the only way new patches enter the system.

- **`patchwork/bin/parsemail.sh`**: Shell wrapper calling `manage.py parsemail`, intended as a mail delivery agent (MDA) for Postfix or similar MTA. Exits 0 always to prevent bounces on parse errors (`patchwork/bin/parsemail.sh:23-29`).
- **`patchwork/bin/parsemail-batch.sh`**: Shell wrapper calling `manage.py parsearchive` for batch-processing mbox archives (`patchwork/bin/parsemail-batch.sh:19-21`).
- **`patchwork/management/commands/parsemail.py`**: Django management command that reads a single email from stdin or a file, delegates to `parse_mail()` (`patchwork/management/commands/parsemail.py:35-71`).
- **`patchwork/management/commands/parsearchive.py`**: Batch archive parser (referenced by the batch script).
- **`patchwork/parser.py`**: The core email parsing engine (`patchwork/parser.py:1192-1512`). It extracts patches, cover letters, and comments from email; determines the project via `List-ID` and subject matching (`patchwork/parser.py:158-214`); handles series grouping via references and markers (`patchwork/parser.py:217-336`); and stores results in the database.

### 2. Web UI (Django WSGI Application)

- **`patchwork/wsgi.py`**: WSGI application entrypoint (`patchwork/wsgi.py:13-15`).
- **`patchwork/urls.py`**: URL routing for the entire application (`patchwork/urls.py:31-382`).
- Serves HTML pages for browsing patches, projects, series, bundles, comments, and user profiles.
- Django admin at `/admin/`.
- Template-based rendering with MIT-licensed templates in `templates/`.

### 3. REST API (Django REST Framework)

- **`patchwork/api/`**: DRF-based REST API with versioned endpoints (`patchwork/urls.py:215-366`).
- Endpoints: `/api/1.0/`, `/api/1.1/`, `/api/1.2/`, `/api/1.3/`, `/api/1.4/`.
- Resources: patches, covers, series, projects, people, users, checks, events, bundles, comments.
- **`patchwork/settings/base.py:180-184`**: Authentication uses `SessionAuthentication`, `BasicAuthentication`, and `TokenAuthentication`.
- **`patchwork/models.py:25-26`**: REST API token model (`rest_framework.authtoken.models.Token`) is conditionally imported when `ENABLE_REST_API` is True.
- **`patchwork/api/base.py:97-107`**: Permission system uses `PatchworkPermission` which grants read to all, write only if `obj.is_editable(user)`.

### 4. XML-RPC API (Deprecated)

- **`patchwork/views/xmlrpc.py`**: XML-RPC dispatcher with methods for listing/fetching projects, people, patches, states, and checks (`patchwork/views/xmlrpc.py:111-145`).
- **`patchwork/settings/base.py:261`**: Disabled by default (`ENABLE_XMLRPC = False`).
- **`patchwork/urls.py:210-213`**: URL routing gated by `settings.ENABLE_XMLRPC`.
- Authentication via HTTP Basic Auth for write methods (`patchwork/views/xmlrpc.py:49-73`).

### 5. Django Management Commands (CLI)

Available through `manage.py` (`manage.py:5-17`):

| Command | File | Purpose |
|---------|------|---------|
| `parsemail` | `patchwork/management/commands/parsemail.py` | Parse single mbox email |
| `parsearchive` | (referenced) | Parse mbox archives |
| `cron` | `patchwork/management/commands/cron.py` | Send notifications, expire confirmations |
| `retag` | `patchwork/management/commands/retag.py` | Re-tag patches |
| `replacerelations` | `patchwork/management/commands/replacerelations.py` | Replace patch relations |
| `rehash` | `patchwork/management/commands/rehash.py` | Re-hash patches |
| `dumparchive` | `patchwork/management/commands/dumparchive.py` | Dump archive |

### 6. Git Post-Receive Hook (Git Integration)

- **`tools/post-receive.hook`**: A post-receive hook that automatically updates patch states in Patchwork when commits are pushed to a Git repository (`tools/post-receive.hook:1-86`).
- Uses `pwclient` CLI to find and update patches by content hash.
- Maps branches to target states (e.g., `refs/heads/main:Accepted`).
- **`tools/patchwork-update-commits`**: Alternative script that iterates over a revspec and updates patches to Accepted state.

### 7. Docker / Container Deployment

- **`docker-compose.yml`**: MySQL + web service (`docker-compose.yml:1-38`).
- **`docker-compose-pg.yml`**: PostgreSQL variant (`docker-compose-pg.yml:1-33`).
- **`docker-compose-sqlite3.yml`**: SQLite variant (referenced in CI).
- **`tools/docker/Dockerfile`**: Builds from `ghcr.io/getpatchwork/pyenv`, installs Python/mysql/postgres clients, sets entrypoint (`tools/docker/Dockerfile:1-41`).
- **`tools/docker/entrypoint.sh`**: Entrypoint that waits for DB, runs migrations, loads fixtures, then executes the command (`tools/docker/entrypoint.sh:1-105`).

### 8. WSGI / HTTP Server Config

- **`lib/apache2/patchwork.wsgi.conf`**: Apache2 WSGI configuration (`lib/apache2/patchwork.wsgi.conf:1-8`).
- **`lib/nginx/patchwork.conf`**: nginx configuration.
- **`lib/uwsgi/`**: uWSGI configuration.

## Authentication Model

Patchwork uses multiple authentication schemes depending on the entrypoint:

| Entrypoint | Auth Method | Details |
|------------|-------------|---------|
| Web UI | Django Session + Password | Standard Django auth with login/logout/register (`patchwork/urls.py:154-165`) |
| REST API | Session, Basic, Token | `rest_framework.authentication.SessionAuthentication`, `BasicAuthentication`, `TokenAuthentication` (`patchwork/settings/base.py:180-184`) |
| XML-RPC | HTTP Basic Auth | Username/password encoded in Basic auth header (`patchwork/views/xmlrpc.py:49-73`) |
| Mail | None (implicitly trusted) | Mail comes from MTA pipe; no authentication on the mail itself beyond standard email headers |
| Git Hook | pwclient credentials | Uses pwclient with configured credentials from `.pwclientrc` |
| Email Notifications | Email confirmation link | Users confirm email opt-out/in via emailed links (`patchwork/views/notification.py:16-38`) |

## Platform-Specific Assumptions

Patchwork makes very specific assumptions that distinguish it from a modern code review agent:

1. **Mailing list as source of truth**: Patches enter exclusively via email (`patchwork/parser.py:1192-1218`). There is no GitHub/GitLab/Azure DevOps integration for fetching patches from pull/merge requests.
2. **List-ID routing**: Projects are identified by mailing list `List-ID` header and optional subject regex matching (`patchwork/parser.py:158-214`). This assumes a one-project-per-list model.
3. **Git-based workflow**: The `Check` model (`patchwork/models.py:1094-1147`) and post-receive hook (`tools/post-receive.hook:1-86`) assume patches are tested and committed via Git.
4. **No PR/MR concept**: Patchwork models have no notion of pull requests, merge requests, forks, or branches (aside from `commit_ref` on patches).
5. **Single review state machine**: Patches flow through states (New, Under Review, Accepted, Rejected, etc.) defined in `State` model (`patchwork/models.py:246-257`). No inline code comments or line-level review.
6. **DMARC/From mangling**: The parser has special handling for mailing lists that mangle the `From` header for DMARC compliance (`patchwork/parser.py:393-427`).

## Repository Permissions

Patchwork's permission model is **not about repository access** (there is no VCS integration) but about object-level permissions:

- **Project maintainers**: Users with `maintainer_projects` relationship can edit patches/checks in their projects (`patchwork/models.py:109-112`, `patchwork/models.py:153-162`).
- **Patch delegates**: Assigned users can edit their delegated patches (`patchwork/models.py:582-593`).
- **Patch submitters**: Original submitters can edit their patches (`patchwork/models.py:582-593`).
- **No repo-level access control**: There is no integration with GitHub/GitLab permissions, as patches don't come from those platforms.

## Operational Tradeoffs

### Strengths

1. **Simple, proven mail-based workflow**: The email-driven model works well for kernel-style development where patches are submitted to mailing lists.
2. **Self-hostable**: Fully self-contained Django app with Docker support, Apache/nginx/uWSGI configs provided.
3. **Versioned REST API**: Multiple API versions (1.0-1.4) with careful backward compatibility (`patchwork/urls.py:348-366`).
4. **CI integration via Checks**: The `Check` model provides a way for CI tools to report status via the REST API (`patchwork/api/check.py:99-116`).
5. **Extensible via API clients**: The `pwclient` ecosystem (external project) provides CLI and library access.

### Weaknesses

1. **No modern VCS platform integration**: No GitHub Actions, GitLab CI, or webhook support for pull/merge requests. This is a fundamental gap for a "code review agent."
2. **Email-only ingestion**: All patches must arrive via email, which creates operational burden (MTA setup, DMARC handling, bounce management).
3. **No diff review/comments inline**: Patchwork tracks patches and comments but doesn't support inline code review comments (no file+line annotations).
4. **Stale XML-RPC API**: The XML-RPC API is deprecated and disabled by default (`patchwork/settings/base.py:261`).
5. **Manual/permission-gated writes**: The REST API write permissions are tied to maintainer/owner roles, not CI token scopes.
6. **Passive notification model**: Patch change notifications are sent via email with a delay (`NOTIFICATION_DELAY_MINUTES = 10`), not pushed via webhooks.

## Patterns Worth Copying for Ultraplan

1. **API versioning through URL path**: Patchwork uses `api/1.0/`, `api/1.1/` etc., with versioned fields in serializers (`patchwork/api/patch.py:198-204`). This is simple and allows graceful evolution without breaking clients.

2. **Pluggable database backends**: Supports PostgreSQL, MySQL, and SQLite3 via environment variables (`patchwork/settings/base.py:119-150`). Good for self-hosting flexibility.

3. **Multiple auth schemes in REST API**: Session + Basic + Token auth (`patchwork/settings/base.py:180-184`) allows both human users (web session) and automated tools (token) to use the same API.

4. **Serialized filter system**: `django-filter` integration with custom filter backends provides consistent filtering across API endpoints (`patchwork/api/filters.py`).

5. **Link-header pagination**: Github-style Link header pagination instead of embedded pagination metadata (`patchwork/api/base.py:54-94`).

6. **CI check abstraction**: The `Check` model (`patchwork/models.py:1094-1147`) provides a clean, extensible mechanism for external tools to report patch status with context labels, target URLs, and state (pending/success/warning/fail).

7. **Mail-to-patch parsing**: The `parse_patch()` state machine in `patchwork/parser.py:879-1042` is a robust implementation for extracting diffs from email bodies, handling multiple patch formats, extended headers, and binary patches.

## Rating

**Score: 4/10**

**Rationale**: Patchwork is a mature, well-architected Django application for its intended purpose (mailing-list-based patch tracking). However, as a code review agent entrypoint, it scores low because:

- **No GitHub/GitLab/Azure DevOps integration exists** — all content enters via email, not pull/merge requests.
- **No webhook support** — no event-driven trigger from VCS platforms.
- **No CI pipeline integration as an agent** — it's a passive tracking system, not an active reviewer.
- **Authentication is database-local** — no OAuth app integration, no GitHub App installation flow.

For Ultraplan's purposes, Patchwork is the wrong archetype. The useful patterns to extract are in the API design (versioning, filtering, pagination, multi-auth) and the check-status abstraction, not the integration model itself.

## Answers to Study Questions

### 1. What are the supported ways to trigger a review?

Patches enter Patchwork exclusively via email (pipe from MTA or batch file). There is no "trigger a review" concept — patches arrive, are parsed, and stored. State changes are triggered by manual UI actions, API calls, or the Git post-receive hook.

### 2. Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**Self-hosted web service**. Patchwork is a Django application intended to be deployed on a server (WSGI behind Apache/nginx). It provides Docker support for development. It is not a SaaS service (though instances like patchwork.kernel.org exist), not a CI job, and not a local CLI (though `pwclient` is a separate CLI tool).

### 3. How does it authenticate with the code hosting platform?

It does not. Patchwork has no code hosting platform integration. It authenticates users internally via Django auth (sessions for web, tokens/HTTP Basic for API).

### 4. What repository permissions does it require?

None. Patchwork does not access code repositories. The `Project` model stores optional `web_url`, `scm_url`, and `commit_url_format` fields for display purposes only (`patchwork/models.py:83-96`).

### 5. How hard would it be to install this in a private repo?

**Not applicable** — Patchwork does not work with repos. It works with mailing lists. Installing it for private use requires setting up a Django application with a database and an MTA configuration to pipe incoming mail to `parsemail`. This is moderately complex (Django + DB + MTA setup) but well-documented.

### 6. Does the integration model create security or operational risks?

- **Mail injection**: The mail parser (`patchwork/parser.py`) accepts emails from any source configured in the MTA. A malformed email can cause `ValueError` or `IntegrityError` (handled: `patchwork/management/commands/parsemail.py:65-70`), but the exit code is always 0 to avoid bounces (`patchwork/bin/parsemail.sh:29`), which could mask failures.
- **No auth on mail**: Email headers (From, List-ID) are trusted for identity and routing. No cryptographic verification is performed.
- **CSRF protection**: Standard Django CSRF middleware protects HTML forms (`patchwork/settings/base.py:34`).
- **XML-RPC disabled by default**: The older XML-RPC API is opt-in (`patchwork/settings/base.py:261`), reducing attack surface.

### 7. Which integration model would be easiest to adapt for Ultraplan?

The **REST API + Check model** (`patchwork/api/check.py:99-116`) is the most portable piece. The pattern of posting CI check results to a patch via `POST /api/1.4/patches/{id}/checks/` with token authentication is a clean, reusable abstraction. However, the overall email-driven architecture is not a suitable starting point for a modern code review agent that needs GitHub/GitLab PR integration.

The **API pagination and filtering patterns** (`patchwork/api/base.py:54-94`, `patchwork/api/filters.py`) and **versioned serializer fields** (`patchwork/api/patch.py:198-204`) are architectural patterns worth replicating.
