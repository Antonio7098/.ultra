# pr-agent

## Scope

- Source studied: `sources/pr-agent`
- Dimension: PR Diff Ingestion & Normalisation
- Score: `8/10`

## Summary

`pr-agent` does not pass raw `git diff` text straight into review prompts. Its providers normalize provider-specific PR/MR change APIs into a shared `FilePatchInfo` dataclass with file contents, patch text, edit type, rename metadata, and added/removed line counts (`pr_agent/algo/types.py:6-26`). That normalized list flows through shared patch-processing utilities that extend hunks with context, optionally convert them into line-numbered hunk blocks, prune oversized diffs, and then feed the resulting string into reviewer and suggestion prompts (`pr_agent/algo/pr_processing.py:38-143`, `pr_agent/algo/pr_processing.py:372-500`, `pr_agent/tools/pr_reviewer.py:189-227`, `pr_agent/tools/pr_code_suggestions.py:367-420`).

The strongest part of the design is the reusable diff model and shared processing layer (`pr_agent/algo/types.py:14-26`, `pr_agent/algo/pr_processing.py:38-143`). The main weakness is line mapping: GitHub uses patch-position lookup with fallback verification (`pr_agent/algo/utils.py:1125-1197`, `pr_agent/git_providers/github_provider.py:399-549`), but GitLab still relies on substring search inside patch text and does not implement batch inline comment creation (`pr_agent/git_providers/gitlab_provider.py:545-549`, `pr_agent/git_providers/gitlab_provider.py:700-744`).

## Diff Ingestion Flow

1. Each provider fetches changed files from its host API and caches them.
   - GitHub calls `self.pr.get_files()` and `repo.compare(pr.base.sha, pr.head.sha)` to derive file lists and the merge base (`pr_agent/git_providers/github_provider.py:196-205`, `pr_agent/git_providers/github_provider.py:263-273`).
   - GitLab calls `self.mr.changes().get('changes', [])` and optionally expands submodule bumps into nested file diffs (`pr_agent/git_providers/gitlab_provider.py:408-412`, `pr_agent/git_providers/gitlab_provider.py:234-287`).
   - Bitbucket Cloud combines `self.pr.diffstat()` with raw unified diff text from `self.pr.diff()` and manually splits it per file (`pr_agent/git_providers/bitbucket_provider.py:218-259`).

2. Providers normalize each changed file into `FilePatchInfo`.
   - Shared fields are `base_file`, `head_file`, `patch`, `filename`, `tokens`, `edit_type`, `old_filename`, `num_plus_lines`, `num_minus_lines`, `language`, and `ai_file_summary` (`pr_agent/algo/types.py:14-26`).
   - GitHub sets `edit_type` from `file.status` and fills line counts from GitHub metadata when available (`pr_agent/git_providers/github_provider.py:313-338`).
   - GitLab sets `edit_type` from `new_file`, `deleted_file`, and `renamed_file`, and preserves `old_filename` when paths differ (`pr_agent/git_providers/gitlab_provider.py:447-472`).
   - Bitbucket sets `edit_type` from `diff.data['status']` after reconstructing per-file patch text (`pr_agent/git_providers/bitbucket_provider.py:323-338`).

3. Shared processing converts normalized files into promptable diff text.
   - `get_pr_diff()` asks the provider for `get_diff_files()`, sorts files by language, extends hunks with context, and either returns the full combined diff or a compressed/pruned version based on token budget (`pr_agent/algo/pr_processing.py:38-143`).
   - `get_pr_multi_diffs()` can split oversized PRs into multiple prompt-sized diff chunks (`pr_agent/algo/pr_processing.py:372-500`).

4. Review tools consume that processed diff.
   - `/review` sends the processed diff under `variables["diff"]` (`pr_agent/tools/pr_reviewer.py:189-227`).
   - `/improve` / code suggestions send both a line-numbered diff and a line-number-stripped variant (`pr_agent/tools/pr_code_suggestions.py:367-420`).

## Internal Diff Representation

