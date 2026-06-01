# Continue PR Review Bot — Dimension 01: Review Entrypoints & Platform Integrations

## Source

`/home/antonioborgerees/coding/ultra/.ultra/studies/ai-code-review-agent-study/sources/continue-pr-review-bot.md`

## Supported Entrypoints

| Entrypoint | Implementation | Evidence |
|---|---|---|
| GitHub Pull Request (automatic) | GitHub Actions workflow event: `pull_request: [opened, synchronize, ready_for_review]` | `continue-pr-review-bot.md:81-82` |
| GitHub Pull Request (on-demand) | GitHub Actions workflow event: `issue_comment: [created]` with `@review-bot` mention | `continue-pr-review-bot.md:83-84, 96-97` |
| CLI (indirect) | `cn` CLI installed via `npm i -g @continuedev/cli`, invoked inside workflow | `continue-pr-review-bot.md:118-119, 178-180` |

## Entrypoint Details

### GitHub Actions (sole entrypoint)

The entire integration is a single GitHub Actions workflow (`.github/workflows/code-review.yml`). Key characteristics:

- **Trigger events**: `pull_request` (types: `opened, synchronize, ready_for_review`) and `issue_comment` (types: `created`) — `continue-pr-review-bot.md:80-84`
- **Gate condition**: Runs on PR events or issue comments containing `@review-bot` — `continue-pr-review-bot.md:95-97`
- **Permissions**: `contents: read`, `pull-requests: write`, `issues: write` — `continue-pr-review-bot.md:86-89`
- **Installation**: `npm i -g @continuedev/cli` — `continue-pr-review-bot.md:119`
- **Secrets required**: `CONTINUE_API_KEY` — `continue-pr-review-bot.md:66`
- **Optional secrets**: `APP_ID` (variable), `APP_PRIVATE_KEY` (secret) for GitHub App token — `continue-pr-review-bot.md:70-71`
- **Review engine**: `cn --config continuedev/review-bot -p "$PROMPT" --auto` — `continue-pr-review-bot.md:178-180`
- **Output**: Single PR comment, created or updated on each run — `continue-pr-review-bot.md:182-215`

The workflow uses `pull_request` (not `pull_request_target`), meaning it runs in the context of the merge commit and does not have access to secrets from forks. This is safer for fork-based contributions but may not trigger on PRs from forks without manual approval.

### CLI layer

The `cn` CLI from `@continuedev/cli` is the review engine invoked inside the workflow. It is not a user-facing entrypoint but is the core mechanism. The workflow builds a prompt from the PR diff and changed files list and passes it to `cn --config <config> -p "<prompt>" --auto`.

### Interactive on-demand reviews

Comment `@review-bot` on any PR to trigger a focused review. The workflow extracts the PR number from the issue comment event and runs the same review pipeline — `continue-pr-review-bot.md:83-84, 127-131`.

## Authentication Model

| Component | Mechanism | Evidence |
|---|---|---|
| Continue Cloud | `CONTINUE_API_KEY` secret, authenticates with Continue Hub | `continue-pr-review-bot.md:66` |
| GitHub (default) | `github.token` — auto-generated GITHUB_TOKEN by Actions runtime | `continue-pr-review-bot.md:124, 144, 184` |
| GitHub (optional) | GitHub App installation token via `actions/create-github-app-token@v1`, using `APP_ID` and `APP_PRIVATE_KEY` | `continue-pr-review-bot.md:104-111` |

- **Primary auth**: Continue API key authenticates with Continue's cloud service, which routes the review request to the user's configured LLM provider.
- **GitHub auth**: Default GITHUB_TOKEN (scoped to the workflow run) or optional GitHub App token for higher API rate limits.
- **No direct LLM API key**: The user does not provide an OpenAI/Anthropic key directly to the workflow; the Continue API key manages LLM routing on the user's behalf.

## Platform-Specific Assumptions

1. **GitHub-only** — Events (`pull_request`, `issue_comment`) and CLI tooling (`gh`) are GitHub-specific. No GitLab, BitBucket, or Azure DevOps support (`continue-pr-review-bot.md:80-84`).
2. **GitHub Actions runner** — Assumes `ubuntu-latest` with Node.js 20 available (`continue-pr-review-bot.md:93, 114-116`).
3. **Continue Cloud dependency** — Requires `CONTINUE_API_KEY` and a Continue account with Hub access (`continue-pr-review-bot.md:49-51`). The review engine is not fully self-hosted.
4. **Single comment model** — All feedback goes into one PR comment, updated in-place. Not a formal GitHub PR review (`continue-pr-review-bot.md:187-215`).
5. **Continue Hub config** — Uses `continuedev/review-bot` as default config, but customizable (`continue-pr-review-bot.md:178, 269-283`).
6. **Custom rules via files** — Rules stored in `.continue/rules/` in the repository, applied as instructions in the prompt (`continue-pr-review-bot.md:147-153, 218-239`).

