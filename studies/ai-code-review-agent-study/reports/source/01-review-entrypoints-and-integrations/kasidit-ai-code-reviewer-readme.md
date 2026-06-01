# Dimension 01: Review Entrypoints & Platform Integrations

**Source:** kasidit-ai-code-reviewer-readme  
**Document:** README of `github.com/kasidit-wansudon/ai-code-reviewer`  
**Language:** Go (per README badge)  
**License:** MIT

---

## 1. Supported Entrypoints

| Entry Point | Supported | Details |
|---|---|---|
| GitHub Action | **Yes** — primary and only entrypoint | Users add a workflow file to `.github/workflows/` referencing the action via `uses: kasidit-wansudon/ai-code-reviewer@v1` (`sources/kasidit-ai-code-reviewer-readme.md:37-62`) |
| GitHub App | No evidence found | Not mentioned |
| CLI | No evidence found | Not mentioned |
| Webhook Service | No evidence found | Not mentioned |
| Hosted/SaaS | No evidence found | Not mentioned |
| GitLab/Azure DevOps | No evidence found | Not mentioned |

**Only a single entrypoint exists** as documented: a GitHub Action triggered on `pull_request` events (`sources/kasidit-ai-code-reviewer-readme.md:28-29`).

---

## 2. Trigger Flow: How a Pull Request Event Enters the System

Based on the documented project structure (`sources/kasidit-ai-code-reviewer-readme.md:113-125`) and usage example (`sources/kasidit-ai-code-reviewer-readme.md:38-62`):

1. GitHub Actions detects `pull_request` with types `opened` or `synchronize` (`sources/kasidit-ai-code-reviewer-readme.md:44`)
2. Runner checks out the repository and runs the action container
3. Action receives `github-token` (automatically provided by GitHub Actions) and `openai-api-key` (from secrets) as inputs (`sources/kasidit-ai-code-reviewer-readme.md:55-56`)
4. Go binary fetches PR diff via GitHub API (`github/pr.go`, referenced in project structure at `sources/kasidit-ai-code-reviewer-readme.md:118`)
5. Diff is parsed per-file, per-hunk by `reviewer/diff_parser.go` (`sources/kasidit-ai-code-reviewer-readme.md:122`)
6. LLM prompt is constructed by `reviewer/prompt.go` (`sources/kasidit-ai-code-reviewer-readme.md:123`)
7. LLM client sends diff to either OpenAI API or self-hosted llm-gateway (`llm/client.go`, `sources/kasidit-ai-code-reviewer-readme.md:124`)
8. Inline comments are posted on specific lines via `github/comment.go` (`sources/kasidit-ai-code-reviewer-readme.md:119`)
9. Summary comment is posted on the PR if `post-summary: true` (`sources/kasidit-ai-code-reviewer-readme.md:61`)

The flow is a **single sequential pipeline** — no branching, retries, or parallel processing is described.

---

## 3. Authentication Model

| Aspect | Implementation | Source Location |
|---|---|---|
| GitHub API Access | `GITHUB_TOKEN` passed as `github-token` input | `sources/kasidit-ai-code-reviewer-readme.md:55` |
| LLM API Access | `OPENAI_API_KEY` passed as `openai-api-key` input | `sources/kasidit-ai-code-reviewer-readme.md:56` |
| Alternative LLM | `llm-gateway-url` — no key required when using self-hosted gateway | `sources/kasidit-ai-code-reviewer-readme.md:103` |

**Authentication flow:** Both secrets are supplied as GitHub Actions inputs. The GitHub Actions runtime injects `GITHUB_TOKEN` automatically; the user must manually create `OPENAI_API_KEY` as a repository secret (`sources/kasidit-ai-code-reviewer-readme.md:55-56`).

**No token validation, rotation, or scoped permission checking** is described in the README. The Go binary presumably trusts whatever inputs it receives.

---

## 4. Repository Permissions Required

From the workflow example (`sources/kasidit-ai-code-reviewer-readme.md:49-51`):

```yaml
permissions:
  pull-requests: write
  contents: read
```

- **`pull-requests: write`** — Required to post inline review comments and summary comments on PRs.
- **`contents: read`** — Required to fetch the PR diff via GitHub API.

These are the **minimum necessary permissions** for the described functionality. No `issues: write`, `checks: write`, `deployments`, or admin permissions are requested. This is a well-scoped permissions model.

