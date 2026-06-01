# Dimension 01: Review Entrypoints & Platform Integrations

## Purpose

Understand how open-source code review agents connect to developer workflows, especially GitHub pull requests, GitLab merge requests, CI pipelines, webhooks, and local CLI execution.

## Background

A code review agent is only useful if it appears in the right place at the right time. Tools like CodeRabbit feel powerful because they are embedded into the pull request workflow. Open-source alternatives often support different entrypoints: GitHub Apps, GitHub Actions, CLI commands, webhook servers, or bots. Each integration model creates tradeoffs around setup complexity, permissions, latency, security, and user experience.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify all supported entrypoints.
   * Determine whether the tool runs as a GitHub App, GitHub Action, CLI, webhook service, or hosted server.
   * Trace how a pull request event enters the system.
   * Identify how authentication and repository access are handled.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/01-review-entrypoints-and-integrations/{repo-name}.md`.

## Evidence

For each repo, collect:

* Installation instructions
* GitHub/GitLab/Azure DevOps integration code
* Webhook handlers
* CLI commands
* CI workflow examples
* Required permissions/scopes
* Configuration examples

## Questions

1. What are the supported ways to trigger a review?
2. Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?
3. How does it authenticate with the code hosting platform?
4. What repository permissions does it require?
5. How hard would it be to install this in a private repo?
6. Does the integration model create security or operational risks?
7. Which integration model would be easiest to adapt for Ultraplan?

## Analysis Axes

* **Workflow fit**: Does the agent naturally fit into PR review?
* **Installation complexity**: How much setup is required?
* **Permission minimisation**: Does it ask only for necessary permissions?
* **Portability**: Can the same review engine run across platforms?
* **Self-hostability**: Can users run it without depending on a SaaS service?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                              |
| ----- | -------------------------------------------------------------------- |
| 1–3   | Hardcoded, fragile, or platform-specific integration                 |
| 4–6   | Works for one platform but has awkward setup or broad permissions    |
| 7–8   | Clean integration with understandable auth and trigger flow          |
| 9–10  | Excellent multi-entrypoint design with secure, portable integrations |

Fast heuristic:

> "Could I add this review agent to a private GitHub repo in under an hour?"

## Output

Write findings to `reports/source/01-review-entrypoints-and-integrations/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Supported entrypoints
* Authentication model
* Platform-specific assumptions
* Operational tradeoffs
* Patterns worth copying into Ultraplan