## Operational Tradeoffs

### Strengths

- **Quick setup**: Claimed 10 minutes — just add workflow file and `CONTINUE_API_KEY` secret (`continue-pr-review-bot.md:58`).
- **Privacy-first**: Code is sent directly to user's configured LLM provider; Continue's service does not read the code (`continue-pr-review-bot.md:35`).
- **Custom rules**: Team-specific rules in `.continue/rules/` apply automatically via prompt instructions (`continue-pr-review-bot.md:147-150`).
- **Comment deduplication**: Updates existing review comment instead of creating a new one on each run (`continue-pr-review-bot.md:202-215`).
- **Interactive on-demand**: `@review-bot` mentions trigger focused reviews without a new push (`continue-pr-review-bot.md:252-263`).
- **Customizable config**: Users can replace `continuedev/review-bot` with their own config (`continue-pr-review-bot.md:267-283`).

### Weaknesses

- **Continue Cloud dependency**: Requires a Continue account and API key — not fully self-hostable. If Continue Hub is down, no reviews (`continue-pr-review-bot.md:49-51`).
- **No webhook/server mode**: Can only run inside GitHub Actions; no persistent webhook listener for event-driven execution outside CI.
- **GitHub-only**: No support for GitLab, BitBucket, Azure DevOps, or other platforms.
- **Single comment, not formal review**: Posts a regular issue comment, not a GitHub PR review (which supports approval, comment, or request-changes). No inline/line-specific comments.
- **Prompt assembly in shell script**: The review prompt is constructed inline in the workflow shell script (`continue-pr-review-bot.md:155-175`), making it hard to version-control or reuse outside the workflow.
- **No state persistence**: Each run analyzes the full PR diff from scratch; no caching of prior review results.
- **Default GITHUB_TOKEN rate limits**: The default token has stricter API rate limits; optional GitHub App mitigates this but adds setup complexity (`continue-pr-review-bot.md:68-71`).
- **`pull_request` (not `pull_request_target`)**: Safer for forks but may not trigger on PRs from first-time contributors without workflow approval, as Actions on `pull_request` from forks require manual approval.
- **LLM cost routing**: LLM costs go through Continue Cloud's management — users may not have visibility or control over which specific model/provider is used.

## Questions

### 1. What are the supported ways to trigger a review?

- **Automatic**: When a PR is opened, synchronized (new commits pushed), or marked ready for review (`continue-pr-review-bot.md:81-82`).
- **On-demand**: Comment `@review-bot` on any PR's issue thread (`continue-pr-review-bot.md:83-84, 96-97`).

No manual CLI invocation by users outside GitHub Actions. No webhook-triggered mode.

### 2. Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**CI job with cloud dependency**. The review runs as a GitHub Actions job using the `cn` CLI, but the CLI authenticates with Continue's cloud service (Continue Hub) — not a fully self-hosted setup. The code stays on the runner and goes to the user's LLM provider, but the orchestration depends on Continue's cloud.

### 3. How does it authenticate with the code hosting platform?

- **Default**: Auto-generated `GITHUB_TOKEN` from the Actions runtime, scoped to the repository and workflow run (`continue-pr-review-bot.md:124`).
- **Optional**: GitHub App installation token generated via `actions/create-github-app-token@v1` using `APP_ID` and `APP_PRIVATE_KEY` — provides higher API rate limits (`continue-pr-review-bot.md:104-111`).

### 4. What repository permissions does it require?

```yaml
permissions:
  contents: read    # Checkout code, fetch diff, list changed files
  pull-requests: write  # Post and update PR comments
  issues: write     # Read issue comments (for @review-bot trigger)
```

(`continue-pr-review-bot.md:86-89`)

The `issues: write` permission is needed because the `@review-bot` trigger listens on `issue_comment` events.

### 5. How hard would it be to install this in a private repo?

**Easy**, assuming the user already has a Continue account with Hub access:
1. Copy the workflow file to `.github/workflows/code-review.yml`
2. Add `CONTINUE_API_KEY` as a repository secret
3. (Optional) Set up a GitHub App for better rate limits

Claimed setup time: 10 minutes (`continue-pr-review-bot.md:58`). Realistically: ~20-30 minutes including Continue account setup, API key generation, and first test PR. The hardest part is the prerequisite: a Continue account with Hub access and understanding of Continue's config system.

**Fast heuristic**: "Could I add this review agent to a private GitHub repo in under an hour?" — **Yes, easily**. The workflow file is copy-paste ready, and the only required secret is the Continue API key.

### 6. Does the integration model create security or operational risks?

**Moderate risks**:

