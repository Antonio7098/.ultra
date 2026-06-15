# review-board

## Dimension

- PR Diff Ingestion & Normalisation

## Score

- 8/10

## Rationale

Review Board has a well-factored diff ingestion layer centered on typed parsed objects (`reviewboard/diffviewer/parser.py:56-149`, `reviewboard/diffviewer/parser.py:150-236`, `reviewboard/diffviewer/parser.py:237-543`), persistent file-level records (`reviewboard/diffviewer/models/filediff.py:30-113`), and a serialized render model (`reviewboard/diffviewer/diffutils.py:92-179`). It supports line-oriented comments through file-relative line numbers (`reviewboard/reviews/models/diff_comment.py:38-45`) and can build multi-file/interdiff/base-commit views (`reviewboard/diffviewer/diffutils.py:1149-1555`).

The main limitation for this study is that Review Board is not a PR review agent and does not fetch GitHub/GitLab pull request diffs directly. Diff ingestion begins from uploaded diff files via WebAPI/forms, not from hosted PR APIs (`reviewboard/webapi/resources/validate_diff.py:36-213`, `reviewboard/webapi/resources/validate_diffcommit.py:41-260`, `reviewboard/diffviewer/managers.py:681-778`). It also shows no clear evidence of generated-file, lockfile, or vendored-file filtering in the ingestion path (`reviewboard/diffviewer/filediff_creator.py:341-458`, `reviewboard/diffviewer/diffutils.py:1149-1555`).

## Diff Ingestion Flow

1. Diffs enter through upload/validation APIs, not hosted-PR fetch APIs.
   `ValidateDiffResource.create()` accepts uploaded `path` and optional `parent_diff_path`, resolves a `Repository`, and calls `DiffSet.objects.create_from_upload(..., validate_only=True)` (`reviewboard/webapi/resources/validate_diff.py:77-177`).
   `ValidateDiffCommitResource.create()` accepts uploaded `diff`, `parent_diff`, `commit_id`, and `parent_id`, validates the form, and calls `ValidateCommitForm.validate_diff()` (`reviewboard/webapi/resources/validate_diffcommit.py:96-257`, `reviewboard/diffviewer/forms.py:336-490`).

2. Uploaded files are read into bytes and passed into the data-layer creation methods.
   `BaseDiffManager.create_from_upload()` reads `diff_file.read()` and `parent_diff_file.read()` and forwards both byte blobs to `create_from_data()` (`reviewboard/diffviewer/managers.py:681-778`).

3. Diff bytes are parsed into structured intermediate objects.
   `create_filediffs()` calls `_prepare_diff_info()`, which calls `_parse_diff()` and `_process_files()` for both the main diff and optional parent diff (`reviewboard/diffviewer/filediff_creator.py:72-201`, `reviewboard/diffviewer/filediff_creator.py:341-457`).

4. SCM-specific parsers normalize raw diff syntax.
   The generic parser model is defined in `ParsedDiff`, `ParsedDiffChange`, and `ParsedDiffFile` (`reviewboard/diffviewer/parser.py:56-149`, `reviewboard/diffviewer/parser.py:150-236`, `reviewboard/diffviewer/parser.py:237-543`).
   Git-specific handling for extended headers, renames, copies, file modes, `/dev/null`, and binary markers lives in `GitDiffParser` (`reviewboard/scmtools/git.py:335-780`).
   Mercurial-specific handling for missing per-file revisions and commit-history validation lives in `HgDiffParser` and `HgGitDiffParser` (`reviewboard/scmtools/hg.py:428-662`).

5. Parsed files are persisted as `FileDiff` rows.
   `create_filediffs()` maps parser output into `FileDiff` objects, setting filenames, revisions, binary/status flags, diff bytes, parent diff bytes, and extra metadata before bulk creation (`reviewboard/diffviewer/filediff_creator.py:203-338`).

