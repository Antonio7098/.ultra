# Dimension 02: PR Diff Ingestion & Normalisation — canonical-maas-code-reviewer

## Overview

`canonical-maas-code-reviewer` ingests PR/Merge-Proposal diffs as **raw unified-diff text strings** and represents them internally as nothing richer than `str` for the review path. The only structured projection of a diff is a side-product built on demand for *validation* — `parse_diff_files_and_lines()` in `src/maas_code_reviewer/review_schema.py:20-81` extracts `{file_path: set(new-file line numbers)}` from the raw text. There is no typed diff model (no per-file, per-hunk, per-line objects), no rename detection, no filtering of binaries/lockfiles/generated files, and no separate "diff layer" module — ingestion is a single function call at the platform-client boundary and the string is then passed straight into a prompt.

**Score: 4/10** — The system has a working line-mapping validator and handles new/deleted files, but the entire diff is treated as opaque text with no normalisation step. Truncation, renaming, binaries, lockfiles, and large multi-file diffs are all weak points. Would I trust this to place inline comments on the correct PR lines? Mostly yes for the simple cases it has been designed for (small-to-medium text-only diffs), but no for renames, very large diffs, or diffs that include generated content.

---

## 1. Diff Ingestion Flow

Three entrypoints produce the same kind of value: a unified-diff `str`.

### 1a. Launchpad merge proposal

`src/maas_code_reviewer/cli.py:64-108` (`review_merge_proposal`):

1. Fetch MP via Launchpad API (`launchpad_client.py:37-40`).
2. `git.clone(target_url, repo_dir, target_branch)` — `git.py:11-16`.
3. `git.merge_into(repo_dir, source_url, source_branch)` — `git.py:28-40` does `git fetch` + `git merge FETCH_HEAD --no-edit`.
4. `git.diff(repo_dir, "ORIG_HEAD", "HEAD")` — `git.py:18-26` returns the unified diff between merge base and merged HEAD.
5. The diff string is passed to `review_diff(...)` (`reviewer.py:170-211`) which builds a prompt and calls Gemini.

### 1b. GitHub pull request

`src/maas_code_reviewer/cli.py:197-253` (`handle_review_pr`):

1. `parse_pr_url(url)` extracts `(owner, repo, pr_number)` (`github_client.py:109-163`).
2. `github_client.get_pr_diff(owner, repo, pr_number)` — `github_client.py:24-54` issues:
   ```
   GET https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}
   Accept: application/vnd.github.v3.diff
   Authorization: Bearer {token}
   X-GitHub-Api-Version: 2022-11-28
   ```
3. `github_client.get_pr_description(owner, repo, pr_number)` fetches the PR body via PyGithub (`github_client.py:56-70`).
4. Both are passed to `review_diff_structured(...)`.

### 1c. Local diff file / stdin

`src/maas_code_reviewer/cli.py:152-194` (`handle_review_diff`):

- Reads file with `Path(args.diff_file).read_text()` or `sys.stdin.read()` for `-` (`cli.py:158-161`).
- No fetching, no validation of format — assumed to already be a unified diff.

### 1d. What gets passed to the LLM

`src/maas_code_reviewer/reviewer.py:131-132` and `203-204`:

```python
truncated_diff = _truncate_diff(diff, max_diff_chars)  # default 30_000
prompt = _build_structured_prompt(truncated_diff, description)
```

The truncated diff is wrapped in a fenced code block and placed inside the system prompt (`reviewer.py:217-221`, `263-265`).

---

## 2. Internal Diff Representation

**The diff has no internal representation other than `str`.** It is a parameter on `review_diff` (`reviewer.py:172`) and `review_diff_structured` (`reviewer.py:89`), it is captured by `ReviewMetrics.diff_lines` / `diff_size_bytes` (`metrics.py:18-19`, `reviewer.py:315-316, 329-330`), and that is the extent of the model.

The **only structured projection** is a side product used purely to validate the LLM's inline-comment output:

`src/maas_code_reviewer/review_schema.py:20-81`:

