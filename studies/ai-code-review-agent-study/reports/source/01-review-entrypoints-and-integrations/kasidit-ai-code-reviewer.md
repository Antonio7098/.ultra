# Dimension 01: Review Entrypoints & Platform Integrations

**Source:** kasidit-ai-code-reviewer  
**Repository:** `github.com/kasidit-wansudon/ai-code-reviewer`  
**Language:** Go 1.22  
**License:** MIT

---

## Supported Entrypoints

### 1. GitHub Action (primary and only entrypoint)

The tool is designed exclusively as a GitHub Action. Users add a workflow file to `.github/workflows/` and reference the action via `uses:` (`README.md:37`).

**Trigger events:** `pull_request` with types `opened` and `synchronize` (`README.md:28-29`).

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

**No other entrypoints exist.** There is no CLI, no webhook server, no self-hosted service mode, and no GitLab/Azure DevOps support.

---

## Authentication Model

| Credential | Mechanism | Source |
|---|---|---|
| GitHub API access | `${{ secrets.GITHUB_TOKEN }}` passed as `github-token` input (`README.md:39`) | GitHub Actions automatic token |
| LLM provider | `${{ secrets.OPENAI_API_KEY }}` passed as `openai-api-key` input (`README.md:40`) | User-provided secret |
| Self-hosted LLM | `llm-gateway-url` input, no key required (`README.md:87`) | Optional alternative to OpenAI |

**Authentication flow:** Both secrets are passed as action inputs, consumed by the Go binary at runtime. There is no evidence of token validation, rotation, or scoped permission checking in the codebase — the binary trusts whatever it receives (`cmd/ai-code-reviewer/main.go:1-12`).

---

## Repository Permissions Required

From the workflow example (`README.md:33-35`):

```yaml
permissions:
  pull-requests: write
  contents: read
```

- **`pull-requests: write`** — Required to post inline review comments and summary comments on PRs.
- **`contents: read`** — Required to fetch the PR diff via GitHub API.

These are the minimum necessary permissions for the described functionality. No `issues: write`, `checks: write`, or admin permissions are requested.

---

## Installation Complexity

**Steps to install in a private repo:**

1. Add the workflow file `.github/workflows/ai-review.yml` with the action reference (`README.md:22-46`).
2. Store `OPENAI_API_KEY` as a repository secret (or configure `llm-gateway-url`).
3. Commit and push. The action runs automatically on next PR open/synchronize.

**Estimated time: <10 minutes** for a user familiar with GitHub Actions.

**No infrastructure required** — the action runs on GitHub-hosted runners. No servers, Docker containers, or databases needed (despite `config/config.yaml:1-8` referencing PostgreSQL, this is scaffolding from `init.sh`, not functional configuration).

---

## Security & Operational Risks

| Risk | Evidence | Severity |
|---|---|---|
| **No `action.yml` in repo** | `init.sh:9` creates `cmd/ai-code-reviewer/` but no `action.yml` exists; README references it at `README.md:99` | **High** — action cannot actually be invoked |
| **LLM API key exposure** | `README.md:40` — OpenAI key passed as input; if the action logs inputs or fails open, key could leak | Medium |
| **No input validation** | `cmd/ai-code-reviewer/main.go:1-12` — main function is a stub; no validation of `github-token`, `openai-api-key`, or `model` | High |
| **Broad file review scope** | `README.md:91` — `file-extensions` defaults to "all", meaning the LLM reviews every file in the diff including secrets, configs, etc. | Medium |
| **GITHUB_TOKEN scope** | `GITHUB_TOKEN` with `pull-requests: write` can also push commits, create issues, etc. if the action is compromised | Low-Medium |
| **No rate limiting** | No evidence of throttling for large PRs; `max-files` is the only guard (`README.md:90`) | Low |

**Critical finding:** The repository contains only a scaffold (`init.sh:1-79`). The `cmd/ai-code-reviewer/main.go:9-11` is a stub that prints "Starting ai-code-reviewer...". The README describes a fully functional tool (`README.md:1-118`), but no implementation code exists — no `github/`, `reviewer/`, `llm/` directories, no `action.yml`. This is a **planned design, not a working system**.

---

## Analysis Axes

### Workflow Fit

**Score: 5/10** (for intended design, not implementation)

The intended design fits naturally into PR review via GitHub Actions (`README.md:22-46`). The action would trigger on PR open/synchronize, fetch diffs, analyze with LLM, and post inline comments — matching the CodeRabbit-like workflow. However, no implementation exists to validate this flow.

### Installation Complexity

**Score: 7/10** (for intended design)

If implemented, adding a workflow file and two secrets is minimal setup. The action model leverages GitHub's native infrastructure.

### Permission Minimisation

**Score: 8/10**

Requests only `pull-requests: write` and `contents: read` — the minimum needed for the described functionality (`README.md:33-35`).

### Portability

**Score: 1/10**

