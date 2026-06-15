# qwen-code-review-docs

## Scope

- Source studied: `sources/qwen-code-review-docs.md:1-123`
- Dimension: PR Diff Ingestion & Normalisation
- Score: `5/10`

## Summary

This source is documentation-only. The document claims that Qwen Code parses unified diffs into structured per-file and per-hunk context, maps findings back to specific line numbers, supports multiple file types, applies file type filtering, and posts inline PR comments (`sources/qwen-code-review-docs.md:33-45`, `sources/qwen-code-review-docs.md:64-68`, `sources/qwen-code-review-docs.md:102-107`). That suggests a design more structured than simply pasting raw `git diff` into a prompt.

The main limitation is evidence quality. I found no implementation files, tests, API call examples, schemas, or concrete internal types in `sources/qwen-code-review-docs.md:1-123`. The document does not show how files, hunks, or changed lines are actually represented; how renamed, deleted, moved, generated, or binary files are encoded; or how GitHub comment coordinates are computed. Because the claims are high-level and unverified, this looks like a documented intent for a moderately capable diff layer rather than a demonstrably robust one.

## Diff Ingestion Flow

The documented flow is:

1. A review is triggered for a PR through `qwen code review --pr <pr-number>` (`sources/qwen-code-review-docs.md:57-68`) or via a GitHub App that listens for PR events and automatically triggers reviews (`sources/qwen-code-review-docs.md:80-85`).
2. The tool analyzes PR diffs and claims to parse unified diff format into structured per-file, per-hunk context (`sources/qwen-code-review-docs.md:33-36`).
3. The review system loads additional repository context and custom rules from `.qwen/rules/`, explicitly from the base branch rather than the PR branch (`sources/qwen-code-review-docs.md:38-41`, `sources/qwen-code-review-docs.md:48-55`, `sources/qwen-code-review-docs.md:72-76`).
4. The system produces summary comments, inline comments, file-level comments, and suggested fixes (`sources/qwen-code-review-docs.md:100-107`).

No clear evidence found for the actual diff fetching code, GitHub API endpoints, payload formats, retry logic, pagination, or how the parsed diff object flows into the model prompt. I searched only the provided document boundary at `sources/qwen-code-review-docs.md:1-123`, per instruction.

## Internal Diff Representation

The document explicitly claims a structured diff view at the file and hunk level: "Parses unified diff format into structured per-file, per-hunk context" (`sources/qwen-code-review-docs.md:33-35`). This is evidence that the intended model is not purely raw diff text.

Beyond that, no concrete internal representation is documented. No evidence found for:

- File object fields such as filename, old path, new path, status, additions, deletions, or patch text.
- Hunk object fields such as header, old start line, new start line, or line arrays.
- A changed-line model for additions, deletions, and context lines.
- A typed schema, class, interface, or JSON structure.

Because `sources/qwen-code-review-docs.md:33-36` is the only structural statement, the strongest supported conclusion is: Qwen Code is documented as using structured diff objects conceptually, but the actual data model is not exposed in this source.

## File Filtering Rules

The document mentions "File type filtering" as a command option and says the diff analysis "Handles multiple file types" (`sources/qwen-code-review-docs.md:33-36`, `sources/qwen-code-review-docs.md:64-68`). That implies some filtering or scoping capability.

No clear evidence found for the actual rules. The document does not specify:

- Which file types are included or excluded.
- Whether generated files are detected.
- Whether lockfiles are ignored.
- Whether vendored directories are ignored.
- Whether binary files are skipped.
- Whether the `max_files` configuration limits by changed-file count before or after filtering.

The only related configuration mention is `max_files` (`sources/qwen-code-review-docs.md:111-116`), but the document does not connect it to a concrete filtering pipeline.

## Line Mapping Strategy

The document says Qwen Code "Maps findings back to specific line numbers" and "Posts comments on specific lines in the PR" (`sources/qwen-code-review-docs.md:34-35`, `sources/qwen-code-review-docs.md:43-45`). That is direct evidence that inline comment placement is part of the design.

No clear evidence found for the mapping algorithm. The document does not show:

- Whether comments are attached using GitHub diff `position`, blob `line`, or multi-line review coordinates.
- How line numbers are derived from unified diff hunks.
- How unchanged context lines are counted.
- How deleted-line comments are handled.
- How the system validates that a model finding still maps to a live diff location.

As a result, I cannot verify line-mapping accuracy from `sources/qwen-code-review-docs.md:1-123`. The source establishes intent, not mechanism.

## Renames, Deletes, Moves, Generated Files, Binaries

No clear evidence found for rename, delete, move, generated-file, or binary-file handling in the document.

What the document does say:

- It parses unified diffs into file and hunk context (`sources/qwen-code-review-docs.md:33-35`).
- It supports file type filtering (`sources/qwen-code-review-docs.md:64-68`).
- It can produce file-level comments for issues spanning multiple lines (`sources/qwen-code-review-docs.md:104-107`).

What is missing:

- No explicit rename or move model.
- No explicit deleted-file handling.
- No binary-file exclusion behavior.
- No generated-file or vendored-file heuristics.
- No lockfile suppression rules.

Because the document is silent on these edge cases, they should be treated as unknown rather than assumed supported.

## Multi-File Reasoning Support

The document supports a cautious "yes" here. It states that the tool analyzes pull requests, parses diffs into structured per-file and per-hunk context, handles multiple file types, and can emit summary comments plus file-level comments (`sources/qwen-code-review-docs.md:20`, `sources/qwen-code-review-docs.md:33-36`, `sources/qwen-code-review-docs.md:102-107`). That implies the review engine can consider more than one file within a PR.