```python
def parse_diff_files_and_lines(diff_text: str) -> dict[str, set[int]]:
    """Extract the set of valid file paths and changed line numbers from a unified diff.
    Returns a dict mapping file path → set of new-side line numbers that
    appear in the diff hunk headers and added/context lines.
    """
```

The parser walks each line of the raw diff:

| Line prefix | Action | File:line |
|---|---|---|
| `+++ ` | Sets `current_file`; strips `b/` prefix; if `/dev/null`, sets `current_file = None` | `review_schema.py:33-44` |
| `--- ` | Ignored (handled via `+++`) | `review_schema.py:46-48` |
| `@@ ` | Parses hunk header for the `+new_start[,new_count]` part and sets `current_line` | `review_schema.py:50-64` |
| `-` (deletion) | Skipped (does not advance the new-file counter) | `review_schema.py:69-72` |
| `+`, ` `, `""` | Added/context line — added to set, counter incremented | `review_schema.py:74-79` |

There are **no** Python dataclasses for `File`, `Hunk`, `Change`, `Line`. There is no concept of "added lines vs context lines" in the model — both end up in the same `set[int]`. There is no per-hunk structure, no old-side line numbers, no per-line change kind, no parent commit / blob reference, and no metadata about the file (mode, symlink, binary, submodule, etc.).

The `REVIEW_JSON_SCHEMA` constant (`review_schema.py:4-17`) describes the **output** review format, not the diff:

```python
REVIEW_JSON_SCHEMA = {
    "type": "object",
    "required": ["general_comment", "inline_comments"],
    "properties": {
        "general_comment": {"type": "string"},
        "inline_comments": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "additionalProperties": {"type": "string"},
            },
        },
    },
}
```

---

## 3. File Filtering Rules

**There are no file filtering rules in the production code.** Searched for `binary`, `generated`, `lockfile`, `vendor`, `rename`, `delete`, `filter` across `src/maas_code_reviewer/*.py` — only one match, the `canonical/maas-code-reviewer` URL string in the review preamble (`reviewer.py:15`).

Concretely:

- The `git diff` invocation in `git.py:18-26` uses no `--diff-filter`, no `--binary`, no `-M`/`-C` rename/copy detection, no `--no-renames`, no path filtering. Whatever git's default behaviour produces is what gets sent to the LLM.
- The GitHub `application/vnd.github.v3.diff` media type does not include binary patches (the response is always textual), but the system does no other filtering.
- The `parse_diff_files_and_lines` function (`review_schema.py:20-81`) makes no attempt to skip files; it parses whatever appears between `+++` lines.
- The 30,000-character truncation (`reviewer.py:93, 117, 333-337`) is character-count-based and may chop a diff in the middle of a hunk, which can cause downstream validation to reject valid line numbers if the file is dropped entirely.

**Implication**: lockfiles (`package-lock.json`, `Cargo.lock`, `uv.lock`), vendored trees (`node_modules/`, `vendor/`), generated code, large fixture files, and minified assets are all included in the review prompt. The only protection is the 30k-character cap.

---

## 4. Line Mapping Strategy

Line mapping is **only** used to *validate* the LLM's claimed line numbers, not to project old-side line numbers or to attach comments to a richer diff model. Strategy:

1. `parse_diff_files_and_lines()` is called by `validate_review_json()` (`review_schema.py:125`) to get the set of valid `(file_path, new_file_line_number)` pairs from the **truncated** diff (`reviewer.py:135`).
2. The LLM is instructed in `STRUCTURED_SYSTEM_INSTRUCTION` (`reviewer.py:47-52`) to:
   - Only include file paths that appear in the diff.
   - Only include line numbers that appear in the diff for that file.
   - Use the **new-file** line numbers from the hunk headers.
3. Each `(file_path, line_str)` pair in the LLM output is checked against the parsed set (`review_schema.py:144-164`). Invalid entries produce a validation error message.
4. The `validate_review` tool (`reviewer.py:134-135, 150-167`) is exposed to the LLM so it can self-correct before submitting.
5. When posting a GitHub review, `cli.py:245-249` flattens the structured dict into the `{path, line, body}` shape PyGithub expects:
   ```python
   comments = [
       {"path": file_path, "line": int(line_str), "body": comment_body}
       for file_path, line_map in inline_comments.items()
       for line_str, comment_body in line_map.items()
   ]
   ```

