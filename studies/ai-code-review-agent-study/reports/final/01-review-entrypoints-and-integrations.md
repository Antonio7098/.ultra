# Dimension 01: Review Entrypoints & Platform Integrations - Combined Study Report

## Study Parameters

| Field | Value |
|-------|-------|
| Dimension | `dimensions/01-review-entrypoints-and-integrations.md` |
| Sources | alex-ellis-ai-code-review-bot, canonical-maas-code-reviewer, continue-pr-review-bot, danger-js, dangerjs-youtube, gerrit, gerrit-ai-youtube, github-agent-pr-review-policy, huggingface-ai-reviewer, kasidit-ai-code-reviewer, kasidit-ai-code-reviewer-readme, patchwork, pr-agent, pr-agent-youtube, qwen-code-review, qwen-code-review-docs, review-board, reviewdog, reviewdog-github-actions, reviewdog-swiftlint-youtube |
| Date | 2026-06-01 |

## Sources Studied

| # | Source | Path |
|---|--------|------|
| 1 | alex-ellis-ai-code-review-bot | `reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md` |
| 2 | canonical-maas-code-reviewer | `reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md` |
| 3 | continue-pr-review-bot | `reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md` |
| 4 | danger-js | `reports/source/01-review-entrypoints-and-integrations/danger-js.md` |
| 5 | dangerjs-youtube | `reports/source/01-review-entrypoints-and-integrations/dangerjs-youtube.md` |
| 6 | gerrit | `reports/source/01-review-entrypoints-and-integrations/gerrit.md` |
| 7 | gerrit-ai-youtube | `reports/source/01-review-entrypoints-and-integrations/gerrit-ai-youtube.md` |
| 8 | github-agent-pr-review-policy | `reports/source/01-review-entrypoints-and-integrations/github-agent-pr-review-policy.md` |
| 9 | huggingface-ai-reviewer | `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md` |
| 10 | kasidit-ai-code-reviewer | `reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer.md` |
| 11 | kasidit-ai-code-reviewer-readme | `reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer-readme.md` |
| 12 | patchwork | `reports/source/01-review-entrypoints-and-integrations/patchwork.md` |
| 13 | pr-agent | `reports/source/01-review-entrypoints-and-integrations/pr-agent.md` |
| 14 | pr-agent-youtube | `reports/source/01-review-entrypoints-and-integrations/pr-agent-youtube.md` |
| 15 | qwen-code-review | `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md` |
| 16 | qwen-code-review-docs | `reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md` |
| 17 | review-board | `reports/source/01-review-entrypoints-and-integrations/review-board.md` |
| 18 | reviewdog | `reports/source/01-review-entrypoints-and-integrations/reviewdog.md` |
| 19 | reviewdog-github-actions | `reports/source/01-review-entrypoints-and-integrations/reviewdog-github-actions.md` |
| 20 | reviewdog-swiftlint-youtube | `reports/source/01-review-entrypoints-and-integrations/reviewdog-swiftlint-youtube.md` |

## Executive Summary

The strongest sources converge on one design rule: keep the review engine separate from the entrypoint. PR-Agent routes CLI, Actions, webhook, polling, and provider-specific servers into one core handler (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:201-208`, `pr_agent/agent/pr_agent.py:50`). reviewdog does the same with a CLI-first engine behind `CommentService` and `DiffService` abstractions (`reports/source/01-review-entrypoints-and-integrations/reviewdog.md:88-95`, `reviewdog.go:48-79`). Hugging Face's reviewer shows the same pattern across Action, App, and Web modes (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:246-253`, `pyproject.toml:34-37`).

Three viable archetypes emerged:

- CI/Action-first tools optimize for under-an-hour installation and private-repo adoption, but usually inherit fork-PR, rate-limit, and platform-coupling constraints (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:97-112`, `.github/workflows/review-pr.yml:10-12`; `reports/source/01-review-entrypoints-and-integrations/reviewdog-github-actions.md:115-127`, `sources/reviewdog-github-actions.md:34-35`).
- GitHub App or webhook services optimize for automatic triggering, fork PR coverage, and better secret isolation, but add deployment and webhook-hardening burden (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:83-96`, `sources/alex-ellis-ai-code-review-bot.md:88-96`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:36-47`, `reviewbot/app.py:66-90`).
- Multi-provider engines optimize for portability and long-term product growth, but almost always pay in auth complexity and broader permission surfaces (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:190-223`, `pr_agent/git_providers/__init__.py:17-27`; `reports/source/01-review-entrypoints-and-integrations/danger-js.md:126-145`, `lib/danger/ci_source/ci_source.rb:7`).