6. Review and rendering operate on structured file objects, not raw patch text.
   `get_diff_files()` builds a `SerializedDiffFile` list for rendering and comparison (`reviewboard/diffviewer/diffutils.py:1149-1555`), and `DiffRenderer` populates chunks on demand with `populate_diff_chunks()` (`reviewboard/diffviewer/renderers.py:17-190`).

## Internal Diff Representation

### Parsed intermediate model

- `ParsedDiff` stores diff-wide metadata, parser instance, extra data, and one or more parsed changes (`reviewboard/diffviewer/parser.py:56-149`).
- `ParsedDiffChange` stores commit-level metadata, including `commit_id`, `parent_commit_id`, and its file list (`reviewboard/diffviewer/parser.py:150-236`).
- `ParsedDiffFile` stores `orig_filename`, `modified_filename`, source and destination revisions/details, `binary`, `copied`, `deleted`, `moved`, `insert_count`, `delete_count`, symlink metadata, and raw per-file diff bytes (`reviewboard/diffviewer/parser.py:237-543`).

### Persistent model

- `FileDiff` persists the normalized per-file change with `source_file`, `dest_file`, `source_revision`, `dest_detail`, `binary`, `status`, `diff`, `parent_diff`, and `extra_data` (`reviewboard/diffviewer/models/filediff.py:30-113`).
- File status is normalized into `COPIED`, `DELETED`, `MODIFIED`, and `MOVED` constants (`reviewboard/diffviewer/models/filediff.py:39-49`).
- `DiffSet` groups revisioned collections of `FileDiff` rows and can finalize cumulative commit-series diffs (`reviewboard/diffviewer/models/diffset.py:19-67`, `reviewboard/diffviewer/models/diffset.py:104-166`).

### Render-time model

- `SerializedDiffFile` is a typed dict containing `filediff`, `interfilediff`, `base_filediff`, display names, flags like `binary`, `deleted`, `moved`, `copied`, `is_new_file`, and lazily-loaded `chunks` (`reviewboard/diffviewer/diffutils.py:92-179`).
- `DiffChunk` and `DiffLine` provide a chunk/line structure with both original and modified real line numbers plus HTML-rendered content and metadata (`reviewboard/diffviewer/chunk_generator.py:103-174`).

## File Filtering Rules

### What is filtered

- Parent diffs are filtered down to only files referenced by the main diff. `_prepare_diff_info()` builds `diff_filenames` from the main diff and passes `limit_to=diff_filenames` when processing the parent diff (`reviewboard/diffviewer/filediff_creator.py:425-449`).
- There is a test proving unused parent-diff files are skipped and do not trigger repository existence checks (`reviewboard/diffviewer/tests/test_forms.py:278-335`).
- Empty Git changes are dropped unless they represent a new empty file, move, copy, or deleted empty file (`reviewboard/scmtools/git.py:671-690`).
- Render-time filtering supports filename pattern filtering through `filename_patterns` in `get_diff_files()` (`reviewboard/diffviewer/diffutils.py:1204-1208`, `reviewboard/diffviewer/diffutils.py:1441-1449`).

### What is not clearly filtered

- No clear evidence found for automatic filtering of generated files, lockfiles, vendored files, or dependency directories in the ingestion path. I checked the main ingestion and render layers in `reviewboard/webapi/resources/validate_diff.py:36-213`, `reviewboard/webapi/resources/validate_diffcommit.py:41-260`, `reviewboard/diffviewer/filediff_creator.py:341-458`, and `reviewboard/diffviewer/diffutils.py:1149-1555`.
- Binary files are detected and represented, but not ignored. `FileDiff.binary` is a first-class field (`reviewboard/diffviewer/models/filediff.py:70-71`), and Git/Mercurial parsers explicitly set `parsed_file.binary = True` (`reviewboard/scmtools/git.py:588-594`, `reviewboard/scmtools/hg.py:559-563`).

## Line Mapping Strategy

