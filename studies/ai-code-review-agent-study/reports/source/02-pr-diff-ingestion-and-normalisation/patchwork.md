# Analysis: patchwork — PR Diff Ingestion & Normalisation

## Source: [patchwork](https://github.com/getpatchwork/patchwork)

Patchwork is a **patch tracking system** for community-based projects (primarily Linux kernel subsystems). It ingests patches via email, parses them, and stores diffs in a database. It is **not** a code review agent.

---

## 1. Diff Ingestion Flow

### Fetching
Patchwork does **not** fetch diffs from GitHub/GitLab APIs. It ingests patches delivered via **email** (mbox format). The entry point is `parse_mail()` in `patchwork/parser.py:1192`.

```python
def parse_mail(mail, list_id=None):
    # ...
    if not is_comment:
        diff, message = find_patch_content(mail)   # patchwork/parser.py:1245
```

**Evidence**: `patchwork/parser.py:1244-1247`

### Extracting Diff from Email
`find_patch_content()` at `patchwork/parser.py:681` iterates over email payloads and looks for:
- `subtype in ['x-patch', 'x-diff']` — attached patches directly
- `subtype == 'plain'` — inline patches via `parse_patch()`

```python
def find_patch_content(mail):
    """Extract a comment and potential diff from a mail."""
    patchbuf = None
    commentbuf = ''
    for payload, subtype in _find_content(mail):
        if subtype in ['x-patch', 'x-diff']:
            patchbuf = payload
        elif subtype == 'plain':
            c = payload
            if not patchbuf:
                patchbuf, c = parse_patch(payload)
```

**Evidence**: `patchwork/parser.py:681-700`

---

## 2. Internal Diff Representation

### Diff Storage Model
The `Patch` model stores diffs as a **raw text string** in a `TextField`:

```python
class Patch(SubmissionMixin):
    diff = models.TextField(null=True, blank=True)
```

**Evidence**: `patchwork/models.py:493`

The diff is stored but **never parsed into structured objects** for review purposes.

### Patch Parsing (State Machine)
`parse_patch()` at `patchwork/parser.py:879` implements a **per-line state machine** that:
1. Separates patch diff from comment content
2. Tracks hunk boundaries (`@@ -X,Y +X,Y @@`)  via `_hunk_re` regex (`patchwork/parser.py:38`)
3. Parses extended headers (rename, copy, mode change) via `EXTENDED_HEADER_LINES` list (`patchwork/parser.py:50-63`)
4. Handles binary patches (GIT binary patch state)

**States** (parser.py lines 900-922):
- 0: text
- 1: suspected patch header (diff, Index:)
- 2: patch header line 1 (`---`)
- 3: patch header line 2 (`+++`)
- 4: patch hunk header line (`@@`)
- 5: patch hunk content
- 6: patch meta header (rename from/rename to/new file/index)
- 7: binary patch hunk

**Evidence**: `patchwork/parser.py:879-1042` (especially lines 900-923 state documentation)

### Filename Extraction
`find_filenames()` at `patchwork/parser.py:1515` extracts filenames from diff using:

```python
_filename_re = re.compile(r'^(---|\+\+\+) (\S+)')
```

**Evidence**: `patchwork/parser.py:39`, `patchwork/parser.py:1515-1540`

### Hash-based Deduplication
`hash_diff()` in `patchwork/hasher.py:18` generates a content-addressable hash from diff lines:
- Normalises filenames by stripping `-p1` prefixes
- Strips line numbers from hunk headers
- Only includes `-`, `+`, and context lines

**Evidence**: `patchwork/hasher.py:18-62`

### Diff Hashing on Save
```python
def save(self, *args, **kwargs):
    if self.hash is None and self.diff is not None:
        self.hash = hash_diff(self.diff)
```

**Evidence**: `patchwork/models.py:575-576`

---

## 3. File Filtering & Noise Handling

### Signature/List Footer Removal
`clean_content()` at `patchwork/parser.py:868` strips `-- ` signature blocks and `_____` list footers:

```python
def clean_content(content):
    sig_re = re.compile(r'^(-- |_+)\n.*', re.S | re.M)
    content = sig_re.sub('', content)
    return content.strip()
```

**Evidence**: `patchwork/parser.py:868-877`

### Filename-only Filtering (for Delegation)
`find_filenames()` at `patchwork/parser.py:1515` extracts filenames **from diffs** for delegate assignment. It does **not** filter generated/lockfile/vendor files — it only strips the `/dev/null` prefix for new files.

**Evidence**: `patchwork/parser.py:1515-1540`

### No Ignore Patterns
No evidence found of `gitignore`-style filtering, lockfile detection, generated file detection, or binary file filtering at the diff ingestion layer.

---

## 4. Hunk and Line Mapping

