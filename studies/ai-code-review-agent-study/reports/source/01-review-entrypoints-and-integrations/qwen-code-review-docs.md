# Study: Dimension 01 — Review Entrypoints & Platform Integrations

**Source:** `qwen-code-review-docs` (Documentation-only source)
**Document:** `https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/code-review.md`

---

## Overview

This is a documentation-only source describing Qwen Code's code review feature. Unlike the cloned repo analysis (`qwen-code-review.md`), this source is limited to one markdown document (`sources/qwen-code-review-docs.md`) and cannot reference implementation code. All findings below are drawn exclusively from the document's content.

---

## 1. Supported Entrypoints

Based on the document (`sources/qwen-code-review-docs.md:20-98`):

| Entrypoint | Documented | Details |
|------------|-----------|---------|
| Local CLI | Yes | `qwen code review --pr <pr-number>` (`:60-61`) |
| GitHub App | Yes | Described as listening for PR events, auto-triggering reviews, posting comments (`:80-85`) |
| GitHub Action | No | Not mentioned — the document describes a GitHub App, not a GitHub Action |
| Webhook server | No | Not mentioned |
| CI pipeline | No | Not mentioned |
| IDE plugin | No | Not mentioned |

The document describes two entrypoints: a **local CLI command** and a **GitHub App integration**. There is no mention of GitHub Actions, GitLab, Azure DevOps, or any other platform.

---

## 2. Primary Design

The document positions Qwen Code's review feature as **dual-mode** (`:20`):

> "designed to work as both a local CLI tool and integrated with GitHub workflows"

No evidence of a hosted SaaS model. The document implies self-hosted operation — the CLI runs locally, and the GitHub App would presumably be self-hosted or installed per-repo. However, the document does not explain how the GitHub App is hosted (e.g., as a serverless function, a dedicated service, or embedded in a CI runner).

---

## 3. Authentication Model

Authentication evidence is minimal (`:116`):

- **CLI mode:** Uses `github_token` configuration option (mentioned under Configuration, `:116`). No details on token scopes or OAuth flow.
- **GitHub App mode:** The document states the App "handles authentication via GitHub App" (`:85`) without further detail on installation flow, private key management, or webhook secret verification.

**No evidence found** for:
- How the GitHub App is registered or installed
- Token exchange flow (e.g., JWT → installation token)
- How the CLI obtains or stores the `github_token`
- Support for any authentication method beyond GitHub

---

## 4. Repository Permissions

The document does **not** specify required permissions or scopes for either the CLI token or the GitHub App. Based on described behavior (posting inline comments, reading PR diffs), the minimal required permissions would include:

- Read pull requests (to fetch diff)
- Write pull requests (to post inline and summary comments)
- Read repository contents (to load custom rules from `.qwen/rules/` on the base branch)

These are inferred from described behavior, not stated explicitly.

---

## 5. Installation Complexity

### Local CLI (`:59-68`)

Low complexity:
1. Install `qwen` CLI tool
2. Run `qwen code review --pr <number>`
3. Configure `github_token` for authentication

### GitHub App (`:80-85`)

Medium-high complexity based on described model:
1. Register a GitHub App (requires GitHub account with appropriate permissions)
2. Configure webhook events (PR events)
3. Deploy the App's backend somewhere (the document does not specify how)
4. Install the App on target repositories

The document provides **no installation instructions** for the GitHub App — no manifest file, no setup script, no deployment guide. This is a significant gap.

### Private Repo

Installing in a private repo would require:
- **CLI route:** A GitHub token with `repo` scope, which the user must generate and configure manually
- **GitHub App route:** The App must be installed on the private repo (standard GitHub App install flow)

No specific guidance is given for either scenario.

---

## 6. Security and Operational Risks

### Explicit Security Feature: Base Branch Rule Loading (`:48-55`)

The document highlights one security design: **rules are loaded from the base branch, not the PR branch**. This prevents:
1. Malicious PRs from injecting custom rules that grant approval (`:51`)
2. Modifying rule definitions to bypass checks (`:52`)
3. Injecting prompts that manipulate review behavior (`:53`)

### Missing Security Documentation

The document does **not** address:
- Webhook secret verification for the GitHub App
- How `github_token` is stored/secured on the client
- What happens if the GitHub App's private key is compromised
- Rate limiting or abuse prevention
- Data handling for the LLM API calls

### Operational Risks

- **Single platform dependency:** The review feature only integrates with GitHub. A GitLab or Bitbucket team would need to build adapters from scratch.
- **No CI fallback:** Without a GitHub Action or webhook server, the review cannot trigger automatically on PR creation/update without the GitHub App being continuously running.
- **Implicit model dependency:** The document mentions `model` configuration (`:113`) and `github_token` (`:116`) as separate settings — the tool requires both an LLM API key and GitHub credentials, creating two auth dependencies.

