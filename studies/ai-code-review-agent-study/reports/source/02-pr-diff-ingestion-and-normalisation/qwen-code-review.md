# qwen-code-review

## Dimension

PR Diff Ingestion & Normalisation

## Rating

**Score: 4/10**

`qwen-code-review` has a real PR-review workflow, but the review path still operates mostly on raw diff text instead of a typed PR diff model. Same-repo reviews fetch PR metadata and create an isolated worktree in `packages/cli/src/commands/review/fetch-pr.ts:86-173`, while cross-repo reviews explicitly use raw `gh pr diff <url>` text in `packages/core/src/skills/bundled/review/SKILL.md:34-39`. Inline-comment submission is anchored only by `(path, line)` pairs in `packages/core/src/skills/bundled/review/SKILL.md:538-572` and `packages/cli/src/commands/review/presubmit.ts:113-144`, with no review-specific hunk parser or diff-line validator in the `/review` implementation.

## Diff Ingestion Flow

For same-repo PR reviews, the deterministic entry point is `qwen review fetch-pr` in `packages/cli/src/commands/review/fetch-pr.ts:86-173`. That command:

- cleans stale review state in `packages/cli/src/commands/review/fetch-pr.ts:69-84`
- fetches `pull/<n>/head` into a local ref with `git fetch` in `packages/cli/src/commands/review/fetch-pr.ts:98-107`
- fetches PR metadata with `gh pr view --json ...` in `packages/cli/src/commands/review/fetch-pr.ts:109-131`
- creates a temporary worktree in `packages/cli/src/commands/review/fetch-pr.ts:133-145`
- writes a small JSON state report in `packages/cli/src/commands/review/fetch-pr.ts:147-172`

That JSON report contains only PR/worktree metadata, not parsed diff content: `prNumber`, `ownerRepo`, `remote`, `ref`, `fetchedSha`, `worktreePath`, `baseRefName`, `headRefName`, `isCrossRepository`, and `diffStat` in `packages/cli/src/commands/review/fetch-pr.ts:48-59` and `packages/cli/src/commands/review/fetch-pr.ts:148-163`.

The actual review scope remains a diff command string. The bundled `/review` skill tells agents to compute the incremental scope with `git diff <lastCommitSha>..HEAD` in `packages/core/src/skills/bundled/review/SKILL.md:63-67`, to use `git diff` / `git diff --staged` for local review in `packages/core/src/skills/bundled/review/SKILL.md:44-46`, and to pass review agents “the diff command” rather than structured diff data in `packages/core/src/skills/bundled/review/SKILL.md:164-169` and `packages/core/src/skills/bundled/review/SKILL.md:321-325`.

For cross-repo PRs, the workflow is even more explicit: lightweight mode runs `gh pr diff <url>` and skips local worktree-based analysis in `packages/core/src/skills/bundled/review/SKILL.md:34-39`. The user-facing docs repeat that cross-repo review is “based on the diff text only” in `docs/users/features/code-review.md:122-140`.

The GitHub Actions workflow follows the same pattern. It captures `gh pr diff --name-only` for changed files in `.github/workflows/qwen-code-pr-review.yml:70-76` and `.github/workflows/qwen-code-pr-review.yml:92-98`, then instructs the action to run `gh pr diff $PR_NUMBER` directly in `.github/workflows/qwen-code-pr-review.yml:126-140`.

## Internal Diff Representation

The `/review` path does not define a typed PR diff object for changed files, hunks, added lines, removed lines, or rename metadata.

What it does represent structurally is narrower:

- PR fetch metadata via `FetchPrResult` in `packages/cli/src/commands/review/fetch-pr.ts:48-59`
- PR context metadata plus previously posted comments via `PrMetadata`, `RawComment`, and `RawReview` in `packages/cli/src/commands/review/pr-context.ts:22-50`
- changed-file lists for deterministic tooling as a plain `string[]` in `packages/cli/src/commands/review/deterministic.ts:21-31`, `packages/cli/src/commands/review/deterministic.ts:75-87`
- review comment anchors as `{ path, line }` pairs in `packages/cli/src/commands/review/presubmit.ts:24-27` and `packages/core/src/skills/bundled/review/SKILL.md:484-497`

