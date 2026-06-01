# PR-Agent: Review Entrypoints & Platform Integrations

## Overview

PR-Agent (by QodoAI) is an open-source AI-powered code review assistant. It supports **ten distinct entrypoints** across **eight git providers**, making it the most multi-platform review tool in the study.

---

## 1. Supported Entrypoints

| Entrypoint | File | Trigger Mechanism |
|---|---|---|
| CLI | `pr_agent/cli.py:104` | `pr-agent --pr_url=<URL> <command>` or `python -m pr_agent.cli` |
| GitHub Action | `pr_agent/servers/github_action_runner.py:33` | Docker-based action triggered by `pull_request`, `pull_request_target`, `issue_comment`, or `pull_request_review_comment` events |
| GitHub App (webhook) | `pr_agent/servers/github_app.py:38` | FastAPI server at `POST /api/v1/github_webhooks`; deployed via gunicorn/uvicorn |
| GitHub Polling | `pr_agent/servers/github_polling.py:145` | Polls `https://api.github.com/notifications` every 5s for `@mention` comments |
| GitHub Lambda | `pr_agent/servers/github_lambda_webhook.py:26` | AWS Lambda handler wrapping the same FastAPI `router` as the GitHub App |
| GitLab Webhook | `pr_agent/servers/gitlab_webhook.py:170` | FastAPI server at `POST /webhook`; `X-Gitlab-Token` shared-secret auth |
| GitLab Lambda | `pr_agent/servers/gitlab_lambda_webhook.py` | Wraps the GitLab webhook router in AWS Lambda via Mangum |
| Bitbucket App | `pr_agent/servers/bitbucket_app.py:234` | Atlassian Connect app; JWT-authenticated webhooks at `/webhook`, `/installed`, `/uninstalled` |
| Bitbucket Server Webhook | `pr_agent/servers/bitbucket_server_webhook.py:130` | `POST /webhook` with HMAC-SHA256 signature verification |
| Azure DevOps Webhook | `pr_agent/servers/azuredevops_server_webhook.py:171` | `POST /` with HTTP Basic Auth |
| Gitea Webhook | `pr_agent/servers/gitea_app.py:23` | `POST /api/v1/gitea_webhooks` with `X-Gitea-Signature` |
| Gerrit Server | `pr_agent/servers/gerrit_server.py:35` | `POST /api/v1/gerrit/{action}` with JSON body |
| Local Git | `pr_agent/git_providers/local_git_provider.py:23` | CLI-driven, operates on local git diff without any remote provider |
| MOSAICO Agent | `pr_agent/mosaico/server.py` | A2A protocol server for multi-agent orchestration |
| Programmatic | `pr_agent/cli_pip.py` | Example showing `PRAgent().handle_request(url, command)` |

---

## 2. Primary Design: Self-Hosted Service

