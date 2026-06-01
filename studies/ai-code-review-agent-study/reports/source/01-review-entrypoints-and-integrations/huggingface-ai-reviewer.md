# Source Analysis: huggingface-ai-reviewer

**Dimension:** 01 — Review Entrypoints & Platform Integrations  
**Source path:** `sources/huggingface-ai-reviewer`  
**Repository:** https://github.com/huggingface/ai-reviewer  
**Version:** 0.1.0

## Overview

A GitHub-native AI code reviewer that supports **three deployment modes** from a single Python codebase: GitHub Action, GitHub App (webhook server), and interactive Web app with human-in-the-loop draft editing. All modes are triggered by a `@askserge` mention in a PR comment.

---

## Supported Entrypoints

| Entrypoint | Mode | Infra Required | Trigger Mechanism |
|---|---|---|---|
| GitHub Action (composite) | Mode 1 | None (runs on Actions runners) | `issue_comment` / `pull_request_review_comment` events via `GITHUB_EVENT_PATH` |
| GitHub App webhooks | Mode 2 | Self-hosted HTTP server (FastAPI/Flask) | GitHub sends `issue_comment` / `pull_request_review_comment` to `POST /webhook` |
| Web app (staged reviews) | Mode 3 | Self-hosted HTTP server + SQLite + clone cache | User submits PR URL via web form; LLM draft can be edited before publishing |

All documented in `README.md:9-15`.

---

## How a PR Event Enters the System

### Action Mode (Mode 1)

1. User comments `@askserge please review` on an open PR.
2. GitHub Actions triggers the workflow defined in `.github/workflows/ai-review.yml:1-55`.
3. The workflow checks out the PR head (`actions/checkout@v4` with `ref: refs/pull/<number>/head`) and runs the composite action (`action.yml`).
4. The composite action installs the package (`pip install .`) and runs `reviewbot-action` (`action.yml:111`).
5. `action_runner.py:79-162` reads the event payload from `$GITHUB_EVENT_PATH`, extracts the `GITHUB_TOKEN`, and calls `build_review_request()` then `run_review()`.

### Webhook / GitHub App Mode (Mode 2)

1. GitHub sends an `issue_comment` or `pull_request_review_comment` webhook to the server's `POST /webhook` endpoint.
2. `app.py:66-90` (Flask) or `webapp.py:800-830` (FastAPI) verifies the `X-Hub-Signature-256` webhook secret, extracts the installation ID from the payload, and submits the review to a `ThreadPoolExecutor` worker.
3. The worker (`_review_worker` at `app.py:44` or `_run_webhook_review_worker` at `webapp.py:317`) generates a GitHub App installation token via `github_auth.py:31-43`, then calls `run_review()`.

### Web App Mode (Mode 3)

1. User logs in via GitHub OAuth (`webapp.py:942-964`), submits a PR reference (e.g., `owner/repo#123`) via the web form (`POST /reviews` at `webapp.py:1319`).
2. The server looks up the user's provider config from the SQLite store, creates a `Job` object, and starts a background thread (`_run_review_worker` at `webapp.py:599`).
3. The worker clones the PR head via a shared bare-clone cache (`clone_cache.py`), runs `prepare_review()` with streaming SSE callbacks, and stores the resulting draft.
4. User edits the draft summary/comments in the browser, then clicks publish (`POST /reviews/.../publish` at `webapp.py:1659`), which calls `publish_review()`.

### Trigger Gating

All modes share the same trigger logic in `triggers.py:6-85`:
- Only `issue_comment` and `pull_request_review_comment` events with `action == "created"` are considered.
- The comment body must contain the `mention_trigger` (default `@askserge`).
- The comment author must have `author_association` of `MEMBER`, `OWNER`, or `COLLABORATOR`.
- The PR must be open.
- For inline follow-ups, the comment is anchored to a specific diff position; the bot replies in-thread.

---

## Authentication Model

