# Dimension 01: Review Entrypoints & Platform Integrations — dangerjs-youtube

## Source Information

- **Name**: DangerJS
- **Source**: YouTube tutorial by Dave Bitter
- **Language**: JavaScript/Node.js
- **Version**: Not specified in transcript

---

## Supported Entrypoints

Based solely on the YouTube transcript, DangerJS is demonstrated as a **CI pipeline command** running inside **GitHub Actions**. The transcript shows one specific entrypoint:

### 1. GitHub Actions Workflow (`danger ci`)

The presenter creates a `.github/workflows/danger.yaml` file triggered on the `pull_request` event. The workflow runs `danger ci`, which executes the Dangerfile and posts results back to the PR. Reference: `sources/dangerjs-youtube.md:143-155`.

```yaml
# Based on transcript description (sources/dangerjs-youtube.md:143-155)
name: danger
on: pull_request
jobs:
  danger:
    runs-on: ubuntu-latest
    steps:
      - run: danger ci
```

The workflow does not appear to use the pre-built `danger/danger` Docker Action from the Ruby Danger ecosystem — it runs `danger ci` directly, suggesting a Node.js package installation step (implied by the transcript mention of "installing everything" at `sources/dangerjs-youtube.md:182-184`).

### 2. Other Entrypoints (not mentioned in transcript)

The transcript does not mention:
- **Webhook server**: No evidence
- **GitHub App**: No evidence
- **Hosted SaaS service**: No evidence
- **Local CLI commands** (`danger pr`, `danger local`, `danger dry_run`): No evidence
- **Other CI providers** (Travis, CircleCI, GitLab CI, etc.): No evidence

The transcript only demonstrates GitHub Actions. The original Ruby Danger supports 30+ CI providers, but the video focuses exclusively on GitHub Actions for a personal website project.

---

## Authentication Model

The YouTube transcript **does not discuss authentication at all**. No mention of:
- Tokens (`DANGER_GITHUB_API_TOKEN`, `GITHUB_TOKEN`, or any other credential)
- OAuth flows
- Personal access tokens
- Secrets configuration

The presenter assumes the GitHub Actions environment handles auth implicitly. In practice, GitHub Actions provides a `GITHUB_TOKEN` secret automatically, and DangerJS likely uses it. However, **this is inferred, not evidenced in the transcript**.

No evidence found for env var names, token scope requirements, or fallback behavior.

---

## Platform-Specific Assumptions

### GitHub Actions Only (Based on Transcript)

The entire demo is GitHub-specific:
- Workflow file at `.github/workflows/danger.yaml` (`sources/dangerjs-youtube.md:143`)
- Triggered on `pull_request` event (`sources/dangerjs-youtube.md:147-148`)
- Uses `danger.github.pr.assignee` and `danger.github.pr.body` APIs (`sources/dangerjs-youtube.md:80-82, 101-102`)
- Results appear as PR comments and CI check status (`sources/dangerjs-youtube.md:186-193`)

### Pull Request Event Flow (As Shown)

1. Developer pushes code and opens a PR (`sources/dangerjs-youtube.md:164-172`)
2. GitHub Actions triggers the `danger.yaml` workflow on `pull_request` event (`sources/dangerjs-youtube.md:143-148`)
3. CI environment sets up Node.js, installs dependencies (`sources/dangerjs-youtube.md:182-184`)
4. `danger ci` command executes the `Dangerfile.js` (`sources/dangerjs-youtube.md:153-156`)
5. DangerJS evaluates rules (check assignee, check description length, list modified files) (`sources/dangerjs-youtube.md:69-109`)
6. Results are posted as PR comments (e.g., "needs an assignee") and as CI check status (`sources/dangerjs-youtube.md:186-193`)
7. When the assignee is added and the workflow re-runs, the warning disappears (`sources/dangerjs-youtube.md:194-217`)

### Dangerfile DSL (From Transcript)

The transcript shows a JavaScript Dangerfile using:
- `danger.getModifiedFiles()` — returns list of changed files (`sources/dangerjs-youtube.md:70`)
- `danger.github.pr.assignee` — PR assignee info (`sources/dangerjs-youtube.md:81-83`)
- `danger.github.pr.body` — PR description text (`sources/dangerjs-youtube.md:101-102`)
- `warn("message")` — posts a warning comment (`sources/dangerjs-youtube.md:94`)
- `fail("message")` — posts a failure (would block CI) — implied by warn/fail pair
- `message("message")` — posts an informational comment — used for file listing

---

## Operational Tradeoffs

### Strengths

1. **Simple entrypoint**: GitHub Actions workflow with a single `danger ci` command. The transcript shows setup in minutes (`sources/dangerjs-youtube.md:156-161`).
2. **No external hosting**: Runs entirely in the CI environment. No webhook server, no SaaS subscription.
3. **Immediate PR feedback**: Results appear as PR comments and CI checks automatically (`sources/dangerjs-youtube.md:186-193`).
4. **Comment lifecycle**: Re-running the workflow removes resolved warnings (`sources/dangerjs-youtube.md:214-217`), suggesting Danger manages comment state.
5. **Node.js ecosystem**: Familiar toolchain for JavaScript/TypeScript projects.

### Weaknesses (Based on Transcript Limitations)

1. **Single-platform evidence**: The transcript only shows GitHub + GitHub Actions. No evidence of GitLab, Bitbucket, Azure DevOps, or other platform support.
2. **Auth not discussed**: The video does not explain how tokens are obtained, scoped, or secured. Critical operational detail omitted.
3. **CI-coupled**: Cannot run as a standalone service or respond to webhook events. Must be a build step.
4. **No inline comments**: Results appear as top-level PR comments, not inline code annotations. The transcript shows: "there are some fills the plural cred needs an assignee" (`sources/dangerjs-youtube.md:188-191`).
5. **No token/secret management shown**: The presenter does not demonstrate adding secrets to GitHub Actions or managing token permissions.
6. **No information on permissions required**: The transcript never discusses what repo scope the token needs.
7. **No multi-repo or organization setup**: The demo is a personal website, not an enterprise workflow.

