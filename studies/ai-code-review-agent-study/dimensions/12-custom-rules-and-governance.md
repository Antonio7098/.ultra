# Dimension 12: Custom Rules & Governance

## Purpose

Understand how code review agents allow teams to define custom rules, governance policies, coding standards, compliance requirements, and project-specific review contracts.

## Background

Generic code review agents are useful, but the highest-value reviewer understands the project's own rules. For Ultraplan, this is central. The reviewer should be able to read operational contracts, sprint-specific guidance, feature requirements, architectural decisions, and team standards, then use them to assess whether a PR actually complies with intended direction.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify custom rule configuration.
   * Check whether rules can be stored in repo files.
   * Determine whether rules are machine-readable, natural-language, or both.
   * Inspect how rule violations are reported.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/12-custom-rules-and-governance/{repo-name}.md`.

## Evidence

For each repo, collect:

* Rule configuration files
* Policy templates
* Repo-level config examples
* Governance or compliance features
* Rule-to-finding mapping
* Examples of custom rule violations
* Documentation for customising behaviour

## Questions

1. Can users define custom review rules?
2. Are rules written in natural language, config, code, or all three?
3. Can rules be scoped by language, file path, module, or severity?
4. Can findings reference the exact rule they violate?
5. Can rules be version-controlled with the repository?
6. Does the system support organisation-level and repo-level policies?
7. How well would this map to Ultraplan contracts, sprint handbooks, and feature docs?

## Analysis Axes

* **Rule expressiveness**: Can real engineering policies be encoded?
* **Traceability**: Can findings cite the violated rule?
* **Scoping**: Can rules apply only where relevant?
* **Versionability**: Can policy evolve with the repo?
* **Governance fit**: Does it support audit-friendly review?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                         |
| ----- | ------------------------------------------------------------------------------- |
| 1–3   | No meaningful custom rule support                                               |
| 4–6   | Basic custom instructions but weak traceability                                 |
| 7–8   | Strong repo-level rules with useful scoping                                     |
| 9–10  | Excellent governance system with rule IDs, evidence, severity, and audit trails |

Fast heuristic:

> "Could I encode my team's review standards and see exactly which rule a PR violated?"

## Output

Write findings to `reports/source/12-custom-rules-and-governance/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Rule system design
* Configuration format
* Scoping model
* Violation reporting strategy
* Ultraplan governance adaptation ideas