| Mode | Auth Mechanism | How Token Is Obtained |
|---|---|---|
| Action | `GITHUB_TOKEN` (job token) | Automatically provided by Actions runner via `${{ github.token }}`; passed as `inputs.github_token` (`action.yml:70-73`) |
| GitHub App | JWT → Installation token | `github_auth.py:25-43`: Signs a JWT with the App's private key (`RS256`, 9-min expiry), then POSTs to `/app/installations/{id}/access_tokens` to get an installation-scoped token |
| Web app | OAuth (user) + App installation token (bot) | User logs in via OAuth (scope: `read:org`) at `webapp.py:942-964`; bot actions use App installation tokens via `installation_id_for_repo()` at `github_auth.py:46-71` |

**OAuth flow** (`webapp.py:967-1052`):
1. User is redirected to `https://github.com/login/oauth/authorize` with `read:org` scope.
2. On callback, the server exchanges the code for an access token, fetches the user's login and orgs.
3. Access is gated by `WEB_ALLOWED_USERS` (comma-separated logins) or `WEB_ALLOWED_ORG` (comma-separated orgs).
4. For SAML-protected orgs, there's a fallback using the GitHub App's own org membership lookup (`user_is_org_member()` at `github_auth.py:74-173`).

---

## Required Permissions

### Action Mode (`.github/workflows/ai-review.yml:10-12`)
```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

### GitHub App Mode (`README.md:72-73`)
- Pull requests: **Read & Write**
- Contents: **Read**
- Issues: **Read**
- Metadata: **Read**
- Subscribed events: **Issue comment**, **Pull request review comment**

### Web App Mode
Same as App mode, plus a separate OAuth App with `read:org` scope (`webapp.py:956`).

---

## Project Structure (relevant to entrypoints)

| File | Purpose |
|---|---|
| `action.yml:1-111` | Composite GitHub Action definition with 18 inputs |
| `.github/workflows/ai-review.yml:1-55` | Example workflow referencing the action |
| `pyproject.toml:34-37` | Three console scripts: `reviewbot-action`, `reviewbot-app`, `reviewbot-web` |
| `reviewbot/action_runner.py:1-166` | Action entry point — reads `$GITHUB_EVENT_PATH`, uses `$GITHUB_TOKEN` |
| `reviewbot/app.py:1-101` | Flask webhook server — verifies `X-Hub-Signature-256`, dispatches to `ThreadPoolExecutor` |
| `reviewbot/webapp.py:1-1757` | FastAPI web app — OAuth login, SSE streaming, draft editing, job persistence |
| `reviewbot/github_auth.py:1-173` | JWT generation, installation token exchange, org membership checks |
| `reviewbot/github_client.py:1-142` | Thin REST client wrapping GitHub API calls |
| `reviewbot/triggers.py:1-85` | Shared trigger gating logic for all modes |
| `reviewbot/config.py:1-268` | Configuration from env vars / Action inputs |
| `reviewbot/reviewer.py:1-1516` | Core review pipeline (diff annotation, LLM calls, validation, publishing) |
| `reviewbot/store.py:1-694` | SQLite persistence for web app jobs |
| `reviewbot/clone_cache.py` | Shared bare-clone + worktree cache for web mode |
| `.env.example:1-72` | All configurable env vars with documentation |
| `aws/` | EC2 deployment scripts (single-VM bootstrap, update, destroy, TLS setup) |

---

## Answers to Study Questions

### 1. What are the supported ways to trigger a review?

Three ways:
- **Comment mention**: Add a comment containing `@askserge` (configurable) to any open PR. Both top-level issue comments and inline review-comment replies are supported. (`triggers.py:23-24`)
- **Web app form**: Submit a PR URL via the interactive web UI at `POST /reviews`. (`webapp.py:1319`)
- **Inline follow-up**: Replying to an existing inline review comment that contains the trigger phrase — the bot answers in-thread as a focused follow-up rather than a full PR review. (`triggers.py:48-72`, `reviewer.py:1427-1516`)

### 2. Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**Primarily self-hosted service with a CI job mode.** The three modes form a spectrum:
- Mode 1 (GitHub Action) is a CI job — zero infrastructure, runs on GitHub's runners.
- Mode 2 (GitHub App webhooks) is a self-hosted service — requires a server receiving webhooks.
- Mode 3 (Web app) is also self-hosted — same server as Mode 2 plus OAuth and SQLite.

There is **no hosted/SaaS tier** provided by Hugging Face (the default `WEB_GITHUB_APP_URL` points to `https://github.com/apps/sergereview`, which is a public GitHub App, but the webhook receiver would still need to be self-hosted). The `aws/` directory provides single-VM EC2 bootstrap scripts for self-hosting.