However, no clear evidence found for a cross-file intermediate representation, batching strategy, or prompt format that preserves relationships across files. Multi-file reasoning is documented at the feature level, not demonstrated in an inspectable diff model.

## Reusability For Ultraplan

This source is only moderately reusable as a design reference.

What seems reusable from the documented design:

- Use structured diff context instead of raw diff dumps (`sources/qwen-code-review-docs.md:33-35`).
- Preserve line mapping so comments can target specific PR lines (`sources/qwen-code-review-docs.md:34-35`, `sources/qwen-code-review-docs.md:43-45`).
- Support both inline comments and file-level comments (`sources/qwen-code-review-docs.md:102-107`).
- Load review rules from the base branch rather than the PR branch, which is a strong security pattern around contextual inputs (`sources/qwen-code-review-docs.md:48-55`, `sources/qwen-code-review-docs.md:118-123`).

What limits reuse:

- No concrete file or hunk schema is documented (`sources/qwen-code-review-docs.md:1-123`).
- No diff fetching API contract is documented (`sources/qwen-code-review-docs.md:80-85`, `sources/qwen-code-review-docs.md:111-116`).
- No line-mapping algorithm is documented (`sources/qwen-code-review-docs.md:34-35`, `sources/qwen-code-review-docs.md:43-45`).
- No tests or failure cases are provided (`sources/qwen-code-review-docs.md:1-123`).

Net: Ultraplan could copy the design goals, but not the implementation details, because this source does not expose them.

## Answers To The Dimension Questions

1. Does the tool use raw diffs or structured diff objects?

The document says it parses unified diff format into "structured per-file, per-hunk context," so it is described as using structured diff objects rather than only raw diff text (`sources/qwen-code-review-docs.md:33-35`). No concrete schema is shown.

2. How are changed files represented internally?

No clear evidence found. The closest statement is that diffs are structured per file and per hunk (`sources/qwen-code-review-docs.md:33-35`), but the document does not define file object fields or types.

3. How are line numbers mapped back to PR comments?

The document claims findings are mapped to specific line numbers and posted as line-specific PR comments (`sources/qwen-code-review-docs.md:34-35`, `sources/qwen-code-review-docs.md:43-45`). No implementation details are given for the mapping method.

4. Does it ignore generated files, lockfiles, vendored files, or binaries?

No clear evidence found. The document mentions file type filtering (`sources/qwen-code-review-docs.md:64-68`) but does not define concrete ignore rules for generated files, lockfiles, vendored files, or binaries.

5. How does it handle renamed, deleted, and moved files?

No clear evidence found in `sources/qwen-code-review-docs.md:1-123`.

6. Can the diff representation support multi-file reasoning?

Probably yes at a feature level, because the tool reviews pull requests, handles multiple file types, and emits summary plus file-level comments (`sources/qwen-code-review-docs.md:20`, `sources/qwen-code-review-docs.md:33-36`, `sources/qwen-code-review-docs.md:102-107`). No concrete cross-file representation is documented.

7. How easy would it be to reuse this diff model in Ultraplan?

Only moderately easy as a conceptual reference. The documented principles are useful, but the actual model is not described in enough detail to reuse directly (`sources/qwen-code-review-docs.md:33-35`, `sources/qwen-code-review-docs.md:48-55`, `sources/qwen-code-review-docs.md:102-107`).

## Failure Modes And Tradeoffs

- Documentation-to-implementation gap: the document promises structured parsing and accurate line mapping, but there is no inspectable mechanism to verify either claim (`sources/qwen-code-review-docs.md:33-35`, `sources/qwen-code-review-docs.md:43-45`).
- Filtering ambiguity: `max_files` and file type filtering are mentioned, but the interaction between them is undocumented, so it is unclear whether important files could be skipped or noisy files included (`sources/qwen-code-review-docs.md:64-68`, `sources/qwen-code-review-docs.md:111-116`).
- Edge-case uncertainty: rename, delete, move, generated-file, and binary handling are not described, which is a material gap for PR review correctness (`sources/qwen-code-review-docs.md:1-123`).
- Security coverage is uneven: base-branch rule loading is documented clearly and is a strong safeguard for rule inputs, but that security feature does not answer whether diff ingestion itself filters unsafe or irrelevant content well (`sources/qwen-code-review-docs.md:48-55`, `sources/qwen-code-review-docs.md:118-123`).

## Rating Rationale

Score: `5/10`

- Positive: the document explicitly describes structured per-file and per-hunk diff parsing, line-number mapping, inline PR comments, file type filtering, multi-file review outputs, and a security-conscious base-branch rule-loading model (`sources/qwen-code-review-docs.md:33-45`, `sources/qwen-code-review-docs.md:48-55`, `sources/qwen-code-review-docs.md:64-68`, `sources/qwen-code-review-docs.md:102-107`).
- Negative: there is no implementation evidence for diff fetchers, API calls, internal types, hunk parsing, line mapping, rename/delete handling, or binary/generated-file filtering anywhere in `sources/qwen-code-review-docs.md:1-123`.

Fast heuristic answer: I would not fully trust this source alone to prove that inline comments land on the correct PR lines, because it documents that capability but does not show how it works (`sources/qwen-code-review-docs.md:34-35`, `sources/qwen-code-review-docs.md:43-45`).

## Evidence Quality Note

This analysis is intentionally limited to the single documentation source at `sources/qwen-code-review-docs.md:1-123`, per the study instructions. No implementation files, tests, configuration files, API clients, or sample review payloads were available inside this source boundary. Every conclusion above is therefore either:

- A documented claim directly supported by `sources/qwen-code-review-docs.md`, or
- An explicit "No clear evidence found" statement scoped to `sources/qwen-code-review-docs.md:1-123`.
