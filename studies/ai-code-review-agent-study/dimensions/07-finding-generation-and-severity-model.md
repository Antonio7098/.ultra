# Dimension 07: Finding Generation & Severity Model

## Purpose

Understand how code review agents represent, classify, score, and prioritise findings.

## Background

A useful reviewer does not just produce comments. It produces findings with type, severity, confidence, location, rationale, suggested fix, and evidence. Without a structured finding model, AI review becomes noisy and hard to govern. Severity models are especially important because review agents can overwhelm developers with minor comments unless they rank issues clearly.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Locate the internal representation of review findings.
   * Identify severity, confidence, category, and location fields.
   * Check whether findings are deduplicated or ranked.
   * Inspect how findings are converted into PR comments.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/07-finding-generation-and-severity-model/{repo-name}.md`.

## Evidence

For each repo, collect:

* Finding/result data structures
* Severity definitions
* Confidence definitions
* Category/taxonomy definitions
* Output schemas
* Comment rendering code
* Examples of review output

## Questions

1. What is the smallest unit of review output?
2. Does each finding have a category?
3. Does each finding have severity?
4. Does each finding have confidence?
5. Are findings deduplicated?
6. Are low-value comments filtered out?
7. Does the model distinguish blockers from suggestions?
8. How suitable is the finding model for governance and audit trails?

## Analysis Axes

* **Finding structure**: Free text vs structured object
* **Severity clarity**: Are levels meaningful and actionable?
* **Confidence modelling**: Does the tool acknowledge uncertainty?
* **Prioritisation**: Are important issues surfaced first?
* **Auditability**: Can findings be traced back to evidence?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                       |
| ----- | ----------------------------------------------------------------------------- |
| 1–3   | Unstructured comments with no useful severity model                           |
| 4–6   | Basic categories or severity but inconsistent usage                           |
| 7–8   | Structured findings with clear prioritisation                                 |
| 9–10  | Excellent finding model with severity, confidence, evidence, and auditability |

Fast heuristic:

> "Could a team use this output to decide whether a PR should be blocked?"

## Output

Write findings to `reports/source/07-finding-generation-and-severity-model/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Finding schema
* Severity model
* Confidence model
* Deduplication/ranking strategy
* Applicability to Ultraplan review reports