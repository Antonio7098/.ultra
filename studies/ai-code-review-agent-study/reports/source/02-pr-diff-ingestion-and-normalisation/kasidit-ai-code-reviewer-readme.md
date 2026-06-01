# Dimension 02: PR Diff Ingestion & Normalisation — kasidit-ai-code-reviewer-readme

## Source

`/home/antonioborgerees/coding/ultra/.ultra/studies/ai-code-review-agent-study/sources/kasidit-ai-code-reviewer-readme.md`

## Overview

This analysis is based **solely on the README document** (`sources/kasidit-ai-code-reviewer-readme.md`). Per the execution instructions, no external code was accessed — all evidence is drawn from the README's stated design.

**Score: 3/10** — The README describes a design with per-file and per-hunk parsing intent, but provides no implementation details, no data structures, and no evidence the diff model is actually built. It is a specification document for a system that may not exist.

---

## 1. Diff Ingestion Flow

The README (`README.md:12-14`, lines 27-34) describes the intended flow:

1. Triggered on Pull Request open/update
2. Fetches PR diff from GitHub API
3. Parses unified diff → per-file, per-hunk context
4. Sends to LLM
5. Posts inline review comments on specific lines

The README does not describe *how* the diff is fetched (which GitHub API endpoint), nor does it show code for the fetching step. The project structure (`README.md:111-125`) references `github/pr.go` (described as "Fetch PR diff + post comments") but this file is not shown or confirmed to exist.

---

## 2. Internal Diff Representation

The README claims at `README.md:29`: "Parses unified diff → per-file, per-hunk context."

This implies:
- A **per-file** representation (one block per changed file)
- A **per-hunk** representation (splitting file changes into hunks with line number context)

However, the README provides **no data structures, no type definitions, no class diagrams, and no example output** showing what the internal diff model looks like. There is no `diff_parser.go` content shown, no `ParsedFile` or `Hunk` types described, and no example of annotated diff output.

The README states at `README.md:113-124` that the project structure includes:
```
github/
│   ├── pr.go           # Fetch PR diff + post comments
│   └── comment.go
reviewer/
│   ├── reviewer.go     # Orchestrate review
│   ├── diff_parser.go  # Parse unified diff   ← Key file for this dimension
│   └── prompt.go       # Construct review prompt
```

But no code from any of these files is shown. The README is the only source material.

---

## 3. File Filtering Rules

The README describes configurable filtering at `README.md:34` and `README.md:107`:

- `file-extensions`: "go,php,ts,sql" — comma-separated list of allowed extensions
- `max-files`: Maximum 10 files to review per PR
- `severity-threshold`: Minimum severity to post comment

**No evidence** of filtering for:
- Generated files (`package-lock.json`, `node_modules/`, etc.)
- Lockfiles
- Vendored code
- Binary files

The `file-extensions` filter is a whitelist by extension, but there is no mention of how binary files, renamed files, or deleted files are handled.

---

## 4. Line Mapping Strategy

The README claims at `README.md:31`: "Posts inline review comments on specific lines."

The Summary Comment Format (`README.md:92-94`) shows examples:
```markdown
- `src/PaymentService.php:45` — Missing input validation
- `migrations/003_add_index.sql:12` — Index on large table may lock
```

This shows the system should be able to reference specific file:line combinations. However:
- **No code** shows how line numbers are extracted from the diff
- **No code** shows how line numbers map back to GitHub PR comment positions
- **No data structure** shows how a finding's line number is tracked alongside the diff content

The example format `file:line` is shown, but the mechanism to produce it from a unified diff hunk is not described.

---

## 5. Edge Case Handling

No evidence found for handling of:
- **Renamed files** — No mention of rename detection or `previous_filename` tracking
- **Deleted files** — No mention of handling removed files vs. modified files
- **Binary files** — No mention of detecting or skipping binary content
- **Generated/lockfile/vendor files** — `file-extensions` filter is the only filtering mechanism; no mention of generated file categories

The README only lists supported *languages* (Go, PHP, TypeScript, Python, SQL) at `README.md:34`, not file *categories* that should be excluded.

---

## 6. Multi-File Reasoning

The README mentions `max-files: 10` as a configuration limit (`README.md:59`), indicating awareness that PRs can have multiple files. However:
- **No description** of how multiple files are chunked or batched for the LLM
- **No description** of how cross-file findings are handled
- **No description** of how per-file reviews are aggregated into a PR-level summary

The Summary Comment Format (`README.md:81-95`) shows aggregated counts ("Files reviewed: 5 | Issues found: 3"), suggesting multi-file aggregation exists at some level, but the mechanism is not described.

---

## 7. Reusability for Ultraplan

**Very Low.** The README describes a design intent but provides no reusable components:
- No diff data structures to reuse
- No parsing logic shown
- No line mapping strategy documented
- No filtering implementation details

