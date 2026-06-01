# Gerrit Code Review — Entrypoints & Platform Integrations

## Overview

Gerrit is a **self-hosted, standalone code review server** for Git repositories. It is not a lightweight review agent that plugs into an existing platform — it **replaces the canonical Git repository** and interposes itself as the gatekeeper for all changes. Users push commits to Gerrit, which creates review "changes" that must be approved before they are merged into the target branch.

**Rating: 3/10** — Gerrit's integration model is fundamentally different from the review agents this study targets. It is not an agent that hooks into GitHub/GitLab PRs; it is its own platform with its own Git workflow. While powerful and flexible, it requires full server infrastructure and replaces the standard Git workflow entirely.

---

## 1. Supported Entrypoints

| Entrypoint | Mechanism | File Evidence |
|---|---|---|
| **Git push over SSH** | `git push ssh://user@host:29418/project refs/for/branch` | `ReceiveCommits.java` (`java/com/google/gerrit/server/git/receive/ReceiveCommits.java:205`) handles the `receive-pack` protocol |
| **Git push over HTTP(S)** | `git push https://user@host/project refs/for/branch` | `GitOverHttpServlet.java` (`java/com/google/gerrit/httpd/GitOverHttpServlet.java:1`) wraps JGit's `GitServlet` |
| **SSH shell** | Admin/developer CLI: `ssh -p 29418 host gerrit ...` | `SshDaemon.java` (`java/com/google/gerrit/sshd/SshDaemon.java:1`); `SshModule.java` (`java/com/google/gerrit/sshd/SshModule.java:48`) registers command dispatch |
| **REST API** | Full CRUD over HTTP | `RestApiServlet.java` (`java/com/google/gerrit/httpd/restapi/RestApiServlet.java:1`) route dispatch; `ChangeApiImpl.java` (`java/com/google/gerrit/server/api/changes/ChangeApiImpl.java:1`) provides the change API |
| **Web UI** | Polymer/GWT browser interface | `polygerrit-ui/app/elements/` (full Polymer app); `GerritGlobalModule.java` (`java/com/google/gerrit/server/config/GerritGlobalModule.java:1`) wires web UI components |
| **SSH stream-events** | Real-time JSON event stream | `StreamEvents.java` (`java/com/google/gerrit/sshd/commands/StreamEvents.java:53`); docs: `Documentation/cmd-stream-events.txt` |
| **Email (receiving)** | Reply to Gerrit emails to post comments | `MailReceiver.java` (`java/com/google/gerrit/server/mail/receive/MailReceiver.java:37`); implementations: `ImapMailReceiver`, `Pop3MailReceiver` |
| **Plugin extensions** | Loadable `.jar` plugins with lifecycle hooks | `PluginLoader.java` (`java/com/google/gerrit/server/plugins/PluginLoader.java:69`); `Plugin.java` (`java/com/google/gerrit/server/plugins/Plugin.java:32`) — supports EXTENSION, PLUGIN, and JS plugin types |

### Not Supported

- **No webhooks** (no `WebHook` or `webhook` references found anywhere in the source)
- **No GitHub App integration** (no GitHub API client code, no PR webhook receivers)
- **No GitLab integration** (no GitLab API client code)
- **No CI/CD pipeline triggers** (no GitHub Actions, GitLab CI, Jenkins files; no webhook receivers from CI systems)
- **No outgoing event callbacks** beyond the SSH stream-events command

---

## 2. How a Change Event Enters the System

The core workflow for Gerrit is fundamentally different from a code review agent attached to GitHub/GitLab. Here is the trace:

### Push-to-Create-Review Flow

1. **User pushes** to `refs/for/<branch>` via SSH or HTTP
2. **`ReceiveCommits.java`** (`java/com/google/gerrit/server/git/receive/ReceiveCommits.java:205`) processes the `receive-pack` command, parsing the magic `refs/for/` prefix
3. The commit is **validated** by `CommitValidators` (`java/com/google/gerrit/server/git/validators/CommitValidators.java`)
4. A **Change** and **PatchSet** are created in the review database (ReviewDb or NoteDb)
5. **`EventBroker.postEvent()`** (`java/com/google/gerrit/server/events/EventBroker.java:86`) is called to fire a `PatchSetCreatedEvent`
6. **`StreamEventsApiListener`** (`java/com/google/gerrit/server/events/StreamEventsApiListener.java:74`) listens for all event types and dispatches them via the event broker to registered listeners (including the SSH stream-events connections)
7. Connected **SSH stream-events clients** receive the JSON event on their persistent SSH connection
8. **Email notifications** are sent via `SmtpEmailSender`

