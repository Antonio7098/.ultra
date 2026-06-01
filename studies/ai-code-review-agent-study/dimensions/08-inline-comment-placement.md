# Dimension 08: Inline Comment Placement

## Purpose

Understand how code review systems decide where to place inline comments and how they ensure comments are valid, precise, and useful inside pull request diffs.

## Background

Inline comments are one of the hardest parts of building a PR review agent. The model may identify a real issue but attach it to the wrong line, comment on unchanged code, or reference a line that does not exist in the PR diff. Good systems separate finding generation from comment placement and validate that comments can actually be posted.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Locate the code that maps findings to PR lines.
   * Identify how comments are positioned inside changed hunks.
   * Check whether comments on unchanged lines are allowed or avoided.
   * Inspect how invalid comments are handled.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/08-inline-comment-placement/{repo-name}.md`.

## Evidence

For each repo, collect:

* PR comment publishing code
* Line mapping utilities
* Diff hunk models
* Comment validation code
* Fallback behaviour for invalid line comments
* Examples of inline comments
* Tests around comment placement

## Questions

1. How does the system choose the target line for a comment?
2. Does it only comment on changed lines?
3. Can it comment on file-level or PR-level issues?
4. How does it handle findings that span multiple lines or files?
5. What happens if the target line is invalid?
6. Are comments validated before publishing?
7. How precise and developer-friendly are the final comments?

## Analysis Axes

* **Placement precision**: Does the comment land on the most relevant line?
* **API correctness**: Does it respect GitHub/GitLab commenting constraints?
* **Fallback strategy**: Can it still report issues when inline placement fails?
* **Multi-line support**: Can it handle larger code regions?
* **Developer experience**: Are comments easy to act on in the PR UI?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                    |
| ----- | -------------------------------------------------------------------------- |
| 1–3   | Comments are often misplaced or invalid                                    |
| 4–6   | Basic line placement works but has weak edge-case handling                 |
| 7–8   | Reliable inline comments with sensible fallbacks                           |
| 9–10  | Excellent placement accuracy with robust validation and multi-line support |

Fast heuristic:

> "Would the developer know exactly what code the reviewer is talking about?"

## Output

Write findings to `reports/source/08-inline-comment-placement/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Comment placement strategy
* Line mapping mechanism
* Validation behaviour
* Edge cases
* Patterns to use in Ultraplan