- Review comments use file-relative line numbers, not raw diff positions. `Comment.first_line` is documented as “the line within the entire file, starting at 1,” and `num_lines` stores the span (`reviewboard/reviews/models/diff_comment.py:38-45`).
- Comment creation requires `filediff_id`, `first_line`, and `num_lines`, with optional `interfilediff_id` or `base_filediff_id` for interdiff and commit-range contexts (`reviewboard/webapi/resources/review_diff_comment.py:45-78`, `reviewboard/webapi/resources/review_diff_comment.py:167-193`).
- Comment URLs anchor to `#file{filediff.id}line{first_line}`, showing that the stable mapping target is the file plus real line number (`reviewboard/reviews/models/diff_comment.py:83-123`).
- Render chunks preserve both original and modified real line numbers in every `DiffLine`: tuple slots `[1]` and `[4]` hold original and modified line numbers (`reviewboard/diffviewer/chunk_generator.py:119-146`).
- `get_diff_files()` and the view layer can resolve plain diff, interdiff, and base-filediff contexts before rendering, which is how the same line-number model can target cumulative diffs and commit ranges (`reviewboard/diffviewer/views.py:818-855`, `reviewboard/diffviewer/diffutils.py:1149-1555`).

## Edge-Case Handling

### Renamed, moved, and copied files

- Git extended headers are parsed for `rename from`, `rename to`, `copy from`, and `copy to` (`reviewboard/scmtools/git.py:372-384`, `reviewboard/scmtools/git.py:534-555`).
- `create_filediffs()` maps those parser flags into `FileDiff.MOVED` and `FileDiff.COPIED` statuses (`reviewboard/diffviewer/filediff_creator.py:279-297`).
- Parent-diff rename state is preserved through `extra_data['parent_moved']` and parent source filename/revision metadata (`reviewboard/diffviewer/filediff_creator.py:216-274`).
- Tests cover pure rename parent diffs and rename-with-content-change parent diffs (`reviewboard/diffviewer/tests/test_forms.py:395-547`) and moved Git diffs (`reviewboard/scmtools/tests/test_git.py:667-698`, `reviewboard/scmtools/tests/test_git.py:870-902`).

### Deleted files

- Git parser recognizes `deleted file mode`, marks `deleted=True`, and preserves old mode (`reviewboard/scmtools/git.py:521-525`, `reviewboard/scmtools/git.py:745-746`).
- `create_filediffs()` maps deleted parsed files to `FileDiff.DELETED` (`reviewboard/diffviewer/filediff_creator.py:279-286`).
- Tests cover deleted text and deleted binary files (`reviewboard/scmtools/tests/test_git.py:699-736`).

### Binary files

- Git parser treats `Binary file` and `GIT binary patch` markers as binary content (`reviewboard/scmtools/git.py:588-594`, `reviewboard/scmtools/git.py:760-764`).
- DiffX also stores binary file sections by setting `parsed_diff_file.binary` from `DiffType.BINARY` (`reviewboard/diffviewer/parser.py:1544-1545`).
- Tests cover Git binary diffs (`reviewboard/scmtools/tests/test_git.py:493-543`) and DiffX binary diffs (`reviewboard/diffviewer/tests/test_diffx_parser.py:842-903`).

### Symlinks and file modes

- Git parser derives symlink state from UNIX modes and extracts old/new symlink targets from diff lines (`reviewboard/scmtools/git.py:643-660`).
- `FileDiff` persists symlink and UNIX mode information in accessors over `extra_data` (`reviewboard/diffviewer/models/filediff.py:169-257`).
- Tests cover symlink add/change/remove handling (`reviewboard/scmtools/tests/test_git.py:1073-1160`) and DiffX symlink metadata (`reviewboard/diffviewer/tests/test_filediff_creator.py:106-187`).

### SCMs without per-file revisions