- **Continue API key exposure**: The `CONTINUE_API_KEY` is stored as a GitHub Actions secret, which is standard practice, but if the workflow is compromised, the key could be exfiltrated.
- **Continue Cloud dependency**: Operational reliability depends on Continue's service availability. If Continue Hub is down or the API changes, reviews stop working.
- **`pull_request` event (not `pull_request_target`)**: The workflow runs in the context of the PR merge commit, not the base branch. This is safer (no secret exposure to forks) but means PRs from forks require manual workflow approval before the first run.
- **LLM data handling**: While code goes to the user's configured LLM provider, Continue Cloud still mediates the request — Continue's service could theoretically log request metadata or prompt content.
- **Broad `issues: write` permission**: Required for the `@review-bot` interactive trigger. This gives the token write access to all issues, not just the PR being reviewed.
- **Single point of provider control**: The Continue API key routes to an opaque LLM configuration — the user delegates which model/provider is actually used to Continue's cloud.
- **No input sanitization evidence**: The workflow does not show any prompt injection protection for PR descriptions, comments, or code content that could contain adversarial instructions.

### 7. Which integration model would be easiest to adapt for Ultraplan?

**The GitHub Actions workflow pattern** — it's the most deployable and self-contained:

1. A single YAML file defines the entire integration
2. Secrets and permissions are declared in standard GitHub Actions format
3. The review engine is a CLI command (`cn`) invoked with a prompt — trivially adaptable to any CI system
4. The comment-post/update logic is reusable in any environment that has `gh` CLI
5. Custom rules via repository files (`.continue/rules/`) is a clean, Git-tracked approach

However, the Continue Cloud dependency is a limitation for Ultraplan (which likely wants fully self-hosted operation). The practical pattern to copy is: **CI-triggered CLI review engine that posts results as PR comments**.

## Patterns Worth Copying into Ultraplan

1. **Workflow-as-config**: Single `.github/workflows/code-review.yml` file defines the entire integration — copy it, add a secret, done.
2. **Comment update deduplication** (`continue-pr-review-bot.md:202-215`): Checks for an existing review comment by body marker (`"🤖 AI Code Review"`) and updates it instead of creating duplicates. Simple and effective.
3. **Custom rules via repo files** (`continue-pr-review-bot.md:218-239`): Team rules stored in `.continue/rules/*.md` with YAML frontmatter (`globs`, `description`, `alwaysApply`). Rules are versioned in Git and automatically applied.
4. **On-demand review via `@bot` mention** (`continue-pr-review-bot.md:252-263`): Allows targeted re-reviews without pushing new commits. The `@review-bot check for [topic]` pattern lets users narrow focus.
5. **Dual auth strategy** (`continue-pr-review-bot.md:104-111`): Default `GITHUB_TOKEN` for basic operation, with optional GitHub App upgrade path for higher rate limits. This is a good progressive enhancement pattern.
6. **Config override via repo variables** (`continue-pr-review-bot.md:267-283`): Uses GitHub Actions variables (`CONTINUE_ORG`, `CONTINUE_CONFIG`) to customize behavior without editing the workflow file — admin-friendly.

## Analysis Axes

| Axis | Rating | Rationale |
|---|---|---|
| **Workflow fit** | 7/10 | Automatically reviews PRs on open/sync, and handles on-demand `@review-bot` comments. But posts as a single comment, not a formal GitHub PR review with inline annotations. |
| **Installation complexity** | 8/10 | One YAML file + one secret. Claimed 10 minutes. Requires Continue account pre-setup, which adds prerequisite friction. |
| **Permission minimization** | 6/10 | `contents: read` + `pull-requests: write` + `issues: write` — the `issues: write` is broader than strictly necessary (needed only for the `@review-bot` trigger). Could be scoped tighter by separating triggers. |
| **Portability** | 2/10 | Heavily GitHub-coupled: GitHub-specific events, `gh` CLI, GitHub Actions runner. No adapters for GitLab, BitBucket, Azure DevOps, or other platforms. The `cn` CLI itself is cross-platform, but the integration is not. |
| **Self-hostability** | 4/10 | The code runs in the user's Actions runner (good), but requires a Continue API key — the review orchestration depends on Continue's cloud service. No fully air-gapped deployment possible. |

## Rating

**Score: 6/10**

**Rationale**: Clean, minimal GitHub Actions integration with a well-designed workflow file and good patterns (comment update, custom rules, on-demand reviews). The setup is genuinely quick (10 minutes claimed). However, the score is held back by three factors: (1) **Continue Cloud dependency** — not fully self-hostable; requires an API key and Continue account; (2) **GitHub-only** — no support for other platforms at all; (3) **Single comment model** — not a formal GitHub PR review, no inline/file-specific comments, less structured than what tools like CodeRabbit provide. It's a good fit if you're already a Continue user on GitHub, but the integration model is tightly coupled to the Continue ecosystem.

## Fast Heuristic Assessment

> "Could I add this review agent to a private GitHub repo in under an hour?"

**Yes** — assuming you have a Continue account with Hub access. The actual setup (copy workflow, add `CONTINUE_API_KEY` secret) is under 15 minutes. Most of the time goes to account creation and API key generation. Under an hour is realistic for a developer with basic GitHub Actions familiarity. **~8/10** for this specific measure.