### REST API Review Flow

1. A client sends `POST /changes/<id>/revisions/<id>/review` with a `ReviewInput` JSON body
2. **`PostReview.java`** (`java/com/google/gerrit/server/change/PostReview.java:1`) handles the REST endpoint
3. Validates permissions, creates comments/approvals via `BatchUpdate`
4. Fires `CommentAddedEvent` via the same event broker chain

### Key difference from other review agents

Gerrit does not react to external review events (like a GitHub PR being opened). Instead, **the Gerrit server IS the source of truth** for both the repository and the review workflow. There is no external trigger — the trigger is `git push` to the Gerrit-managed repository.

---

## 3. Authentication Model

### Auth Types

| Auth Type | Source | Description |
|---|---|---|
| `OPENID` / `OPENID_SSO` | `AuthType.java:17-24` | Standard OpenID / Single Sign-On |
| `HTTP` / `HTTP_LDAP` | `AuthType.java:32-47` | Container-managed auth (trusts HTTP header) |
| `LDAP` / `LDAP_BIND` | `AuthType.java:71-82` | Gerrit collects credentials and binds to LDAP |
| `OAUTH` | `AuthType.java:91` | Generic OAuth provider over HTTP |
| `CLIENT_SSL_CERT_LDAP` | `AuthType.java:63` | SSL client certificate + LDAP user details |
| `CUSTOM_EXTENSION` | `AuthType.java:85` | Custom auth via plugin |
| `DEVELOPMENT_BECOME_ANY_ACCOUNT` | `AuthType.java:88` | Debug/development impersonation |

**Configuration**: `AuthConfig.java` (`java/com/google/gerrit/server/config/AuthConfig.java:39`) reads from `etc/gerrit.config` `[auth]` section. See `Documentation/config-gerrit.txt`.

### Authentication Mechanisms by Entrypoint

- **SSH**: Public key authentication via `CachingPublicKeyAuthenticator` (`java/com/google/gerrit/sshd/SshModule.java:87`). Keys stored in the review database.
- **Git over HTTP**: HTTP basic auth or digest auth with HTTP password from Gerrit. `ProjectBasicAuthFilter.java` / `ProjectOAuthFilter.java` in `httpd/`.
- **Web UI**: Session cookie-based auth, with login flows for OpenID, OAuth, LDAP, etc.
- **REST API**: HTTP basic auth (with XSRF token for mutating requests), OAuth token, or cookie-based session.
- **SSH commands**: Authenticated via SSH key; authorization checked by `@RequiresCapability` annotations (e.g., `StreamEvents.java:51` requires `STREAM_EVENTS` capability).

---

## 4. Repository Permissions Required

Gerrit implements a comprehensive, hierarchical permission model:

- **Project-level permissions** (`ProjectPermission.java` in `server/permissions/`)
- **Ref-level permissions** (`RefPermission.java`) — read, push, create, delete refs
- **Change-level permissions** (`ChangePermission.java`) — read, abandon, restore, rebase, submit, etc.
- **Label permissions** (`LabelPermission.java`) — vote on code review, verified, etc.
- **Global capabilities** (`GlobalCapability.java`) — administer server, stream events, create account, etc.
- **Access control lists** defined per-project in `refs/meta/config` branch

Gerrit requires **full filesystem and database access** to the review site directory, including:
- Git repository storage (all projects)
- Database (ReviewDb or NoteDb in Git)
- Plugin directory
- Cache directory
- SSH host keys
- Mail configuration

---

## 5. Platform-Specific Assumptions

### Hosting Model

Gerrit assumes it is the **primary Git remote**. This is a hard architectural assumption:

- Users set `origin` to the Gerrit URL, not to GitHub/GitLab
- The magic `refs/for/<branch>` refspec is Gerrit-specific
- Gerrit manages its own Git repositories, SSH daemon, HTTP server, and database
- There is no adapter layer to plug into GitHub or GitLab PR workflows

### Database Dependencies

Requires a SQL database (H2 embedded, PostgreSQL, MySQL, MariaDB) or NoteDb (Git-based metadata storage). The `DataSourceProvider` (`java/com/google/gerrit/server/schema/DataSourceProvider.java`) manages the connection pool.

### Java/SSH Dependencies

- Requires Java 8+ runtime
- Requires Bazel for building from source
- Ships its own embedded SSH daemon (Apache MINA SSHD)
- Ships its own embedded HTTP server (Jetty)

---

## 6. Operational Tradeoffs

### Strengths