- Mercurial explicitly sets `has_per_file_revisions = False` (`reviewboard/scmtools/hg.py:431-439`, `reviewboard/scmtools/hg.py:587-591`).
- `get_file_exists_in_history()` falls back to looser filename-based validation in that mode and records `__validated_parent_id` for later revision rewriting (`reviewboard/diffviewer/commit_utils.py:143-166`, `reviewboard/diffviewer/commit_utils.py:212-259`).
- `_process_files()` rewrites the source revision from `__validated_parent_id` when validation discovers a better parent revision (`reviewboard/diffviewer/filediff_creator.py:617-633`).
- Tests cover this fallback behavior (`reviewboard/diffviewer/tests/test_filediff_creator.py:292-340`).

## Answers To The Study Questions

### 1. Does the tool use raw diffs or structured diff objects?

It ingests raw diff bytes, but immediately parses them into structured objects. The typed model begins with `ParsedDiff`, `ParsedDiffChange`, and `ParsedDiffFile` (`reviewboard/diffviewer/parser.py:56-543`), is persisted in `FileDiff` and `DiffSet` (`reviewboard/diffviewer/models/filediff.py:30-113`, `reviewboard/diffviewer/models/diffset.py:19-67`), and is transformed into `SerializedDiffFile` plus `DiffChunk`/`DiffLine` for rendering (`reviewboard/diffviewer/diffutils.py:92-179`, `reviewboard/diffviewer/chunk_generator.py:103-174`).

### 2. How are changed files represented internally?

As `ParsedDiffFile` during parsing (`reviewboard/diffviewer/parser.py:237-543`), then as persistent `FileDiff` rows with normalized status and metadata (`reviewboard/diffviewer/models/filediff.py:30-113`), then as render-time `SerializedDiffFile` dicts (`reviewboard/diffviewer/diffutils.py:92-179`).

### 3. How are line numbers mapped back to PR comments?

Review Board comments are attached by `filediff_id` plus file-relative line range (`first_line`, `num_lines`) rather than by raw patch offsets (`reviewboard/webapi/resources/review_diff_comment.py:45-78`, `reviewboard/reviews/models/diff_comment.py:38-45`). Rendered chunks carry original and modified real line numbers for every row (`reviewboard/diffviewer/chunk_generator.py:119-146`), and comment links anchor directly to `#file{id}line{first_line}` (`reviewboard/reviews/models/diff_comment.py:121-123`).

### 4. Does it ignore generated files, lockfiles, vendored files, or binaries?

It does not appear to automatically ignore generated, lockfile, or vendored files. No clear evidence found in the ingestion/render paths I inspected: `reviewboard/webapi/resources/validate_diff.py:36-213`, `reviewboard/webapi/resources/validate_diffcommit.py:41-260`, `reviewboard/diffviewer/filediff_creator.py:341-458`, and `reviewboard/diffviewer/diffutils.py:1149-1555`.

It does handle binaries explicitly rather than filtering them out, via `FileDiff.binary` (`reviewboard/diffviewer/models/filediff.py:70-71`) and parser support (`reviewboard/scmtools/git.py:588-594`, `reviewboard/diffviewer/parser.py:1544-1545`).

### 5. How does it handle renamed, deleted, and moved files?

Git diffs parse rename/copy/delete headers in `GitDiffParser` (`reviewboard/scmtools/git.py:372-384`, `reviewboard/scmtools/git.py:514-555`). These are normalized to `FileDiff` status values in `create_filediffs()` (`reviewboard/diffviewer/filediff_creator.py:279-297`). Parent-diff ancestry and rename metadata are preserved in `extra_data` (`reviewboard/diffviewer/filediff_creator.py:216-274`). Tests cover rename, delete, binary delete, and symlink edge cases (`reviewboard/scmtools/tests/test_git.py:667-736`, `reviewboard/scmtools/tests/test_git.py:822-1160`, `reviewboard/diffviewer/tests/test_forms.py:395-547`).

### 6. Can the diff representation support multi-file reasoning?

