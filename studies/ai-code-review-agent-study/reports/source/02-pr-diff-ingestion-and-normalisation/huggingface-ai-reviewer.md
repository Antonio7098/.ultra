# huggingface-ai-reviewer — Dimension 02: PR Diff Ingestion & Normalisation

## Source

`/home/antonioborgerees/coding/ultra/.ultra/studies/ai-code-review-agent-study/sources/huggingface-ai-reviewer`

## Diff Ingestion Flow

The flow is:

1. `GitHubClient.get_pr_files()` (`reviewbot/github_client.py:29-44`) fetches the list of changed files from GitHub's `GET /repos/{owner}/{repo}/pulls/{number}/files` API, paginated at 100 files per page. Each file entry contains `filename`, `status`, `patch`, `additions`, `deletions`, and `previous_filename`.

2. `_build_annotated_diff_chunks()` (`reviewbot/reviewer.py:279-335`) iterates over the file list. For each file with a `patch`, it calls `parse_patch()` to produce a `ParsedFile`, then splits the annotated diff into character-bounded chunks via `_split_annotated_block()` (`reviewbot/reviewer.py:203-276`). The `skip_paths` set (populated from the context script) causes files to be omitted entirely.

3. For each chunk, the annotated diff text — a unified diff with `[Rxxxx]` / `[Lxxxx]` line-number tags embedded — is placed into the user prompt via `build_user_prompt()` (`reviewbot/prompts.py:423-470`).

4. The LLM's response is validated by `_validate_comments()` (`reviewbot/reviewer.py:338-360`), which checks that each returned `(path, side, line)` triple exists in the chunk's `visible_positions` map. Any comment referencing a line not in the visible set is dropped and logged.

---

## Internal Diff Representation

### `patch.py` — Core Data Structures

**`DiffPosition`** (`patch.py:8-13`):
```python
@dataclass
class DiffPosition:
    side: str  # "RIGHT" for added/context, "LEFT" for deletion
    line: int  # file line number on that side
```

**`ParsedFile`** (`patch.py:17-25`):
```python
@dataclass
class ParsedFile:
    path: str
    valid_positions: set[tuple[str, int]] = field(default_factory=set)
    annotated: str = ""   # human-readable, line-numbered diff for LLM
    raw_patch: str = ""   # retained for snippet extraction
```

**`DiffSnippetLine`** (`patch.py:76-86`) for web UI diff hunk rendering:
```python
@dataclass
class DiffSnippetLine:
    op: str           # "+", "-", or " "
    old: Optional[int]
    new: Optional[int]
    text: str
    is_target: bool = False
```

### `parse_patch()` — Patch Parsing (`patch.py:28-73`)

The function parses a unified diff `patch` string per file:

- Regex `_HUNK_RE = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")` (line 5) matches hunk headers.
- Each `+` line (not `+++`) gets a `RIGHT` position entry and is annotated as `[R{line}]`.
- Each `-` line (not `---`) gets a `LEFT` position entry and is annotated as `[L{line}]`.
- Context lines (starting with ` `) get a `RIGHT` position and `[R{line}]` annotation.
- `parsed.valid_positions` accumulates all addressable `(side, line)` pairs.
- `parsed.annotated` is the full annotated string fed to the LLM.

### `_split_annotated_block()` (`reviewbot/reviewer.py:203-276`)

Splits a `ParsedFile`'s annotated text into chunks that fit within `max_chars`. Prefers hunk-aligned splits; falls back to line-level splits inside a hunk, repeating the `@@` header in each fragment so the LLM retains local context.

### `_DiffChunk` dataclass (`reviewbot/reviewer.py:179-183`)

```python
@dataclass
class _DiffChunk:
    text: str
    parsed_by_path: dict[str, ParsedFile]
    visible_positions: dict[str, set[tuple[str, int]]]
```

`visible_positions` is a map of file path → set of `(side, line)` pairs that are valid comment targets within that chunk. Built by `_extract_visible_positions()` (`reviewbot/reviewer.py:192-200`) using the regex `_TAGGED_DIFF_LINE_RE = re.compile(r"^\[(R|L)\s*(\d+)\] ")` (`reviewbot/reviewer.py:117`).

---

## Line Mapping Strategy

1. **Annotation**: `parse_patch()` transforms the raw unified diff into annotated text where each addressable line is prefixed with `[R{line}]` or `[L{line}]`. This annotated text is what the LLM sees.

2. **Extraction**: `_extract_visible_positions()` (`reviewbot/reviewer.py:192-200`) scans the annotated text line-by-line using `_TAGGED_DIFF_LINE_RE`, extracting `(side, line)` pairs into a set. This set IS the `visible_positions` for a chunk.