The weakest fits for Ultraplan were full review platforms and UI-only overlays. Gerrit, Review Board, and Patchwork are mature systems, but they replace or bypass normal PR workflows instead of dropping into them (`reports/source/01-review-entrypoints-and-integrations/gerrit.md:56-59`, `java/com/google/gerrit/server/git/receive/ReceiveCommits.java:205`; `reports/source/01-review-entrypoints-and-integrations/review-board.md:107-118`, `reviewboard/hostingsvcs/hook_utils.py:94-160`; `reports/source/01-review-entrypoints-and-integrations/patchwork.md:93-100`, `patchwork/parser.py:158-214`).

## Core Thesis

For a modern review agent, the best default is:

1. Start with a CLI or composite Action for lowest-friction adoption.
2. Keep trigger parsing, provider auth, and comment posting outside the core review engine.
3. Add GitHub App or webhook mode only when fork PR support, lower latency, or centralized ops become real needs.
4. Invest in provider abstractions before expanding beyond GitHub.

This thesis is supported most clearly by PR-Agent, reviewdog, and Hugging Face's ai-reviewer, which all preserve one core engine while varying transport and auth layers (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:201-208`, `pr_agent/agent/pr_agent.py:50`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:150-156`, `cienv/cienv.go:37-104`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:248-253`, `reviewbot/triggers.py:1-85`).

## Rating Summary

| Source | Score | Approach | Main Strength | Main Concern |
|--------|-------|----------|---------------|--------------|
| alex-ellis-ai-code-review-bot | 6/10 | GitHub App + self-hosted webhook + isolated executor | Excellent isolation and token handling | Heavy microVM operational burden |
| canonical-maas-code-reviewer | 7/10 | CLI core + GitHub Actions wrapper | Clean CI wrapper with minimal permissions | GitHub automation is narrow and one-shot |
| continue-pr-review-bot | 6/10 | GitHub Actions + cloud-backed CLI | Fast install and on-demand `@review-bot` flow | Continue Cloud dependency and GitHub-only |
| danger-js | 8/10 | CI-first multi-provider CLI | Extremely portable CI/provider abstraction | PAT-heavy security model |
| dangerjs-youtube | 6/10 | GitHub Actions tutorial | Very simple PR workflow fit | Auth and permissions undocumented |
| gerrit | 3/10 | Standalone review platform | Strong event and permission model | Replaces PR workflow entirely |
| gerrit-ai-youtube | 4/10 | Manual Gerrit UI AI assist | Human-curated, low-noise model | No automation and awkward copy/paste UX |
| github-agent-pr-review-policy | 2/10 | Policy guidance over GitHub SaaS | Strong layered-review ideas | Not an installable integration |
| huggingface-ai-reviewer | 8/10 | Three-mode GitHub stack: Action, App, Web app | Best progressive upgrade path from one codebase | GitHub-only and no hosted backend |
| kasidit-ai-code-reviewer | 3/10 | Intended GitHub Action | Minimal permission intent | Repository is scaffold-only, not working |
| kasidit-ai-code-reviewer-readme | 6/10 | Documented GitHub Action | Trivial setup and least-privilege docs | Single-platform and docs-led evidence only |
| patchwork | 4/10 | Mail-ingestion review platform | Mature self-hosted API and check model | Email-centric, no PR integration |
| pr-agent | 8/10 | Self-hosted multi-provider engine | Widest real entrypoint and provider coverage | Broad token scopes and optional webhook verification |
| pr-agent-youtube | 2/10 | Chrome extension over hosted backend | Near-zero user install friction | Manual, browser-bound, hosted-only |
| qwen-code-review | 7/10 | CLI/TUI core + GitHub Action + daemon/channels | Broad reusable entrypoints from one agent core | PR review integration is GitHub-only and workflow-bound |
| qwen-code-review-docs | 4/10 | Documented CLI + GitHub App | Good base-branch rule-loading idea | Docs conflict with repo evidence and omit ops details |
| review-board | 5/10 | Self-hosted review platform with provider adapters | Mature hosting-service abstraction | Heavy server setup and no native PR bot flow |
| reviewdog | 8/10 | CLI-first multi-platform diff annotator | Portable single binary plus optional App proxy | PAT/API scopes are often broad |
| reviewdog-github-actions | 6/10 | GitHub Actions wrapper around reviewdog | Native `GITHUB_TOKEN` workflow simplicity | Fork-PR degradation and GitHub-only scope |
| reviewdog-swiftlint-youtube | 6/10 | GitHub Actions tutorial with linter pipe | Clear pipe-to-inline-comment pattern | Omits credential and failure-mode guidance |