### Hunk Header Parsing
`_hunk_re` regex at `patchwork/parser.py:38` parses `@@` hunk headers:

```python
_hunk_re = re.compile(r'^\@\@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? \@\@')
```

This captures start line and line count for both old and new file versions.

**Evidence**: `patchwork/parser.py:38`

### Line Count Tracking During Parse
During state-machine parsing, line counts `lc = (old_count, new_count)` are tracked and decremented per line:

```python
elif state in [4, 5]:
    if line.startswith('-'):
        lc[0] -= 1
    elif line.startswith('+'):
        lc[1] -= 1
    # ...
    if lc[0] <= 0 and lc[1] <= 0:
        state = 3
        hunk += 1
```

**Evidence**: `patchwork/parser.py:990-1008`

### No Line-to-Comment Mapping
Patchwork has **no concept** of attaching comments to specific diff lines. Comments are:
- Stored as `PatchComment` or `CoverComment` objects
- Related to the entire patch/cover, not to specific lines/hunks
- Displayed in chronological order on the patch page

**Evidence**: `patchwork/models.py:785-828`

---

## 5. Edge Cases

### Renamed Files
Handled via extended header parsing in `parse_patch()` state 6, checking against `EXTENDED_HEADER_LINES`:

```python
'rename from ',
'rename to ',
```

**Evidence**: `patchwork/parser.py:50-63`, `patchwork/parser.py:1009-1023`

### Deleted Files
Handled — `--- a/file` with `/dev/null` as the new file path indicates a deleted file.

### Binary Files
Handled — state 7 (`GIT binary patch`) processes binary patches:

```python
elif state == 7:
    if line.startswith('diff'):
        buf += line
        state = 0
    else:
        patchbuf += buf + line
        buf = ''
```

**Evidence**: `patchwork/parser.py:1024-1030`

### New Empty Files
Handled via `EXTENDED_HEADER_LINES` — `'new file mode '` and checking for `diff --git ... new file mode`.

---

## 6. Multi-file Reasoning

**No multi-file reasoning exists.** Each `Patch` object represents a single diff. The `Series` model groups multiple patches, but there is no unified diff representation across files. The system tracks filenames per-patch (via `find_filenames()`) for delegation purposes, but does not build a cross-file change graph.

---

## 7. Reusability for Ultraplan

### What Could Be Reused
- `parser.parse_patch()` state machine — reasonably robust for parsing unified diff format
- `parser.find_filenames()` — simple filename extraction from diffs
- `parser._hunk_re` regex — reliable hunk header parsing
- `hasher.hash_diff()` — content-addressable diff hashing

### What Cannot Be Reused
- The entire diff representation is a **raw text blob** (`TextField`)
- **No structured diff model** (no File/Hunk/ChangedLine classes)
- **No line-number mapping** for inline comments
- **No line mapping**, file filtering, or noise handling beyond basic signature stripping
- **No API integration** — email-only ingestion

### Reusability Score: **2/10**
The parsing utilities are well-tested (see `patchwork/tests/test_parser.py`) but the **diff is stored as opaque text** with no structured representation suitable for a modern PR review agent that needs to place inline comments on correct lines.

---

## 8. Rating

**Score: 2/10 — Dumps raw diff text with little structure**

| Axis | Rating | Evidence |
|------|--------|----------|
| Diff structure | 2 | Raw `TextField`, no typed model (`patchwork/models.py:493`) |
| Line mapping accuracy | 1 | No line mapping exists (`patchwork/models.py:785-828`) |
| Noise filtering | 3 | Simple sig/footer stripping only (`patchwork/parser.py:868-877`) |
| Edge-case handling | 5 | Handles renames, deletes, binaries, new files via parsed state machine (`patchwork/parser.py:50-63`, `1009-1030`) |
| Reusability | 2 | Parsing utilities usable; no structured diff model |

**Rationale**: Patchwork is a **patch tracking system**, not a code review agent. Its diff handling is designed to store and display patches, not to power AI-driven inline reviews. The diff is stored as raw text, parsed into a state machine for extraction/comment separation, but never converted into a typed model with line-level mappings.

---

## Summary of Evidence

| Item | File | Lines |
|------|------|-------|
| `Patch.diff` field (raw text) | `patchwork/models.py` | 493 |
| `parse_patch()` state machine | `patchwork/parser.py` | 879-1042 |
| Hunk header regex | `patchwork/parser.py` | 38 |
| Extended header list (renames, etc.) | `patchwork/parser.py` | 50-63 |
| `find_filenames()` | `patchwork/parser.py` | 1515-1540 |
| `hash_diff()` | `patchwork/hasher.py` | 18-62 |
| Signature/footer stripping | `patchwork/parser.py` | 868-877 |
| Parser tests | `patchwork/tests/test_parser.py` | 1-1473+ |