---

## 5. Installation Complexity for Private Repos

**Very low complexity**, based solely on the README:

1. Create `.github/workflows/ai-review.yml` with the provided workflow template (`sources/kasidit-ai-code-reviewer-readme.md:38-62`)
2. Add `OPENAI_API_KEY` as a repository secret in GitHub (`sources/kasidit-ai-code-reviewer-readme.md:56`)
3. (Optional) Configure `llm-gateway-url` instead of OpenAI key (`sources/kasidit-ai-code-reviewer-readme.md:57`)
4. Commit and push. The action runs automatically on next PR open/synchronize.

**Estimated time: under 10 minutes** for a user familiar with GitHub Actions.

**No infrastructure required** — the action runs on GitHub-hosted runners. No servers, Docker containers, databases, or webhook endpoints to manage. The `llm-gateway-url` option adds a self-hosted dependency if the user chooses that path, but it is optional.

**Private repo note:** All GitHub Actions secrets work identically in private repos. The `GITHUB_TOKEN` is automatically available. No additional configuration is needed for private repos.

---

## 6. Security and Operational Risks

### Identified Risks (from README evidence)

| Risk | Description | Mitigation | Source |
|---|---|---|---|
| LLM API key exposure | `OPENAI_API_KEY` passed through action inputs; if the action logs inputs or fails, key could leak in workflow output | Standard GitHub Actions secret handling | `sources/kasidit-ai-code-reviewer-readme.md:56` |
| Broad file review scope | `file-extensions` defaults to "all" — LLM sees every file in the diff including configs, secrets, and generated files | `file-extensions` input for filtering | `sources/kasidit-ai-code-reviewer-readme.md:107` |
| `GITHUB_TOKEN` scope | Token with `pull-requests: write` is available inside the action runtime; if the Go binary is compromised, token could be misused | GitHub's ephemeral token + minimal permissions | `sources/kasidit-ai-code-reviewer-readme.md:49-51` |
| No rate limiting described | Large PRs with many files could cause excessive LLM API calls and cost | `max-files` input provides a hard limit | `sources/kasidit-ai-code-reviewer-readme.md:106` |
| Prompt injection | PR diff content is sent to LLM; malicious code or comments in diff could manipulate LLM output | No mitigation described in README | Implied by the flow |
| No input validation documented | No mention of validation for `github-token`, `openai-api-key`, or `model` inputs | None described | N/A |

### Operational Risks

- **Cost exposure**: Each PR review makes LLM API calls. With `review-level` configurable (`sources/kasidit-ai-code-reviewer-readme.md:105`), users can trade off cost vs. thoroughness, but there is no cost budget or cap described.
- **Latency**: LLM API calls add latency to CI (typically 10-30s per file). The `max-files` default of 10 (`sources/kasidit-ai-code-reviewer-readme.md:106`) limits this but large PRs may still cause significant wall-clock time.
- **Single point of failure**: If the LLM API is down, reviews fail entirely — no fallback to deterministic analysis is described.

---

## 7. Platform Portability

| Platform | Status | Source |
|---|---|---|
| GitHub.com | **Fully supported** — designed as a GitHub Action | `sources/kasidit-ai-code-reviewer-readme.md:19` |
| GitHub Enterprise Server | Partial — GitHub Actions work on GHES, but `GITHUB_TOKEN` behavior may differ | Not addressed in README |
| GitLab | No evidence found | Not mentioned |
| BitBucket | No evidence found | Not mentioned |
| Azure DevOps | No evidence found | Not mentioned |

The tool is **exclusively GitHub-specific**. The entire design is built around GitHub Actions and the GitHub API (`github/pr.go`, `github/comment.go` in project structure at `sources/kasidit-ai-code-reviewer-readme.md:117-119`). Porting to another platform would require:

- Replacing the GitHub API client (`github/pr.go`) with the target platform's API
- Reimplementing the GitHub Action wrapper as the target platform's CI integration
- Adapting the authentication model (e.g., GitLab CI tokens, Azure DevOps PATs)

The core review engine (`reviewer/diff_parser.go`, `reviewer/prompt.go`, `llm/client.go` at `sources/kasidit-ai-code-reviewer-readme.md:121-124`) is potentially portable, but the README describes no abstraction layer for platform independence.