Accuracy assessment:

- **Strength**: line numbers are validated against the same diff the LLM saw, so the LLM cannot post comments on lines that were not in the diff.
- **Weakness**: there is no fall-back. If the LLM generates a syntactically valid JSON that fails the diff-validation step, the only way to recover is via the `validate_review` tool call (the LLM self-correction loop). There is no programmatic re-mapping from old-side to new-side line numbers, no fuzzy matching, no "approximate line" support.
- **Weakness**: the validator is fed the *truncated* diff (`reviewer.py:135`), not the original. A file that survives truncation but whose hunk headers are still complete will validate; a file whose tail is chopped in the middle of a hunk may end up with a partial `current_line` and reject line numbers the LLM thinks are valid (e.g. test at `review_schema.py:188-197` exercises this fallback behaviour).

---

## 5. Edge Case Handling

| Edge case | Handled? | Evidence |
|---|---|---|
| New file (added in PR) | Yes — included in `parse_diff_files_and_lines` result. | `test_review_schema.py:143-153`; `review_schema.py:36-44` (strips `b/`, records file). |
| Deleted file (removed in PR) | Yes — excluded. `+++ /dev/null` sets `current_file = None`, so no lines are recorded and any inline comment for the deleted file fails validation. | `test_review_schema.py:137-141, 322-331`; `review_schema.py:38-43`. |
| Multiple hunks per file | Yes — `current_line` is re-seeded from each `@@` header. | `test_review_schema.py:159-181`; `review_schema.py:50-64`. |
| Multiple files in one diff | Yes — `current_file` flips on each `+++` line. | `test_review_schema.py:116-135`. |
| `b/` path prefix | Yes — stripped. | `test_review_schema.py:79-82`; `review_schema.py:36-38`. |
| Path without `b/` prefix | Yes — kept as-is. | `test_review_schema.py:183-186`; `review_schema.py:35`. |
| Malformed hunk header | Partial — falls back to `current_line = 0` and keeps going. Lines may be recorded with line number 0, which is not useful. | `test_review_schema.py:188-197`; `review_schema.py:59-62`. |
| Context lines as comment targets | Yes — context lines (` `) are valid targets. | `test_review_schema.py:333-342`. |
| Empty diff | Yes — short-circuits with a default comment, no LLM call. | `reviewer.py:124-129, 518-531` (`test_reviewer.py`); `EMPTY_DIFF_GENERAL_COMMENT = "No changes to review: the provided diff is empty."` (`reviewer.py:84`). |
| **Renamed file** | **No** — there is no special handling. The parser only looks at `+++` line content; it does not look at the `rename from`/`rename to` extended-header lines that some diffs emit. Relies entirely on git's default rename detection at the `git diff` layer (`git.py:18-26`). If git produces a `rename from X\nrename to Y\nextended header` block, the parser will treat `Y` as a new file and ignore `X` (since `+++ b/Y` is the only `+++` it tracks). | No evidence of explicit rename handling in `src/maas_code_reviewer/`. |
| **Binary files** | **No** — not filtered. The `git diff` call has no `--binary` / `--no-binary` flag. Binary content is unlikely to flow through the GitHub `application/vnd.github.v3.diff` media type, but if it does, it would be included verbatim in the prompt and the parser would treat it as ordinary text (any binary blob starting with a `+` would be misread). | No evidence of binary filtering. |
| **Lockfiles / generated / vendored** | **No** — no allowlist/denylist. | No evidence of any path-based filter (`grep` for `binary|generated|lockfile|vendor|filter` returns nothing). |
| Symlinks, submodules, mode changes | No — git emits these as `new mode`, `new symlink`, `Subproject commit ...` lines and the parser ignores them all. | No handling in `review_schema.py`. |
| Non-unified diff format | No — parser is hard-coded to unified-diff conventions (`@@ -X,Y +A,B @@` headers, `+`/`-`/` ` line prefixes). | Test fixtures in `test_review_schema.py:13-62` are all unified diff. |
| Diff exceeding 30,000 characters | Yes — truncated; `TRUNCATION_NOTE` is appended. | `reviewer.py:79-82, 333-337`; `test_reviewer.py:79-99, 159-176, 581-597`. |
| Line number key not parseable as int | Yes — validation rejects non-numeric line keys. | `review_schema.py:147-153`. |