3. **Validation**: `_validate_comments()` (`reviewbot/reviewer.py:338-360`) runs on the LLM's output JSON. For each comment, it checks whether `(side, line)` is in `visible_positions[path]`. Invalid comments are rejected.

4. **Snippets**: `extract_hunk_snippet()` (`patch.py:89-138`) reconstructs a GitHub-style diff hunk around a commented line by re-parsing the `raw_patch` and locating the target `(side, line)`. Returns `list[DiffSnippetLine]`.

**No path through this system can post a comment on a line not in the diff.** The validation at `reviewer.py:354-358` is the enforcement point.

---

## File Filtering Logic

### Context Script (`reviewbot/context_script.py:1-193`)

The repo can supply an executable `.ai/context-script` that receives a JSON payload on stdin:

```json
{
  "title": "...",
  "body": "...",
  "files": [
    {"path": "foo.py", "status": "added|modified|removed|renamed|copied|changed",
     "additions": int, "deletions": int, "previous_path": str|null}
  ]
}
```

stdout can be plain text (injected as `REPO-PROVIDED CONTEXT`) or a JSON object:
```json
{"context": "...", "skip_files": ["generated/foo.py", "vendor/"]}
```

`skip_files` causes matching paths to be omitted from the diff entirely. This is the primary mechanism for filtering generated files, lockfiles, vendored code, and binaries.

### Built-in Handling

- **Binary files**: GitHub's file API returns no `patch` for binary files. `_build_annotated_diff_chunks()` skips any file where `patch` is absent (`reviewer.py:300-301`). A notice is posted if no reviewable hunks remain (`reviewer.py:1086-1092`).
- **Renamed files**: `previous_filename` is provided by GitHub's API and passed to the context script as `previous_path`. The context script can decide to skip it.
- **Deleted files**: The `status: "removed"` is visible to the context script; LEFT-side comments can be placed on deleted lines.
- **Generated files / lockfiles**: No built-in denylist. The system relies entirely on the context script (`.ai/context-script`) to identify and skip these. If no context script is present, nothing is filtered.

---

## Multi-File Reasoning

The system can handle multi-file PRs through chunking. When the annotated diff for all changed files exceeds `max_diff_chars` (default 200,000), `_build_annotated_diff_chunks()` splits the review into multiple LLM calls, each with its own chunk of diff and visible positions.

Per-chunk summaries are merged via `_synthesize_merged_summary()` (`reviewbot/reviewer.py:556-616`) — an additional LLM call that rewrites multiple partial summaries into a single coherent PR-level review, avoiding chunk references in the published output.

The `ReviewDraft` dataclass (`reviewbot/reviewer.py:78-100`) accumulates comments from all chunks, deduplicates by `(path, side, line, body)`, and renders them as a single review.

---

## Evidence

| Concern | Evidence |
|---|---|
| Diff fetching | `github_client.py:29-44` — `get_pr_files()` paginated API call |
| Internal model | `patch.py:8-86` — `DiffPosition`, `ParsedFile`, `DiffSnippetLine` dataclasses |
| Patch parsing | `patch.py:28-73` — `parse_patch()` with `_HUNK_RE` regex |
| Line annotation | `patch.py:56-68` — `[Rxxxx]` / `[Lxxxx]` annotation per line |
| Line extraction | `reviewer.py:117` — `_TAGGED_DIFF_LINE_RE` regex; `reviewer.py:192-200` — `_extract_visible_positions()` |
| Comment validation | `reviewer.py:338-360` — `_validate_comments()` against `visible_positions` |
| Chunk splitting | `reviewer.py:203-276` — `_split_annotated_block()` hunk/line-aware splitting |
| Multi-chunk merge | `reviewer.py:556-616` — `_synthesize_merged_summary()` |
| File filtering | `context_script.py:19-20, 34, 121-125` — `skip_files` support |
| Binary file handling | `reviewer.py:300-301` — skips files with no `patch` |
| Snippet extraction | `patch.py:89-138` — `extract_hunk_snippet()` for web UI |
| Rename tracking | `context_script.py:77` — `previous_path` provided to context script |
| Tests | `tests/test_reviewer.py:145-179` — `DiffChunkingTests` with position preservation checks |

---

## Questions

### 1. Raw diffs or structured diff objects?
**Structured objects.** The key types are `ParsedFile` (`patch.py:17-25`), `DiffPosition` (`patch.py:8-13`), and `DiffSnippetLine` (`patch.py:76-86`). The LLM receives annotated text, but the underlying representation is typed and position-tracked.

### 2. How are changed files represented internally?
`ParsedFile` holds `path`, `valid_positions: set[tuple[str, int]]`, `annotated: str`, and `raw_patch: str`. Files without patches (binaries) are silently skipped at chunking time.