## Approach Models

### 1. CI-First Wrappers

This cluster treats review as a job step, not a server. Canonical MAAS, Continue, reviewdog's GitHub Actions pattern, the two reviewdog tutorials, the documented kasidit Action, and Qwen's PR workflow all follow this model (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:28-37`, `src/maas_code_reviewer/cli.py:197-253`; `reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:17-29`, `continue-pr-review-bot.md:80-84`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:30-37`, `.github/workflows/qwen-code-pr-review.yml:1-190`).

Why it works:

- Uses native CI secrets and permissions.
- Requires no public endpoint.
- Fits private repos and existing YAML-centric workflows.

When it diverges:

- Safer `pull_request` workflows trade convenience for fork friction in Continue (`reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:30-31,81-82`, `continue-pr-review-bot.md:95-97`).
- `pull_request_target` workflows regain secrets but need tighter safeguards, as seen in Canonical MAAS and Qwen (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:80-91,119-126`, `.github/workflows/review-pr.yml:10-12`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:166-169`, `.github/workflows/qwen-code-pr-review.yml:22-25`).

### 2. App/Webhook Services

This cluster centers on webhooks, background workers, and app-issued tokens. Alex Ellis's bot and Hugging Face's App/Web modes are the clearest examples (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:25-39`, `sources/alex-ellis-ai-code-review-bot.md:87-96`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:36-47`, `reviewbot/app.py:66-90`). Qwen's docs also describe this model, though the repo analysis does not confirm an implemented App path (`reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md:14-27`, `sources/qwen-code-review-docs.md:80-85`).

Why it works:

- Supports true event-driven behavior.
- Handles fork PRs better because secrets live server-side.
- Allows central queuing, deduplication, and interactive follow-ups.

Why it costs more:

- Requires a deployed service, webhook secret management, and background execution.
- Security mistakes become internet-facing mistakes.

### 3. Multi-Provider Engines

PR-Agent, reviewdog, Danger, and Review Board all invest in platform adapters instead of a single GitHub path (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:190-199`, `pr_agent/git_providers/__init__.py:17-27`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:14-24`, `reviewdog.go:48-79`; `reports/source/01-review-entrypoints-and-integrations/danger-js.md:85-123`, `lib/danger/danger_core/environment_manager.rb:91-101`; `reports/source/01-review-entrypoints-and-integrations/review-board.md:217-226`, `reviewboard/hostingsvcs/base/registry.py:37`).

Why it works:

- Preserves one engine across GitHub, GitLab, Bitbucket, Gitea, Azure DevOps, and more.
- Lets product surface area grow without rewriting review logic.

Why it diverges:

- reviewdog keeps the core very narrow, focused on diff annotation (`reports/source/01-review-entrypoints-and-integrations/reviewdog.md:150-156`, `reviewdog.go:48-79`).
- PR-Agent goes broader, with many commands and servers, so auth and deployment complexity rise faster (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:11-27,163-173`, `pr_agent/servers/github_app.py:38-54`).

### 4. Local-First Agent Cores

Qwen Code and Canonical MAAS show a useful variant: the review engine is fundamentally a CLI, then wrapped by CI or other shells (`reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:14-29`, `packages/cli/src/nonInteractiveCli.ts:191`; `reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:30-37,134-145`, `src/maas_code_reviewer/reviewer.py:87-147`).

Why it works:

- Gives local testing and non-platform-specific reuse.
- Keeps CI integration thin.

Best fit:

- Teams that want to validate review behavior locally before automating it.

### 5. Full Review Platforms And UI Overlays

Gerrit, Review Board, Patchwork, Gerrit's AI talk, the PR-Agent Chrome extension, and the GitHub Copilot policy article sit outside the main bolt-on-bot pattern (`reports/source/01-review-entrypoints-and-integrations/gerrit.md:34-59`, `java/com/google/gerrit/server/events/EventBroker.java:86`; `reports/source/01-review-entrypoints-and-integrations/patchwork.md:9-18`, `patchwork/parser.py:1192-1512`; `reports/source/01-review-entrypoints-and-integrations/pr-agent-youtube.md:11-18,56-63`; `reports/source/01-review-entrypoints-and-integrations/github-agent-pr-review-policy.md:17-30,82-108`).

These sources are still useful, but mostly for policies, eventing, or UX ideas rather than Ultraplan's core integration shape.

## Pattern Catalog

### Thin Entrypoints Over One Core Engine

Problem solved: adding new triggers without duplicating review logic.

Sources: PR-Agent, reviewdog, Hugging Face, Qwen, Canonical MAAS (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:201-208`, `pr_agent/agent/pr_agent.py:50`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:248-253`, `reviewbot/triggers.py:1-85`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:184-190`, `packages/cli/src/commands/review.ts:19-39`).