The internal model is a typed file-level object, not raw diff text. `FilePatchInfo` in `pr_agent/algo/types.py:14-26` stores:

- Original file content in `base_file` (`pr_agent/algo/types.py:16`).
- New file content in `head_file` (`pr_agent/algo/types.py:17`).
- Unified patch text in `patch` (`pr_agent/algo/types.py:18`).
- Canonical path in `filename` (`pr_agent/algo/types.py:19`).
- Edit classification in `edit_type` using `EDIT_TYPE.ADDED`, `EDIT_TYPE.DELETED`, `EDIT_TYPE.MODIFIED`, `EDIT_TYPE.RENAMED`, or `EDIT_TYPE.UNKNOWN` (`pr_agent/algo/types.py:6-11`, `pr_agent/algo/types.py:21`).
- Rename origin in `old_filename` (`pr_agent/algo/types.py:22`).
- Added/removed line counts in `num_plus_lines` and `num_minus_lines` (`pr_agent/algo/types.py:23-24`).

Hunks are not represented as first-class objects. Instead, shared utilities parse unified patch text on demand with `RE_HUNK_HEADER` (`pr_agent/algo/git_patch_processing.py:12-14`) and derive either expanded hunks (`pr_agent/algo/git_patch_processing.py:16-188`) or line-numbered hunk renderings (`pr_agent/algo/git_patch_processing.py:301-411`). This is structured enough for prompt generation and comment mapping, but less reusable than a typed `File -> Hunk -> Line` AST.

## File Filtering Rules

There are two filtering layers.

1. Provider-agnostic ignore rules.
   - `filter_ignored()` applies configured regex patterns, glob patterns, and generated-code mappings from `generated_code_ignore.toml` (`pr_agent/algo/file_filter.py:8-81`, `pr_agent/settings/generated_code_ignore.toml:1-42`).
   - Tests cover glob filtering, regex filtering, invalid regex handling, and generated-code framework filtering (`tests/unittest/test_file_filter.py:19-130`).

2. Extension and generated-artifact screening.
   - `is_valid_file()` rejects lockfiles like `package-lock.json`, `yarn.lock`, `Cargo.lock`, and minified/source-map suffixes like `.min.js`, `.js.map`, and `.css.map` before language sorting or review (`pr_agent/algo/language_handler.py:15-34`).
   - Providers explicitly drop files that fail `is_valid_file()` and log them as invalid extensions (`pr_agent/git_providers/github_provider.py:276-279`, `pr_agent/git_providers/github_provider.py:339-340`, `pr_agent/git_providers/gitlab_provider.py:427-430`, `pr_agent/git_providers/gitlab_provider.py:473-474`, `pr_agent/git_providers/bitbucket_provider.py:291-295`, `pr_agent/git_providers/bitbucket_provider.py:340-341`).

Binary handling is indirect rather than explicit. I found no dedicated binary-file type or branch for binary patches in the provider implementations I inspected (`pr_agent/git_providers/github_provider.py:222-348`, `pr_agent/git_providers/gitlab_provider.py:395-477`, `pr_agent/git_providers/bitbucket_provider.py:214-344`). The practical behavior seems to be: if a file has no patch, providers try `load_large_diff()` from fetched contents (`pr_agent/git_providers/github_provider.py:309-310`, `pr_agent/git_providers/gitlab_provider.py:455-458`, `pr_agent/algo/utils.py:684-703`), and if the path is a filtered artifact it is skipped earlier (`pr_agent/algo/language_handler.py:23-34`). No evidence found for explicit binary-file suppression beyond that path/content-based behavior.

## Hunk Parsing And Normalisation

- `extend_patch()` expands each hunk with extra context lines before and after, with optional dynamic-context widening toward a nearby section header (`pr_agent/algo/git_patch_processing.py:16-188`).
- `decouple_and_convert_to_hunks_with_lines_numbers()` rewrites each file patch into `__new hunk__` and `__old hunk__` blocks with explicit line numbers on the new side (`pr_agent/algo/git_patch_processing.py:301-411`).
- `handle_patch_deletions()` removes delete-only hunks from prompt diffs and collapses whole-file deletions to `None` so they can be summarized separately (`pr_agent/algo/git_patch_processing.py:268-298`).