### Security Considerations

- **No evidence** of token handling, scoping, or masking in the transcript.
- **No evidence** of webhook validation (since there's no webhook).
- The Dangerfile is evaluated as JavaScript code. Malicious or poorly written rules in the Dangerfile could have unintended effects, but this is inherent to the design.

---

## Patterns Worth Copying for Ultraplan

1. **Single-command CI integration**: `danger ci` as the CI entrypoint is clean. Ultraplan could offer a similar `ultra review` command that auto-detects the CI environment.

2. **GitHub Actions workflow template**: The YAML workflow shown is minimal and easy to add to any repo. Ultraplan could provide a copy-paste workflow template.

3. **PR event trigger**: Using the `pull_request` event as the trigger is natural and covers all PR lifecycle events (opened, synchronized, reopened).

4. **Dangerfile-as-code pattern**: Writing review rules in a file checked into the repo (`Dangerfile.js`) makes configuration version-controlled and reviewable. Ultraplan could adopt a similar `ultrafile` or config-in-repo pattern.

5. **Re-evaluation on re-run**: The workflow can be re-run and Danger will update/remove its previous comments. This idempotent comment lifecycle is a good UX pattern.

6. **Simple warn/fail/message API**: The three-level feedback API (`warn`, `fail`, `message`) maps naturally to CI check status and PR comments. Ultraplan could adopt a similar severity model.

---

## Answers to Study Questions

### Q1: Supported ways to trigger a review

Based on the transcript, the only demonstrated trigger is a **GitHub Actions workflow running `danger ci` on `pull_request` events** (`sources/dangerjs-youtube.md:143-148`). No evidence of webhooks, GitHub App events, CLI commands outside CI, or other CI providers.

### Q2: Primary design model

**CI job** (self-hosted). The tool runs as a step inside an existing GitHub Actions pipeline. Not a hosted service, not a GitHub App, not a webhook server.

### Q3: Authentication with code hosting platform

**Not discussed in the transcript.** No evidence of token names, OAuth flows, or secret configuration. In practice, DangerJS likely uses the `GITHUB_TOKEN` automatically provided by GitHub Actions, but this is inferred, not evidenced.

### Q4: Repository permissions required

**Not discussed in the transcript.** No evidence of required token scopes, permission levels, or API access patterns beyond reading PR metadata (assignee, body, modified files) and posting comments.

### Q5: Installation difficulty in a private repo

**Low** (based on transcript evidence):
1. Install the DangerJS npm package (implied, `sources/dangerjs-youtube.md:56-57`)
2. Create a `Dangerfile.js` with rules (`sources/dangerjs-youtube.md:58-109`)
3. Add `.github/workflows/danger.yaml` (`sources/dangerjs-youtube.md:143-155`)
4. Push and open a PR (`sources/dangerjs-youtube.md:156-172`)

The presenter goes from setup to working PR checks in under 5 minutes of video time. The transcript does not mention adding secrets, configuring tokens, or any platform-specific setup that would complicate private repo installation.

### Q6: Security or operational risks

- **Auth gap**: The transcript does not acknowledge token management. Users may not realize they need to configure a token with appropriate scopes.
- **Dangerfile as code execution**: The Dangerfile is JavaScript that runs in CI with the token's permissions. Any code in the Dangerfile can make API calls with that token.
- **CI-coupled latency**: Review results only appear after the CI run completes. No real-time webhook response.
- **No evidence** of token scoping, least-privilege guidance, or security warnings in the transcript.

### Q7: Easiest integration model to adapt for Ultraplan

The **GitHub Actions + npm package** model shown in the transcript is the easiest to adapt. It requires:
- A single npm package install
- A workflow YAML file (5-10 lines)
- A config/rule file checked into the repo

This model is:
- **Self-hosted**: No external service dependency
- **Familiar**: GitHub Actions is widely used
- **Version-controlled**: The config and rules live in the repo
- **Portable to other CI**: The `danger ci` abstraction could work in any CI that supports Node.js

---

## Rating

**Score: 6/10**

| Axis | Score | Rationale |
|---|---|---|
| Workflow fit | 8 | Fits naturally into CI/PR workflow. Results appear as PR comments and check status. |
| Installation complexity | 7 | Simple GitHub Actions setup shown (add workflow file, Dangerfile, push). |
| Permission minimization | 3 | Token scope not discussed. No evidence of fine-grained permissions. Unknown if `GITHUB_TOKEN` default scope is sufficient or if broader token needed. |
| Portability | 3 | Only GitHub + GitHub Actions evidenced. No mention of GitLab, Bitbucket, Azure DevOps, or other CI providers. |
| Self-hostability | 10 | Fully self-hosted. No SaaS dependency. Runs entirely in CI. |

**Rationale**: The DangerJS GitHub Actions integration shown in the transcript is straightforward and well-demonstrated. However, the transcript is a beginner tutorial and omits critical operational details: authentication, token permissions, secret management, and cross-platform support. The analysis would benefit from examining the actual DangerJS source code and documentation to properly assess multi-platform support and security posture. The score reflects what is evidenced in the transcript alone.

**Fast heuristic**: "Could I add this review agent to a private GitHub repo in under an hour?" — **Yes**, likely in 10-15 minutes based on the simplified workflow shown. However, the transcript does not cover token setup for private repos, which could add complexity.