- **Extremely fine-grained permission model** — per-project, per-ref, per-label access control
- **Highly extensible** — plugin system supports Java, JS, and REST API plugins
- **Self-contained** — manages its own repos, auth, database, SSH, and HTTP
- **Real-time event stream** — SSH stream-events provides a persistent connection for event-driven integrations
- **Email-based review** — users can reply to emails to post comments
- **Battle-tested at scale** — used by Android, Chrome, Go, and many large projects
- **Complete audit trail** — every event is recorded in NoteDb

### Weaknesses for Ultraplan's Use Case

- **Not a review agent** — Gerrit is a full platform, not a lightweight add-on. It cannot be added to an existing GitHub/GitLab repository
- **No webhooks** — no native way to receive or send webhooks. The `stream-events` SSH connection requires persistent SSH access
- **No CI/CD integration** — no GitHub Actions, GitLab CI, or Jenkins pipeline integration
- **Complex operational overhead** — requires database setup, SSH key management, site directory initialization, and ongoing maintenance
- **Replaces standard Git workflow** — developers must use `git push origin HEAD:refs/for/branch` instead of standard PR workflows
- **Java monolith** — heavyweight deployment (WAR file + database + SSH daemon)
- **No hosted/SaaS option in the open-source code** — always self-hosted
- **No GitHub App or GitLab App** — cannot be installed with a few clicks

---

## 7. Patterns Worth Copying into Ultraplan

### 1. Event-Driven Architecture with Access Control

Gerrit's event system (`EventBroker` + `StreamEventsApiListener`) shows a clean pattern:
- Events are fired at specific action points (`ReceiveCommits`, `PostReview`, etc.)
- `EventBroker` applies visibility filtering before dispatching to listeners
- Listeners can be registered dynamically via the `DynamicSet` injection system
- The `UserScopedEventListener` vs `EventListener` distinction allows per-user vs unrestricted listening

This pattern is worth copying for Ultraplan's plugin/event system.

### 2. Plugin System with Multiple API Surface Levels

Gerrit's plugin system (`Plugin.java:33`) supports three API types:
- **EXTENSION** — lightweight, limited API surface
- **PLUGIN** — full access to server internals via Guice injection
- **JS** — JavaScript plugins for the web UI

This tiered approach allows safe third-party extensions without exposing internals.

### 3. Stream Events Pattern

The `gerrit stream-events` SSH command provides a persistent, real-time event feed. For Ultraplan, a WebSocket or SSE-based event stream could replace the SSH channel for webhook-like delivery.

### 4. Validation Pipeline

Gerrit's commit validation pipeline (`CommitValidators`, `RefOperationValidators`, `MergeValidationListener`, `OnSubmitValidationListener`) chains multiple validators for each operation. Ultraplan could adopt a similar chain-of-responsibility for review validation.

### 5. Fine-Grained Permission Backend

`PermissionBackend` (`java/com/google/gerrit/server/permissions/PermissionBackend.java`) provides a clean interface for checking permissions at the project/ref/change/label level. Ultraplan should consider a similar abstraction for access control.

---

## 8. Answers to Study Questions

### Q1: What are the supported ways to trigger a review?

1. **`git push`** to `refs/for/<branch>` (over SSH or HTTP) — the primary mechanism
2. **REST API** `POST /changes` — create a change directly
3. **Email reply** — reply to a Gerrit notification email to post comments (IMAP/POP3 polling)
4. **SSH commands** — `gerrit review`, `gerrit approve`, etc.
5. **Plugins** — custom triggers via the plugin API

### Q2: Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**Self-hosted service.** Gerrit is a standalone server daemon (`Daemon.java`) that manages its own Git repositories, database, SSH server, HTTP server, and email. It is designed to be installed and operated by an organization's infrastructure team.

### Q3: How does it authenticate with the code hosting platform?

**It does not authenticate with any external code hosting platform.** Gerrit IS the code hosting platform. Authentication is between the user and the Gerrit server itself, using SSH keys, HTTP passwords, or SSO (OpenID/OAuth/LDAP).

### Q4: What repository permissions does it require?

Gerrit requires:
- Full read/write access to its Git repository storage directory
- Database connection (SQL or NoteDb)
- SSH host key files
- Plugin directory access
- Web session cache
- Log directory
- Mail server credentials (if email configured)

### Q5: How hard would it be to install this in a private repo?

**Extremely hard compared to modern review agents.** Steps:
1. Provision a server (or VM/container)
2. Install Java 8+
3. Run `java -jar gerrit.war init -d /path/to/site` — interactive wizard
4. Configure database connection (PostgreSQL recommended)
5. Configure SSH keys
6. Set up reverse proxy (nginx/Apache) if needed
7. Configure SSO/auth providers
8. Point users to use `git push ssh://gerrit.example.com:29418/project refs/for/main`
9. Migrate the canonical repo to Gerrit