The README could serve as a **specification** for building an Ultraplan integration, but the diff ingestion layer described cannot be directly reused because it exists only as a README claim, not as code.

---

## 8. Failure Modes & Tradeoffs

Based solely on README claims:

1. **No implementation evidence** — The README describes features but provides no code, tests, or example outputs to verify the claims.
2. **No diff parsing details** — "Parses unified diff" is stated but not explained; the parsing strategy (regex, line-by-line, hunk-aware) is unknown.
3. **No line mapping details** — Comment placement is claimed but the mechanism is not described.
4. **No edge case handling evidence** — Binary files, renames, deletes, and generated files are not mentioned as handled.
5. **Configuration is minimal** — Only extension-based filtering; no path-based or category-based filtering.

---

## 9. Questions & Answers

### 1. Does the tool use raw diffs or structured diff objects?

**Unknown / Intended structured.** The README states "Parses unified diff → per-file, per-hunk context" (`README.md:29`), which implies structured objects. However, no data structures, type definitions, or example outputs are shown. The design intent is structured, but there is no evidence the implementation is.

### 2. How are changed files represented internally?

**Not described.** The README lists a `diff_parser.go` file but shows no content. No `File`, `Hunk`, or `Line` types are described. The internal representation is unknown.

### 3. How are line numbers mapped back to PR comments?

**Not described.** The Summary Comment Format shows `file:line` references (`README.md:92-94`), but no code or algorithm for mapping diff line numbers to GitHub PR comment positions is provided.

### 4. Does it ignore generated files, lockfiles, vendored files, or binaries?

**No evidence found.** The only filtering mechanism described is `file-extensions` (language extension whitelist). No mention of generated files, lockfiles, vendor directories, or binary files.

### 5. How does it handle renamed, deleted, and moved files?

**No evidence found.** The README does not mention rename detection, delete handling, or move detection. The `github/pr.go` file that would contain this logic is not shown.

### 6. Can the diff representation support multi-file reasoning?

**Likely limited.** The `max-files: 10` config suggests multi-file awareness, and the summary format aggregates findings across files. However, no batching, chunking, or cross-file reasoning mechanism is described.

### 7. How easy would it be to reuse this diff model in Ultraplan?

**Not applicable.** The diff model exists only as a README claim. There are no data structures, no parsing code, and no tests to reuse. Building an Ultraplan integration would require implementing the entire diff ingestion layer from scratch using the README as a specification only.

---

## 10. Summary Table — Analysis Axes

| Axis | Rating | Evidence |
|---|---|---|
| Diff structure (raw text vs typed model) | 3/10 — README claims structured per-file per-hunk parsing, but no types or output examples shown | `README.md:29` — "Parses unified diff → per-file, per-hunk context" |
| Line mapping accuracy | 2/10 — `file:line` format shown in examples, but no mapping mechanism described | `README.md:92-94` — example comment format only |
| Noise filtering (binaries, lockfiles, vendor, generated) | 2/10 — Only `file-extensions` extension-based filter described; no generated/lockfile/vendor handling | `README.md:34, 107` — `file-extensions` input |
| Edge-case handling (rename, delete, binary, generated) | 1/10 — No mention of any edge cases | No evidence in README |
| Reusability | 1/10 — No code, no types, no implementation; README is a specification only | Entire document is a README with no code |

---

## 11. Rating: 3/10

**Rationale**: The README earns a 3 (rather than 1) because it explicitly mentions per-file and per-hunk context parsing (`README.md:29`), which is better than a raw text dump. However, it scores no higher because:

1. **No implementation evidence** — No code, data structures, or example outputs exist in the document.
2. **No line mapping mechanism** — Comment placement is claimed but not explained.
3. **No edge case handling** — Binary files, renames, deletes, and generated files are unmentioned.
4. **Minimal filtering** — Only extension-based whitelist; no path or category filtering.

**Fast heuristic**: "Would I trust this system to place inline comments on the correct PR lines?" — **Unknown.** The README claims it can, but provides no evidence (code, tests, examples) that the diff parsing or line mapping is actually implemented.

---

## Evidence Summary

| Claim | File Path | Lines |
|---|---|---|
| Intended diff ingestion flow | `sources/kasidit-ai-code-reviewer-readme.md` (README.md) | 27-34 |
| "Parses unified diff → per-file, per-hunk context" | `sources/kasidit-ai-code-reviewer-readme.md` | 29 |
| Project structure listing diff_parser.go | `sources/kasidit-ai-code-reviewer-readme.md` | 113-124 |
| file-extensions filtering | `sources/kasidit-ai-code-reviewer-readme.md` | 34, 107 |
| max-files configuration | `sources/kasidit-ai-code-reviewer-readme.md` | 59, 106 |
| Example comment format with file:line | `sources/kasidit-ai-code-reviewer-readme.md` | 92-94 |
| Supported languages | `sources/kasidit-ai-code-reviewer-readme.md` | 34 |