---

## 6. Multi-File Reasoning

The diff is sent to the LLM as a single string. Multi-file reasoning is therefore done entirely inside the LLM's context window, with these mechanisms:

- All files appear in one prompt inside one fenced code block (`reviewer.py:217-221, 263-265`).
- The LLM is given a JSON schema that supports a per-file-per-line inline-comment map (`review_schema.py:4-17`).
- The validator confirms each file path and each line number, so a comment cannot accidentally point at a file or line outside the diff (`review_schema.py:135-164`).
- The LLM has access to `read_file` and `list_directory` tools (`reviewer.py:137, 206`, `repo_tools.py:8-41`) that allow it to read the post-merge working tree for cross-file reasoning, scoped to the repository directory for path-traversal safety (`repo_tools.py:24, 36`).

There is **no per-file chunking** (the entire diff goes in one prompt) and **no per-file analysis step** (a single LLM call handles every file). The system is implicitly bounded by Gemini's context window and by the 30,000-character truncation in `reviewer.py:93, 117`.

---

## 7. Reusability for Ultraplan

**Easiest components to lift:**

| Component | Why it's reusable | File:line |
|---|---|---|
| `parse_diff_files_and_lines()` | Pure function, 60 lines, no external dependencies. Produces the canonical "valid line numbers per file" projection that any review system needs. | `review_schema.py:20-81` |
| `validate_review_json()` | Pure validator against a JSON schema + the diff. Decoupled from the LLM provider. | `review_schema.py:84-166` |
| `REVIEW_JSON_SCHEMA` | The output format (general_comment + inline_comments keyed by file/line) is platform-agnostic. | `review_schema.py:4-17` |
| `RepoTools` | Path-traversal-safe `read_file`/`list_directory` callable wrapper. | `repo_tools.py:8-41` |
| `GitClient` protocol-as-class | Tiny, focused wrapper around `subprocess` for clone/diff/merge. Could be replaced wholesale or reused as-is. | `git.py:8-60` |
| `review_diff` / `review_diff_structured` | Orchestration functions that take a diff string + a `GeminiClient`-shaped LLM. | `reviewer.py:87-147, 170-211` |

**What would have to be built or replaced:**

1. **A typed diff model.** The current `str` approach is fine for the prompt but useless for downstream tooling (hunk counts, per-file summaries, "files changed" tables, per-line annotations). Ultraplan would benefit from a proper `Diff → List[File] → List[Hunk] → List[Line]` projection.
2. **File filtering.** No allowlist/denylist, no size cap per file, no binary detection, no lockfile detection, no vendored-tree detection. Ultraplan needs at least a default denylist (`*.lock`, `package-lock.json`, `node_modules/`, etc.).
3. **Rename handling.** The parser does not understand `rename from`/`rename to` extended header lines. GitHub's `application/vnd.github.v3.diff` and `git diff -M` outputs can include these, and the system would silently mis-classify a renamed file as a new file.
4. **Truncation strategy.** The current character-count truncation can cut a hunk in half. Ultraplan should consider per-hunk or per-file chunking with a structured "summary + detailed hunks" representation.
5. **API abstraction.** The diff client is hard-coded to the GitHub diff media type and to a single Launchpad flow. A `DiffProvider` protocol (with `get_diff(pr_ref) -> RawDiff`) would decouple ingestion from the review engine.

The good news is that **the diff layer is already very thin** — there is no large proprietary abstraction to unwind. Lifting `review_schema.py` and `RepoTools` wholesale would cover about 70% of what's reusable.