---

## 7. Adaptation Potential for Ultraplan

### Patterns Worth Copying

1. **Security-first rule loading** (`:48-55`): Loading review rules from the base branch is a critical security pattern that Ultraplan should adopt. It prevents PR authors from manipulating review criteria.

2. **Dual CLI + integration model** (`:20`): Designing the review engine as a standalone CLI that can also be embedded into platform integrations creates flexibility. Users can try it locally before installing it on their workflow.

3. **Rule file format** (`:70-76`): Using markdown files in a well-known directory (`.qwen/rules/`) for custom review guidelines is simple and discoverable. Ultraplan could adopt a similar convention.

4. **Configurable severity threshold** (`:115`): The `severity_threshold` option allows teams to tune verbosity — useful for reducing noise.

### Limitations for Ultraplan

1. **GitHub-only** (`:80-85`): No GitLab, Bitbucket, Azure DevOps, or self-hosted Git support. Ultraplan would need a platform-agnostic abstraction.

2. **No CI workflow example** (`:30`): The document mentions "GitHub workflows" but provides no YAML workflow example, Action configuration, or CI integration pattern. Ultraplan should provide concrete CI examples for every supported platform.

3. **No webhook server** (`:80-85`): The GitHub App model requires a running service (implied but not detailed). No webhook server code or deployment configuration is provided.

4. **Missing permission documentation**: The document does not specify required GitHub permissions, making it harder for operators to assess security impact.

---

## 8. Questions Answered

### 8.1 What are the supported ways to trigger a review?

- **CLI:** `qwen code review --pr <number>` (`:60-61`)
- **GitHub App:** Automatic on PR events (`:81-82`)
- **CLI with custom options:** `--rules-dir`, `--level`, `--file-filter` (`:63-68`)

### 8.2 Is the tool designed as a hosted service, self-hosted service, CI job, or local CLI?

**Self-hosted CLI tool** with an optional **GitHub App integration** (`:20`). No hosted/SaaS version is described.

### 8.3 How does it authenticate with the code hosting platform?

- **CLI:** `github_token` config value (`:116`)
- **GitHub App:** Native GitHub App authentication (`:85`)
- No webhook secret verification or OAuth flow is documented

### 8.4 What repository permissions does it require?

**Not stated.** Inferred from behavior: read pull requests, write pull requests (inline comments), read repository contents (rule files).

### 8.5 How hard would it be to install in a private repo?

**CLI route:** Easy — configure `github_token` with appropriate scopes (`:116`). **GitHub App route:** Moderate — requires App registration, deployment, and installation. No setup guide is provided for either.

### 8.6 Does the integration model create security or operational risks?

- **Strengths:** Base branch rule loading prevents rule injection (`:48-55`)
- **Weaknesses:** No guidance on token storage, webhook secret management, or rate limiting. Single-platform dependency is an operational risk (`:80-85`)

### 8.7 Which integration model would be easiest to adapt for Ultraplan?

The **CLI-first approach** (`:59-68`) is easiest — a self-contained command that takes a PR number and produces structured review output. The **base-branch rule loading** pattern (`:48-55`) is essential security infrastructure worth copying. The **GitHub App model** (`:80-85`) is less well-documented and would require significant implementation work to replicate.

---

## 9. Rating

**Score: 4/10**

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Workflow fit | 5 | CLI-only and GitHub App model described. Fits PR review workflow when the GitHub App is deployed, but the document provides no deployment guide. |
| Installation complexity | 4 | CLI route is simple. GitHub App route is complex with no documentation. No CI workflow provided. |
| Permission minimisation | 3 | Required permissions are **not documented**. Cannot assess without guessing. |
| Portability | 2 | **GitHub-only**. No mention of GitLab, Bitbucket, or any other platform. |
| Self-hostability | 6 | CLI is fully self-hostable. GitHub App model implies self-hosting but provides no deployment instructions. |
| Documentation completeness | 3 | High-level overview with significant gaps: no installation guide, no permission docs, no CI example, no webhook setup, no token management. |

The score of 4 reflects that the document describes a potentially capable tool but provides insufficient detail to evaluate or replicate the integration model. The lack of permission documentation, CI workflow examples, and GitHub App deployment guidance are critical gaps for an entrypoints-and-integrations analysis.

---

## Evidence Quality Note

This source is a **single markdown document** (`sources/qwen-code-review-docs.md:1-123`) — not a cloned repository. All citations reference line numbers within that document. No implementation code, test files, configuration files, or workflow YAML was available for analysis. Findings about the GitHub App (permissions, authentication flow, webhook handling) are based on the document's high-level descriptions and cannot be verified against implementation code. For a more detailed analysis, refer to the companion report `qwen-code-review.md` based on the cloned `QwenLM/qwen-code` repository.