Why it works: trigger parsing, auth, and comment posting change per platform; the review algorithm changes much less.

Copy it when: you expect more than one entrypoint or more than one provider.

Overkill when: the product will stay GitHub-Action-only for the foreseeable future.

### Progressive Upgrade Path

Problem solved: letting teams start simple and grow into stronger integration.

Sources: Hugging Face's Action/App/Web trio, Continue's default token plus optional App token, reviewdog's CLI plus doghouse (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:14-21,184-194`, `action.yml:79-111`; `reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:152-157`, `continue-pr-review-bot.md:104-111`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:88-95,148-156`, `doghouse/appengine/main.go:66-116`).

Why it works: teams can adopt in 10-15 minutes, then migrate to App or service mode when fork support or control becomes necessary.

Copy it when: adoption friction matters more than architectural purity.

Risk: multiple supported modes create testing and docs burden.

### Short-Lived, Scoped Platform Tokens

Problem solved: reducing standing credentials and blast radius.

Sources: Alex Ellis and Hugging Face use installation tokens; reviewdog doghouse does likewise (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:43-63`, `sources/alex-ellis-ai-code-review-bot.md:90`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:62-73`, `github_auth.py:25-43`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:40-46`, `doghouse/server/github.go:25-38`).

Why it works: avoids PAT sprawl and scopes access to installed repos.

Copy it when: you run a webhook service or app-backed deployment.

Alternative: native CI tokens are simpler for Action-first integrations, as seen in Canonical MAAS and reviewdog Actions (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:62-74`, `src/maas_code_reviewer/github_client.py:22`; `reports/source/01-review-entrypoints-and-integrations/reviewdog-github-actions.md:101-107`, `sources/reviewdog-github-actions.md:34-35`).

### Repo-Tracked Rules Loaded From Trusted Context

Problem solved: custom review policy without letting PR authors rewrite the rules mid-review.

Sources: Continue reads `.continue/rules/`; Hugging Face uses `.ai/review-rules.md` from the default branch; Qwen docs explicitly load rules from the base branch (`reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:58-60,153-156`, `continue-pr-review-bot.md:147-153`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:198-214`, `action.yml:8-73`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md:97-105,127-131`, `sources/qwen-code-review-docs.md:48-55`).

Why it works: keeps team policy versioned in Git while preserving trust boundaries.

Copy it when: teams need custom review standards.

Risk: if rule-loading semantics are unclear, operators will not know which branch is authoritative.

### Graceful Degradation In Permission-Limited Contexts

Problem solved: still surfacing results when inline writes are blocked.

Sources: reviewdog falls back to Actions log output on fork PRs; Hugging Face Action mode explicitly refuses fork-secret scenarios; Qwen guards collaborator association before running (`reports/source/01-review-entrypoints-and-integrations/reviewdog.md:52-57,141-147`, `service/github/github.go:236-251`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:162-169`, `action_runner.py:117-130`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:166-169,229-233`, `.github/workflows/qwen-code-pr-review.yml:22-25`).

Why it works: fork PRs are a real product constraint, not an edge case.

Copy it when: you will run in open-source or mixed-trust repos.

Risk: silent degradation is bad UX; explicit status messaging is better.

## Key Differences

The biggest divergence is not quality but deployment boundary.

- CI-first tools assume the repo already has a trusted automation surface. That is why they bias toward built-in tokens and copy-paste YAML (`reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:115-125`, `continue-pr-review-bot.md:58`; `reports/source/01-review-entrypoints-and-integrations/reviewdog-github-actions.md:115-127`, `sources/reviewdog-github-actions.md:117-123`).
- App/webhook tools assume the review product itself should own runtime, auth, and queueing. That is why they invest in webhook verification, worker pools, and app tokens (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:166-183`, `webapp.py:28-32`; `reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:102-129`, `sources/alex-ellis-ai-code-review-bot.md:128-131`).
- Multi-provider engines assume the review logic should survive platform churn. That is why they front-load adapter abstractions (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:192-199`, `pr_agent/git_providers/git_provider.py:74`; `reports/source/01-review-entrypoints-and-integrations/danger-js.md:157-172`, `lib/danger/request_sources/request_source.rb:5`).

The second major divergence is trust model.

