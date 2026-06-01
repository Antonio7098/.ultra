# Dimension 02: PR Diff Ingestion & Normalisation

## Purpose

Understand how code review agents fetch, parse, normalise, and represent pull request diffs before passing them into review logic.

## Background

Naive AI review systems often just paste `git diff` into a prompt. Better systems treat the diff as structured data: changed files, hunks, added lines, removed lines, renamed files, deleted files, binary files, generated files, and line mappings. This structure is essential for accurate inline comments, filtering noise, and avoiding hallucinated file references.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Locate the code responsible for fetching PR diffs.
   * Identify the internal representation of files, hunks, and changed lines.
   * Check how renamed, deleted, generated, and binary files are handled.
   * Trace how diff data flows into the review engine.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/02-pr-diff-ingestion-and-normalisation/{repo-name}.md`.

## Evidence

For each repo, collect:

* Diff fetching code
* API calls to GitHub/GitLab/etc.
* Internal diff data structures
* File filtering logic
* Hunk parsing logic
* Tests around diff parsing
* Examples of generated review comments

## Questions

1. Does the tool use raw diffs or structured diff objects?
2. How are changed files represented internally?
3. How are line numbers mapped back to PR comments?
4. Does it ignore generated files, lockfiles, vendored files, or binaries?
5. How does it handle renamed, deleted, and moved files?
6. Can the diff representation support multi-file reasoning?
7. How easy would it be to reuse this diff model in Ultraplan?

## Analysis Axes

* **Diff structure**: Raw text vs typed model
* **Line mapping accuracy**: Can findings be attached to the right line?
* **Noise filtering**: Does it avoid reviewing irrelevant files?
* **Edge-case handling**: Renames, deletes, binaries, generated files
* **Reusability**: Can the diff layer be separated from the review layer?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                       |
| ----- | ------------------------------------------------------------- |
| 1–3   | Dumps raw diff text with little structure                     |
| 4–6   | Basic file and hunk parsing but limited edge-case handling    |
| 7–8   | Clean structured diff model with reliable line mapping        |
| 9–10  | Robust diff ingestion layer suitable for production PR review |

Fast heuristic:

> "Would I trust this system to place inline comments on the correct PR lines?"

## Output

Write findings to `reports/source/02-pr-diff-ingestion-and-normalisation/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Diff ingestion flow
* Internal diff representation
* File filtering rules
* Line mapping strategy
* Failure modes and tradeoffs