# Dimension 15: Observability, Cost & Evaluation

## Purpose

Understand how code review agents measure quality, track failures, monitor cost, evaluate review accuracy, and improve over time.

## Background

AI review agents can become expensive and unreliable if they are not measured. A serious system needs logging, tracing, token accounting, model cost tracking, review metrics, false-positive analysis, latency monitoring, and evaluation datasets. Without observability, it is impossible to know whether the reviewer is getting better or just producing plausible comments.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify logging and tracing.
   * Look for token/cost tracking.
   * Check whether reviews are evaluated against datasets or golden examples.
   * Inspect metrics around latency, failures, and model usage.
   * Identify whether users can give feedback on review comments.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/15-observability-cost-and-evaluation/{repo-name}.md`.

## Evidence

For each repo, collect:

* Logging code
* Telemetry/tracing integrations
* Token usage tracking
* Cost estimation logic
* Evaluation scripts
* Test fixtures for review quality
* User feedback mechanisms
* Metrics dashboards if present

## Questions

1. Does the system log each review stage?
2. Does it track model usage and cost?
3. Does it expose review latency?
4. Does it evaluate review quality?
5. Does it measure false positives and false negatives?
6. Can users provide feedback on comments?
7. Can maintainers compare prompt/model versions?
8. Is there enough observability to debug bad reviews?

## Analysis Axes

* **Runtime visibility**: Can operators see what happened?
* **Cost awareness**: Are token and model costs tracked?
* **Quality evaluation**: Is review usefulness measured?
* **Debuggability**: Can bad findings be traced back to inputs and prompts?
* **Improvement loop**: Can the system learn from review outcomes?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                                |
| ----- | -------------------------------------------------------------------------------------- |
| 1–3   | Little visibility into cost, quality, or failures                                      |
| 4–6   | Basic logs but weak evaluation and cost tracking                                       |
| 7–8   | Good observability with cost and quality signals                                       |
| 9–10  | Excellent evaluation loop with tracing, feedback, cost control, and regression testing |

Fast heuristic:

> "Could I explain why this reviewer made a bad comment and prevent it happening again?"

## Output

Write findings to `reports/source/15-observability-cost-and-evaluation/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Logging and tracing model
* Cost tracking approach
* Evaluation strategy
* Feedback mechanisms
* Ultraplan observability recommendations