Tests cover context extension and deletion handling.

- `tests/unittest/test_extend_patch.py:15-196` exercises basic extension, multiple hunks, dynamic context, and manual diff generation fallback.
- `tests/unittest/test_handle_patch_deletions.py:36-72` checks delete-only hunk removal and whole-file deletion behavior.

## Line Mapping Strategy

### GitHub

GitHub inline comments map through patch positions, not only absolute file lines.

- `create_inline_comment()` calls `find_line_number_of_relevant_line_in_file()` on the cached normalized `diff_files` (`pr_agent/git_providers/github_provider.py:399-412`).
- `find_line_number_of_relevant_line_in_file()` walks hunk headers, tracks added/context lines, and returns both patch-relative `position` and new-file `absolute_position` (`pr_agent/algo/utils.py:1125-1197`).
- Tests verify exact-match lookup, fuzzy matching through `difflib`, missing-file behavior, and refusal to target deleted lines (`tests/unittest/test_find_line_number_of_relevant_line_in_file.py:7-66`).
- If GitHub rejects a batch review with `422`, the provider verifies comments one-by-one against the review API and downgrades invalid multi-line suggestions to single-line comments when possible (`pr_agent/git_providers/github_provider.py:414-549`).

This is the strongest inline-placement path in the repo.

### GitLab

GitLab uses a weaker mapping approach.

- `search_line()` and `find_in_file()` scan patch text for a matching substring and maintain old/new line counters while iterating through hunk lines (`pr_agent/git_providers/gitlab_provider.py:700-744`).
- `send_inline_comment()` converts that result into GitLab `position` payloads using `base_sha`, `start_sha`, `head_sha`, `old_path`, `new_path`, and either `old_line` or `new_line` (`pr_agent/git_providers/gitlab_provider.py:555-580`).
- If committable suggestion creation fails, it falls back to a non-committable file note carrying a link and diff snippet (`pr_agent/git_providers/gitlab_provider.py:581-636`).

This works, but substring matching is more collision-prone than GitHub's patch-position lookup.

### Bitbucket Cloud

Bitbucket Cloud also reuses the shared line finder.

- `create_inline_comment()` calls `find_line_number_of_relevant_line_in_file()` and returns `absolute_position` for publication (`pr_agent/git_providers/bitbucket_provider.py:411-425`).
- Suggestion publishing uses provider-native `line` and `start_line` fields for single-line and multi-line comments (`pr_agent/git_providers/bitbucket_provider.py:123-186`).

## Renames, Deletes, Moves, Generated Files, Binaries

- Renames are modeled in `EDIT_TYPE.RENAMED` (`pr_agent/algo/types.py:6-11`) and providers populate rename metadata where available, especially `old_filename` in GitLab (`pr_agent/git_providers/gitlab_provider.py:452-470`).
- GitHub recognizes `file.status == 'renamed'` but does not populate `old_filename` in the inspected code path (`pr_agent/git_providers/github_provider.py:313-338`).
- Whole-file deletes are recognized as `EDIT_TYPE.DELETED` and then suppressed from prompt patches by `handle_patch_deletions()` (`pr_agent/git_providers/github_provider.py:313-338`, `pr_agent/git_providers/gitlab_provider.py:447-472`, `pr_agent/algo/git_patch_processing.py:268-298`).
- Generated files can be ignored through `config.ignore_language_framework` plus mappings in `generated_code_ignore.toml` (`pr_agent/settings/configuration.toml:50-58`, `pr_agent/settings/generated_code_ignore.toml:1-42`, `pr_agent/algo/file_filter.py:23-31`).
- Lockfiles and common generated/minified artifacts are excluded by `is_valid_file()` (`pr_agent/algo/language_handler.py:23-34`).
- Vendored-file handling: No clear evidence found. I searched provider and filtering code for vendor-specific rules and found no dedicated vendored-file logic beyond generic glob/regex ignores and bad-extension screening (`pr_agent/algo/file_filter.py:8-81`, `pr_agent/algo/language_handler.py:15-34`).
- Binary-file handling: No clear evidence found for an explicit binary marker or skip path in the studied providers (`pr_agent/git_providers/github_provider.py:222-348`, `pr_agent/git_providers/gitlab_provider.py:395-477`, `pr_agent/git_providers/bitbucket_provider.py:214-344`).

