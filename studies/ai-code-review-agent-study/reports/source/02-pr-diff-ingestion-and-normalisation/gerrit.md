# Gerrit

## Score

8/10

Gerrit has a strong structured diff layer built around `PatchList`, `PatchListEntry`, `PatchScript`, `FileInfo`, and `DiffInfo`, not raw pasted diff text (`java/com/google/gerrit/server/patch/PatchListLoader.java:155-219`, `java/com/google/gerrit/server/patch/PatchListEntry.java:66-128`, `java/com/google/gerrit/common/data/PatchScript.java:40-65`, `java/com/google/gerrit/extensions/common/FileInfo.java:17-25`, `java/com/google/gerrit/extensions/common/DiffInfo.java:20-82`). It also has explicit support for rename/copy/binary handling and rebase-only hunks (`java/com/google/gerrit/server/patch/PatchListEntry.java:85-102`, `java/com/google/gerrit/server/patch/PatchListEntry.java:341-371`, `java/com/google/gerrit/server/patch/PatchListLoader.java:189-215`, `javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:1047-1090`). The score stops short of 9-10 because the model is still primarily per-file, not a reusable multi-file review package, and Gerrit documents at least one rename-history limitation plus an octopus-merge fallback (`java/com/google/gerrit/server/patch/PatchScriptFactory.java:299-304`, `java/com/google/gerrit/server/patch/PatchListLoader.java:164-175`).

## Diff Ingestion Flow

Gerrit exposes two structured entrypoints for changed code:

- `GET /files` is implemented by `Files.ListFiles.apply`, which returns `Map<String, FileInfo>` for a revision, a chosen base revision, or a chosen parent (`java/com/google/gerrit/server/change/Files.java:98-181`).
- `GET /files/{path}/diff` is implemented by `GetDiff.apply`, which returns a typed `DiffInfo` object with metadata, hunks, intraline edits, headers, and binary status (`java/com/google/gerrit/server/change/GetDiff.java:123-264`).

The backend diff pipeline is:

1. `Files.ListFiles.apply` or `GetDiff.apply` chooses the diff base from default parent, explicit base revision, or explicit parent number (`java/com/google/gerrit/server/change/Files.java:159-176`, `java/com/google/gerrit/server/change/GetDiff.java:138-152`).
2. `PatchScriptFactory.call` loads a `PatchList` from `PatchListCache`, gets the `PatchListEntry` for the requested file, loads comments/history, and turns it into a `PatchScript` (`java/com/google/gerrit/server/patch/PatchScriptFactory.java:189-261`).
3. `PatchListLoader.readPatchList` uses JGit `DiffFormatter`, enables rename detection, scans the two trees, computes rebase-only edits when the optimized algorithm is enabled, and emits `PatchListEntry` objects (`java/com/google/gerrit/server/patch/PatchListLoader.java:159-219`).
4. `GetDiff.apply` converts `PatchScript` edits into `DiffInfo.ContentEntry` records, including common lines, side A lines, side B lines, intraline edit spans, skipped context, and `dueToRebase` markers (`java/com/google/gerrit/server/change/GetDiff.java:154-190`, `java/com/google/gerrit/server/change/GetDiff.java:302-403`).

There is no evidence that Gerrit's review flow consumes raw unified diff text as its main internal representation. The only raw diff-like header preserved in the public model is `DiffInfo.diffHeader` (`java/com/google/gerrit/extensions/common/DiffInfo.java:27-34`, `java/com/google/gerrit/server/change/GetDiff.java:254-257`).

## Internal Diff Representation

Changed files are represented as `FileInfo` objects keyed by new path in a `Map<String, FileInfo>` (`java/com/google/gerrit/extensions/common/FileInfo.java:17-25`, `java/com/google/gerrit/server/change/FileInfoJson.java:68-107`). `FileInfo` carries:

- `status` for change type (`A`, `D`, `R`, `C`, `W`) (`java/com/google/gerrit/extensions/common/FileInfo.java:18-24`, `java/com/google/gerrit/server/change/FileInfoJson.java:74-85`).
- `oldPath` for rename/copy source (`java/com/google/gerrit/extensions/common/FileInfo.java:20`, `java/com/google/gerrit/server/change/FileInfoJson.java:77`).
- line insert/delete counts for text files (`java/com/google/gerrit/extensions/common/FileInfo.java:21-22`, `java/com/google/gerrit/server/change/FileInfoJson.java:82-84`).
- `binary`, `sizeDelta`, and `size` (`java/com/google/gerrit/extensions/common/FileInfo.java:19-24`, `java/com/google/gerrit/server/change/FileInfoJson.java:78-85`).