- Strongest trust boundaries appear in Alex Ellis's microVM design and in Hugging Face's association-gated triggers (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:59-63,104-111`, `sources/alex-ellis-ai-code-review-bot.md:129-131`; `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:49-57,174-177`, `reviewbot/triggers.py:23-24`).
- Weakest trust boundaries appear where broad PATs are normal or webhook verification is optional, as in Danger, PR-Agent user mode, and direct reviewdog PAT flows (`reports/source/01-review-entrypoints-and-integrations/danger-js.md:139-153`, `lib/danger/request_sources/github/github.rb:66-78`; `reports/source/01-review-entrypoints-and-integrations/pr-agent.md:165-173`, `pr_agent/servers/utils.py:10-25`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:27-46`, `cmd/reviewdog/main.go:710-713`).

## Tradeoffs

### GitHub Action vs GitHub App

Benefit of Action: easiest private-repo install, no public service, native token reuse (`reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer-readme.md:74-88`, `sources/kasidit-ai-code-reviewer-readme.md:38-62`; `reports/source/01-review-entrypoints-and-integrations/reviewdog-github-actions.md:115-127`, `sources/reviewdog-github-actions.md:117-123`).

Cost of Action: fork PR limitations, run-time timeouts, less persistent state, and GitHub-only coupling (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:162-169`, `README.md:58-61`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:157-163`, `.github/workflows/qwen-code-pr-review.yml:42`).

Benefit of App: event-driven behavior, centralized control, short-lived installation tokens, better fork support (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:138-150`, `github_auth.py:25-43`; `reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:173-179`, `sources/alex-ellis-ai-code-review-bot.md:90`).

Cost of App: real deployment burden and larger exposed attack surface (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:85-96`, `sources/alex-ellis-ai-code-review-bot.md:91`; `reports/source/01-review-entrypoints-and-integrations/pr-agent.md:147-159`, `pr_agent/servers/github_app.py:38-54`).

### PAT/User Token vs App Token

PAT benefit: simplest to explain and works outside server-side app flows (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:62-74`, `src/maas_code_reviewer/cli.py:201`; `reports/source/01-review-entrypoints-and-integrations/danger-js.md:55-79`, `lib/danger/request_sources/github/github.rb:21-27`).

PAT cost: broad scopes and operator-bound credentials (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:167-173`, `pr_agent/servers/github_polling.py:172-176`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:117-123`, `cmd/reviewdog/main.go:710-713`).

Best-fit context: local CLI or CI tools before an App exists.

Alternative seen elsewhere: App tokens in Alex Ellis, Hugging Face, and doghouse.

### Full Platform vs Bolt-On Bot

Full platform benefit: deep workflow ownership, richer internal event models, and full audit/control surfaces (`reports/source/01-review-entrypoints-and-integrations/gerrit.md:160-189`, `java/com/google/gerrit/server/permissions/PermissionBackend.java`; `reports/source/01-review-entrypoints-and-integrations/review-board.md:217-226`, `reviewboard/hostingsvcs/base/hosting_service.py`).

Full platform cost: does not solve the user's "add this to my repo this afternoon" problem (`reports/source/01-review-entrypoints-and-integrations/gerrit.md:222-235`, `java/com/google/gerrit/pgm/Daemon.java:224-294`; `reports/source/01-review-entrypoints-and-integrations/review-board.md:196-205`, `reviewboard/manage.py:336`).

Best-fit context: organizations willing to standardize on the review platform itself.

Alternative: bolt-on Action/App models from Hugging Face, reviewdog, PR-Agent.

## Decision Guide

1. Choose a GitHub Action first if the primary goal is private-repo adoption in under an hour.
Evidence: Canonical MAAS, Continue, reviewdog Actions, and kasidit README all show copy-YAML-plus-secret setups (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:99-112`, `.github/workflows/review-pr.yml:1-50`; `reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer-readme.md:168-176`, `sources/kasidit-ai-code-reviewer-readme.md:38-62`).

2. Choose a GitHub App or webhook service when fork PR support, live command handling, or central policy enforcement matters more than setup simplicity.
Evidence: Hugging Face and Alex Ellis both move secrets and auth server-side to do this (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:36-47,166-177`, `reviewbot/app.py:66-90`; `reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:173-179`, `sources/alex-ellis-ai-code-review-bot.md:90-93`).

3. Build provider abstractions before adding the second non-GitHub platform.
Evidence: PR-Agent, reviewdog, Danger, and Review Board all succeed here because adapters are first-class (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:192-199`, `pr_agent/git_providers/__init__.py:17-27`; `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:180-186`, `reviewdog.go:48-79`).

