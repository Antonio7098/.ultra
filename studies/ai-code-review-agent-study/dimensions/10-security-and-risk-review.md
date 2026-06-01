# Dimension 10: Security & Risk Review

## Purpose

Understand how code review agents detect security, privacy, dependency, secret-management, and operational-risk issues.

## Background

Security review is one of the most valuable applications of automated code review, but also one of the riskiest. LLMs may hallucinate vulnerabilities or miss subtle ones. Strong systems combine static security tools, dependency scanners, secret scanners, secure coding rules, and AI explanation. For enterprise use, the reviewer should distinguish confirmed vulnerabilities from risk hypotheses.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify security-specific review logic.
   * Check whether it integrates with tools like Semgrep, CodeQL, Trivy, Gitleaks, npm audit, pip-audit, or OSV.
   * Locate security prompts and risk categories.
   * Inspect how security findings are scored and reported.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/10-security-and-risk-review/{repo-name}.md`.

## Evidence

For each repo, collect:

* Security scanner integrations
* Security prompts
* Risk/severity categories
* Secret scanning support
* Dependency vulnerability handling
* Examples of security review output
* Suppression or allowlist mechanisms

## Questions

1. Does the system perform security-specific review?
2. Does it use deterministic security tools?
3. How does it classify security severity?
4. Does it detect secrets and credential leaks?
5. Does it detect dependency risk?
6. Does it distinguish confirmed vulnerabilities from possible concerns?
7. Could this become part of an enterprise security review workflow?

## Analysis Axes

* **Security coverage**: Code, secrets, dependencies, configs, auth, data exposure
* **Tool support**: Deterministic scanners vs LLM-only review
* **Severity quality**: Are security issues ranked appropriately?
* **Evidence quality**: Are claims grounded in code and scanner output?
* **Enterprise readiness**: Is the output suitable for compliance or audit?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                       |
| ----- | ----------------------------------------------------------------------------- |
| 1–3   | Generic security comments with little evidence                                |
| 4–6   | Some security review but limited tool support                                 |
| 7–8   | Strong security review with scanner integration                               |
| 9–10  | Excellent risk review with evidence, severity, and enterprise-grade reporting |

Fast heuristic:

> "Would a security-conscious team trust this reviewer to flag meaningful risk without creating panic?"

## Output

Write findings to `reports/source/10-security-and-risk-review/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Security review model
* Scanner integrations
* Risk taxonomy
* Evidence and severity handling
* Ultraplan security-review ideas