The tool is **primarily a self-hosted service**, not a SaaS product. Every entrypoint (except Qodo's hosted offering) requires the user to deploy and run the server themselves. Evidence:

- The `docker/Dockerfile:1-55` defines **9 build targets** (`github_app`, `bitbucket_app`, `gitlab_webhook`, `github_polling`, `bitbucket_server_webhook`, `azure_devops_webhook`, `gitea_app`, `mosaico_agent`, `cli`), each a self-hosted deployment variant.
- The GitHub Action (`action.yaml:1-7`) is a Docker-based action that runs inside the user's CI pipeline, not a hosted service.
- The CLI (`pr_agent/cli.py:14-57`) runs locally with no server component.

The hosted option (Qodo's cloud GitHub App) exists but its code is not in this repo — the repo provides the self-hosted alternative.

---

## 3. Authentication Models by Platform

### GitHub

**Two deployment modes** (`pr_agent/settings/configuration.toml:221-222`):
- **User mode** (`deployment_type = "user"`): Uses a GitHub Personal Access Token with `repo` scope. Token is set via `GITHUB.USER_TOKEN` in settings or `GITHUB_TOKEN` env var.
- **App mode** (`deployment_type = "app"`): Uses GitHub App authentication with `app_id`, `private_key`, and `installation_id`. The `GithubProvider._get_github_client()` method (`pr_agent/git_providers/github_provider.py:827-852`) creates either `AppAuthentication` or `Auth.Token` depending on deployment mode.

**Webhook verification** (`pr_agent/servers/utils.py:10-25`): HMAC-SHA256 signature verification via `x-hub-signature-256` header. Optional, enabled when `github.webhook_secret` is configured.

**Polling auth** (`pr_agent/servers/github_polling.py:172-176`): Uses `Authorization: Bearer {token}` header with the personal access token.

### GitLab

**Authentication** (`pr_agent/servers/gitlab_webhook.py:179-201`):
- Webhook secret via `X-Gitlab-Token` header, validated against `GITLAB.SHARED_SECRET` or a secret provider.
- API access via `GITLAB.PERSONAL_ACCESS_TOKEN`.

### Bitbucket Cloud

**Authentication** (`pr_agent/servers/bitbucket_app.py:33-59`):
- JWT-based Atlassian Connect authentication.
- Uses `app_key`, `shared_secret`, `client_key` to obtain a bearer token from Bitbucket's OAuth2 endpoint.
- Secrets stored via `secret_provider.store_secret()` (`pr_agent/servers/bitbucket_app.py:328`).

### Bitbucket Server

**Authentication** (`pr_agent/servers/bitbucket_server_webhook.py:136-144`):
- HMAC-SHA256 signature verification via `x-hub-signature` header.
- API access via `BITBUCKET_SERVER.BEARER_TOKEN`.

### Azure DevOps

**Authentication** (`pr_agent/servers/azuredevops_server_webhook.py:80-91`):
- HTTP Basic Auth with `webhook_username` / `webhook_password` from config.
- Requires HTTPS for credential protection.

### Gitea

**Authentication** (`pr_agent/servers/gitea_app.py:48-60`):
- HMAC-SHA256 signature via `x-gitea-signature` header.
- API via `GITEA.PERSONAL_ACCESS_TOKEN`.

### Gerrit

No authentication — operates on `refspec` and `project` strings from a simple JSON POST.

### Local

No authentication — operates entirely on the local filesystem.

---

## 4. Required Permissions

| Platform | Permissions Required |
|---|---|
| GitHub (user token) | `repo` scope (full private repo access). Polling additionally needs `notifications` read. |
| GitHub (app) | PR read/write, issues read/write, content read, metadata read. Configurable in GitHub App settings. |
| GitLab | `api` scope (full API access). |
| Bitbucket Cloud | Account-level OAuth2 token with pull request read/write. |
| Bitbucket Server | Project-level bearer token with pull request read/write. |
| Azure DevOps | PAT with Code (Read & Write) scope + webhook basic auth credentials. |
| Gitea | Personal access token with repo scope. |
| Gerrit | No API token needed (SSH-based). |
| Local | None (filesystem only). |

---

## 5. Trigger Flow: How a PR Event Enters the System

### GitHub App Flow

1. GitHub sends a webhook POST to `/api/v1/github_webhooks` (`pr_agent/servers/github_app.py:38-54`)
2. Request body is parsed, signature is verified (`pr_agent/servers/github_app.py:63-74`)
3. Event is dispatched by `handle_request()` (`pr_agent/servers/github_app.py:312-358`) based on `event` and `action`:
   - `issue_comment` + `created` → `handle_comments_on_pr()` (line 341)
   - `pull_request` + `opened`/`reopened`/`ready_for_review` → `handle_new_pr_opened()` (line 345)
   - `pull_request` + `synchronize` → `handle_push_trigger_for_new_commits()` (line 351)
4. PR URL + command string is passed to `PRAgent().handle_request()` (`pr_agent/agent/pr_agent.py:121`)
5. `PRAgent._handle_request()` parses the command, applies repo settings, and invokes the appropriate tool class (`pr_agent/agent/pr_agent.py:24-44`)

### GitHub Action Flow

1. GitHub Actions triggers with event payload at `GITHUB_EVENT_PATH` (`pr_agent/servers/github_action_runner.py:70`)
2. Environment variables `GITHUB_TOKEN`, `OPENAI_KEY` are read (lines 35-39)
3. Event type dispatched:
   - `pull_request` / `pull_request_target` → runs auto_review/auto_describe/auto_improve (lines 110-143)
   - `issue_comment` / `pull_request_review_comment` → calls `PRAgent().handle_request()` (lines 146-182)

### CLI Flow

1. User runs `pr-agent --pr_url=<URL> <command>` (`pr_agent/cli.py:69-102`)
2. `PRAgent().handle_request()` is called with the PR URL and command
3. No webhook or background processing — runs synchronously

### Polling Flow

1. Every 5 seconds, `polling_loop()` (`pr_agent/servers/github_polling.py:145`) checks GitHub notifications API
2. Filters for `mention`-type notifications on pull requests
3. Extracts the comment body and calls `process_comment()` → `PRAgent().handle_request()`

---

## 6. Installation Complexity in a Private Repo

**Heuristic answer: 30–60 minutes for GitHub Actions; 1–2 hours for a webhook server.**

| Entrypoint | Complexity | Steps Required |
|---|---|---|
| GitHub Action | **Low** | 1) Add workflow YAML, 2) Set `OPENAI_API_KEY` and `GITHUB_TOKEN` in secrets, 3) Done. The `action.yaml` references a pre-built Docker image from Docker Hub. |
| GitHub App (self-hosted) | **Medium** | 1) Create a GitHub App with proper permissions, 2) Generate+save private key, 3) Set up webhook URL + secret, 4) Deploy the FastAPI server (Docker/gunicorn), 5) Configure `github.app_id`, `github.private_key`, `github.webhook_secret`. |
| GitHub Polling | **Low** | 1) Deploy polling server, 2) Set `GITHUB.USER_TOKEN` with `repo` scope, 3) Users tag the bot (`@pr-agent`) in PR comments. |
| GitLab Webhook | **Medium** | 1) Deploy webhook server, 2) Set `GITLAB.PERSONAL_ACCESS_TOKEN` + `GITLAB.SHARED_SECRET`, 3) Configure GitLab webhook pointing to the server. |
| Bitbucket App | **High** | 1) Set up Atlassian Connect app in Bitbucket, 2) Configure `bitbucket.app_key` and `bitbucket.base_url`, 3) Deploy with HTTPS, 4) JWT + OAuth2 complexity. |
| Azure DevOps | **Medium** | 1) Deploy webhook server behind HTTPS, 2) Create webhook in ADO with basic auth credentials, 3) Set `AZURE_DEVOPS_ORG` and `AZURE_DEVOPS_PAT`. |
| Local CLI | **None** | Just install with `pip` and run. No hosting required. |

