# Dimension 01: Review Entrypoints & Platform Integrations — reviewdog-swiftlint-youtube

## Source Information

- **Name**: Automate GitHub PR Comments with Reviewdog + SwiftLint
- **Type**: YouTube tutorial video (transcript only — no code or repository available in the source)
- **URL**: https://www.youtube.com/watch?v=Hexx8oWJCGg
- **Subject**: Wiring up reviewdog inside a GitHub Actions job to pipe SwiftLint output back as inline PR comments
- **Stack described**: GitHub Actions, macOS runner, reviewdog CLI, SwiftLint, Homebrew
- **Applicable Dimensions** (per source YAML): 01, 06, 14
- **Analysis date**: 2026-06-01

> **Important boundary**: This source is a single short YouTube tutorial transcript (`sources/reviewdog-swiftlint-youtube.md:12-75`). It is **not** the reviewdog source code, the SwiftLint source, or the GitHub Actions runner. Every claim below is grounded in transcript language. There is no GitHub repo, YAML file, or code artifact in scope to cite.

---

## Supported Entrypoints

The transcript describes exactly **one** entrypoint, in detail. It does not mention any other integration model.

### 1. GitHub Actions job step (the only one demonstrated)

The presenter adds a new job to an existing CI workflow. The job:

- Is called **`lint`** (`sources/reviewdog-swiftlint-youtube.md:38-41`).
- Runs in **parallel** with the existing `build` and `test` jobs (`sources/reviewdog-swiftlint-youtube.md:38-40`).
- Runs on **macOS** (`sources/reviewdog-swiftlint-youtube.md:41` "run it on macros" [sic — `macros` = macOS], confirmed again at `sources/reviewdog-swiftlint-youtube.md:59-61` "automatically runs on Mac OS").
- **Installs reviewdog** as the first step (`sources/reviewdog-swiftlint-youtube.md:43-45` "Now we need to set up review d. This install the tool").
- **Installs Swift** "manually with homebrew, but you could also use peer build action" (`sources/reviewdog-swiftlint-youtube.md:47-49`).
- **Runs SwiftLint and pipes its output into reviewdog** (`sources/reviewdog-swiftlint-youtube.md:50-54` "run Swift Link and pipe the results into Review Dog. Review Dog then posts those results back to GitHub as inline pull request comments").
- Requires the workflow to declare **permissions enabling reviewdog to write PR comments** (`sources/reviewdog-swiftlint-youtube.md:34-36` "we need to add permissions so review dog can write comments directly to pull requests").

Inferred (not stated) trigger event: `on: pull_request` is not explicitly named in the transcript, but the result is "inline pull request comments" (`sources/reviewdog-swiftlint-youtube.md:53-54`) and the example push of a PR is shown at `sources/reviewdog-swiftlint-youtube.md:65-69`.

### 2. Entrypoints NOT mentioned in the transcript