### 3. How does it authenticate with the code hosting platform?

- **Action mode**: Uses the Actions job token (`GITHUB_TOKEN`), passed via the `github_token` input which defaults to `${{ github.token }}`. (`action.yml:70-73`)
- **GitHub App / webhook mode**: Generates a short-lived JWT (RS256, 9-min expiry) signed with the App's private key, exchanges it for an installation-scoped token via `POST /app/installations/{id}/access_tokens`. (`github_auth.py:25-43`)
- **Web app mode**: Two-legged — user authenticates via GitHub OAuth (scope: `read:org`) for access control; bot actions use the GitHub App installation token method above. (`webapp.py:942-964`, `github_auth.py:46-71`)

### 4. What repository permissions does it require?

- Action: `contents: read`, `pull-requests: write`, `issues: write`.
- GitHub App: Pull requests (R/W), Contents (R), Issues (R), Metadata (R).
- Web App: Same as GitHub App, plus OAuth `read:org` scope.

All documented in `.github/workflows/ai-review.yml:10-12` and `README.md:72-73`.

### 5. How hard would it be to install this in a private repo?

**Action mode: ~15 minutes.** Add `LLM_API_KEY` as a repo secret, copy the workflow YAML into `.github/workflows/`, and comment `@askserge` on a PR. The composite action is published to `huggingface/ai-reviewer@main`, so no clone or build step is needed in the target repo.

**GitHub App mode: ~45-60 minutes.** Create a GitHub App (Settings → Developer settings → GitHub Apps → New), configure webhook URL and permissions, download the private key, deploy the webhook server (EC2, Railway, Fly.io, etc.), set env vars, install the App on the target repo. The `aws/deploy.sh` script automates the EC2 part.

**Web app mode: Same as App mode + OAuth setup.** Extra steps: create an OAuth App, set `GITHUB_OAUTH_CLIENT_ID`/`GITHUB_OAUTH_CLIENT_SECRET`, configure allowed users/orgs.

The main effort driver is the self-hosted server for Modes 2/3. For a single repo, Mode 1 is trivially fast.

### 6. Does the integration model create security or operational risks?

Yes, several identified:

1. **Forked PR token exposure** (`action_runner.py:21-24`): GitHub does not pass secrets to workflows triggered from forks. The action explicitly detects this and refuses to run. Documented in `README.md:58-61` and handled in `action_runner.py:117-130`.

2. **Webhook secret required** (`app.py:35-41`, `webapp.py:308-314`): Both webhook servers verify `X-Hub-Signature-256` before processing events. Without this, any POST to `/webhook` could trigger reviews. The `Config.from_env(require_app=True)` enforces it (`config.py:146-148`).

3. **LLM API key storage**: In Action mode, the key is a GitHub secret. In App mode, it's an env var on the server. In Web mode, per-repo provider keys are stored in SQLite (`store.py`), accessible via admin UI. The `_provider_config_summary()` function (`webapp.py:494-519`) scrubs keys from API responses, only showing length + last 4 chars.

4. **No APPROVE by default** (`config.py:234`): `ALLOW_APPROVE` defaults to off because the LLM's choice of review event is influenced by attacker-controlled PR content. The web UI refuses to publish an APPROVE unless the operator opts in (`webapp.py:1696-1697`).