---

## 7. Security and Operational Risks

| Risk | Severity | Details |
|---|---|---|
| Broad token permissions | **High** | GitHub user token requires `repo` scope — full private repo access for all repos the token can see, not just the repos being reviewed. |
| Self-hosted HTTPS dependency | **Medium** | Bitbucket App, Azure DevOps webhook, and GitHub App require publicly-accessible HTTPS endpoints. Lax TLS configurations could leak credentials. |
| Secret management | **Medium** | Private keys and tokens are configured via environment variables or `.secrets.toml`. The `secret_providers/` module (`pr_agent/secret_providers/`) provides AWS Secrets Manager and GCS integration, but these are optional. |
| Webhook auth bypass | **Low-Medium** | Webhook signature verification is **optional** for GitHub and Gitea (gated by `if webhook_secret:`). If not configured, anyone who knows the webhook URL can trigger reviews. |
| No request rate limiting | **Low-Medium** | The GitHub App server (`pr_agent/servers/github_app.py:77-78`) has a `DefaultDictWithTimeout` to deduplicate push triggers, but no general rate limiting. A burst of webhooks could exhaust API quota or AI model credits. |
| Token exposure in logs | **Low** | `get_logger()` might log request bodies in debug mode (`pr_agent/servers/github_app.py:343` shows `artifact=body`). Tokens in environment variables could leak in crash logs. |
| CLI mode auth | **Low** | CLI runs with the operator's own `GITHUB.USER_TOKEN`. If the operator leaves, the setup breaks. |

