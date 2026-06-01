# Dimension 02: PR Diff Ingestion & Normalisation — kasidit-ai-code-reviewer

## Overview

`kasidit-ai-code-reviewer` is a **scaffold/design document only**. The repository contains a stub `main.go` (`cmd/ai-code-reviewer/main.go:9-11`) that prints "Starting ai-code-reviewer..." and no other meaningful implementation. The README (`README.md:1-118`) describes a fully planned system with diff parsing, per-file/per-hunk analysis, and LLM integration, but none of the referenced files (`github/pr.go`, `reviewer/diff_parser.go`, `reviewer/reviewer.go`, `llm/client.go`, `action.yml`) exist. All evidence below is drawn from the README's stated design intentions, not from implemented code.

**Score: 1/10** — Raw diff text dumps with no implementation. Would I trust this to place inline comments on the correct PR lines? No — there is no system to place them.

---

## 1. Diff Ingestion Flow

The README (`README.md:12-14`) describes the intended flow:

1. Triggered on Pull Request open/update.
2. Fetch PR diff from GitHub API.
3. Parse unified diff → per-file, per-hunk context.
4. Send to LLM.
5. Post inline review comments on specific lines.

**No code implements any of these steps.** The `cmd/ai-code-reviewer/main.go:1-12` is a stub. There are no Go files beyond the stub, no `github/` package, no `reviewer/` package, no `llm/` package. The `init.sh:1-79` creates the scaffolding directory structure but nothing inside it.

The README references project structure at `README.md:98-109`:

```
ai-code-reviewer/
├── action.yml
├── cmd/reviewer/main.go
├── github/
│   ├── pr.go           # Fetch PR diff + post comments
│   └── comment.go
├── reviewer/
│   ├── reviewer.go     # Orchestrate review
│   ├── diff_parser.go  # Parse unified diff
│   └── prompt.go       # Construct review prompt
└── llm/client.go
```

**None of these files exist.** The `cmd/ai-code-reviewer/main.go:1-12` is the only `.go` file present, and it contains only a print statement and log statement.

---

## 2. Internal Diff Representation

The README claims at `README.md:13`: "Parses unified diff → per-file, per-hunk context." This implies a typed model, but:

- **No `diff_parser.go` exists.**
- **No `File`, `Hunk`, or `Line` types exist.**
- The `go.mod:1-3` defines an empty module with no dependencies (no `gin`, no `redis`, no `zap` despite `init.sh:28-32` listing them).

The README describes an intent to parse diffs into per-file, per-hunk structures (`README.md:29`), but there is no code that does this.

---

## 3. File Filtering Rules

The README describes at `README.md:34` and `README.md:91`:
- Supported file types: Go, PHP, TypeScript, Python, SQL.
- Configurable via `file-extensions` input ("go,php,ts,sql").

**No code implements this filtering.** The `config/config.yaml:1-8` is scaffolding from `init.sh` and does not contain any file extension rules. No Go code references file filtering, extension checking, or path-based allow/deny lists.

---

## 4. Line Mapping Strategy

The README claims at `README.md:31`: "Posts inline review comments on specific lines." This would require line mapping from the diff to PR comment placement.

**No code implements line mapping.** The GitHub API integration described in `README.md:102-103` requires a `github-token` input, but `github/pr.go` does not exist. The stub `main.go` does not call any GitHub APIs, parse any diffs, or place any comments.

---

## 5. Edge Case Handling

No implementation exists, so edge cases are unhandled by default. The README does not describe any special handling for:

- Renamed files (`README.md` does not mention rename detection).
- Deleted files (`README.md` does not mention handling of removed files).
- Binary files (`README.md` does not mention binary handling).
- Generated/lockfile/vendor files (`README.md:34` only lists language extensions, not file categories like `package-lock.json`, `node_modules/`, etc.).

---

## 6. Multi-File Reasoning

The README describes at `README.md:12-14` that the system should handle PRs with multiple files, but the intended mechanism (per-file-per-hunk context) has no implementation. No code exists to chunk, batch, or reason across multiple files.

---

## 7. Reusability for Ultraplan

**Not reusable.** The codebase is a scaffold with no implemented functionality. The design described in the README would be moderately reusable (per-file per-hunk structure, prompt construction, inline comment posting), but none of it can be evaluated because it does not exist.