Yes. `DiffSet` represents a collection of `FileDiff` rows (`reviewboard/diffviewer/models/diffset.py:19-67`), `get_diff_files()` returns a list of `SerializedDiffFile` objects for whole diffsets and commit spans (`reviewboard/diffviewer/diffutils.py:1149-1555`), and `DiffParser.raw_diff()` / `DiffXParser.raw_diff()` can reconstruct aggregate diffs (`reviewboard/diffviewer/parser.py:1301-1339`, `reviewboard/diffviewer/parser.py:1644-1773`). This is strong support for multi-file views, though it is aimed at UI/review rendering rather than an AI reasoning pipeline.

### 7. How easy would it be to reuse this diff model in Ultraplan?

Moderately easy at the conceptual level, harder at the implementation level.

- The conceptual model is strong and reusable: parsed diff, per-file normalized record, rendered multi-file list, and explicit line/chunk model (`reviewboard/diffviewer/parser.py:56-543`, `reviewboard/diffviewer/models/filediff.py:30-113`, `reviewboard/diffviewer/diffutils.py:92-179`, `reviewboard/diffviewer/chunk_generator.py:103-174`).
- The implementation is tightly coupled to Django models, repository backends, and Review Board rendering/comment APIs (`reviewboard/diffviewer/managers.py:681-778`, `reviewboard/diffviewer/diffutils.py:1149-1555`, `reviewboard/webapi/resources/review_diff_comment.py:21-333`).
- For Ultraplan, the best reusable ideas are the typed file/change model, explicit status flags, parent/interdiff/base-filediff handling, and line-number-aware chunk model.

## Failure Modes And Tradeoffs

- No hosted-PR fetch abstraction. This codebase expects uploaded diffs and repository-backed validation, not GitHub/GitLab PR file APIs (`reviewboard/webapi/resources/validate_diff.py:36-213`, `reviewboard/webapi/resources/validate_diffcommit.py:41-260`). That makes it less directly portable to an AI PR-review bot.
- Mercurial support trades strictness for compatibility. `has_per_file_revisions = False` enables looser validation and later source-revision rewriting, which is practical but less exact than Git’s per-file SHA model (`reviewboard/scmtools/hg.py:431-439`, `reviewboard/diffviewer/commit_utils.py:148-166`, `reviewboard/diffviewer/filediff_creator.py:617-633`).
- Some parser behavior is SCM-specific, so “the diff model” is not one parser but a parser framework plus backend-specific subclasses (`reviewboard/diffviewer/parser.py:544-642`, `reviewboard/scmtools/git.py:335-780`, `reviewboard/scmtools/hg.py:428-662`).
- Empty metadata-only Git changes are discarded unless they match a few special cases (`reviewboard/scmtools/git.py:671-690`). That keeps noise down, but it can hide pure metadata changes until the viewer grows explicit support.
- Generated-file/noise suppression is largely absent in the ingestion layer. Consumers would need a separate policy layer for AI review filtering. No clear evidence found in `reviewboard/diffviewer/filediff_creator.py:341-458` and `reviewboard/diffviewer/diffutils.py:1149-1555`.

## Bottom Line

Review Board has a mature structured diff ingestion stack with strong handling for per-file metadata, line-aware rendering, interdiffs, commit ranges, renames, deletes, binaries, and SCM-specific quirks (`reviewboard/diffviewer/parser.py:56-543`, `reviewboard/scmtools/git.py:335-780`, `reviewboard/diffviewer/diffutils.py:1149-1555`). I would trust it more than a raw `git diff` prompt dump for placing inline comments on the right file and line.

I would not treat it as a ready-made PR-agent ingestion layer, because there is no hosted-PR fetch stage and no built-in review-noise filtering for generated or vendored files (`reviewboard/webapi/resources/validate_diff.py:36-213`, `reviewboard/webapi/resources/validate_diffcommit.py:41-260`).