4. Keep a CLI path even if the product is server-first.
Evidence: Canonical MAAS, PR-Agent, and Qwen all use CLI paths for testing, local execution, or composition (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:134-145`, `src/maas_code_reviewer/cli.py:152-194`; `reports/source/01-review-entrypoints-and-integrations/pr-agent.md:225-228`, `pr_agent/cli.py:104`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:78-83`, `packages/cli/src/commands/review.ts:19-39`).

5. Delay heavy isolation layers until threat model justifies them.
Evidence: Alex Ellis's microVM pattern is excellent but far more operationally expensive than the containerized or CI-runner approaches elsewhere (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:127-129,243-248`, `sources/alex-ellis-ai-code-review-bot.md:91-96`).

## Practical Tips

- Publish the simplest working path first: one workflow file or one CLI command.
- Document exact permissions explicitly. The best examples name the exact block: `contents: read`, `pull-requests: write`, and only add `issues: write` when comment triggers require it (`reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:80-91`, `.github/workflows/review-pr.yml:10-12`; `reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:102-114`, `continue-pr-review-bot.md:86-89`).
- Treat fork PR behavior as a product requirement, not a footnote.
- Keep repo-specific rules in Git, but load them from trusted branch context.
- Deduplicate comments and push-trigger reviews. Continue updates one standing comment; PR-Agent deduplicates rapid push triggers (`reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:68-70,152-157`, `continue-pr-review-bot.md:202-215`; `reports/source/01-review-entrypoints-and-integrations/pr-agent.md:214-223`, `pr_agent/servers/github_app.py:77-206`).
- Prefer SHA-pinned Actions or version-pinned installers when distributing CI integrations. Qwen's review workflow pins the action commit (`reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:166-169`, `.github/workflows/qwen-code-pr-review.yml:34-35`).

## Anti-Patterns / Caution Signs

