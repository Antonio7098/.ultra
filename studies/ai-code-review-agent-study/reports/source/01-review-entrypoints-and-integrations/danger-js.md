# Dimension 01: Review Entrypoints & Platform Integrations — danger-js

## Source Information

- **Name**: Danger
- **Repository**: <https://github.com/danger/danger>
- **Language**: Ruby (gem)
- **Version**: (current development)
- **LOC**: ~12,000+ across `lib/`

---

## Supported Entrypoints

Danger is triggered exclusively through a CLI command (`bundle exec danger`) that runs inside a CI pipeline. It is NOT a hosted service, GitHub App, or webhook server. It operates in the following modes:

### 1. CI Pipeline Command (`danger` — default runner)

The primary entrypoint. Invoked in CI as `bundle exec danger` (or `danger`). The `Runner` class at `lib/danger/commands/runner.rb:4` is the CLI entrypoint via [CLAide](https://github.com/CocoaPods/CLAide).

```ruby
# lib/danger/commands/runner.rb:75-85
def run
  Executor.new(ENV).run(
    base: @base, head: @head, dangerfile_path: @dangerfile_path,
    danger_id: @danger_id, new_comment: @new_comment,
    fail_on_errors: @fail_on_errors, fail_if_no_pr: @fail_if_no_pr,
    remove_previous_comments: @remove_previous_comments
  )
end
```

### 2. Local PR Preview (`danger pr <URL>`)

Runs the Dangerfile against a remote PR without posting results. Uses `DANGER_USE_LOCAL_GIT=YES`. Implemented at `lib/danger/commands/pr.rb:11`. Supports GitHub and mirrors the GitLab counterpart.

### 3. Local MR Preview (`danger mr <URL>`)

Same as `danger pr` but for GitLab merge requests. Implemented at `lib/danger/commands/mr.rb:11`.

### 4. Local Git Diff (`danger local`)

Deprecated in favor of `danger pr`. Runs Danger against the current local branch. Implemented at `lib/danger/commands/local.rb:12`.

### 5. Dry Run (`danger dry_run`)

Runs Danger against local git branches without posting to a review platform. Sets `DANGER_USE_LOCAL_ONLY_GIT=YES`. Implemented at `lib/danger/commands/dry_run.rb:7`.

### 6. GitHub Actions (`danger/danger` Docker Action)

A Docker-based GitHub Action that wraps the `bundle exec danger` CLI. The Dockerfile is at `Dockerfile:1-25` with an `ENTRYPOINT ["bundle", "exec", "danger"]`. The GitHub Actions CI source detects `GITHUB_ACTION` env var at `lib/danger/ci_source/github_actions.rb:21-23`.

---

## Authentication Model

Danger authenticates via **personal access tokens** stored as environment variables. There is no OAuth flow, no GitHub App installation, and no session management.

| Platform | Required Env Vars | Optional Env Vars |
|---|---|---|
| **GitHub** | `DANGER_GITHUB_API_TOKEN` or `DANGER_GITHUB_BEARER_TOKEN` | `DANGER_GITHUB_HOST`, `DANGER_GITHUB_API_BASE_URL` |
| **GitLab** | `DANGER_GITLAB_API_TOKEN` | `DANGER_GITLAB_HOST`, `DANGER_GITLAB_API_BASE_URL` |
| **Bitbucket Cloud** | `DANGER_BITBUCKETCLOUD_UUID` | OAuth key/secret, username/password, repo access token |
| **Bitbucket Server** | `DANGER_BITBUCKETSERVER_USERNAME`, `DANGER_BITBUCKETSERVER_PASSWORD`, `DANGER_BITBUCKETSERVER_HOST` | Code Insights config |
| **Azure DevOps (VSTS)** | `DANGER_VSTS_API_TOKEN`, `DANGER_VSTS_HOST` | `DANGER_VSTS_API_VERSION` |

Key detail at `lib/danger/request_sources/github/github.rb:21-27`:
```ruby
def self.env_vars
  ["DANGER_GITHUB_API_TOKEN", "DANGER_GITHUB_BEARER_TOKEN"]
end
def self.optional_env_vars
  ["DANGER_GITHUB_HOST", "DANGER_GITHUB_API_BASE_URL", "DANGER_OCTOKIT_VERIFY_SSL"]
end
```

For GitHub Actions, if `DANGER_GITHUB_API_TOKEN` is not set, it falls back to the `GITHUB_TOKEN` automatically (`lib/danger/ci_source/github_actions.rb:41-43`). This is a significant UX improvement.

Tokens are masked in inspect output (`lib/danger/request_sources/request_source.rb:42-48`).

---

## Platform-Specific Assumptions

### CI Provider Detection (30+ providers)

Danger auto-detects the CI provider via environment variables. Each CI source implements `validates_as_ci?` and `validates_as_pr?`. Examples:

- **GitHub Actions**: `GITHUB_ACTION` env var, PR if `GITHUB_EVENT_NAME` is `pull_request` or `pull_request_target` (`lib/danger/ci_source/github_actions.rb:21-28`)
- **Travis**: `HAS_JOSH_K_SEAL_OF_APPROVAL` (`lib/danger/ci_source/travis.rb:32-39`)
- **CircleCI**: `CIRCLE_BUILD_NUM`, optionally uses CircleCI API for PR detection (`lib/danger/ci_source/circle.rb:47-62`)
- **GitLab CI**: `GITLAB_CI` (`lib/danger/ci_source/gitlab_ci.rb:30-33`)
- **Azure Pipelines**: `AGENT_ID`, `BUILD_SOURCEBRANCH`, `BUILD_REPOSITORY_URI`, etc. (`lib/danger/ci_source/azure_pipelines.rb:34-41`)

Full list at `lib/danger/ci_source/` with 32 CI source files.

### Request Source Detection

Based on `repo_url` pattern matching in `lib/danger/danger_core/environment_manager.rb:91-101`:
```ruby
def get_repo_source(repo_url)
  case repo_url
  when /github/i then RequestSources::GitHub
  when /gitlab/i then RequestSources::GitLab
  when /bitbucket\.(org|com)/i then RequestSources::BitbucketCloud
  when /\.visualstudio\.com/i, /dev\.azure\.com/i then RequestSources::VSTS
  end
end
```

Each CI source declares which request sources it supports via `supported_request_sources`. For example, `AzurePipelines` supports all 5 request sources (`lib/danger/ci_source/azure_pipelines.rb:47-54`), while `GitHubActions` only supports `GitHub` (`lib/danger/ci_source/github_actions.rb:30-32`).

### Pull Request Event Flow

1. CI pipeline starts → Danger runs as a build step
2. `EnvironmentManager` detects CI source from env vars (`lib/danger/danger_core/environment_manager.rb:11-14`)
3. CI source extracts `repo_slug`, `pull_request_id`, `repo_url` from env
4. `EnvironmentManager` iterates request sources to find a matching + valid one (`lib/danger/danger_core/environment_manager.rb:38-46`)
5. Request source fetches PR details via API (`fetch_details`), sets up git branches (`setup_danger_branches`)
6. SCM computes diff via `GitRepo.diff_for_folder` (`lib/danger/scm_source/git_repo.rb:11-25`)
7. Dangerfile is evaluated in the DSL context
8. Results are posted back via `update_pull_request!` (comments + commit status)

---

## Operational Tradeoffs

### Strengths

1. **Extremely portable**: Runs in any CI (30+ providers) and posts to 5 code review platforms. The abstraction layer (`CI` base class at `lib/danger/ci_source/ci_source.rb:7`, `RequestSource` base class at `lib/danger/request_sources/request_source.rb:5`) makes this clean.
2. **No hosted dependency**: Entirely self-hosted. No SaaS, no webhook server, no long-running process.
3. **Plugin ecosystem**: Dangerfile DSL with community plugins (`lib/danger/danger_core/dangerfile.rb:88-91` loads `./danger_plugins/*.rb`).
4. **Inline review comments**: Supports inline PR comments on GitHub, GitLab (>= 10.8), Bitbucket Server, and Azure DevOps. GitHub implementation at `lib/danger/request_sources/github/github.rb:273-299`.
5. **Token masking**: Credentials are masked in debug output (`lib/danger/request_sources/request_source.rb:42-48`).
6. **Multi-repo organization Dangerfiles**: Supports cascading Dangerfiles across repos.

### Weaknesses

1. **No GitHub App integration**: Requires a personal access token with repo scope. No fine-grained app permissions, no webhook-based triggering. The token has broad access.
2. **CI-coupled execution model**: Cannot run as a standalone service. No webhook server, no event-driven architecture. The commit/build must already exist in the CI environment.
3. **Token-in-CI security model**: Secrets must be exposed to CI environment variables. For open source, the token often needs "Display value in build log" enabled (Travis docs at `lib/danger/ci_source/travis.rb:29`) which leaks tokens.
4. **Shallow clone issues**: Git merge-base resolution can fail with shallow clones. Workarounds include incremental depth fetch (`lib/danger/scm_source/git_repo.rb:83-99`).
5. **No preview before posting** (in CI mode): `danger local` and `danger pr` exist but the primary CI flow posts directly.
6. **Ruby runtime dependency**: Requires Ruby >= 2.7 (`danger.gemspec:21`), which may not be available in all CI environments.
7. **No webhook/event-driven mode**: Can't respond to PR events reactively — must be explicitly called in CI. Misses events like PR opened, labeled, or synchronized.

### Security Considerations

- GitHub token with `repo` scope grants broad write access (`lib/danger/request_sources/github/github.rb:66-78` uses the token for Octokit client which has full API access).
- Token stored in CI environment variables (subject to CI provider's security model).
- Token displayed in Travis build logs for fork PR support (`lib/danger/danger_core/environment_manager.rb:126-128`).
- Bitbucket Cloud supports multiple auth methods including OAuth and app passwords (`lib/danger/request_sources/bitbucket_cloud.rb:13-30`).
- GitHub bearer token support for GitHub App installations (`lib/danger/request_sources/github/github.rb:44, 73-74`).

---

## Patterns Worth Copying for Ultraplan

1. **Multi-provider abstraction**: The CI source / Request source separation is excellent. Ultraplan could use a similar `Source` base class with `validates?`, `fetch_details`, `update_pull_request!` interface.

2. **Auto-detection via environment**: CI providers are detected by checking for unique env vars. Ultraplan could auto-detect GitHub Actions, GitLab CI, etc. without explicit configuration.

3. **Graceful degradation for inline comments**: GitLab support tests the server version (`lib/danger/request_sources/gitlab.rb:147-156`) and falls back to non-inline comments if unavailable.

4. **Comment lifecycle management**: Danger creates, updates, strikes-through (for resolved), and deletes its own comments. It tags comments with `generated_by_danger` for identification (`lib/danger/request_sources/github/github.rb:162`).

5. **Commit status integration**: Danger sets commit status (`success`/`failure`) via `submit_pull_request_status!` at `lib/danger/request_sources/github/github.rb:229-261`, which provides CI-level feedback in addition to PR comments.

6. **Local testing without posting**: The `danger pr`, `danger mr`, and `danger dry_run` commands allow testing the Dangerfile locally without affecting the PR.

7. **GITHUB_TOKEN auto-fallback**: GitHub Actions CI source auto-uses `GITHUB_TOKEN` if `DANGER_GITHUB_API_TOKEN` is not set (`lib/danger/ci_source/github_actions.rb:41-43`). This reduces setup friction significantly.

8. **Tokenless local mode**: The `use_local_git` flag and `LocalOnly` request source (`lib/danger/request_sources/local_only.rb`) allow running Danger without any API token for local git-only analysis.

---

## Answers to Study Questions

### Q1: Supported ways to trigger a review
- **CI build step** (`bundle exec danger`): Primary method, runs in 30+ CI providers.
- **GitHub Actions** (`danger/danger` Docker action): Wrapper around the CLI.
- **Local CLI** (`danger pr <URL>`, `danger mr <URL>`, `danger local`, `danger dry_run`): For testing without posting to PR.
- **No webhook, no hosted service, no GitHub App**.

### Q2: Primary design model
Primarily a **CI job** (self-hosted). Not a hosted service, not a GitHub App, not a webhook server. The tool is designed to run as a single step in an existing CI pipeline.

### Q3: Authentication with code hosting platform
Via **personal access tokens** in environment variables. GitHub supports both classic PATs (`DANGER_GITHUB_API_TOKEN`) and GitHub App installation tokens (`DANGER_GITHUB_BEARER_TOKEN`). GitLab uses `DANGER_GITLAB_API_TOKEN`. Bitbucket and Azure DevOps have their own credential schemes.

### Q4: Repository permissions required
**Broad**: The GitHub token must have `repo` scope (for private repos) which grants read/write to code, PRs, issues, and settings. There are no fine-grained permissions. The token is used for:
- Reading PR details, diff, comments (`lib/danger/request_sources/github/github.rb:93-99, 136-143`)
- Posting/editing/deleting comments (`lib/danger/request_sources/github/github.rb:160-227`)
- Setting commit status (`lib/danger/request_sources/github/github.rb:229-261`)
- Reading file contents (`lib/danger/request_sources/github/github.rb:560-573`)

### Q5: Installation difficulty in a private repo
**Low difficulty, under 30 minutes**:
1. Add `gem "danger"` to Gemfile, `bundle install`
2. Create a `Dangerfile`
3. Generate a GitHub personal access token with `repo` scope
4. Add token as a CI secret
5. Add `bundle exec danger` to CI pipeline

For GitHub Actions, it's even simpler (5-minute setup using `danger/danger` action).

### Q6: Security or operational risks
- **Token exposure**: Token must be in CI env vars. Fork PR support may require exposing it in build logs.
- **Broad token scope**: `repo` scope grants more permissions than Danger needs.
- **No webhook validation**: Since Danger doesn't receive webhooks, there's no webhook secret to manage — but this also means no event-driven triggering.
- **`eval` in Dangerfile**: The Dangerfile is evaluated via `eval()` at `lib/danger/danger_core/dangerfile.rb:314`, which means arbitrary code execution from the Dangerfile.

### Q7: Easiest integration model to adapt for Ultraplan
The **CI source / Request source abstraction** (`lib/danger/ci_source/ci_source.rb` and `lib/danger/request_sources/request_source.rb`) is the most valuable pattern. Specifically:
- The `validates_as_ci?` / `validates_as_pr?` detection pattern
- The `supported_request_sources` matrix (each CI source declares which platforms it works with)
- The `update_pull_request!` interface for posting results
- The local testing commands (`danger pr`, `danger mr`) for development

---

## Rating

**Score: 8/10**

| Axis | Score | Rationale |
|---|---|---|
| Workflow fit | 9 | Fits naturally into CI pipelines. Runs as a build step. |
| Installation complexity | 7 | Simple for GitHub Actions (5 min). More setup for other CI (token management, Gemfile). |
| Permission minimization | 4 | Requires `repo`-scoped token. No fine-grained permissions. Open source tokens may need to be public. |
| Portability | 9 | 30+ CI providers, 5 code review platforms. Excellent abstraction layer. |
| Self-hostability | 10 | Fully self-hosted. No SaaS dependency at all. |

**Rationale**: Danger's integration design is exceptionally portable and well-abstracted. The CI source / Request source separation is a textbook example of clean integration architecture. However, its reliance on broad personal access tokens, lack of GitHub App support, and CI-coupled execution model prevent a higher score. The token security model is the weakest point.

**Fast heuristic**: "Could I add this review agent to a private GitHub repo in under an hour?" — **Yes**, easily in 15-30 minutes for most setups.