---

## 8. Platform-Specific Assumptions

- **GitHub is the primary platform**: The richest event handling (push triggers with dedup, line comments, inline code suggestions with fallback verification, auto-approve, sub-issues via GraphQL). The `github_provider.py:1123` is the largest provider file.
- **GitLab has near-parity**: Supports MR open/reopen, push triggers, draft detection, comments, `DiffNote` handling for `/ask_line`.
- **Bitbucket uses JWT/OAuth2**: Most complex auth flow; uses Atlassian Connect manifest (`pr_agent/servers/atlassian-connect.json`) and secret provider for client key storage.
- **Azure DevOps uses basic auth**: Simplest credential model but requires HTTPS; only supports comment threads, not inline diff comments.
- **Gitea mirrors GitHub's model**: Same PR event structure (`pull_request`, `issue_comment`), same webhook signature pattern (`x-gitea-signature` mirrors `x-hub-signature-256`).
- **Gerrit has no webhook**: Uses `SSH` communication and a simple HTTP API where actions are path parameters.
- **Local has no network**: Entirely offline; writes output to files on disk.
- **All providers use the same command set**: The `command2class` mapping (`pr_agent/agent/pr_agent.py:24-44`) is provider-agnostic. Only the git provider implementation changes.

---

## 9. Patterns Worth Copying for Ultraplan

### 9.1. Pluggable Git Provider Architecture

The `_GIT_PROVIDERS` registry (`pr_agent/git_providers/__init__.py:17-27`) maps provider names to classes. Each provider extends the abstract `GitProvider` (`pr_agent/git_providers/git_provider.py:74`). Adding a new provider requires only:
1. Implement the `GitProvider` interface
2. Register it in the dict
3. Set `config.git_provider` to the new key

This is the ideal pattern for Ultraplan's multi-platform support.

### 9.2. Entrypoint/Review Engine Separation

The `PRAgent` class (`pr_agent/agent/pr_agent.py:50`) is a thin command router. Every entrypoint (CLI, Action, webhook, polling) calls the same `handle_request()` method. The entrypoint only handles:
- Event parsing
- Authentication/verification
- Background task scheduling

This clean separation makes adding new entrypoints cheap.

### 9.3. Repo-Specific Configuration

`.pr_agent.toml` files in the target repository override settings via `get_repo_settings()` (`pr_agent/git_providers/github_provider.py:733-741`). This allows per-repo customization without modifying the deployment configuration.

### 9.4. Incremental Review on Push

The push trigger deduplication logic (`pr_agent/servers/github_app.py:77-206`) handles the common "rapid push" scenario gracefully:
- A `DefaultDictWithTimeout` tracks active tasks per PR URL
- At most 2 concurrent tasks per PR (1 active + 1 waiting for backlog)
- Prevents duplicate reviews when multiple commits are pushed quickly

### 9.5. Self-Hosted by Default

The Dockerfile with 9 build targets (`docker/Dockerfile`) makes self-hosting straightforward. Each platform gets its own Docker image target. This is the right default for Ultraplan — offer self-hosted as primary, with a SaaS option as an add-on.

### 9.6. Minimal Entrypoint: CLI

The CLI (`pr_agent/cli.py:104`) is the simplest integration: no server, no webhooks, no auth. Users can run `pip install pr-agent && pr-agent --pr_url=<URL> review` and get results immediately. This is the fastest path to value.

---

## 10. Answers to Study Questions

### Q1: What are the supported ways to trigger a review?