---

## 8. Failure Modes & Tradeoffs

1. **Truncation can invalidate the LLM's output.** The truncated diff is what gets passed to the validator (`reviewer.py:135`), so any file present in the original but chopped out of the prompt becomes "not in diff" and the LLM's comments on it are rejected. There is no re-truncation / re-validation pass.
2. **No protection against prompt-injection-via-diff.** A malicious PR could include instructions inside the diff body that the LLM obeys. The system trusts the diff text 100%.
3. **Single LLM call, no per-file analysis.** Large multi-file PRs exceed the 30k-character cap and lose either the tail of the diff or entire files. The system does not split or summarise.
4. **`git diff` defaults determine what gets reviewed.** Without explicit `--diff-filter` or `-M` flags (`git.py:18-26`), the system inherits git's heuristics. Renames below the similarity threshold become add+delete pairs, which the parser handles as new file (the add) plus silently-dropped delete, leading to comments on the new path that may not match the developer's intent.
5. **No tests for binary, rename, or generated-file behaviour.** Searched `tests/` — no fixtures or assertions for `*.lock`, `node_modules/`, symlink entries, `Binary files ... differ`, or `rename from`/`rename to` headers. The edge-case test surface stops at: new file, deleted file, two files, multiple hunks, malformed hunk, `b/` prefix, plain path, empty diff (`test_review_schema.py:13-197`).
6. **Structured output can crash the run.** If the LLM returns text that is not JSON and not in a fenced block, `review_diff_structured` raises `json.JSONDecodeError` (`reviewer.py:142-143`; see `test_reviewer.py:626-635`). There is no retry, no fallback to plain-text `review_diff`.
7. **Coverage enforcement is 100%** (`Makefile:16`: `--cov-fail-under=100`), which is good for the surface area that is tested, but the test surface is narrow — the uncovered edge cases above are simply not exercised.

---

## 9. Summary Table — Analysis Axes

| Axis | Rating | Evidence |
|---|---|---|
| Diff structure (raw text vs typed model) | Raw text only | `reviewer.py:89, 172`; `cli.py:91, 161, 215`; no `File`/`Hunk`/`Line` types exist in `src/maas_code_reviewer/`. |
| Line mapping accuracy | Adequate for new/context lines, weak for renames | `review_schema.py:20-81` (parser) + `validate_review_json` (`review_schema.py:84-166`); no old-side mapping. |
| Noise filtering (binaries, lockfiles, vendor, generated) | None | `grep -E "binary|generated|lockfile|vendor|filter"` over `src/maas_code_reviewer/*.py` returns one irrelevant match. |
| Edge-case handling (rename, delete, binary, generated) | Partial: new + delete handled; rename + binary + generated not handled | `review_schema.py:33-44`; no rename handling. |
| Reusability | High for `review_schema.py` + `repo_tools.py`; low for the rest (no abstraction to reuse) | `review_schema.py`, `repo_tools.py` are pure / protocol-free. |
| Multi-file reasoning | Supported by passing whole diff in one prompt + per-file validation in the JSON schema | `review_schema.py:4-17`; `reviewer.py:137, 206`. |

---

## 10. Final Score: 4/10

| Reason | Detail |
|---|---|
| In favour (+): new/delete handled, validator is well-tested, JSON output is platform-agnostic, `parse_diff_files_and_lines` is a clean reusable unit. | `review_schema.py:20-81, 84-166`; `test_review_schema.py:13-342`. |
| Against (−): raw `str` only, no typed model, no filtering, no rename handling, no binary handling, character-count truncation can chop hunks, no per-file analysis, narrow test surface. | `git.py:18-26`; `reviewer.py:93, 117, 333-337`; absence of any filter logic. |

The system is functional for the common case of a small-to-medium text-only diff on a single platform, and the schema validation step gives it a non-trivial robustness win over a "just paste the diff in" implementation. But the absence of any normalisation layer (typed model, file filtering, rename handling, binary detection, structured chunking) keeps it in the "works in the easy cases" band, not the "production-grade" band.