| Entrypoint | Evidence in transcript |
| --- | --- |
| GitHub App (reviewdog's hosted App) | No mention |
| Self-hosted webhook server (doghouse) | No mention |
| Local CLI outside CI (`reviewdog` against a local checkout) | No mention |
| GitLab CI / Bitbucket Pipelines / Azure DevOps | No mention |
| Pre-built `reviewdog/action-swiftlint` Docker action (a real action that exists upstream) | No mention — the presenter installs reviewdog and Swift manually |
| Manual `workflow_dispatch` trigger | No mention |
| Cron / scheduled run | No mention |

**Inferred boundary**: The transcript is a single-tutorial demonstration. It does not survey the full reviewdog integration surface. The main `reviewdog` source, the `reviewdog-github-actions` source in this study, and the upstream `reviewdog/action-*` Actions all describe additional entrypoints — but those are not in scope for *this* source.

---

## Authentication & Permissions Model

The transcript addresses permissions but **not credentials**.

### Permissions (explicit)

The presenter states that the workflow must declare permissions allowing reviewdog to write comments to pull requests:

> "First, we need to add permissions so review dog can write comments directly to pull requests." (`sources/reviewdog-swiftlint-youtube.md:34-36`)

No specific permission keys (`pull-requests: write`, `checks: write`, `contents: read`) are named. No `permissions:` block is shown. The transcript treats this as a one-line config change without further elaboration.

### Credentials (not discussed)

The transcript **does not mention** any of the following:

- `GITHUB_TOKEN` / `${{ secrets.GITHUB_TOKEN }}`
- A personal access token (PAT)
- A reviewdog-specific token
- A bot account
- The `REVIEWDOG_GITHUB_API_TOKEN` environment variable
- OAuth flows or GitHub App installation

The presenter assumes that once the workflow has the right permissions, reviewdog can write to the PR. This is consistent with the standard reviewdog-Actions pattern (covered by the sibling source `reviewdog-github-actions.md:32-43`) but **is not evidenced in this transcript**.

### Permission scope — observed behavior

The video shows that, after the job runs, "review dog instantly left a comment right on the exact line" (`sources/reviewdog-swiftlint-youtube.md:67-69`). The comment is an **inline PR comment at the exact line of the violation** (`sources/reviewdog-swiftlint-youtube.md:53-54`, `67-69`). That output target implies at minimum:

- `pull-requests: write` (to post a review comment)
- `contents: read` (to read the diff)

Whether reviewdog also uses the Check Runs API (`checks: write`) is not stated.

---

## Platform-Specific Assumptions

### GitHub-only

The transcript is unambiguously GitHub-centric. Every concrete reference ties to GitHub:

- "GitHub into your own code reviewing teammate" (`sources/reviewdog-swiftlint-youtube.md:16-18`)
- "they show up as comments in the full [pull] request itself" (`sources/reviewdog-swiftlint-youtube.md:31-32`)
- "permissions so review dog can write comments directly to pull requests" (`sources/reviewdog-swiftlint-youtube.md:35-36`)
- "Review Dog then posts those results back to GitHub as inline pull request comments" (`sources/reviewdog-swiftlint-youtube.md:52-54`)
- "level up your GitHub workflow, try adding review d to your CI" (`sources/reviewdog-swiftlint-youtube.md:70-72`)

No mention of GitLab, Bitbucket, Azure DevOps, Gerrit, or local Git servers.

### macOS-only runner

The job is hard-pinned to a macOS runner (`sources/reviewdog-swiftlint-youtube.md:41`, `60-62`). This is because the analyzed language is Swift, which requires Xcode toolchain access on Apple platforms. The transcript also offers two Swift install options:

- Manual Homebrew install (`sources/reviewdog-swiftlint-youtube.md:47-48` "I'm doing it manually with homebrew")
- A "pre build action" alternative (`sources/reviewdog-swiftlint-youtube.md:48-49` "you could also use peer build action" — likely a transcribed mishearing of *prebuilt action* or *pre-build action*)

The transcript does not discuss caching, action pinning, or whether Swift is preinstalled on the runner image.

### Single linter

The integration pattern is: **one job → one linter → reviewdog**. The transcript only walks through SwiftLint. It does not show parallel linters, a matrix, or a single linter that fans out across multiple languages.

### Linter-output-as-source-of-truth

The design assumes the linter's stdout/stderr is the entire review surface. There is no human review, no LLM review, no model call. The only "intelligence" is the linter's pattern matchers. This is the central design point of reviewdog and is preserved in the transcript.

---

## Operational Tradeoffs

### Strengths (as demonstrated in the transcript)

| Strength | Evidence |
| --- | --- |
| Zero-setup auth | No tokens created, no App installed, no bot account — reviewdog reuses the workflow's existing permissions (`sources/reviewdog-swiftlint-youtube.md:34-36`) |
| Inline PR comments at the exact line | "review dog instantly left a comment right on the exact line" (`sources/reviewdog-swiftlint-youtube.md:67-69`) |
| Parallel CI job | "This runs in parallel with other jobs like build and test" (`sources/reviewdog-swiftlint-youtube.md:38-40`) — does not block the build pipeline |
| Linter-agnostic engine | SwiftLint is interchangeable with any tool that emits line-numbered output; reviewdog itself is the constant |
| Fast feedback | "instantly left a comment" (`sources/reviewdog-swiftlint-youtube.md:68`) — appears as soon as the job completes |
| Trivial install | "I'm doing it manually with homebrew" (`sources/reviewdog-swiftlint-youtube.md:47-48`) — no Docker, no compiled binary download script shown |

### Weaknesses (as observed or omitted in the transcript)

| Weakness | Evidence / Gap |
| --- | --- |
| macOS-only | Job pinned to Mac OS (`sources/reviewdog-swiftlint-youtube.md:60-62`) — excludes Linux/Windows Swift users without explanation of how to choose runner |
| Single platform (GitHub only) | Every reference is GitHub — no GitLab/Bitbucket/Azure/gerrit fallback |
| No permission details | "we need to add permissions" (`sources/reviewdog-swiftlint-youtube.md:35`) — no `permissions:` block, no `pull-requests: write`, no `checks: write` named |
| No credential discussion | Token name, source, scope, and rotation strategy are entirely absent |
| No fork-PR caveat | The well-known `GITHUB_TOKEN` fork-PR limitation (covered in `reviewdog-github-actions.md:32-43`) is not mentioned |
| No rate-limit handling | Not discussed |
| No supply-chain hygiene | No mention of SHA-pinning reviewdog installation, Homebrew version, or SwiftLint version |
| No failure mode discussion | What happens if SwiftLint emits no findings? What if reviewdog cannot post a comment? Not addressed |
| No multi-job / monorepo pattern | Single job, single linter, single repo scope |
| No output-format options | Only "inline PR comments" is shown (`sources/reviewdog-swiftlint-youtube.md:53-54`); no Check Runs, no review-summary comment, no annotation alternative |
| Tutorial-style brevity | `[Music]` gaps and incomplete sentences suggest this is a 5-minute demo, not a production-grade walkthrough |

---

## Security Considerations (what the transcript implies and what it skips)

| Risk | Transcript stance |
| --- | --- |
| Secret leakage | Not discussed — no tokens are introduced, so the surface is the standard GitHub Actions-managed `GITHUB_TOKEN` |
| Token scope minimization | Not discussed — the presenter only says "add permissions so review dog can write" (`sources/reviewdog-swiftlint-youtube.md:35-36`), with no scoping guidance |
| Fork PR silent failure | Not discussed — open-source repos using this pattern may silently lose inline annotations on external contributions |
| Runner supply chain | Not discussed — Homebrew install (`sources/reviewdog-swiftlint-youtube.md:47-48`) and a generic "pre build action" (`sources/reviewdog-swiftlint-youtube.md:48-49`) are both unverified-by-default mechanisms |
| Comment injection | reviewdog translates the linter's `file:line:col: message` format directly into a PR comment. A malicious or buggy linter could inject content into PRs. Not discussed. |
| Reviewdog update surface | `install the tool` (`sources/reviewdog-swiftlint-youtube.md:43-45`) is described in one breath. No version pinning. No integrity check. |

---

## Answers to Study Questions

### Q1: What are the supported ways to trigger a review?

Based solely on the transcript: **a GitHub Actions job that runs as part of an existing CI workflow, triggered by a push to or update of a pull request**. The exact `on:` event is not named, but the outcome ("inline pull request comments" — `sources/reviewdog-swiftlint-youtube.md:53-54`) requires the `pull_request` event. No webhook, no CLI, no scheduled run, no App event, no manual trigger is described.

### Q2: Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**CI job, self-hosted in the user's own GitHub Actions runner.** Reviewdog executes inside a step of the user's existing CI pipeline. There is no SaaS component and no separate service to provision. (The transcript never mentions the reviewdog GitHub App or the doghouse server — both of which exist upstream but are out of scope here.)

### Q3: How does it authenticate with the code hosting platform?

**Not explicitly discussed.** The transcript says only that the workflow needs "permissions so review dog can write comments directly to pull requests" (`sources/reviewdog-swiftlint-youtube.md:34-36`). By elimination, reviewdog must be using either the workflow's auto-injected `GITHUB_TOKEN` or a `pull-requests: write` scope on the runner's credentials — but this is **inferred, not evidenced**. No token name, no env var, no setup step is shown.

### Q4: What repository permissions does it require?

The transcript names only one requirement: **the ability to write PR comments** (`sources/reviewdog-swiftlint-youtube.md:34-36`). Concretely that implies `pull-requests: write`. Whether `checks: write` (for Check Run annotations) or `contents: read` are also required is not discussed. No `permissions:` block is shown. No least-privilege guidance is given.

### Q5: How hard would it be to install this in a private repo?

**Very low — under 30 minutes, based on the transcript.** The demonstrated install path is:

1. Add a permissions line to the workflow file (`sources/reviewdog-swiftlint-youtube.md:34-36`).
2. Add a new `lint` job that runs on macOS in parallel with the existing jobs (`sources/reviewdog-swiftlint-youtube.md:38-41`).
3. Install reviewdog (`sources/reviewdog-swiftlint-youtube.md:43-45`).
4. Install SwiftLint (via Homebrew or a "pre build action") (`sources/reviewdog-swiftlint-youtube.md:47-49`).
5. Pipe `swiftlint` into `reviewdog` (`sources/reviewdog-swiftlint-youtube.md:50-54`).
6. Push a PR and observe inline comments (`sources/reviewdog-swiftlint-youtube.md:65-69`).

There is no token provisioning, no App installation, no webhook registration. The friction is comparable to the sibling `reviewdog-github-actions.md:116-127` analysis (a copy-paste YAML into `.github/workflows/`).

**Caveat**: The transcript does not show whether the `GITHUB_TOKEN` default scope is sufficient, nor what to do on a private repo with stricter default token settings. Inferred to work, not evidenced.

### Q6: Does the integration model create security or operational risks?

**Yes — several, mostly because the transcript omits them:**

1. **No token-scope guidance** — users may grant broader workflow permissions than strictly needed (`sources/reviewdog-swiftlint-youtube.md:35-36`).
2. **macOS runner cost** — running SwiftLint on `macos-latest` is materially more expensive per minute than Linux; not discussed as a tradeoff.
3. **No fork-PR degradation plan** — the well-known limitation where `GITHUB_TOKEN` is read-only on fork PRs (documented in `reviewdog-github-actions.md:33-44`) is not mentioned. This is a silent failure mode for OSS repos.
4. **No version pinning** — reviewdog and SwiftLint are installed without version constraints.
5. **No review surface beyond style** — the model treats the linter as the source of truth for review. A reviewer who wants semantic or AI-assisted feedback gets nothing from this integration.
6. **macOS-only job** — the integration excludes cross-platform Swift users who may build on Linux Swift toolchains.
7. **No rate-limit handling** — large PRs producing many violations could hit GitHub's comment rate limits.

### Q7: Which integration model would be easiest to adapt for Ultraplan?

The model in this transcript is the same one described in `reviewdog-github-actions.md:142-156` — a **GitHub Actions step in a CI job** — and the patterns worth copying are identical:

1. **Platform-native token reuse** — let the CI environment provide auth; never ask the user to mint a separate credential.
2. **Step-in-pipeline, not a separate service** — the user adds a job; Ultraplan does not need to run.
3. **Linter-agnostic engine** — accept `file:line:col: message` on stdin; the user picks the analyzer.
4. **Inline PR comments at the exact line** — high-signal, low-noise placement; matches what reviewers expect.
5. **Parallel job, not a blocking step** — does not delay build or test (`sources/reviewdog-swiftlint-youtube.md:38-40`).

The transcript's contribution beyond the `reviewdog-github-actions` source is **specifically the linter→engine pipe pattern with a non-default linter** (SwiftLint on macOS). For Ultraplan, this confirms the pipe pattern works for any linter that emits line-numbered output, not only the ones the upstream `reviewdog/action-*` Actions wrap. Ultraplan should expose a "bring your own linter" mode where the engine consumes the linter's stdout and renders it as PR feedback.

**Adaptation limit**: The macOS-pinned job is **not** portable to a multi-platform review engine. If Ultraplan is meant to be cross-platform, it should default to Linux runners and treat the macOS case as an opt-in matrix entry.

---

## Rating

**Score: 6/10**

| Axis | Score | Rationale (grounded in transcript) |
| --- | --- | --- |
| Workflow fit | 8 | Fits naturally into PR review: parallel CI job, inline PR comments at the exact line, immediate feedback (`sources/reviewdog-swiftlint-youtube.md:38-40`, `53-54`, `67-69`) |
| Installation complexity | 8 | One workflow edit + a few `run:` steps; no token, no App, no service to provision (`sources/reviewdog-swiftlint-youtube.md:34-54`) |
| Permission minimisation | 3 | "Add permissions" is the entire guidance; no `permissions:` block, no scoping, no least-privilege advice (`sources/reviewdog-swiftlint-youtube.md:34-36`) |
| Portability | 3 | GitHub-only and macOS-only. No Linux runner, no GitLab/Bitbucket/Azure option discussed (`sources/reviewdog-swiftlint-youtube.md:41`, `60-62`) |
| Self-hostability | 9 | Runs entirely in the user's own GitHub Actions runner. No SaaS, no external service, no outbound call other than the GitHub comment write |
| Auth clarity | 2 | Credentials are not mentioned. Token name, source, scope, and rotation are entirely absent from the transcript |

**Rationale summary**: The demonstrated integration is a clean, low-friction, self-hosted pattern that fits the PR review workflow well. It loses points for: (a) macOS-pinning, (b) GitHub-only, (c) zero permission/credential clarity, and (d) zero discussion of fork-PR, rate-limit, or supply-chain failure modes. The transcript is a 5-minute demo, not an operations guide, and the analysis rates it as such.

**Fast heuristic** — *"Could I add this review agent to a private GitHub repo in under an hour?"*: **Yes**, in roughly 20–30 minutes, assuming the repo is a Swift project and the user already has a GitHub Actions workflow. For a non-Swift repo, this specific tutorial is not applicable — but the underlying reviewdog-pipe pattern (covered by `reviewdog-github-actions.md`) generalizes.

---

## Patterns Worth Copying into Ultraplan

1. **Pipe-model review surface** — the linter's stdout is the input contract (`sources/reviewdog-swiftlint-youtube.md:50-54`). Ultraplan should expose a stdin/stdout interface, not a tightly coupled linter integration.
2. **Inline comments at the exact line** — "comment right on the exact line" (`sources/reviewdog-swiftlint-youtube.md:68-69`) is the highest-signal placement for style/quality feedback. Ultraplan's renderer should target this by default.
3. **Parallel job, never blocking** — "runs in parallel with other jobs like build and test" (`sources/reviewdog-swiftlint-youtube.md:38-40`). Review feedback must not be on the critical path of the build.
4. **No new credentials** — the workflow's existing permissions are sufficient. Ultraplan should follow the same zero-credential principle, accepting whatever token the CI environment provides.
5. **Linter substitution is trivial** — replacing SwiftLint with ESLint, golangci-lint, or shellcheck requires changing only the install + pipe step. Ultraplan's adapter design should treat the analyzer as a swappable module.
6. **macOS matrix entry, not default** — for cross-platform review engines, the macOS case is a matrix option, not a hard pin. Ultraplan should learn from the transcript's macOS-only limitation.

## Patterns to Avoid

1. **Opaque permission changes** — "add permissions" without naming the scope is exactly the kind of guidance that leads to over-broad workflow tokens.
2. **Unversioned installs** — "install the tool" and "install Swift ... with homebrew" without pinning a version is a supply-chain risk.
3. **No fork-PR degradation plan** — a silent fallback to log output is a known reviewdog-Actions hazard; Ultraplan should document its fallback behavior explicitly.
4. **macOS-only by default** — Apple runners are the most expensive in GitHub Actions; defaulting to them is wasteful for non-Apple codebases.
5. **No failure-mode coverage** — the transcript never discusses what happens if reviewdog cannot post, if SwiftLint crashes, or if the runner times out. Ultraplan's documentation should not make the same omission.