To reuse this for Ultraplan, one would need to build the entire diff ingestion layer from scratch.

---

## 8. Failure Modes & Tradeoffs

1. **No action.yml** — The README references `action.yml` at `README.md:99` but it does not exist, meaning the GitHub Action cannot actually run.
2. **Stub main.go** — `cmd/ai-code-reviewer/main.go:9-11` only prints "Starting ai-code-reviewer..." and logs, doing nothing.
3. **No dependencies** — `go.mod:1-3` is bare; `init.sh:27-33` lists dependencies (gin, redis, sqlx, zap, viper) that are never added via `go mod tidy`.
4. **No diff parsing** — The core functionality described (fetch diff, parse, review, comment) has zero implemented code.
5. **No tests** — No test files exist anywhere in the repository.

---

## 9. Questions & Answers

### 1. Does the tool use raw diffs or structured diff objects?

**Neither.** No diff processing code exists. The README describes an intent to use structured diffs (`README.md:13`), but nothing is implemented.

### 2. How are changed files represented internally?

**No representation exists.** No Go types for files, hunks, or lines. The stub `main.go` has no data structures.

### 3. How are line numbers mapped back to PR comments?

**Not implemented.** No GitHub API calls, no comment posting code. The stub does nothing.

### 4. Does it ignore generated files, lockfiles, vendored files, or binaries?

**No.** No filtering logic exists. The stub does not process any diff.

### 5. How does it handle renamed, deleted, and moved files?

**Not handled.** No diff parsing code exists to detect any of these cases.

### 6. Can the diff representation support multi-file reasoning?

**Unknown.** No diff representation exists to evaluate. The README describes a design that could support it, but the code does not.

### 7. How easy would it be to reuse this diff model in Ultraplan?

**Not applicable.** There is no diff model to reuse. The entire system would need to be built from scratch.

---

## 10. Summary Table — Analysis Axes

| Axis | Rating | Evidence |
|---|---|---|
| Diff structure (raw text vs typed model) | N/A — no implementation | `cmd/ai-code-reviewer/main.go:1-12` is the only Go file; no `diff_parser.go`, no `reviewer/` package. |
| Line mapping accuracy | N/A — no implementation | No GitHub API calls, no comment posting code. |
| Noise filtering (binaries, lockfiles, vendor, generated) | N/A — no implementation | No filtering code exists. |
| Edge-case handling (rename, delete, binary, generated) | N/A — no implementation | No code to handle anything. |
| Reusability | 0/10 — nothing to reuse | No implemented diff layer, no types, no parsing logic. |

---

## 11. Final Score: 1/10

| Reason | Detail |
|---|---|
| Nothing implemented | `cmd/ai-code-reviewer/main.go:9-11` is a stub that only prints and logs. |
| Referenced files missing | `action.yml`, `github/pr.go`, `github/comment.go`, `reviewer/reviewer.go`, `reviewer/diff_parser.go`, `reviewer/prompt.go`, `llm/client.go` do not exist. |
| go.mod empty | `go.mod:1-3` declares the module but has no dependencies; `init.sh:27-33` describes dependencies not present. |
| README describes design, not implementation | Every feature claim in the README (`README.md:9-35`) is a planned feature with no code to back it. |

**Justification:** This is a design scaffold, not a working system. The fast heuristic question "Would I trust this system to place inline comments on the correct PR lines?" is **no** — there is no system to trust. The README provides a well-thought-out design specification that could become a functional tool, but as of the current repository state, it is nothing more than scaffolding with a stub entry point.

---

## Evidence Summary

| Claim | File Path | Lines |
|---|---|---|
| README describes intended diff parsing | `README.md` | 13 |
| README describes per-file per-hunk context | `README.md` | 29 |
| README lists project structure | `README.md` | 98-109 |
| Stub main.go | `cmd/ai-code-reviewer/main.go` | 9-11 |
| go.mod is empty | `go.mod` | 1-3 |
| init.sh creates scaffolding | `init.sh` | 1-79 |
| config is scaffold | `config/config.yaml` | 1-8 |
| action.yml referenced but missing | `README.md` | 99 |