## Multi-File Reasoning Support

Yes. The review layer consumes a combined diff assembled from many `FilePatchInfo` objects.

- `get_pr_diff()` concatenates normalized per-file patches into one prompt string (`pr_agent/algo/pr_processing.py:67-76`, `pr_agent/algo/pr_processing.py:167-207`).
- `get_pr_multi_diffs()` can split many-file PRs into multiple chunks while preserving file boundaries (`pr_agent/algo/pr_processing.py:372-500`).
- The reviewer passes the combined diff into one model call (`pr_agent/tools/pr_reviewer.py:189-227`).

The representation is therefore good enough for multi-file reasoning at prompt time, even though it lacks a richer cross-file graph or typed hunk tree.

## Reusability For Ultraplan

Reuse looks plausible, especially at the file-normalization layer.

What is reusable:

- `FilePatchInfo` is a small cross-provider canonical model (`pr_agent/algo/types.py:14-26`).
- `get_pr_diff()` and `get_pr_multi_diffs()` are largely provider-agnostic once `get_diff_files()` is implemented (`pr_agent/algo/pr_processing.py:38-143`, `pr_agent/algo/pr_processing.py:372-500`).
- The MOSAICO `DiffInputProvider` proves the review stack can run from a supplied unified diff without a live host integration (`pr_agent/mosaico/diff_provider.py:1-126`).

What limits reuse:

- Hunks are still stored as raw patch text rather than typed objects (`pr_agent/algo/types.py:14-26`, `pr_agent/algo/git_patch_processing.py:301-411`).
- Inline comment mapping logic is partly provider-specific and partly string-match-based, especially on GitLab (`pr_agent/git_providers/github_provider.py:399-549`, `pr_agent/git_providers/gitlab_provider.py:700-744`).
- Provider modules often mix fetching, normalization, and publication concerns in one class (`pr_agent/git_providers/github_provider.py:222-338`, `pr_agent/git_providers/github_provider.py:394-598`).

Net: the diff model is reusable with moderate adaptation, but Ultraplan would likely want a stronger typed hunk/line layer than `pr-agent` currently exposes.

## Answers To The Dimension Questions

1. Does the tool use raw diffs or structured diff objects?

It uses structured file objects internally via `FilePatchInfo`, then renders them back into prompt strings for model input (`pr_agent/algo/types.py:14-26`, `pr_agent/algo/pr_processing.py:38-143`).

2. How are changed files represented internally?

As `FilePatchInfo` records containing original content, new content, unified patch, canonical filename, edit type, optional old filename, and line counts (`pr_agent/algo/types.py:14-26`).

3. How are line numbers mapped back to PR comments?

GitHub and Bitbucket use shared patch scanning in `find_line_number_of_relevant_line_in_file()` to derive patch position and absolute line (`pr_agent/algo/utils.py:1125-1197`, `pr_agent/git_providers/github_provider.py:399-412`, `pr_agent/git_providers/bitbucket_provider.py:411-425`). GitLab scans the patch text directly and converts the match into GitLab `position` fields (`pr_agent/git_providers/gitlab_provider.py:700-744`, `pr_agent/git_providers/gitlab_provider.py:555-580`).

4. Does it ignore generated files, lockfiles, vendored files, or binaries?

It ignores configured generated files, lockfiles, and common minified/source-map artifacts (`pr_agent/algo/file_filter.py:23-31`, `pr_agent/settings/generated_code_ignore.toml:1-42`, `pr_agent/algo/language_handler.py:23-34`). No clear evidence found for explicit vendored-file logic or explicit binary-file handling (`pr_agent/algo/file_filter.py:8-81`, `pr_agent/git_providers/github_provider.py:222-348`, `pr_agent/git_providers/gitlab_provider.py:395-477`).

