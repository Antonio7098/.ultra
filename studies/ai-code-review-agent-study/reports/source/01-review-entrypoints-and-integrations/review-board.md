# Study: Dimension 01 — Review Entrypoints & Platform Integrations

**Source:** review-board  
**Repository:** https://github.com/reviewboard/reviewboard  
**Analyzed:** 2026-06-01  

---

## Overview

Review Board is a **self-hosted, web-based code and document review platform** written in Django. It is not an AI code review agent but a human-centric code review management system. It has been under active development since 2006 and supports integration with 22+ hosting services and 8+ SCM systems.

The project consists of two main components: the Review Board server (this repo) and RBTools (a separate repo at https://github.com/reviewboard/rbtools/) — a CLI tool for posting changes for review.

---

## 1. Supported Entrypoints

### 1.1 Web Application (Primary)

- **WSGI entrypoint**: `reviewboard/wsgi.py:95` — standard Django WSGI application served behind a web server (nginx/Apache).
- **URL routing**: `reviewboard/urls.py:71-161` — mounts the web API at `/api/`, review UI at `/r/`, admin at `/admin/`, OAuth2 at `/oauth2/`, and per-repository webhook receivers under `/repos/<id>/<service>/`.
- **Management commands**: `reviewboard/manage.py:336` — Django `manage.py` for site administration (upgrade, createdb, evolve, runserver).

### 1.2 CLI Site Administration

- **`rb-site`**: `reviewboard/cmdline/rbsite.py` (registered in `pyproject.toml:49`) — installs, upgrades, and manages Review Board sites. Not a code review entrypoint; purely administrative.
- **`rbext`**: `reviewboard/cmdline/rbext.py` (registered in `pyproject.toml:50`) — manages extensions.
- **`rbssh`**: `reviewboard/cmdline/rbssh.py` (registered in `pyproject.toml:51`) — SSH helper for repository access.

### 1.3 Incoming Webhook Receivers

Per hosting service webhook endpoints for auto-closing review requests on push:

| Service   | Webhook URL Pattern                 | Handler                                            |
|-----------|-------------------------------------|----------------------------------------------------|
| GitHub    | `/repos/<id>/github/hooks/close-submitted/` | `reviewboard/hostingsvcs/github.py:536-610` |
| GitLab    | (no built-in webhook receiver)      | N/A — uses API polling instead                    |
| Bitbucket | `/repos/<id>/bitbucket/hooks/close-submitted/` | `reviewboard/hostingsvcs/bitbucket.py`      |
| Forgejo   | `/repos/<id>/forgejo/hooks/close-submitted/` | `reviewboard/hostingsvcs/forgejo/views.py:49-100` |
| RB Gateway| `/repos/<id>/rbgateway/hooks/close-submitted/` | `reviewboard/hostingsvcs/rbgateway.py:46-100` |

Webhook URLs are dynamically registered via the `HostingServiceRegistry` in `reviewboard/hostingsvcs/base/registry.py:207-234`. Each hosting service defines `repository_url_patterns` which are injected into a `DynamicURLResolver` (`reviewboard/hostingsvcs/urls.py:7`).

### 1.4 Outgoing Webhooks

- **Configuration**: `WebHookTarget` model in `reviewboard/notifications/models.py:17-179`
- **Dispatching**: `reviewboard/notifications/webhooks.py` — sends POST requests to configured URLs on events like `review_request_published`, `review_published`, etc.
- **Encoding**: JSON, XML, or form-encoded (`reviewboard/notifications/models.py:35-43`).
- **Security**: HMAC-SHA256 signing via configurable `secret` field (`reviewboard/notifications/models.py:99-100`).

### 1.5 Email Notifications

- **Backend**: `reviewboard/notifications/email/backend.py` — sends email notifications for review request activity via SMTP.
- **Signal handlers**: `reviewboard/notifications/email/signal_handlers.py` — connects to Django signals for review lifecycle events.

### 1.6 REST API

- **Endpoint**: `/api/` (`reviewboard/urls.py:122`)
- **Resources**: 85+ resource types in `reviewboard/webapi/resources/` covering repositories, review requests, diffs, comments, users, groups, sessions, webhooks, etc.
- **Authentication**: Session-based, OAuth2, or API tokens.

### 1.7 OAuth2 Provider

- **Module**: `reviewboard/oauth/` — allows third-party applications to authenticate via OAuth2.

### 1.8 Extension System

- **Base class**: `reviewboard/extensions/base.py` — plugins can add URL patterns, API resources, hooks, and integration configs.
- **Integration framework**: `reviewboard/integrations/base.py:17-41` — higher-level pluggable components that can hold multiple active configurations (e.g., Slack messaging per-channel).

---

## 2. Authentication Model

### 2.1 Web Application Authentication

- Django session-based auth (username/password)
- OAuth2 provider (`reviewboard/oauth/`)
- API token auth for programmatic access
- Two-factor authentication support

### 2.2 Hosting Service Authentication

Each hosting service has its own auth mechanism, stored encrypted in `HostingServiceAccount.data`:

| Service   | Credential Type                | Storage                  | Auth Verification                                                                 |
|-----------|--------------------------------|--------------------------|-----------------------------------------------------------------------------------|
| GitHub    | Personal Access Token (classic or fine-grained) | `personal_token` encrypted in DB (`reviewboard/hostingsvcs/github.py:938`) | HTTP GET to `/user`, checks `X-OAuth-Scopes` header for classic PATs (`reviewboard/hostingsvcs/github.py:906-930`) |
| GitLab    | Private/API token              | `private_token` encrypted in DB (`reviewboard/hostingsvcs/gitlab.py:411-413`) | HTTP GET to `/projects?per_page=1` tries API v3/v4 (`reviewboard/hostingsvcs/gitlab.py:1452-1505`) |
| Bitbucket | Atlassian API token            | Encrypted in DB (`reviewboard/hostingsvcs/bitbucket.py`) | HTTP GET to user endpoint |
| Forgejo   | API token                      | `api_token` encrypted in DB (`reviewboard/hostingsvcs/forgejo/service.py:94`) | HTTP GET to `/user` with token |
| Gerrit    | HTTP username + password       | `gerrit_http_password` encrypted in DB (`reviewboard/hostingsvcs/gerrit.py:73-74`) | HTTP Basic Auth to Gerrit API |

### 2.3 Repository Access Authentication

For fetching file contents and diffs from repositories:
- **Git/SSH**: Uses SSH keys managed via `reviewboard/ssh/` with encryption at rest.
- **Git/HTTPS**: Uses the hosting service account's stored credentials.
- **Subversion**: Uses per-repository username/password.
- **Perforce**: Uses `p4` CLI authentication.

---

## 3. How a Pull Request / Change Event Enters the System

Review Board does **not** operate as a GitHub/GitLab bot that auto-reviews pull requests. Instead, the flow is:

1. **Developer posts a change** (via RBTools CLI or web UI), creating a **Review Request**.
2. **Review Request** is stored in the database and assigned to reviewers.
3. **Reviewers** review the diff via the web UI, posting comments inline.
4. When code is **pushed** to the remote repository, an optional incoming webhook can **auto-close** the review request as "submitted".

The webhook flow for auto-closing:
1. Hosting service sends POST to `/repos/<id>/<service>/hooks/close-submitted/`.
2. HMAC signature is validated using a per-repository UUID (`reviewboard/hostingsvcs/hook_utils.py:46-91`).
3. Payload is parsed for commit messages containing "Reviewed at <server_url>/r/<id>/" (`reviewboard/hostingsvcs/hook_utils.py:94-160`).
4. Matching review requests are closed as "submitted" (`reviewboard/hostingsvcs/hook_utils.py:202-290`).

---

## 4. Required Permissions / Scopes

### GitHub
- **Required scope**: `repo` (for classic PATs) — `reviewboard/hostingsvcs/github.py:70`
- **For fine-grained PATs**: `Contents: Read` — verified by checking `/branches` endpoint (`reviewboard/hostingsvcs/github.py:849-863`)
- **Note**: For organization repos, org admins must explicitly grant access to the PAT (`reviewboard/hostingsvcs/github.py:756-759`)

### GitLab
- **Required scope**: `api` — `reviewboard/hostingsvcs/gitlab.py:161`

### Bitbucket
- **Required scopes**: `read:user:bitbucket`, `read:repository:bitbucket` — `reviewboard/hostingsvcs/bitbucket.py:75-77`

---

## 5. Installation Complexity

### For a Private Repo

1. **Set up the server**: Install Review Board on a machine (Django + PostgreSQL/MySQL + web server).
2. **Create a site**: Run `rb-site install /var/www/reviewboard`.
3. **Configure the repository**: In the admin UI, add the repository with the hosting service (e.g., GitHub).
4. **Authenticate**: Link a hosting service account with a PAT.
5. **Optionally configure webhooks**: For push-based auto-closing of review requests.
6. **Users install RBTools**: To post changes for review from the CLI.

**Estimated time**: Several hours to days for initial setup, depending on infrastructure familiarity.

### Key Dependencies
- Python 3.9+, Node.js (for static media), database (PostgreSQL/MySQL/SQLite), web server (nginx/Apache/uWSGI/gunicorn).
- Optional: memcached, Elasticsearch, LDAP, S3 storage.

---

## 6. Security & Operational Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Token exposure** | PATs/tokens stored encrypted but decryptable by the server | Encryption at rest with Django's signing key (`reviewboard/scmtools/crypto_utils.py`) |
| **Broad token scope** | GitHub PATs need `repo` scope (full repo access) | Fine-grained PATs introduced in v8.0 can limit to `Contents: Read` |
| **No least-privilege** | The integration model requires relatively broad repository access | Fine-grained tokens and per-repo scoping are partial solutions |
| **Webhook forgery** | Incoming webhooks could be spoofed | HMAC-SHA1 signatures validated with per-repo UUID |
| **SSH key storage** | SSH keys for repository access stored on disk | Encrypted by the SSH storage backend (`reviewboard/ssh/storage/`) |
| **No PR-level integration** | No native GitHub App/GitLab bot integration | The separate RBTools CLI fills this gap but adds friction |

---

## 7. Answers to Study Questions

### Q1: What are the supported ways to trigger a review?

1. **RBTools CLI** (external project): `rbt post` — posts a diff from a local checkout to Review Board.
2. **Web UI**: Users can create review requests manually via the web interface.
3. **API**: POST to `/api/review-requests/` with diff content.
4. **Email**: (Limited) Some configurations allow email-based creation.
5. **Review Bot** (external project): Automated code review tool that posts review comments via the API.

Review Board does NOT have native GitHub PR trigger or GitLab MR trigger. The integration requires an explicit "post for review" step.

### Q2: Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**Self-hosted web service.** It is primarily a server-side Django application that you install and manage yourself. There is also a hosted version (RBCommons, mentioned in `README.rst:67`). RBTools is a separate CLI companion.

### Q3: How does it authenticate with the code hosting platform?

Through **Personal Access Tokens** (GitHub), **API tokens** (GitLab, Forgejo), or **HTTP passwords** (Gerrit), stored encrypted in the database. No OAuth2 web flow (except the legacy GitHub authorizations API which is deprecated in `reviewboard/hostingsvcs/github.py:932-936`).

### Q4: What repository permissions does it require?

- **GitHub**: `repo` scope (classic PAT) or `Contents: Read` (fine-grained PAT).
- **GitLab**: `api` scope.
- **Bitbucket**: `read:user:bitbucket`, `read:repository:bitbucket`.
- **Gerrit**: HTTP password with read access.

### Q5: How hard would it be to install this in a private repo?

**Hard.** This is not a lightweight integration. You need to:
1. Provision a server (or use RBCommons hosted).
2. Install and configure Django, database, web server, and all dependencies.
3. Add each repository manually through the admin UI.
4. Have developers install RBTools and configure it for each repo.
5. Optionally configure webhooks from the hosting service.

This is **not an "add to repo in under an hour" solution**. It's a full-scale code review platform installation.

### Q6: Does the integration model create security or operational risks?

Yes. The primary risks are:
- **Broad token permissions**: Until v8.0's fine-grained PAT support, GitHub tokens needed full `repo` scope.
- **Server maintenance burden**: The operator must keep the Django app, database, and web server patched.
- **Token encryption dependency**: All secrets rely on Django's `SECRET_KEY` — if leaked, all stored tokens are compromised.
- **Webhook HMAC keys stored per-repo**: UUIDs used for HMAC signing are stored in the repo model in the database.

### Q7: Which integration model would be easiest to adapt for Ultraplan?

The **hosting service provider pattern** (`reviewboard/hostingsvcs/base/hosting_service.py`) is the cleanest abstraction to borrow:

- A `BaseHostingService` abstract class defines the contract (`get_file`, `get_branches`, `get_commits`, `get_change`, `authorize`, `check_repository`).
- Each platform (GitHub, GitLab, Bitbucket, etc.) is a subclass with platform-specific API clients.
- A `HostingServiceRegistry` (`reviewboard/hostingsvcs/base/registry.py:37`) dynamically registers services via Python entry points.
- URL patterns for webhooks are dynamically injected when a service is registered (`reviewboard/hostingsvcs/base/registry.py:207-234`).

This pattern would allow Ultraplan to support multiple code hosting platforms with a clean, testable abstraction and plugin-style registration.

The **outgoing webhook system** (`reviewboard/notifications/webhooks.py`) is also well-designed: configurable targets, HMAC signing, multiple encoding formats, and per-event filtering would serve as a good foundation for Ultraplan's notification system.

---

## 8. Rating

**Score: 5/10**

**Rationale**: Review Board's integration model is mature and supports many platforms (22+ hosting services, 8+ SCMs), but it is fundamentally designed as a **human-centric, self-hosted review management platform** rather than an automated PR review agent. Key limitations:

- **No native GitHub App/GitLab bot integration** — changes must be explicitly posted via RBTools CLI or web UI, not triggered automatically from PRs/MRs.
- **Heavy operational burden** — requires full server setup with database, web server, and maintenance.
- **Broad permissions** — classic PATs require full `repo` scope; fine-grained PATs only added in v8.0.
- **Token storage dependency** — all secrets decryptable if Django `SECRET_KEY` is compromised.
- **PR/MR triggers are absent** — the webhook system only handles auto-closing of review requests on push, not auto-creation of reviews on PR open.

The abstraction patterns (base class, registry, dynamic URL registration, encrypted credential storage) are valuable for Ultraplan to borrow, but the integration model itself is not readily portable to a "drop-in PR review agent" use case.

---

## 9. Patterns Worth Copying into Ultraplan

1. **BaseHostingService + registry pattern** (`reviewboard/hostingsvcs/base/hosting_service.py`, `reviewboard/hostingsvcs/base/registry.py:37`)
   - Abstract class per platform with a registry that supports both built-in and plugin-registered services.
   - Dynamic URL injection when services are registered.

2. **Encrypted credential storage** (`reviewboard/scmtools/crypto_utils.py`)
   - `encrypt_password`/`decrypt_password` wrapping Django's signing API.
   - Per-service-account credential isolation.

3. **Webhook HMAC signing** (`reviewboard/hostingsvcs/github.py:581-591`, `reviewboard/notifications/webhooks.py`)
   - Both incoming and outgoing webhooks use HMAC for payload integrity.
   - Per-repository UUID for shared-secret derivation.

4. **Outgoing webhook configuration model** (`reviewboard/notifications/models.py`)
   - Configurable targets with filters (by event type, by repository).
   - Multiple encoding formats (JSON, XML, form-encoded).
   - HMAC secret per target.

5. **Signal-based event architecture** (`reviewboard/signals.py`, `reviewboard/reviews/signals/`)
   - Django signals for `initializing`, `finalized_setup`, `site_settings_loaded`, plus per-object signals for review lifecycle.
   - Allows extensions and integrations to react without tight coupling.

6. **Plugin system via Python entry points** (`reviewboard/hostingsvcs/base/registry.py:46`)
   - Uses the `reviewboard.hosting_services` entry point group for third-party hosting services.
   - No code change needed to add new services — just install a package.

7. **Multi-format diff construction** (`reviewboard/hostingsvcs/github.py:1029-1121`)
   - Reconstructs unified diffs from GitHub/GitLab API responses (which may not return full diffs).
   - Normalizes across hosting services into a common diff format.