- Broad PATs as the default long-term auth model. Danger, reviewdog direct mode, PR-Agent user mode, and older Review Board integrations all show the blast-radius problem (`reports/source/01-review-entrypoints-and-integrations/danger-js.md:139-153`, `lib/danger/request_sources/github/github.rb:66-78`; `reports/source/01-review-entrypoints-and-integrations/review-board.md:124-133`, `reviewboard/hostingsvcs/github.py:70`).
- Optional webhook verification. PR-Agent allows GitHub/Gitea verification to be skipped if no secret is configured (`reports/source/01-review-entrypoints-and-integrations/pr-agent.md:51-52,169-171`, `pr_agent/servers/utils.py:10-25`).
- Docs that promise an integration surface the repo does not actually implement. The kasidit repo is scaffold-only, and the Qwen docs describe a GitHub App path not evidenced in the repo analysis (`reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer.md:75-83`, `cmd/ai-code-reviewer/main.go:9-11`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md:21-27`, `sources/qwen-code-review-docs.md:80-85`).
- Manual browser-only trigger models when the goal is org-wide review coverage. The PR-Agent extension and Gerrit AI copy/paste flow are useful complements, not primaries (`reports/source/01-review-entrypoints-and-integrations/pr-agent-youtube.md:56-63,97-105`; `reports/source/01-review-entrypoints-and-integrations/gerrit-ai-youtube.md:114-126,138-149`; `gerrit-ai-youtube.md:141-158`).
- Prompt assembly or policy logic buried directly in workflow shell scripts, which reduces reuse and testability (`reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:78-79`, `continue-pr-review-bot.md:155-175`).

## Notable Absences

- Exact permission manifests are missing or incomplete in several otherwise interesting sources, especially Alex Ellis, Qwen docs, and transcript-only sources (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:73-80`, `sources/alex-ellis-ai-code-review-bot.md:181`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md:56-64`, `sources/qwen-code-review-docs.md:116`).
- Strong rate limiting and queueing controls are rare. Hugging Face caps concurrent workers; PR-Agent deduplicates push bursts; most others do little or provide no evidence (`reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:182-183`, `webapp.py:28-32`; `reports/source/01-review-entrypoints-and-integrations/pr-agent.md:216-220`, `pr_agent/servers/github_app.py:77-206`).
- Multi-platform parity is uncommon outside PR-Agent, reviewdog, Danger, and Review Board.
- Few sources combine CLI, CI, and App modes cleanly in one codebase. Hugging Face is the clearest implemented example.

## Per-Source Notes

- `alex-ellis-ai-code-review-bot`: strongest isolation story; weakest install story.
- `canonical-maas-code-reviewer`: good model for CLI-first review engine wrapped by CI.
- `continue-pr-review-bot`: good repo-rules and comment-refresh UX, but cloud-tied.
- `danger-js`: still one of the cleanest portability architectures, despite old token assumptions.
- `dangerjs-youtube`: useful as a simplicity example, not as an ops reference.
- `gerrit`: valuable for event architecture patterns, not for PR integration shape.
- `gerrit-ai-youtube`: strong human-in-the-loop philosophy, weak automation.
- `github-agent-pr-review-policy`: better used as policy input than architecture input.
- `huggingface-ai-reviewer`: best example of progressive entrypoints from one codebase.
- `kasidit-ai-code-reviewer`: should not be treated as implemented evidence.
- `kasidit-ai-code-reviewer-readme`: decent least-privilege template if implementation catches up.
- `patchwork`: useful API/check abstractions, wrong workflow archetype for Ultraplan.
- `pr-agent`: best breadth of real provider integrations.
- `pr-agent-youtube`: extension UX ideas are good, but it is not a primary integration model.
- `qwen-code-review`: strong local-first architecture; PR automation remains GitHub-specific.
- `qwen-code-review-docs`: notable for base-branch rule-loading, but evidence quality is thin.
- `review-board`: mature provider registry and webhook patterns, but too heavy for drop-in adoption.
- `reviewdog`: best CLI-first universal integration surface.
- `reviewdog-github-actions`: gold-standard GitHub setup simplicity, with known fork limits.
- `reviewdog-swiftlint-youtube`: good demonstration of the linter-output pipe model.

## Open Questions

- Qwen's docs describe a GitHub App review path, but the repo analysis found a GitHub Action workflow instead. It is unclear whether the docs are ahead of, behind, or divergent from implementation (`reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md:21-27`, `sources/qwen-code-review-docs.md:80-85`; `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:30-37`, `.github/workflows/qwen-code-pr-review.yml:1-190`).
- Alex Ellis's report gives strong auth and isolation evidence but does not enumerate exact GitHub App permission scopes (`reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:66-80`, `sources/alex-ellis-ai-code-review-bot.md:181`).
- Transcript-only sources leave unresolved questions around exact tokens, scopes, and failure modes.
- The kasidit README describes missing files as if implemented; the repo report shows they are absent, so future synthesis dimensions should treat it as design intent unless code appears (`reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer.md:82-83`, `init.sh:1-79`).

## Evidence Index

Every evidence reference in this report follows the `path/to/file.ts:NN` format. Below is a consolidated index.

- `reports/source/01-review-entrypoints-and-integrations/alex-ellis-ai-code-review-bot.md:25-39`, `43-63`, `102-129`, `223-248`; `sources/alex-ellis-ai-code-review-bot.md:88-96`, `128-131`, `141-147`, `181`
- `reports/source/01-review-entrypoints-and-integrations/canonical-maas-code-reviewer.md:22-24`, `41-56`, `62-74`, `80-91`, `97-112`, `134-145`; `.github/workflows/review-pr.yml:1-50`, `10-12`; `src/maas_code_reviewer/cli.py:197-253`; `src/maas_code_reviewer/reviewer.py:87-147`
- `reports/source/01-review-entrypoints-and-integrations/continue-pr-review-bot.md:17-29`, `40-50`, `61-82`, `102-114`, `150-157`; `continue-pr-review-bot.md:80-84`, `86-89`, `104-111`, `147-153`, `202-215`
- `reports/source/01-review-entrypoints-and-integrations/danger-js.md:15-18`, `55-79`, `85-123`, `126-153`, `157-172`; `lib/danger/ci_source/ci_source.rb:7`; `lib/danger/request_sources/request_source.rb:5`; `lib/danger/request_sources/github/github.rb:21-27`, `66-78`; `lib/danger/danger_core/environment_manager.rb:91-101`
- `reports/source/01-review-entrypoints-and-integrations/dangerjs-youtube.md:14-18`, `46-56`, `92-117`, `186-200`; `sources/dangerjs-youtube.md:143-155`, `182-193`
- `reports/source/01-review-entrypoints-and-integrations/gerrit.md:34-59`, `62-85`, `133-155`, `158-189`, `286-299`; `java/com/google/gerrit/server/git/receive/ReceiveCommits.java:205`; `java/com/google/gerrit/server/events/EventBroker.java:86`; `java/com/google/gerrit/server/events/StreamEventsApiListener.java:74-108`; `java/com/google/gerrit/server/permissions/PermissionBackend.java`
- `reports/source/01-review-entrypoints-and-integrations/gerrit-ai-youtube.md:17-46`, `69-92`, `99-133`, `138-149`, `205-217`; `gerrit-ai-youtube.md:141-158`, `187-201`, `280-292`, `319-373`
- `reports/source/01-review-entrypoints-and-integrations/github-agent-pr-review-policy.md:17-30`, `57-79`, `82-108`, `157-169`
- `reports/source/01-review-entrypoints-and-integrations/huggingface-ai-reviewer.md:14-21`, `26-57`, `60-73`, `76-95`, `162-183`, `184-194`, `246-276`; `action.yml:70-73`, `79-111`; `pyproject.toml:34-37`; `reviewbot/app.py:66-90`; `reviewbot/webapp.py:28-32`, `317`, `599`, `942-964`, `1659`; `reviewbot/github_auth.py:25-43`; `reviewbot/triggers.py:1-85`
- `reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer.md:12-24`, `28-37`, `40-54`, `71-83`, `171-185`; `README.md:33-40`, `87-91`, `99`; `cmd/ai-code-reviewer/main.go:9-11`; `init.sh:1-79`
- `reports/source/01-review-entrypoints-and-integrations/kasidit-ai-code-reviewer-readme.md:10-22`, `25-39`, `57-71`, `74-88`, `91-109`, `223-247`; `sources/kasidit-ai-code-reviewer-readme.md:38-62`, `49-51`, `55-60`, `103-107`, `113-125`
- `reports/source/01-review-entrypoints-and-integrations/patchwork.md:9-18`, `27-35`, `57-63`, `91-100`, `111-129`, `146-157`; `patchwork/parser.py:158-214`, `879-1042`, `1192-1512`; `patchwork/api/check.py:99-116`; `patchwork/settings/base.py:180-184`
- `reports/source/01-review-entrypoints-and-integrations/pr-agent.md:11-27`, `43-52`, `96-108`, `112-144`, `163-173`, `190-223`, `278-289`; `pr_agent/agent/pr_agent.py:24-44`, `50`; `pr_agent/git_providers/__init__.py:17-27`; `pr_agent/git_providers/git_provider.py:74`; `pr_agent/servers/github_app.py:38-54`, `77-206`; `pr_agent/servers/utils.py:10-25`
- `reports/source/01-review-entrypoints-and-integrations/pr-agent-youtube.md:11-18`, `22-29`, `41-50`, `76-84`, `127-131`
- `reports/source/01-review-entrypoints-and-integrations/qwen-code-review.md:14-37`, `86-113`, `118-135`, `144-170`, `174-190`, `243-256`; `.github/workflows/qwen-code-pr-review.yml:1-190`, `22-25`, `34-35`, `42-48`, `53`; `packages/cli/src/nonInteractiveCli.ts:191`; `packages/cli/src/commands/review.ts:19-39`; `packages/cli/src/commands/review/lib/gh.ts:61-68`; `packages/channels/base/src/ChannelBase.ts:17`
- `reports/source/01-review-entrypoints-and-integrations/qwen-code-review-docs.md:14-27`, `41-52`, `56-64`, `97-120`, `123-143`, `184-197`; `sources/qwen-code-review-docs.md:20`, `48-55`, `59-68`, `80-85`, `113-116`
- `reports/source/01-review-entrypoints-and-integrations/review-board.md:31-50`, `74-102`, `105-118`, `122-133`, `156-166`, `215-226`, `230-242`; `reviewboard/hostingsvcs/base/hosting_service.py`; `reviewboard/hostingsvcs/base/registry.py:37`, `207-234`; `reviewboard/hostingsvcs/hook_utils.py:46-91`, `94-160`, `202-290`; `reviewboard/notifications/webhooks.py`; `reviewboard/manage.py:336`
- `reports/source/01-review-entrypoints-and-integrations/reviewdog.md:14-24`, `27-46`, `49-82`, `84-95`, `98-156`, `160-188`; `reviewdog.go:48-79`; `cmd/reviewdog/main.go:282-468`, `710-713`; `cienv/cienv.go:37-104`; `service/github/github.go:236-251`; `doghouse/appengine/main.go:66-116`; `doghouse/server/github.go:25-38`
- `reports/source/01-review-entrypoints-and-integrations/reviewdog-github-actions.md:15-26`, `30-41`, `45-68`, `71-82`, `115-157`, `160-177`; `sources/reviewdog-github-actions.md:34-35`, `117-123`
- `reports/source/01-review-entrypoints-and-integrations/reviewdog-swiftlint-youtube.md:21-33`, `51-83`, `120-147`, `164-221`, `225-259`; `sources/reviewdog-swiftlint-youtube.md:34-54`, `65-72`

---

Generated by dimension `dimensions/01-review-entrypoints-and-integrations.md`.