5. **Comment author gating**: Only MEMBER/OWNER/COLLABORATOR can trigger a review (`triggers.py:31`). This prevents external contributors from triggering LLM API calls on arbitrary PR content.

6. **Prompt injection safety** (`README.md:172-175`): PR content is treated as untrusted input. Injection attempts are flagged, and repo-defined tools run in a read-only sandbox.

7. **Session security** (`webapp.py:125-150`, `aws/README.md:86-102`): Sessions use signed cookies via `itsdangerous`. `WEB_SESSION_SECRET` must be strong. The `Secure` flag on the cookie is conditional on `WEB_INSECURE_COOKIES`. AWS deploy auto-generates the session secret.

8. **Clone cache** (`webapp.py:291-296`, `web_clone_cache_dir`): The web app maintains a git clone cache. Orphaned worktrees are cleaned on restart. Hourly GC prunes stale bare repos (`webapp.py:771-785`).

9. **Rate limiting** (`webapp.py:28-32`, `app.py:27-32`): Both webhook servers bound concurrent reviews via `ThreadPoolExecutor(max_workers=2)` to prevent resource exhaustion. The Action mode relies on GitHub's own concurrency limits.

### 7. Which integration model would be easiest to adapt for Ultraplan?

**The composite GitHub Action pattern** (`action.yml:79-111`) is the most portable and easiest to adapt:

- Zero infrastructure: runs on GitHub's own runners with no server to deploy.
- All inputs are explicit Action inputs with defaults, making configuration self-documenting.
- The action is self-contained — `pip install .` from the action path, no external service dependency.
- The same Python package powers all three modes, so the core review logic is reusable.
- The action installs itself (`pip install "${{ github.action_path }}"`), so there's no pre-built container to maintain.

For a private repo setup under an hour, this is the clear winner. The pattern is well-established (hundreds of thousands of GitHub Actions use this approach) and the composite action format means Ultraplan could publish its own action to the Marketplace with minimal friction.

---

## Configuration Surface

All configuration is shared across modes, passed as Action inputs (Mode 1) or environment variables (Modes 2/3). Key settings from `action.yml:8-73` and `.env.example:1-72`:

| Setting | Default | Purpose |
|---|---|---|
| `LLM_API_KEY` | (required) | Bearer token for chat-completion endpoint |
| `LLM_API_BASE` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `LLM_MODEL` | auto-discovered | Model identifier |
| `MENTION_TRIGGER` | `@askserge` | Phrase that triggers review |
| `REVIEW_EVENT` | `COMMENT` | Fallback review event |
| `MAX_DIFF_CHARS` | `200000` | Max diff size sent to LLM |
| `REVIEW_RULES_PATH` | `.ai/review-rules.md` | Repo-specific review rules (from default branch) |
| `REPO_CHECKOUT_PATH` | `${{ github.workspace }}` | Enables LLM browse tools |
| `TOOL_MAX_ITERATIONS` | `30` | Cap on blind tool-call turns |
| `ALLOW_APPROVE` | `false` | Whether to allow LLM-chosen APPROVE events |

---

## Platform-Specific Assumptions

The tool is **entirely GitHub-specific**:

- Only GitHub REST API v3 is used (`github_client.py:1-142`).
- Trigger events are GitHub-specific (`issue_comment`, `pull_request_review_comment`).
- Authentication uses GitHub App JWTs and OAuth tokens.
- The `actions/checkout` step is hardcoded in the Action workflow (`action.yml:83-85` uses `actions/setup-python@v5`, and the example workflow uses `actions/checkout@v4`).
- File contents are fetched via `GET /repos/{owner}/{repo}/contents/{path}`.
- Reviews are posted via `POST /repos/{owner}/{repo}/pulls/{number}/reviews` (GitHub's Pull Request Reviews API).
- No GitLab, Bitbucket, Azure DevOps, Gerrit, or Codeberg support.
- No support for non-GitHub review triggers (e.g., email patches, CLI input).

---

## Operational Tradeoffs

| Concern | Assessment |
|---|---|
| **Setup complexity** | Low for Action mode (trivial); Medium for App/Web modes (need a server) |
| **Latency** | Action mode: depends on runner queue + LLM latency. Webhook mode: near-real-time (server already running). Web app: extra latency from checkout + SSE streaming |
| **Scaling** | Action mode scales with GitHub's runner pool. Webhook mode is single-box with 2-worker thread pool. No horizontal scaling support |
| **Cost** | Action mode: LLM API costs only (runner minutes are free for public repos). Self-hosted: server costs + LLM costs |
| **Debugging** | Action mode: step summary + log output. Webhook mode: server logs. Web app: SSE streaming + SQLite history |
| **Upgrade** | Action mode: change tag in workflow. Web hook/web: `git pull` + restart server; `aws/update.sh` provides rsync-based deploy |
| **Fork PR support** | Action mode: NOT supported (secrets not passed). App/webhook mode: works (App token is server-side) |

---

## Patterns Worth Copying into Ultraplan

1. **Three-mode architecture from one codebase** (`README.md:9-15`): The same Python package exposes `reviewbot-action`, `reviewbot-app`, and `reviewbot-web` entry points. This lets users start with the simplest mode and upgrade without changing the review logic. Ultraplan could ship as a CLI tool that also serves as a webhook handler and an Action.

2. **Composite GitHub Action** (`action.yml:79-111`): The action is "composite" (no Docker image), installs itself from source, and passes all config as explicit inputs with defaults. This makes Marketplace publishing easy and gives users full control via workflow YAML.

3. **Shared trigger gating** (`triggers.py:6-85`): A single `build_review_request()` function is called from all three modes, ensuring behavior is identical regardless of entrypoint. The same pattern would let Ultraplan's core review logic stay entrypoint-agnostic.

4. **Token budget enforcement** (`reviewer.py:690-692`, `1131-1153`): The `llm_max_input_tokens` cap on cumulative input tokens prevents runaway costs on large PRs. Cross-chunk token tracking is built into the agentic loop.

5. **Inline follow-up flow** (`triggers.py:48-72`, `reviewer.py:1427-1516`): The ability to reply to inline review comments as focused follow-ups (not full re-reviews) is a UX detail that distinguishes serious review tools from simple one-shot comment bots.

6. **GitHub App org membership fallback** (`github_auth.py:74-173`): Two-step membership check (public API first, then App installation) works around SAML SSO limitations. This shows deep GitHub platform knowledge worth preserving.

7. **Per-repo provider configs** (`webapp.py:414-454`, `store.py`): Per-repo LLM provider keys stored in SQLite and gated by `allowed_users`/`allowed_orgs` and `repo_pattern` — admins can assign different models/keys to different repos without redeploying.

8. **Pruned job retention** (`webapp.py:544-549`): Automatic pruning of old jobs (configurable `web_job_retention`, default 25) keeps the SQLite store bounded without manual cleanup.

---

## Rating

**Score: 8/10**

Rationale:
- Clean three-mode design (Action / App webhook / Web app) from a single codebase.
- Composite Action makes Mode 1 trivial to adopt — pin a version, set one secret, done.
- Webhook signature verification, author-association gating, and forked-PR detection show security awareness.
- Well-documented permissions and configuration surface.
- **-1**: GitHub-only — no GitLab, Bitbucket, Azure DevOps, or generic webhook support. Portability is low.
- **-1**: No hosted SaaS tier — users must self-host Modes 2/3 or accept the Action mode's fork-PR limitation.

Fast heuristic: *"Could I add this review agent to a private GitHub repo in under an hour?"* — **Yes**, using Mode 1 (GitHub Action), easily under 15 minutes. For Modes 2/3, it's more like 1-2 hours.