See Section 1 (14 entrypoints). The primary triggers are:
1. **Automatic on PR open/reopen** (all webhook-based servers + GitHub Action)
2. **Comment commands** (`/review`, `/describe`, `/improve`, `/ask`, etc.) on PR comments (all providers)
3. **Push trigger** — automatic review when new commits are pushed (GitHub, GitLab, Bitbucket, Gitea)
4. **CLI invocation** — explicit `pr-agent --pr_url=<URL> <command>`
5. **Polling** — periodic check for `@mentions` in PR comments (GitHub only)

### Q2: Primarily a hosted service, self-hosted service, CI job, or local CLI?

**Self-hosted service**, with CI (GitHub Action) and local CLI as secondary options. The GitHub App webhook server is the flagship deployment mode; the Dockerfile and multi-target build system emphasize self-hosting. No SaaS code is in the repo.

### Q3: How does it authenticate?

See Section 3 for all 8 platforms. GitHub supports two modes (PAT or App JWT); most other platforms use personal access tokens + webhook secrets.

### Q4: What repository permissions does it require?

See Section 4. GitHub user mode needs full `repo` scope; GitHub App mode allows granular permissions. The broadest permission requirement is the biggest security concern.

### Q5: How hard to install in a private repo?

30 min (GitHub Action, polling) to 2 hours (Bitbucket App, Azure DevOps webhook with HTTPS). The GitHub Action is the simplest — just add a YAML file and set secrets.

### Q6: Does the integration model create security or operational risks?

Yes — see Section 7. The main risks are:
- **GitHub PAT with `repo` scope** grants access to ALL repos the user can see, not just the target repo
- **Optional webhook signature verification** on GitHub/Gitea
- **No built-in rate limiting** against webhook floods
- **HTTPS dependency** for Bitbucket, Azure DevOps, and recommended for all webhook servers

### Q7: Which integration model would be easiest to adapt for Ultraplan?

The **pluggable git provider architecture** (`pr_agent/git_providers/__init__.py:17-27`) is the single most adaptable piece. For Ultraplan, this means:

1. **Start with the CLI entrypoint** (`pr_agent/cli.py`) — zero infrastructure, immediate value
2. **Implement a `GitProvider` for each target platform** — the abstract base class (`pr_agent/git_providers/git_provider.py:74`) is well-designed for this
3. **Add the GitHub Action** as the first CI integration since it's the least complex and most commonly requested
4. **Reuse the command routing pattern** (`pr_agent/agent/pr_agent.py:24-44`) with Ultraplan-specific tools instead of PR review commands
5. **Keep the environment variable secret pattern** (tokens from `os.environ`, config from TOML files)

---

## 11. Rating

| Criteria | Score | Rationale |
|---|---|---|
| **Workflow fit** | 9 | Naturally embeds into PR/MR workflows. Commands are intuitive (`/review`, `/describe`, `/improve`). Auto-triggers on PR open and push. |
| **Installation complexity** | 7 | GitHub Action is trivial (30 min). Full webhook server is medium complexity (1-2 hours). Bitbucket App is high (JWT/AWS secrets). Self-hosted requires Docker/infrastructure knowledge. |
| **Permission minimisation** | 5 | GitHub user mode requires excessive `repo` scope. GitHub App mode is better but still broad. GitLab needs full `api` scope. Only the local provider has zero permissions. |
| **Portability** | 9 | Same review engine runs across 8 git providers. The `GitProvider` abstraction makes adding new platforms straightforward. |
| **Self-hostability** | 9 | First-class Docker support with 9 build targets. No SaaS dependency. Works fully offline with `LocalGitProvider`. |
| **Overall** | **8/10** | Excellent multi-entrypoint design with a clean architecture. Loses points on broad permission requirements and the "optional" webhook verification that could lead to insecure deployments. |

The key insight for Ultraplan: **PR-Agent's core architectural decision — a shared review engine behind pluggable git providers and multiple entrypoints — is the pattern to replicate.** The portability and self-hostability scores are the standout features worth copying.