---

## 8. Self-Hostability

| Factor | Assessment | Evidence |
|---|---|---|
| LLM provider choice | **Flexible** — supports direct OpenAI or self-hosted `llm-gateway` | `sources/kasidit-ai-code-reviewer-readme.md:102-103` |
| CI infrastructure | **Tied to GitHub** — GitHub Action format requires GitHub CI runners | `sources/kasidit-ai-code-reviewer-readme.md:19` |
| Alternative runner | Possible via GitHub self-hosted runners, but action format itself is non-portable | Not addressed in README |
| No SaaS dependency for LLM | Achievable via `llm-gateway-url` for self-hosted LLM | `sources/kasidit-ai-code-reviewer-readme.md:103` |

**Partial self-hostability.** The `llm-gateway-url` option enables air-gapped/private LLM deployments, which is valuable for enterprise users. However, the action format fundamentally depends on GitHub infrastructure — it cannot run outside GitHub Actions without rewriting the entrypoint layer.

---

## 9. Answers to Study Questions

### Q1: What are the supported ways to trigger a review?

**Single trigger:** GitHub Action triggered on `pull_request: [opened, synchronize]` (`sources/kasidit-ai-code-reviewer-readme.md:43-44`). No manual triggers, CLI commands, chat commands, webhook endpoints, or API calls are described.

### Q2: Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**CI job** — specifically a GitHub Action running in CI. It is described entirely as a workflow step (`sources/kasidit-ai-code-reviewer-readme.md:37-62`). No hosted service, self-hosted service, or local CLI mode exists. The `llm-gateway-url` option adds self-hosted LLM capability but the runtime model remains CI-only.

### Q3: How does it authenticate with the code hosting platform?

Via `GITHUB_TOKEN` passed as `github-token` action input (`sources/kasidit-ai-code-reviewer-readme.md:55,101`). This is the standard GitHub Actions automatic token scoped to the workflow's repository. The token is created and managed by the GitHub Actions runtime, not by the user.

### Q4: What repository permissions does it require?

- `pull-requests: write` — to post inline and summary comments
- `contents: read` — to fetch PR diffs

(`sources/kasidit-ai-code-reviewer-readme.md:49-51`)

These are the minimum necessary permissions. The action makes no additional permission requests.

### Q5: How hard would it be to install this in a private repo?

**Very easy** (under 10 minutes):
1. Add a workflow file to `.github/workflows/` (`sources/kasidit-ai-code-reviewer-readme.md:38-62`)
2. Store `OPENAI_API_KEY` as a repository secret (`sources/kasidit-ai-code-reviewer-readme.md:56`)
3. Commit and push

Private repos have no additional friction — all the same secrets and permissions mechanisms apply. The fast heuristic question "Could I add this review agent to a private GitHub repo in under an hour?" — **Yes, absolutely, in under 10 minutes based on the README documentation.**

### Q6: Does the integration model create security or operational risks?

**Moderate risks, mostly standard for CI-integrated tools:**

- **LLM API key in CI secrets** (`sources/kasidit-ai-code-reviewer-readme.md:56`) — standard practice but means the key is accessible inside every action execution
- **`GITHUB_TOKEN` with write permissions** (`sources/kasidit-ai-code-reviewer-readme.md:49-50`) — exposed inside the action; if the Go binary has a vulnerability, the token could be exfiltrated
- **No prompt injection defense** — the README does not mention sanitizing PR diffs before sending to the LLM
- **Cost risk** — `max-files` default of 10 limits exposure but no cost budget or caps are described
- **Default `file-extensions: all`** (`sources/kasidit-ai-code-reviewer-readme.md:107`) — LLM may review sensitive files unless explicitly filtered

The risks are comparable to other GitHub Actions that make outbound API calls (e.g., CodeRabbit, PR-Agent). No extraordinary security measures (e.g., microVM isolation, network egress controls, token scope minimization beyond what GitHub Actions provides) are described.

### Q7: Which integration model would be easiest to adapt for Ultraplan?

**The GitHub Action model as documented here is the easiest entry point.** Key reasons:

1. **Zero infrastructure** — no servers, webhooks, or databases to manage
2. **Well-defined trigger** — `pull_request: [opened, synchronize]` events are standard across all GitHub repos
3. **Automatic token** — `GITHUB_TOKEN` is provisioned by GitHub Actions, eliminating credential management
4. **Familiar setup** — developers already understand adding workflow files and secrets
5. **Minimal permissions** — the `pull-requests: write + contents: read` model is the gold standard for least-privilege