This is **not a one-hour task**. For a private GitHub repo, it would require replacing GitHub entirely with Gerrit.

### Q6: Does the integration model create security or operational risks?

**Yes:**
- SSH daemon — exposed port 29418, requires key management, potential attack surface
- Database — sensitive review data, requires secure configuration
- Running as a review gate — if misconfigured, could bypass review requirements
- Plugin system — loaded plugins have full server access
- Email receiver — could be used for injection attacks if not properly validated
- Single point of failure — if Gerrit goes down, no pushes to the canonical repo are possible

**Mitigations:**
- Replication plugin for mirroring to backup servers
- Fine-grained ACLs
- NoteDb for audit trail
- Read-only slave instances

### Q7: Which integration model would be easiest to adapt for Ultraplan?

Gerrit's **SSH stream-events** and **plugin event listener** patterns are the most adaptable:
- The `EventListener` / `UserScopedEventListener` interfaces (`java/com/google/gerrit/server/events/EventListener.java:24`) expose all server events with permission filtering built in
- The `StreamEventsApiListener` (`java/com/google/gerrit/server/events/StreamEventsApiListener.java:74`) shows how to bridge internal extension events to the event broker/dispatcher
- Ultraplan could use a similar event-driven model, replacing Gerrit's SSH transport with WebSocket or webhook delivery

However, Gerrit's core model (replace the Git remote, intercept pushes) is **not** adaptable for Ultraplan's use case of hooking into existing GitHub/GitLab workflows. Gerrit's value is as a standalone platform, not a bolt-on agent.

---

## 9. Evidence Summary

| Claim | Evidence |
|---|---|
| Push triggers review via receive-pack | `java/com/google/gerrit/server/git/receive/ReceiveCommits.java:205` |
| SSH daemon provides admin and stream-events access | `java/com/google/gerrit/sshd/SshDaemon.java:1` |
| HTTP daemon provides Git-over-HTTP and REST API | `java/com/google/gerrit/httpd/GitOverHttpServlet.java:1`; `java/com/google/gerrit/httpd/restapi/RestApiServlet.java:1` |
| Event broker dispatches to filtered listeners | `java/com/google/gerrit/server/events/EventBroker.java:43-60` |
| Stream events listener wires extension events to broker | `java/com/google/gerrit/server/events/StreamEventsApiListener.java:74-108` |
| SSH stream-events command exports real-time JSON | `java/com/google/gerrit/sshd/commands/StreamEvents.java:53` |
| Multiple auth backends (OpenID, OAuth, LDAP, HTTP, etc.) | `java/com/google/gerrit/extensions/client/AuthType.java:17-92` |
| Auth config reads from gerrit.config | `java/com/google/gerrit/server/config/AuthConfig.java:39-100` |
| Plugin system supports EXTENSION/PLUGIN/JS types | `java/com/google/gerrit/server/plugins/Plugin.java:33-37` |
| Plugin loader scans directory for jars | `java/com/google/gerrit/server/plugins/PluginLoader.java:69` |
| Email receiver polls IMAP/POP3 for review-by-email | `java/com/google/gerrit/server/mail/receive/MailReceiver.java:37`, `MailProcessor.java:74` |
| No webhook code found | `grep` for `webhook` across entire source — 0 results |
| No GitHub/GitLab integration code found | No GitHub API clients, no PR webhook parsers |
| Init wizard creates site directory | `java/com/google/gerrit/pgm/init/BaseInit.java` |
| Server launched as daemon with SSH and/or HTTP | `java/com/google/gerrit/pgm/Daemon.java:224-294` |

---

## 10. Score & Rationale

**Score: 3/10**

| Criterion | Score | Rationale |
|---|---|---|
| Workflow fit | 1 | Gerrit does not fit a PR review workflow — it replaces the entire Git workflow |
| Installation complexity | 2 | Requires server provisioning, Java, database, SSH setup, site init — hours, not minutes |
| Permission minimisation | 3 | Extremely granular, but the server itself requires full filesystem/database access |
| Portability | 7 | Review engine could theoretically be extracted, but is deeply coupled to Gerrit's Git hosting |
| Self-hostability | 10 | Designed from the ground up for self-hosting |
| Multi-entrypoint | 3 | Multiple entrypoints (SSH, HTTP, REST, email) but NO integration with external platforms |

Gerrit scores highly on self-hostability and has a well-designed internal event architecture, but it is fundamentally not a "code review agent" in the sense of this study. It is a full code review platform that replaces, rather than augments, existing Git hosting.