Per-file diff bodies are represented as `DiffInfo` (`java/com/google/gerrit/extensions/common/DiffInfo.java:20-82`). Important fields:

- `metaA` and `metaB` for side-specific file metadata (`java/com/google/gerrit/extensions/common/DiffInfo.java:21-24`, `java/com/google/gerrit/server/change/GetDiff.java:217-237`).
- `changeType` and `binary` (`java/com/google/gerrit/extensions/common/DiffInfo.java:27-36`, `java/com/google/gerrit/server/change/GetDiff.java:213-216`, `java/com/google/gerrit/server/change/GetDiff.java:249-252`).
- `content`, a list of `ContentEntry` records containing common lines (`ab`), removed lines (`a`), added lines (`b`), intraline spans (`editA`, `editB`), whitespace-only common markers (`common`), skipped ranges (`skip`), and `dueToRebase` (`java/com/google/gerrit/extensions/common/DiffInfo.java:57-81`, `java/com/google/gerrit/server/change/GetDiff.java:322-397`).

Below that public model, `PatchListEntry` stores the normalized JGit result: change type, patch type, old/new path, compact header bytes, coarse edits, edits due to rebase, insertion/deletion counts, and size deltas (`java/com/google/gerrit/server/patch/PatchListEntry.java:66-128`).

## File Filtering Rules

The strongest filtering behavior is rebase-awareness, not generated-file suppression.

- `PatchListLoader.getPatchListEntry` drops a file entirely when all edits in that file are classified as due to rebase (`java/com/google/gerrit/server/patch/PatchListLoader.java:393-399`).
- Acceptance tests verify that unrelated added, removed, renamed, and rebase-only files are omitted from patch-set-to-patch-set diffs (`javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:208-279`, `javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:1139-1142`).
- Gerrit also injects special generated "magic" files for commit message and merge list through `Patch.COMMIT_MSG` and `Patch.MERGE_LIST` (`java/com/google/gerrit/reviewdb/client/Patch.java:22-37`, `java/com/google/gerrit/server/patch/PatchListLoader.java:197-209`).

No clear evidence found for first-class filtering of lockfiles, vendored paths, or general generated files. I searched the Gerrit source for `generated`, `vendored`, `vendor`, `lockfile`, `package-lock`, and `yarn.lock`, and the only diff-related generated-file mechanism I found was the magic-file handling in `java/com/google/gerrit/reviewdb/client/Patch.java:22-37`.

## Line Mapping Strategy

Gerrit maps review comments by path plus semantic coordinates, not by raw diff position.

- Public comment input uses `path`, `side`, `parent`, `line`, and `range` (`java/com/google/gerrit/extensions/client/Comment.java:27-35`, `java/com/google/gerrit/extensions/client/Comment.java:40-59`).
- `Comment.side()` converts those fields into Gerrit's stored side encoding, where parent comments use negative parent numbers and revision comments use `1` (`java/com/google/gerrit/extensions/client/Comment.java:98-103`).
- `PostReview.insertComments` and `PostReview.createRobotCommentFromInput` persist the review using `setLineNbrAndRange(...)` plus `setCommentRevId(...)` (`java/com/google/gerrit/server/change/PostReview.java:904-919`, `java/com/google/gerrit/server/change/PostReview.java:978-995`).
- `Comment.setLineNbrAndRange` normalizes the stored line number to either the explicit line or the range end line (`java/com/google/gerrit/reviewdb/client/Comment.java:252-258`).
- `CommentsUtil.setCommentRevId` resolves the comment back to the correct old or new revision ID depending on side and parent selection (`java/com/google/gerrit/server/CommentsUtil.java:493-515`).
- `CommentJson.fillCommentInfo` reconstructs `side`, `parent`, `line`, and `range` for API output (`java/com/google/gerrit/server/change/CommentJson.java:125-159`).

Validation is explicit before comments are accepted:

- path must refer to an affected file or magic file (`java/com/google/gerrit/server/change/PostReview.java:545-579`);
- line must be non-negative (`java/com/google/gerrit/server/change/PostReview.java:582-588`);
- ranges must satisfy structural validity (`java/com/google/gerrit/server/change/PostReview.java:724-739`);
- comments on auto-merge magic files are blocked (`java/com/google/gerrit/server/change/PostReview.java:590-595`, `javatests/com/google/gerrit/acceptance/server/change/CommentsIT.java:266-275`).

This is a strong placement model for inline review because it is anchored to file path, side, parent, line, and range rather than prompt text.

## Edge Cases

### Renames, copies, deletes, and moves

- Rename detection is enabled in the diff loader with `df.setDetectRenames(true)` (`java/com/google/gerrit/server/patch/PatchListLoader.java:184-187`).
- `PatchListEntry` preserves `oldName` and `newName` and maps JGit rename/copy events to Gerrit change types (`java/com/google/gerrit/server/patch/PatchListEntry.java:85-102`, `java/com/google/gerrit/server/patch/PatchListEntry.java:324-338`).
- `FileInfoJson` exposes rename/copy source paths through `oldPath` (`java/com/google/gerrit/server/change/FileInfoJson.java:74-85`).
- Deleted files appear with only `metaA`; added files appear with only `metaB` (`java/com/google/gerrit/server/change/GetDiff.java:217-237`, `javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:107-118`).
- Gerrit merges JGit's delete-add rewrite break into one `REWRITE` file record when both sides collide on the same new name (`java/com/google/gerrit/server/change/FileInfoJson.java:87-104`).

### Binary files

- Binary files are detected at patch-list level from JGit patch type, with a defensive NUL-byte fallback if JGit emitted text for actually-binary content (`java/com/google/gerrit/server/patch/PatchListEntry.java:341-371`).
- `FileInfoJson` marks file listings as binary and suppresses line counts for them (`java/com/google/gerrit/server/change/FileInfoJson.java:80-85`).
- `GetDiff.apply` sets `DiffInfo.binary` for per-file diffs (`java/com/google/gerrit/server/change/GetDiff.java:213-216`).
- Acceptance tests cover added and modified binary files appearing in changed-file results (`javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:155-179`).

### Rebase-only hunks

- Gerrit computes edits due to rebase in `PatchListLoader.determineEditsDueToRebase(...)` and threads those through `PatchListEntry` and `PatchScript` (`java/com/google/gerrit/server/patch/PatchListLoader.java:189-215`, `java/com/google/gerrit/server/patch/PatchListEntry.java:71-76`, `java/com/google/gerrit/common/data/PatchScript.java:50-64`).
- `GetDiff.Content.addDiff` exposes those hunks with `dueToRebase` on the relevant `ContentEntry` (`java/com/google/gerrit/server/change/GetDiff.java:378-397`).
- Acceptance tests verify per-hunk `dueToRebase` markers for renamed and copied files (`javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:1047-1090`, `javatests/com/google/gerrit/acceptance/api/revision/RevisionDiffIT.java:1119-1142`).

## Generated Review Comments

Gerrit's closest built-in analogue to agent-generated review output is robot comments.

- `ReviewInput` has a dedicated `robotComments` map keyed by path, with each `RobotCommentInput` extending normal comment coordinates and adding `robotId`, `robotRunId`, `url`, `properties`, and `fixSuggestions` (`java/com/google/gerrit/extensions/api/changes/ReviewInput.java:34-37`, `java/com/google/gerrit/extensions/api/changes/ReviewInput.java:103-111`).
- `PostReview.checkRobotComments` validates robot metadata and fix suggestions before storing them (`java/com/google/gerrit/server/change/PostReview.java:597-692`).
- `PostReview.createRobotCommentFromInput` persists them using the same path/side/line/range coordinate model as human comments (`java/com/google/gerrit/server/change/PostReview.java:978-995`).
- Acceptance tests show retrieval of stored robot comments and fix suggestions (`javatests/com/google/gerrit/acceptance/api/revision/RobotCommentsIT.java:97-109`, `javatests/com/google/gerrit/acceptance/api/revision/RobotCommentsIT.java:247-296`).

## Answers

### 1. Does the tool use raw diffs or structured diff objects?