That means the review layer normalises PR context and comment anchors, but not the diff itself.

There is a stronger typed diff utility elsewhere in the repo: `GitDiffResult`, `PerFileStats`, and `fetchGitDiffHunks()` in `packages/core/src/utils/gitDiff.ts:27-52` and `packages/core/src/utils/gitDiff.ts:273-307`, plus `parseGitDiff()` in `packages/core/src/utils/gitDiff.ts:414-483`. That parser handles structured hunks, per-file caps, and path extraction. But I found no evidence that `/review` uses it; a repo-wide reference search only shows usages in the diff UI, not in `packages/cli/src/commands/review/*.ts`.

## Line Mapping Strategy

Inline comments are submitted through GitHub’s Create Review API with `path` and `line` fields, not `position`, in `packages/core/src/skills/bundled/review/SKILL.md:538-572`. The skill is explicit that every inline comment must map to a valid diff line and that unmappable findings must fall back into the review body in `packages/core/src/skills/bundled/review/SKILL.md:538-560`.

Before submit, overlap detection also works only on `(path, line)` pairs. `packages/cli/src/commands/review/presubmit.ts:113-144` classifies existing comments by `path`, `line`, and `commit_id`, and `packages/cli/src/commands/review/presubmit.ts:200-211` builds `newFindingKeys` as `${path}:${line}`. The docs describe the same-line-overlap policy in `docs/users/features/code-review.md:164-168`.

This gives the system a minimal anchor model for publishing comments, but no internal mapping from hunk offsets to PR-review coordinates. I found no review-specific parser for hunks, no validation that a proposed line is actually in the changed side of the diff, and no handling of multi-line ranges such as `start_line` / `side`. The effective strategy is: let the LLM read raw diff text, choose a `(path, line)`, and rely on GitHub’s review API to accept or reject it.

## File Filtering Rules

The clearest implemented filter is for deterministic analysis, not for the review diff itself. The skill instructs the pipeline to exclude deleted files from changed-file lists with `git diff --diff-filter=d --name-only` or equivalent in `packages/core/src/skills/bundled/review/SKILL.md:108-110`. The deterministic runner then consumes a plain `changedFiles: string[]` and filters diagnostics to those files in `packages/cli/src/commands/review/deterministic.ts:21-31`, `packages/cli/src/commands/review/deterministic.ts:75-87`, and `packages/cli/src/commands/review/deterministic.ts:152-165`.

I found **no clear evidence** that the `/review` diff ingestion layer ignores generated files, lockfiles, vendored files, or binaries before sending diff text to review agents. I specifically searched the review implementation and skill instructions and found deleted-file handling, but not review-specific generated/binary noise filters in `packages/core/src/skills/bundled/review/SKILL.md:108-110` and `packages/cli/src/commands/review/fetch-pr.ts:86-173`.

## Edge Cases

### Renamed, deleted, moved files

- Deleted files are explicitly excluded from deterministic changed-file lists in `packages/core/src/skills/bundled/review/SKILL.md:108-110`.
- Renamed or removed public methods are mentioned only as review concerns for cross-file analysis in `packages/core/src/skills/bundled/review/SKILL.md:301-309`; this is not diff normalisation.
- I found **no clear evidence** that `/review` has a typed representation for renamed or moved files before LLM review. Same-repo review depends on raw `git diff` text in `packages/core/src/skills/bundled/review/SKILL.md:63-67`, `packages/core/src/skills/bundled/review/SKILL.md:164-169`, and `packages/core/src/skills/bundled/review/SKILL.md:321-325`.

### Binary files