GitHub Action only. No CLI, no webhook server, no GitLab support. The `init.sh:17-18` scaffolds `internal/handler` and `internal/service` directories suggesting future extensibility, but nothing is implemented.

### Self-Hostability

**Score: 6/10** (for intended design)

Supports `llm-gateway-url` for self-hosted LLM (`README.md:87`), and GitHub Actions can be self-hosted via GitHub Enterprise. However, the action format itself requires GitHub infrastructure.

---

## Questions & Answers

### 1. What are the supported ways to trigger a review?

**Single entrypoint:** GitHub Action triggered on `pull_request: [opened, synchronize]` (`README.md:28-29`).

### 2. Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**CI job** — specifically a GitHub Action running on GitHub-hosted runners (`README.md:37`). No hosted service, self-hosted service, or CLI modes exist.

### 3. How does it authenticate with the code hosting platform?

Via `GITHUB_TOKEN` passed as `github-token` input (`README.md:39`). This is the standard GitHub Actions automatic token scoped to the workflow's repository.

### 4. What repository permissions does it require?

`pull-requests: write` and `contents: read` (`README.md:33-35`).

### 5. How hard would it be to install this in a private repo?

**Trivial** — add a workflow file and two secrets. Under 10 minutes if the action actually worked. Currently impossible because `action.yml` is missing.

### 6. Does the integration model create security or operational risks?

Yes. Key risks:
- OpenAI API key passed through GitHub Actions inputs (`README.md:40`) — standard but requires careful secret management.
- No input validation in the stub (`cmd/ai-code-reviewer/main.go:9-11`).
- Default `file-extensions: all` means LLM sees every file including secrets (`README.md:91`).
- **Critical:** The action cannot run because `action.yml` does not exist in the repo.

### 7. Which integration model would be easiest to adapt for Ultraplan?

The GitHub Action model is already the simplest integration pattern. For Ultraplan, a **hybrid approach** would work best:
- Keep the GitHub Action for PR-triggered reviews (same pattern as this repo).
- Add a CLI mode for local/on-demand reviews (missing here, would need implementation).
- Add a webhook server mode for custom CI systems (missing here).

---

## Patterns Worth Copying into Ultraplan

| Pattern | Evidence | Value |
|---|---|---|
| **Minimal permissions model** | `README.md:33-35` — only `pull-requests: write` + `contents: read` | Avoids over-provisioning tokens |
| **Configurable review depth** | `README.md:89` — `review-level: minimal | standard | thorough` | Lets users trade cost vs. thoroughness |
| **Self-hosted LLM option** | `README.md:87` — `llm-gateway-url` input | Enables air-gapped/private deployments |
| **Inline + summary comments** | `README.md:48-79` — per-file inline comments plus overall summary | Best of both granular and overview feedback |
| **File extension filtering** | `README.md:91` — `file-extensions` input | Prevents unnecessary LLM calls on irrelevant files |

---

## Rating

**Score: 3/10**

| Criterion | Score | Rationale |
|---|---|---|
| Entrypoint diversity | 1/10 | Single entrypoint (GitHub Action only) |
| Implementation completeness | 1/10 | `action.yml` missing; `main.go` is a stub; no actual review logic exists |
| Authentication design | 3/10 | Standard GITHUB_TOKEN + API key pattern, but no validation or scoping |
| Permission minimisation | 8/10 | Correctly requests only necessary permissions |
| Private repo usability | 5/10 | Would be trivial if implemented; currently non-functional |
| Security posture | 2/10 | No input validation, no secret handling, no rate limiting |
| Portability | 1/10 | GitHub-only, no cross-platform support |

**Justification:** This repository is a scaffold/proof-of-concept with a detailed README but virtually no implementation. The `init.sh:1-79` creates a project skeleton, `cmd/ai-code-reviewer/main.go:9-11` is a print statement, and key files referenced in the README (`action.yml`, `github/pr.go`, `reviewer/reviewer.go`, `llm/client.go`) do not exist. The design documented in the README is sound — minimal permissions, configurable review levels, self-hosted LLM support — but cannot be evaluated as a working system. The fast heuristic question "Could I add this review agent to a private GitHub repo in under an hour?" is **no**, because the action cannot run without `action.yml`.

---

## Evidence Summary

| Claim | File Path | Lines |
|---|---|---|
| GitHub Action entrypoint | `README.md` | 22-46 |
| PR trigger events | `README.md` | 28-29 |
| GitHub token auth | `README.md` | 39 |
| OpenAI API key auth | `README.md` | 40 |
| Self-hosted LLM option | `README.md` | 87 |
| Required permissions | `README.md` | 33-35 |
| File extension filtering | `README.md` | 91 |
| Review levels | `README.md` | 89 |
| Missing action.yml | `README.md` | 99 (listed in project structure) |
| Stub main function | `cmd/ai-code-reviewer/main.go` | 9-11 |
| Scaffold script | `init.sh` | 1-79 |
| Config (scaffold, non-functional) | `config/config.yaml` | 1-8 |
| Go module definition | `go.mod` | 1-3 |