### 3. How are line numbers mapped back to PR comments?
- `parse_patch()` annotates each addressable line as `[R{line}]` or `[L{line}]`.
- `_extract_visible_positions()` inverts the annotated text back into a `set[tuple[str, int]]`.
- `_validate_comments()` checks each LLM-returned `(path, side, line)` against this set. Rejected comments are logged at `reviewer.py:1246-1252`.

### 4. Does it ignore generated files, lockfiles, vendored files, or binaries?
- **Binaries**: Yes — GitHub returns no `patch`, and `reviewer.py:300-301` skips such files.
- **Generated / lockfiles / vendored**: No — there is no built-in denylist. Filtering depends entirely on a repo-supplied `.ai/context-script`. If absent, nothing is filtered.

### 5. How does it handle renamed, deleted, and moved files?
- **Renamed**: `previous_filename` is surfaced to the context script as `previous_path`; the context script can opt to skip the file.
- **Deleted**: `status: "removed"` passed to context script; LEFT-side positions are tracked and valid for comments.
- **Moved**: No special handling; treated as modified with a content delta.

### 6. Can the diff representation support multi-file reasoning?
Yes. The `_DiffChunk` structure aggregates `parsed_by_path` and `visible_positions` per chunk. Multiple chunks accumulate into a single `ReviewDraft`. The synthesis LLM call merges per-chunk summaries into one coherent review. However, each chunk is a separate LLM call with no cross-chunk state except the accumulated comments.

### 7. How easy would it be to reuse this diff model in Ultraplan?

**Moderate.** The core `parse_patch()` / `ParsedFile` / `DiffSnippetLine` layer in `patch.py` is cleanly separated from the GitHub API and review logic. It handles:
- Unified diff parsing with hunk header extraction
- `[R/L]` annotation for line mapping
- Snippet extraction for UI rendering

What would require adaptation:
- The GitHub API client (`github_client.py`) — replace with Ultraplan's API.
- The context script mechanism (`context_script.py`) — replace with Ultraplan's config/rules injection.
- The comment validation layer (`_validate_comments`) — replace with Ultraplan's comment API.
- The prompt templates (`prompts.py`) — replace with Ultraplan's prompt strategy.

The patch model itself is the most reusable component. The review pipeline around it (triggering, chunking, LLM interaction, publishing) would need significant rework.

---

## Failure Modes and Tradeoffs

| Failure Mode | Impact |
|---|---|
| No built-in filtering for generated/lockfiles | PRs with large auto-generated diffs (e.g., `package-lock.json`, `yarn.lock`, protobufgenerated files) will consume the diff budget without useful review output unless the repo provides a context script. |
| Context script is opt-in | Most repos will not have a `.ai/context-script`, so filtering defaults to off. |
| Left-side comment placement depends on accurate `LEFT` annotation | If the unified diff format from GitHub has irregularities (e.g., incomplete hunk headers), the line number tracking could misalign. The `parse_patch()` implementation handles the happy path but has no explicit error handling for malformed patches. |
| Chunks are independent | There is no cross-chunk position tracking. A comment on a line that happens to appear in two chunks will only be validated against the chunk where it appears; if the LLM places it in the wrong chunk, it could be validated against the wrong file. |
| Binary file handling is silent | Binary files are simply omitted from review without notification to the reviewer. |
| Renamed file tracking relies on context script | If the context script doesn't handle `previous_path`, renamed files are reviewed as if they were new files (on the new path). |

---

## Rating

**Score: 7 / 10**

**Rationale**: The system uses a clean typed diff model (`ParsedFile`, `valid_positions`, annotated `[R/L]` lines) with solid comment validation. Line mapping is reliable — the `[Rxxxx]` / `[Lxxxx]` annotation system and the `_validate_comments()` check make it difficult to place a comment on a wrong line. The chunking mechanism is well thought out (hunk-aligned splits, visible-position tracking across chunks, synthesis merge). Multi-file reasoning is supported via chunking + synthesis.

Deductions:
- No built-in filtering for generated/lockfiles/vendored files — relies entirely on an opt-in context script that most repos won't have.
- Binary files are silently skipped rather than surfaced.
- Renamed file handling depends entirely on repo-side configuration.
- The LEFT/RIGHT annotation is tied to a specific diff format (unified diff); if the GitHub API ever changes its patch format, the regex-based parser could break.

The design earns a 7 rather than higher because the noise-filtering gap (no built-in generated/lockfile filtering) is significant for production use, and the annotation layer is coupled to unified diff format rather than being a more general diff model.

**Fast heuristic**: "Would I trust this system to place inline comments on the correct PR lines?" — Yes, for lines in properly-formed unified diffs. No, for generated/lockfile-heavy PRs without a custom context script.