**What Ultraplan should extend beyond this model:**

| Missing in this model | Ultraplan opportunity | Rationale |
|---|---|---|
| CLI mode | Add `ultra review` CLI command | Enables local/on-demand review without CI |
| Webhook server | Add HTTP server for custom triggers | Enables GitLab/Azure DevOps/self-hosted Git |
| Multi-platform | Abstract SCM client behind interface | Single review engine across all platforms |
| Interactive commands | Add PR comments like `/ultra review` | Enables on-demand re-review without re-running CI |
| Webhook validation | Add HMAC/secret verification | Required for non-Action entrypoints |

---

## 10. Analysis Axes

| Axis | Score | Rationale |
|---|---|---|
| **Workflow fit** | 8/10 | GitHub Action triggers naturally on PR events — no manual intervention needed. The inline + summary comment format aligns with developer expectations. |
| **Installation complexity** | 9/10 | Add one workflow file and one secret. Under 10 minutes for a GitHub Actions user. No infrastructure. |
| **Permission minimisation** | 8/10 | Requests only `pull-requests: write` and `contents: read` — the exact minimum needed. |
| **Portability** | 1/10 | GitHub Action only. No CLI, webhook server, GitLab/Azure DevOps/self-hosted Git support. The review engine (`reviewer/`, `llm/`) could theoretically be portable, but the README shows no abstraction layer. |
| **Self-hostability** | 4/10 | `llm-gateway-url` enables self-hosted LLM, but the action format requires GitHub infrastructure. Cannot run outside GitHub Actions without a rewrite. |

---

## 11. Rating

**Score: 6/10**

| Criterion | Score | Rationale |
|---|---|---|
| Entrypoint diversity | 1/10 | Single entrypoint (GitHub Action only) |
| Authentication design | 7/10 | Standard GITHUB_TOKEN pattern — automatic, scoped, no manual credential management |
| Permission minimisation | 8/10 | Correctly requests only necessary permissions |
| Installation complexity | 9/10 | Minimal setup for GitHub users |
| Private repo usability | 9/10 | Works identically in private repos |
| Security posture | 4/10 | No prompt injection defense, no input validation described, no cost caps |
| Portability | 1/10 | GitHub-only — no support for any other platform |
| Self-hostability | 4/10 | LLM gateway is self-hostable; action runtime is not |

**Justification:** The GitHub Action design is clean, minimal, and well-scoped. The permissions model (`pull-requests: write` + `contents: read`) is the gold standard for least-privilege PR review tools. The README describes a working integration that would be trivially deployable in any GitHub repo.

However, the score is limited by:
- **Single platform** — no support for GitLab, BitBucket, Azure DevOps, or self-hosted Git
- **Single trigger** — only PR events; no CLI, webhook, or manual triggers
- **No portable runtime** — tightly coupled to GitHub Actions
- **No security hardening described** — the README does not mention prompt injection defense, input validation, or token scope minimization beyond what GitHub Actions provides by default
- **Documentation over implementation** — the README describes the project structure (`sources/kasidit-ai-code-reviewer-readme.md:113-125`) but there is no code in this README source to verify the actual implementation

**Fast heuristic:** "Could I add this review agent to a private GitHub repo in under an hour?" — **Yes, in under 10 minutes** based on the README. The action's documented setup is trivial for any GitHub Actions user.

---

## 12. Patterns Worth Copying into Ultraplan