I found **no clear evidence** that `/review` explicitly filters binary files before handing the diff to review agents. The separate reusable diff utility can represent binary files in `packages/core/src/utils/gitDiff.ts:33-47` and parses binary `numstat` rows in `packages/core/src/utils/gitDiff.ts:320-376`, but that utility is not wired into the review path.

### Generated / vendored / lockfiles

I found **no clear evidence** of explicit review-time suppression rules for generated files, vendored code, or lockfiles in `packages/cli/src/commands/review/*.ts` or `packages/core/src/skills/bundled/review/SKILL.md:28-172`.

## Flow Into Review Logic

The flow into actual review logic is prompt-driven rather than model-driven:

1. `qwen review fetch-pr` builds worktree + metadata in `packages/cli/src/commands/review/fetch-pr.ts:86-173`.
2. `qwen review pr-context` builds a Markdown context file from PR metadata and prior comment threads in `packages/cli/src/commands/review/pr-context.ts:245-289`.
3. deterministic analysis writes JSON findings keyed to changed files in `packages/cli/src/commands/review/deterministic.ts:21-31` and `packages/cli/src/commands/review/deterministic.ts:75-87`.
4. the `/review` skill launches agents with a diff command, not a parsed diff object, in `packages/core/src/skills/bundled/review/SKILL.md:162-169`.
5. verification also receives “the command to obtain the diff” instead of structured diff data in `packages/core/src/skills/bundled/review/SKILL.md:321-325`.
6. PR submission converts final findings to Create Review JSON with `comments[].path` and `comments[].line` in `packages/core/src/skills/bundled/review/SKILL.md:540-572`.

## Tests

I found **no clear evidence** of dedicated tests for `packages/cli/src/commands/review/fetch-pr.ts:86-173`, `packages/cli/src/commands/review/pr-context.ts:245-289`, or `packages/cli/src/commands/review/presubmit.ts:146-255`. A repo-wide search for `fetch-pr|pr-context|presubmit` in `*.test.*` returned no matches.

There **are** strong tests for the reusable diff parser in `packages/core/src/utils/gitDiff.test.ts:168-215`, `packages/core/src/utils/gitDiff.test.ts:466-664`, and `packages/core/src/utils/gitDiff.test.ts:990-1093`, including rename-only diffs, quoted-path handling, caps, and external-diff suppression. Those tests increase confidence in the parser itself, but not in the `/review` PR-ingestion path because I found no evidence of integration.

## Answers

### 1. Does the tool use raw diffs or structured diff objects?

Mostly raw diffs. Same-repo review uses `git diff ...` commands as the review scope in `packages/core/src/skills/bundled/review/SKILL.md:63-67`, `packages/core/src/skills/bundled/review/SKILL.md:164-169`, and `packages/core/src/skills/bundled/review/SKILL.md:321-325`. Cross-repo review explicitly uses `gh pr diff <url>` in `packages/core/src/skills/bundled/review/SKILL.md:34-39`. Structured objects exist only for metadata and comment anchors in `packages/cli/src/commands/review/fetch-pr.ts:48-59`, `packages/cli/src/commands/review/pr-context.ts:22-50`, and `packages/cli/src/commands/review/presubmit.ts:24-35`.

### 2. How are changed files represented internally?

As small metadata structures plus plain filename lists, not as typed changed-file diff objects. `FetchPrResult.diffStat` stores counts in `packages/cli/src/commands/review/fetch-pr.ts:48-59`. Deterministic analysis uses `changedFiles: string[]` in `packages/cli/src/commands/review/deterministic.ts:21-31` and `packages/cli/src/commands/review/deterministic.ts:75-87`. Inline-comment dedupe uses `{ path, line }` anchors in `packages/cli/src/commands/review/presubmit.ts:24-27`.

### 3. How are line numbers mapped back to PR comments?