5. How does it handle renamed, deleted, and moved files?

Providers classify them with `EDIT_TYPE`, preserve rename source on some providers, and suppress whole-file deletion patches during prompt construction (`pr_agent/algo/types.py:6-26`, `pr_agent/git_providers/gitlab_provider.py:447-472`, `pr_agent/git_providers/github_provider.py:313-338`, `pr_agent/algo/git_patch_processing.py:268-298`).

6. Can the diff representation support multi-file reasoning?

Yes. Multiple normalized files are grouped, sorted, extended, and concatenated into one or more prompt payloads (`pr_agent/algo/pr_processing.py:38-143`, `pr_agent/algo/pr_processing.py:372-500`).

7. How easy would it be to reuse this diff model in Ultraplan?

Moderately easy at the file-model layer because `FilePatchInfo` and `DiffInputProvider` already separate ingestion from review enough to run on supplied diffs (`pr_agent/algo/types.py:14-26`, `pr_agent/mosaico/diff_provider.py:29-126`). Harder if Ultraplan needs strongly typed hunks and consistently precise inline mapping across hosts (`pr_agent/algo/git_patch_processing.py:301-411`, `pr_agent/git_providers/gitlab_provider.py:700-744`).

## Failure Modes And Tradeoffs

- Large PRs trade accuracy for cost: providers may stop loading full file contents after a threshold, leaving only patch text for later files (`pr_agent/git_providers/github_provider.py:286-307`, `pr_agent/git_providers/gitlab_provider.py:432-441`, `pr_agent/git_providers/bitbucket_provider.py:297-317`).
- Missing provider patch payloads are recovered by regenerating unified diffs from fetched file contents (`pr_agent/algo/utils.py:684-703`, `pr_agent/git_providers/github_provider.py:309-310`, `pr_agent/git_providers/gitlab_provider.py:455-458`). This is pragmatic, but reconstructed patches may differ from host-native diff metadata.
- Delete-only hunks are intentionally removed from prompt diffs (`pr_agent/algo/git_patch_processing.py:268-298`), which reduces noise but also removes some removal context from model review.
- GitHub inline publication is relatively resilient because it verifies and repairs invalid comments (`pr_agent/git_providers/github_provider.py:466-549`). GitLab inline publication is less mature because batch inline comment creation is unimplemented and line lookup is string-match-based (`pr_agent/git_providers/gitlab_provider.py:545-549`, `pr_agent/git_providers/gitlab_provider.py:700-744`).

## Rating Rationale

Score: `8/10`

- Positive: shared structured diff model (`pr_agent/algo/types.py:14-26`), provider normalization (`pr_agent/git_providers/github_provider.py:222-348`, `pr_agent/git_providers/gitlab_provider.py:395-477`, `pr_agent/git_providers/bitbucket_provider.py:214-344`), configurable filtering (`pr_agent/algo/file_filter.py:8-81`, `pr_agent/algo/language_handler.py:15-34`), and strong GitHub fallback verification (`pr_agent/git_providers/github_provider.py:414-549`).
- Negative: no first-class hunk objects (`pr_agent/algo/git_patch_processing.py:301-411`), mixed provider quality for line mapping (`pr_agent/git_providers/gitlab_provider.py:700-744`), and no clear explicit binary/vendored handling in the studied paths (`pr_agent/git_providers/github_provider.py:222-348`, `pr_agent/git_providers/gitlab_provider.py:395-477`).

Fast heuristic answer: I would generally trust GitHub inline placement here, but I would trust GitLab placement less because the matching logic is looser and the inline publishing path is less complete (`pr_agent/algo/utils.py:1125-1197`, `pr_agent/git_providers/github_provider.py:399-549`, `pr_agent/git_providers/gitlab_provider.py:545-580`, `pr_agent/git_providers/gitlab_provider.py:700-744`).