| Pattern | Evidence | Value |
|---|---|---|
| **Minimal permissions model** | `sources/kasidit-ai-code-reviewer-readme.md:49-51` — only `pull-requests: write` + `contents: read` | Avoids over-provisioning tokens |
| **Configurable review depth** | `sources/kasidit-ai-code-reviewer-readme.md:58` — `review-level: minimal | standard | thorough` | Lets users trade cost vs. thoroughness |
| **Self-hosted LLM option** | `sources/kasidit-ai-code-reviewer-readme.md:103` — `llm-gateway-url` input | Enables air-gapped/private deployments |
| **Inline + summary comments** | `sources/kasidit-ai-code-reviewer-readme.md:64-95` — per-file inline comments plus overall summary | Best of both granular and overview feedback |
| **File extension filtering** | `sources/kasidit-ai-code-reviewer-readme.md:60` — `file-extensions` input | Prevents unnecessary LLM calls on irrelevant files |
| **Max files guard** | `sources/kasidit-ai-code-reviewer-readme.md:59` — `max-files` input with default 10 | Cost and latency control for large PRs |
| **Severity threshold** | `sources/kasidit-ai-code-reviewer-readme.md:108` — `severity-threshold: low` | Filters noisy low-severity findings from inline comments |
| **Simple YAML configuration** | `sources/kasidit-ai-code-reviewer-readme.md:37-62` — all config in a single workflow file | Low learning curve, easy to version-control |

**What Ultraplan should do differently:**

1. **Abstract the SCM client** behind an interface (GitHub API, GitLab API, Azure DevOps API) so the same review engine works across platforms
2. **Add CLI mode** for local/on-demand reviews (e.g., `ultra review --diff="..."`)
3. **Add webhook server mode** for GitLab/Azure DevOps/self-hosted Git where CI-native integrations are not available
4. **Document security hardening** — prompt injection defense, input validation, token scope verification
5. **Keep the minimalist YAML config style** — it works well and is familiar to developers

---

## 13. Evidence Index

| Claim | Source Location |
|---|---|
| Tool is a GitHub Action for PR review | `sources/kasidit-ai-code-reviewer-readme.md:19` |
| Triggered on PR open/update | `sources/kasidit-ai-code-reviewer-readme.md:27,43-44` |
| Fetches PR diff from GitHub API | `sources/kasidit-ai-code-reviewer-readme.md:28` |
| Parses unified diff per-file, per-hunk | `sources/kasidit-ai-code-reviewer-readme.md:29` |
| Sends to LLM via llm-gateway or direct OpenAI | `sources/kasidit-ai-code-reviewer-readme.md:30` |
| Posts inline review comments on specific lines | `sources/kasidit-ai-code-reviewer-readme.md:31` |
| Summary comment on PR | `sources/kasidit-ai-code-reviewer-readme.md:32` |
| Configurable settings: file types, severity threshold, max files | `sources/kasidit-ai-code-reviewer-readme.md:33` |
| Example workflow | `sources/kasidit-ai-code-reviewer-readme.md:38-62` |
| Trigger events: `pull_request: [opened, synchronize]` | `sources/kasidit-ai-code-reviewer-readme.md:43-44` |
| Required permissions: `pull-requests: write`, `contents: read` | `sources/kasidit-ai-code-reviewer-readme.md:49-51` |
| `GITHUB_TOKEN` authentication | `sources/kasidit-ai-code-reviewer-readme.md:55` |
| `OPENAI_API_KEY` authentication | `sources/kasidit-ai-code-reviewer-readme.md:56` |
| `llm-gateway-url` alternative | `sources/kasidit-ai-code-reviewer-readme.md:103` |
| `review-level` input | `sources/kasidit-ai-code-reviewer-readme.md:105` |
| `max-files` input (default 10) | `sources/kasidit-ai-code-reviewer-readme.md:106` |
| `file-extensions` input (default all) | `sources/kasidit-ai-code-reviewer-readme.md:107` |
| `severity-threshold` input (default low) | `sources/kasidit-ai-code-reviewer-readme.md:108` |
| `post-summary` input (default true) | `sources/kasidit-ai-code-reviewer-readme.md:109` |
| Project structure: `github/pr.go`, `github/comment.go` | `sources/kasidit-ai-code-reviewer-readme.md:117-119` |
| Project structure: `reviewer/reviewer.go`, `diff_parser.go`, `prompt.go` | `sources/kasidit-ai-code-reviewer-readme.md:121-123` |
| Project structure: `llm/client.go` | `sources/kasidit-ai-code-reviewer-readme.md:124` |
| Review comment format with severity emoji | `sources/kasidit-ai-code-reviewer-readme.md:64-77` |
| Summary comment format with table | `sources/kasidit-ai-code-reviewer-readme.md:79-95` |
| Supported languages: Go, PHP, TypeScript, Python, SQL | `sources/kasidit-ai-code-reviewer-readme.md:34` |
| MIT License | `sources/kasidit-ai-code-reviewer-readme.md:134` |