By direct `(path, line)` submission through GitHub’s Create Review API in `packages/core/src/skills/bundled/review/SKILL.md:538-572`. Existing-comment overlap detection also keys on `(path, line)` in `packages/cli/src/commands/review/presubmit.ts:113-144` and `packages/cli/src/commands/review/presubmit.ts:200-211`. I found no internal hunk-to-line mapping layer.

### 4. Does it ignore generated files, lockfiles, vendored files, or binaries?

Only deleted-file exclusion is clearly implemented for deterministic analysis in `packages/core/src/skills/bundled/review/SKILL.md:108-110`. No clear evidence found for generated-file, lockfile, vendored-file, or binary filtering in the `/review` ingestion path.

### 5. How does it handle renamed, deleted, and moved files?

Deleted files are filtered out of deterministic changed-file lists in `packages/core/src/skills/bundled/review/SKILL.md:108-110`. For renames and moves, I found no typed review-side handling; the system appears to depend on raw diff text from `git diff` or `gh pr diff` in `packages/core/src/skills/bundled/review/SKILL.md:34-39` and `packages/core/src/skills/bundled/review/SKILL.md:63-67`. A separate parser elsewhere can represent rename-style entries in `packages/core/src/utils/gitDiff.ts:312-376`, but I found no evidence that `/review` uses it.

### 6. Can the diff representation support multi-file reasoning?

Yes at the prompt level, not at the model level. Agents are instructed to reason across files and callers in `packages/core/src/skills/bundled/review/SKILL.md:246-301`, and same-repo reviews run inside a full worktree created by `packages/cli/src/commands/review/fetch-pr.ts:133-145`. But the diff representation itself is still raw text plus filenames, so cross-file reasoning comes from repo search and file reads, not from a structured multi-file diff graph.

### 7. How easy would it be to reuse this diff model in Ultraplan?

The current `/review` diff model would be only moderately reusable because it is mostly procedural and prompt-driven: metadata JSON in `packages/cli/src/commands/review/fetch-pr.ts:48-59`, Markdown PR context in `packages/cli/src/commands/review/pr-context.ts:99-243`, filename arrays in `packages/cli/src/commands/review/deterministic.ts:21-31`, and comment anchors in `packages/cli/src/commands/review/presubmit.ts:24-35`. That is enough to orchestrate a CLI review flow, but not enough for a robust shared diff layer.

The better reuse candidate is the separate parser in `packages/core/src/utils/gitDiff.ts:27-52`, `packages/core/src/utils/gitDiff.ts:273-307`, and `packages/core/src/utils/gitDiff.ts:414-483`. If Ultraplan wanted a typed local-diff model, that utility is closer to reusable infrastructure than the `/review` pipeline itself.

## Failure Modes And Tradeoffs

- **Comment-placement risk**: because `/review` does not build a review-specific hunk model, inline accuracy depends on the LLM choosing a valid changed line from raw diff text before submission in `packages/core/src/skills/bundled/review/SKILL.md:538-572`.
- **Noise-filtering gap**: deleted files are filtered for deterministic tooling in `packages/core/src/skills/bundled/review/SKILL.md:108-110`, but I found no comparable generated/binary/vendor filtering before LLM review.
- **Good operational isolation**: worktree isolation is strong in `packages/cli/src/commands/review/fetch-pr.ts:133-145` and `packages/core/src/skills/bundled/review/SKILL.md:50-61`, which reduces local-state corruption even though diff normalisation is weak.
- **Good comment-thread context**: `packages/cli/src/commands/review/pr-context.ts:99-243` is thoughtful about already-discussed threads, replies, and open comments, which should reduce duplicate findings even without a typed diff AST.
- **Architectural split**: the repo already contains a capable structured diff parser in `packages/core/src/utils/gitDiff.ts:414-483`, but the PR-review pipeline does not consume it. That separation makes the current review path simpler to ship, but leaves inline comment placement less trustworthy than the parser groundwork suggests.
