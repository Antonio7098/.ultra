# Dimension 09: False Positive Control & Verification

## Purpose

Understand how code review agents reduce hallucinations, speculative comments, duplicate findings, and low-value suggestions.

## Background

The biggest weakness of AI code review is noise. If a reviewer produces too many wrong, obvious, or subjective comments, developers will ignore it. High-quality systems need verification passes, confidence scoring, duplicate detection, evidence checks, and strict rules about when not to comment. A good reviewer should be comfortable saying nothing.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify any verification or self-review stages.
   * Check how the system filters speculative findings.
   * Look for deduplication, confidence thresholds, and severity thresholds.
   * Inspect prompt rules that discourage low-value comments.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/09-false-positive-control-and-verification/{repo-name}.md`.

## Evidence

For each repo, collect:

* Verification prompts
* Confidence scoring logic
* Deduplication code
* Filtering thresholds
* "Do not comment" instructions
* Examples of suppressed findings
* Tests or evals for review quality

## Questions

1. Does the system verify findings before publishing?
2. Does it require evidence from the diff or repo context?
3. Does it suppress low-confidence comments?
4. Does it deduplicate similar findings?
5. Does it avoid style nitpicks unless requested?
6. Can the system produce an empty review?
7. How does it balance recall against developer trust?

## Analysis Axes

* **Evidence discipline**: Are findings grounded in code?
* **Noise reduction**: Are weak comments filtered?
* **Verification depth**: Is there a second pass or structured check?
* **Deduplication**: Are repeated findings merged?
* **Developer trust**: Would developers keep this reviewer enabled?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                            |
| ----- | ------------------------------------------------------------------ |
| 1–3   | Noisy reviewer with many speculative comments                      |
| 4–6   | Some filtering but still prone to weak findings                    |
| 7–8   | Good verification and confidence filtering                         |
| 9–10  | Excellent false-positive control with strong evidence requirements |

Fast heuristic:

> "Would I trust this reviewer enough to let it comment on every PR?"

## Output

Write findings to `reports/source/09-false-positive-control-and-verification/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Verification strategy
* Filtering rules
* Deduplication approach
* Confidence handling
* Lessons for Ultraplan