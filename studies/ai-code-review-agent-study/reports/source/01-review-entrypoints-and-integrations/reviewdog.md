# Study: Review Entrypoints & Platform Integrations — reviewdog

## Source Metadata

- **Repo**: [reviewdog/reviewdog](https://github.com/reviewdog/reviewdog)
- **Language**: Go
- **Primary role**: Universal diff-based linter comment posting tool
- **Analysis date**: 2026-06-01

---

## 1. Supported Entrypoints

reviewdog supports **six distinct entrypoint models**, making it one of the most portable code review tools in the ecosystem.

| Entrypoint | Mechanism | File Evidence |
|---|---|---|
| **CLI (stdin pipe)** | Primary interface. Linter output piped via stdin, diff fetched locally or from CI env vars. | `cmd/reviewdog/main.go:282-468` |
| **GitHub Actions** | Runs as a workflow step using `secrets.GITHUB_TOKEN`. Can use `github-check`, `github-pr-check`, `github-pr-review`, `github-annotations`, `github-pr-annotations` reporters. | `.github/workflows/reviewdog.yml:1-348` |
| **Doghouse server (GitHub App proxy)** | Self-hosted Google App Engine service at `reviewdog.app`. CLI sends lint results as JSON to `/check` endpoint. Server authenticates as GitHub App installation to create Check Runs. | `doghouse/appengine/main.go:66-116`, `doghouse/appengine/checker.go:27-74` |
| **CI environment detection** | Auto-detects Travis CI, Circle CI, Drone.io, GitLab CI, Bitbucket Pipelines, Woodpecker CI from env vars. No explicit config needed. | `cienv/cienv.go:37-104`, `cienv/github_actions.go:69-102` |
| **GitHub webhooks** | Doghouse server handles `check_suite` (requested) and `installation` (created) events to track installation state. | `doghouse/appengine/github_webhook.go:19-87` |
| **Project config file** | `.reviewdog.yml` defines multiple runners, each with cmd/format/level. Enables batch runs. | `project/conf.go:8-24`, `.reviewdog.yml:1-20` |

---

## 2. Authentication & Permissions Model

| Auth Method | Scope | Where |
|---|---|---|
| `REVIEWDOG_GITHUB_API_TOKEN` | GitHub PAT with `repo` scope (or `GITHUB_TOKEN` in Actions) | `cmd/reviewdog/main.go:710-713` |
| `REVIEWDOG_TOKEN` | Doghouse repo token (generated via OAuth web UI at `reviewdog.app/gh/{owner}/{repo}`) | `cmd/reviewdog/doghouse.go:54-58` |
| `REVIEWDOG_GITLAB_API_TOKEN` | GitLab PAT with `api` scope | `cmd/reviewdog/main.go:802-804` |
| `REVIEWDOG_GITEA_API_TOKEN` | Gitea access token | `cmd/reviewdog/main.go:531-534` |
| `BITBUCKET_USER` + `BITBUCKET_PASSWORD` or `BITBUCKET_ACCESS_TOKEN` | Bitbucket Cloud/Server auth | `cmd/reviewdog/main.go:863-866` |
| `GERRIT_USERNAME` + `GERRIT_PASSWORD` or `GERRIT_GIT_COOKIE_PATH` | Gerrit basic auth or cookie auth | `cmd/reviewdog/main.go:841-851` |
| **GitHub App JWT** (server-side) | Doghouse server uses `ghinstallation/v2` to authenticate as GitHub App | `doghouse/server/github.go:25-38` |
| **Trusted CI IPs** | Doghouse skips token validation for known CI provider IPs (Travis CI) | `doghouse/appengine/checker.go:76-89`, `doghouse/server/ciutil/ciutil.go` |

**Permission requirements**:
- **GitHub (direct)**: `repo` scope for PAT (full private repo access) or `checks: write` + `pull-requests: write` in Actions context
- **GitHub (doghouse)**: Token is per-repository, generated from 8-byte crypto random (`doghouse/server/token.go:12-14`). The doghouse server uses ephemeral installation tokens that scoped to the installation's repos.
- **GitLab**: `api` scope for PAT
- **Gitea**: `repo` scope for access token
- **Bitbucket**: Repository write access

---

## 3. Platform-Specific Assumptions

### GitHub
- **Two distinct API paths**: (1) Check Runs API (`service/github/check.go`) for `github-check`/`github-pr-check`, (2) Pull Request Review API (`service/github/github.go`) for `github-pr-review`
- **Fork PR handling**: When `GITHUB_TOKEN` lacks write permission (forked PRs), `github-pr-review` falls back to GitHub Actions log commands (`service/github/github.go:236-251`)
- **Check annotation limits**: 50 annotations per request, summary text capped at 65535 characters (`service/github/check.go:26-31`)
- **Review comment limits**: Max 30 review comments per PR review to avoid abuse detection (`service/github/github.go:27,174`)
- **GitHub Enterprise**: Supports custom `GITHUB_API` base URL (`cmd/reviewdog/main.go:777-799`)
- **Check suite re-run**: Detects re-run events from `GITHUB_EVENT_PATH` JSON payload (`cienv/github_actions.go:69-102`)

### GitLab
- Two reporters: `gitlab-mr-discussion` (thread comments) and `gitlab-mr-commit` (commit-level comments)
- No automatic MR ID from GitLab CI env vars (GitLab bug `gitlab-org/gitlab-ce#15280`), so reviewdog falls back to SHA-based MR lookup (`cmd/reviewdog/main.go:817-825`, `cmd/reviewdog/main.go:883-898`)
- Supports self-hosted GitLab via `GITLAB_API` or `CI_API_V4_URL` env vars

### Bitbucket
- Cloud and Server split: Cloud uses API v2.0, Server uses separate REST API (`service/bitbucket/`)
- Code Insights reports with `PASSED`/`FAILED`/`PENDING` states per tool
- No diff filtering: Bitbucket reporter always uses `filter.ModeNoFilter` (`cmd/reviewdog/main.go:415`)
- 100 annotation batch limit (`service/bitbucket/annotator.go:18`)

### Gitea
- Single reporter: `gitea-pr-review`
- Supports guessing PR ID from branch/commit via Gitea API (`cmd/reviewdog/main.go:580-625`)
- Requires `GITEA_ADDRESS` env var for server URL
- Requires Gitea >= 1.17.0 (`cmd/reviewdog/main.go:637`)

### Gerrit
- Single reporter: `gerrit-change-review`
- Three auth modes: basic, git cookie, or no auth
- Requires explicit env vars (`GERRIT_CHANGE_ID`, `GERRIT_REVISION_ID`, `GERRIT_BRANCH`, `GERRIT_ADDRESS`)
- Uses `golang.org/x/build/gerrit` SDK

---

## 4. Operational Tradeoffs

| Dimension | Tradeoff |
|---|---|
| **Architecture** | CLI-first design means reviewdog is fundamentally a **pipe filter**, not a daemon. The doghouse server is optional, providing GitHub App integration for repos that cannot use PATs. |
| **Latency** | Direct API calls (no doghouse) are fastest. Doghouse adds one network hop. Both are synchronous from the CI step's perspective. |
| **Security** | PAT with `repo` scope grants broad access. Doghouse token model is more scoped (per-repo). GitHub App installation tokens are the most secure (ephemeral, auto-scoped). |
| **Setup complexity** | Lowest: `REVIEWDOG_GITHUB_API_TOKEN` + pipe. Medium: GitHub Actions with `GITHUB_TOKEN`. Highest: Doghouse server (requires GAE deployment, GitHub App setup, OAuth flow). |
| **Portability** | Excellent. The same CLI binary works across 5+ platforms. Platform-specific logic is isolated to `service/` packages behind uniform `CommentService`/`DiffService` interfaces (`reviewdog.go:48-79`). |
| **Self-hostability** | The CLI is fully self-hostable (single binary). The doghouse server requires Google App Engine. |
| **CI dependency** | Most reporters require a CI environment for PR number/SHA detection. The `-guess` flag provides a workaround by searching GitHub API. |

---

## 5. Answers to Study Questions

### Q1: What are the supported ways to trigger a review?

1. **CI pipeline execution** (most common): GitHub Action, Travis CI, Circle CI, Drone.io, GitLab CI, Bitbucket Pipelines, Woodpecker CI
2. **Local CLI** with `-diff` flag for local changes
3. **Doghouse server** via GitHub App `check_suite` webhook → CLI call
4. **Manual pipe**: Any shell pipeline producing linter output → `reviewdog -reporter=<x>`

### Q2: Primary design: self-hosted service, CI job, or local CLI?

**Primarily a CI-integrated CLI tool.** The design center is a pipe filter that runs in CI jobs. The doghouse server (hosted or self-hosted GAE) is a complementary component for GitHub App integration. The CLI is the single binary users install; server components are optional.

### Q3: How does it authenticate with the code hosting platform?

Via **environment-variable-injected tokens**: PATs (GitHub, GitLab, Gitea), username/password (Bitbucket, Gerrit), OAuth tokens (doghouse), or GitHub App JWT + installation tokens (doghouse server). Not OAuth flows from the CLI side (except doghouse web UI). Token is validated at request time — no token exchange or refresh logic in the CLI.

### Q4: What repository permissions does it require?

- **GitHub PAT**: `repo` (full control of private repos) — broad
- **GitHub Actions**: `checks: write` + `pull-requests: write` + `contents: read` — more scoped
- **GitLab PAT**: `api` scope — broad
- **Bitbucket**: Repository write access
- **Doghouse token**: Per-repository, no GitHub user scopes needed — minimal
- **GitHub App installation**: Auto-scoped to repos the app is installed on — most minimal

### Q5: How hard would it be to install in a private repo?

**Easy for GitHub (under 30 min):**
1. Add a GitHub Actions workflow YAML
2. Set `REVIEWDOG_GITHUB_API_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
3. Pipe linter output to `reviewdog -reporter=github-pr-check`

**For doghouse (1-2 hours):**
1. Install the GitHub App at `https://github.com/apps/reviewdog`
2. Get token from `https://reviewdog.app/gh/{owner}/{repo}`
3. Set `REVIEWDOG_TOKEN` in CI secrets

**For self-hosted doghouse (1-2 days):**
1. Deploy GAE app with private key + GitHub App credentials
2. Configure webhook and OAuth
3. Point CLI at custom `REVIEWDOG_GITHUB_APP_URL`

### Q6: Does the integration model create security or operational risks?

- **PAT in CI secrets**: Standard risk. PAT with `repo` scope is powerful; rotation is manual.
- **Doghouse static token**: 8-byte hex token (`doghouse/server/token.go:12-14`) — 64 bits of entropy. Reasonable for a CI token but not cryptographic grade.
- **Trusted CI IP bypass**: Doghouse server skips token validation for known CI provider IPs (`doghouse/appengine/checker.go:86-88`). This is a deliberate operational tradeoff for Travis CI users but could be abused if CI IP ranges change.
- **No token refresh**: GitHub App installation tokens are short-lived and auto-refreshed by the doghouse server (`ghinstallation/v2` handles this). Direct PAT usage has no such mechanism.

### Q7: Which integration model would be easiest to adapt for Ultraplan?

The **CI env var detection + single CLI binary** model is the most adaptable:

1. The `cienv` package (`cienv/cienv.go:37-104`) shows how to extract repo identity from environment — this pattern works for any CI that sets env vars.
2. The `CommentService`/`DiffService` interface (`reviewdog.go:48-79`) is cleanly abstracted — a new platform integration means implementing two interfaces (Post + Diff).
3. The **stdin pipe model** means Ultraplan would receive linter output the same way, parse it (using existing `parser/` package), filter by diff, and post via a platform-specific service.

The doghouse server architecture (thin proxy that authenticates as a GitHub App) is worth copying if Ultraplan wants to offer a hosted service — but the core engine should remain CLI-first for self-hostability.

---

## 6. Rating

**Score: 8/10**

Rationale:
- **+2**: Multi-platform support (GitHub, GitLab, Bitbucket, Gitea, Gerrit) via clean interface abstraction
- **+2**: Optional doghouse server for GitHub App integration without PAT
- **+1**: Excellent CI auto-detection across 7+ CI providers
- **+1**: Fork PR fallback to log commands shows deep GitHub Actions understanding
- **+1**: Project config for multi-runner orchestration
- **+1**: Local reporter mode for development workflows

- **-1**: GitHub PAT with `repo` scope is over-broad for the task (read+write to all repos)
- **-1**: No hosted SaaS offering — users must self-host doghouse or use PATs
- **-1**: Gerrit support requires many explicit env vars (no auto-detection)

---

## 7. Patterns Worth Copying into Ultraplan

1. **Interface-driven platform abstraction**: `CommentService` + `DiffService` (`reviewdog.go:48-79`) makes adding a new platform trivial (implement Post + Flush + Diff). Ultraplan should define similar narrow interfaces.

2. **CI auto-detection as a package**: `cienv/cienv.go` reads 20+ env var names across providers. This is a standalone, testable package. Ultraplan's equivalent would let users bring their own CI without Ultraplan knowing about it.

3. **Doghouse proxy pattern**: Thin server that authenticates as a platform app, receives results from CLI, posts on behalf. Decouples auth complexity from the review engine.

4. **Graceful permission fallback**: GitHub PR review → fallback to Actions log annotations on permission denied (`service/github/github.go:236-251`). Ultraplan should plan for limited-permission environments.

5. **Stdio as universal interface**: Linter results in → review comments out. No daemon, no webhook server required for basic use. This dramatically lowers adoption friction.