Structured diff objects. File lists use `Map<String, FileInfo>` and per-file content uses `DiffInfo`, both produced from `PatchList` and `PatchScript` rather than raw diff text (`java/com/google/gerrit/server/change/Files.java:159-176`, `java/com/google/gerrit/server/change/GetDiff.java:154-264`, `java/com/google/gerrit/extensions/common/FileInfo.java:17-25`, `java/com/google/gerrit/extensions/common/DiffInfo.java:20-82`).

### 2. How are changed files represented internally?

As `PatchListEntry` objects in `PatchList`, then surfaced as a `Map<String, FileInfo>` keyed by new path (`java/com/google/gerrit/server/patch/PatchListLoader.java:197-219`, `java/com/google/gerrit/server/patch/PatchListEntry.java:66-128`, `java/com/google/gerrit/server/change/FileInfoJson.java:68-107`).

### 3. How are line numbers mapped back to PR comments?

Comments carry `path`, `side`, `parent`, `line`, and optional `range`, are normalized with `setLineNbrAndRange`, and are tied to the correct revision ID using `setCommentRevId` (`java/com/google/gerrit/extensions/client/Comment.java:27-35`, `java/com/google/gerrit/reviewdb/client/Comment.java:252-258`, `java/com/google/gerrit/server/CommentsUtil.java:493-515`, `java/com/google/gerrit/server/change/PostReview.java:904-919`).

### 4. Does it ignore generated files, lockfiles, vendored files, or binaries?

It handles binaries explicitly (`java/com/google/gerrit/server/change/FileInfoJson.java:80-85`, `java/com/google/gerrit/server/change/GetDiff.java:213-216`) and excludes files whose edits are entirely due to rebase (`java/com/google/gerrit/server/patch/PatchListLoader.java:395-399`). It also treats commit message and merge list as special generated magic files (`java/com/google/gerrit/reviewdb/client/Patch.java:22-37`). No clear evidence found for built-in lockfile, vendored-path, or generic generated-file suppression beyond that search boundary.

### 5. How does it handle renamed, deleted, and moved files?

Rename detection is enabled in the loader, old and new paths are preserved, deleted files keep only side A metadata, and rewrite/delete-add collisions are normalized into a single `REWRITE` record (`java/com/google/gerrit/server/patch/PatchListLoader.java:184-187`, `java/com/google/gerrit/server/patch/PatchListEntry.java:85-102`, `java/com/google/gerrit/server/change/GetDiff.java:217-237`, `java/com/google/gerrit/server/change/FileInfoJson.java:87-104`).

### 6. Can the diff representation support multi-file reasoning?

Partially. Gerrit can enumerate all changed files with `Map<String, FileInfo>` and fetch structured `DiffInfo` for each file, so a caller can build multi-file reasoning on top (`java/com/google/gerrit/server/change/Files.java:159-176`, `java/com/google/gerrit/server/change/GetDiff.java:123-264`). But the normalized hunk model itself is per-file, and I found no single aggregate multi-file diff object for downstream review engines.

### 7. How easy would it be to reuse this diff model in Ultraplan?

Moderately easy at the API shape level, harder at the implementation level. The public models are clean and reusable: `FileInfo`, `DiffInfo`, and the comment coordinate model are straightforward (`java/com/google/gerrit/extensions/common/FileInfo.java:17-25`, `java/com/google/gerrit/extensions/common/DiffInfo.java:20-82`, `java/com/google/gerrit/extensions/client/Comment.java:27-59`). The implementation is more coupled to Gerrit's patch cache, review database, change notes, and JGit-based patch pipeline (`java/com/google/gerrit/server/patch/PatchScriptFactory.java:81-107`, `java/com/google/gerrit/server/patch/PatchScriptFactory.java:189-261`). Reusing the wire model looks easier than extracting the whole ingestion stack.

## Failure Modes And Tradeoffs

- Gerrit explicitly notes that patch history loading does not properly account for files renamed between patch sets, so historical patch objects can be wrong in that scenario (`java/com/google/gerrit/server/patch/PatchScriptFactory.java:299-304`).
- For octopus merges where auto-merge cannot be computed, Gerrit falls back to diffing against the first parent even when that was not requested (`java/com/google/gerrit/server/patch/PatchListLoader.java:164-175`).
- The diff model is structurally rich for file-local review, but multi-file review agents would need an extra aggregation layer on top of `Map<String, FileInfo>` plus per-file `DiffInfo` (`java/com/google/gerrit/server/change/Files.java:159-176`, `java/com/google/gerrit/server/change/GetDiff.java:123-264`).
