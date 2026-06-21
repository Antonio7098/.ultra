# Repo Analysis: aider

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | aider |
| Path | `repos/aider` |
| Language / Stack | Python, CLI tool |
| Analyzed | 2026-05-17 |

## Summary

Aider sits at **Guided Autonomy** on the spectrum, with configurable leaning toward **Semi-Autonomous**. The system's philosophy is "AI-first but human-supervised": by default, the LLM agent can auto-edit, auto-commit, auto-lint, and auto-create files, but every action that touches user content outside the chat boundary requires explicit human approval. Autonomy is highly configurable per session via CLI flags.

## Rating

**7/10** — Configurable autonomy with clear boundaries and safeguards. All autonomous behaviors have corresponding flags to enable/disable. However, there is no per-workflow or per-agent autonomy configuration; the settings apply globally per session.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Auto-commits enabled by default | `auto_commits=True` in `Coder.__init__` | `aider/coders/base_coder.py:409-413` |
| Auto-lint enabled by default | `auto_lint=True` in `Coder.__init__` | `aider/coders/base_coder.py:527` |
| Auto-test disabled by default | `auto_test=False` in `Coder.__init__` | `aider/coders/base_coder.py:529` |
| Auto-accept architect enabled by default | `auto_accept_architect=True` passed to `Coder.create` | `aider/main.py:1005` |
| Dirty commits enabled by default | `dirty_commits=True` in `Coder.__init__` | `aider/coders/base_coder.py:413` |
| File creation without asking | System prompt tells LLM "You can create new files without asking!" | `aider/coders/editblock_prompts.py:17` |
| Shell command suggestion enabled by default | `suggest_shell_commands=True` in `Coder.__init__` | `aider/coders/base_coder.py:117` |
| URL detection enabled by default | `detect_urls=True` in `Coder.__init__` | `aider/coders/base_coder.py:118` |
| Human approval for editing files outside chat | `allowed_to_edit()` checks via `confirm_ask` | `aider/coders/base_coder.py:2226-2228` |
| Human approval for creating new files | `confirm_ask` for new file creation | `aider/coders/base_coder.py:2207` |
| Human approval before shell command execution | `confirm_ask` with `explicit_yes_required=True` | `aider/coders/base_coder.py:2456-2462` |
| Human approval for lint fix | `confirm_ask("Attempt to fix lint errors?")` | `aider/coders/base_coder.py:1603-1606` |
| Human approval for test fix | `confirm_ask("Attempt to fix test errors?")` | `aider/coders/base_coder.py:1619-1622` |
| Human approval for file mentions | `confirm_ask("Add file to the chat?")` | `aider/coders/base_coder.py:1772-1773` |
| Human approval for URL scraping | `confirm_ask("Add URL to the chat?")` | `aider/coders/base_coder.py:976-977` |
| Max reflections limit for self-correction | `max_reflections = 3` | `aider/coders/base_coder.py:101` |
| Reflection loop logic | After failed edits, reflects errors back to AI for retry | `aider/coders/base_coder.py:932-944` |
| Git undo capability | `/undo` command reverts aider commits | `aider/commands.py:553-655` |
| Yes-always flag bypasses all prompts | `--yes-always` arg (default: None) | `aider/args.py:760-764` |
| Auto-commit behavior after edits | `auto_commit()` called after `apply_updates()` | `aider/coders/base_coder.py:1589` |
| Architect mode: two-model pipeline | `ArchitectCoder` plans, creates editor coder automatically | `aider/coders/architect_coder.py:37-44` |
| Architect edit approval gate | When `auto_accept_architect=False`, asks user | `aider/coders/architect_coder.py:17` |
| Different coder modes = different autonomy | `ask` (read-only), `diff`/`whole` (editable), `architect` (two-model) | `aider/coders/__init__.py:18-33` |
| Linting and test auto-correction cycle | After edits, auto-lint runs; test auto-run if configured | `aider/coders/base_coder.py:1599-1623` |
| Commit created with aider attribution | Git author/committer named as "User Name (aider)" | `aider/repo.py:294-308` |
| Co-authored-by trailer for AI contributions | `Co-authored-by: aider (model) <aider@aider.chat>` | `aider/repo.py:248-252` |
| Model-specific reasoning effort control | `--reasoning-effort` and `--thinking-tokens` config | `aider/main.py:837-849` |
| Subtree-only file access restriction | `--subtree-only` limits file scope | `aider/args.py:434-438` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Guided Autonomy, leaning Semi-Autonomous** by default. The LLM agent autonomously decides what code to write, creates files without asking, auto-commits to git, and auto-lints results. However, several guardrails require human approval:

- Editing files not in the chat (`base_coder.py:2226-2228`)
- Running shell commands (`base_coder.py:2456-2462`)
- Adding detected files to chat (`base_coder.py:1772-1773`)
- Scraping URLs (`base_coder.py:976-977`)

The system defaults to a model where **the AI drives all code production decisions**, but **the human must consent to any action that expands scope** (new files beyond chat, shell execution, adding context). This is visible in the architect mode where the AI plans and implements with a single user approval gate.

### 2. Is autonomy configurable per workflow or agent?

**No, it's per session, not per workflow.** All autonomy flags (`auto_commits`, `auto_lint`, `auto_test`, `auto_accept_architect`, `suggest_shell_commands`, `detect_urls`) are set during `Coder.create()` at startup and apply globally for the entire session. There is no mechanism to vary autonomy by file type, directory, git branch, or workflow stage.

The only per-"agent" variation is the edit format (coder mode), which changes what the LLM is allowed to do:
- `ask`: no edits permitted (`ask_coder.py:6-8`)
- `architect`: two-model pipeline (`architect_coder.py:6-8`)
- `diff`/`whole`/`editblock`: full edit capability

CLI flags can be changed only by restarting the session or via `/model`/`/chat-mode` commands (`commands.py:87-112`, `commands.py:138-203`), but the underlying flags like `--auto-commits` cannot be changed mid-session.

### 3. What decisions are reserved for humans?

| Decision | Mechanism | File:Line |
|----------|-----------|-----------|
| Editing files outside chat | `allowed_to_edit()` calls `confirm_ask()` | `base_coder.py:2191-2240` |
| Creating new files | `confirm_ask("Create new file?")` | `base_coder.py:2207` |
| Running shell commands | `confirm_ask()` with `explicit_yes_required=True` | `base_coder.py:2456-2462` |
| Adding files to chat | `confirm_ask()` per detected file mention | `base_coder.py:1772-1773` |
| Scraping URLs | `confirm_ask()` per detected URL | `base_coder.py:976-977` |
| Fixing lint errors | `confirm_ask("Attempt to fix lint errors?")` | `base_coder.py:1603-1606` |
| Fixing test failures | `confirm_ask("Attempt to fix test errors?")` | `base_coder.py:1619-1622` |
| Architect plan approval (opt-out) | When `auto_accept_architect=False` | `architect_coder.py:17` |
| Analytics collection opt-in | `confirm_ask()` during first run | `main.py:649-651` |
| Adding to gitignore | `confirm_ask()` for .gitignore files | `main.py:191` |

All of these can be bypassed with `--yes-always` (`args.py:760-764`).

### 4. What is the default when AI confidence is low?

Aider uses a **reflection loop** rather than confidence-based fallback:

- When edits fail to apply (SEARCH/REPLACE blocks don't match), the error is reflected back to the AI as a new message, up to `max_reflections=3` (`base_coder.py:101`, `base_coder.py:932-944`).
- When lint errors are found after editing, the user is asked if they want to automatically fix (`base_coder.py:1603-1606`), and if they say yes, the errors are reflected back to the AI.
- When the context window is exceeded, the system reports the error and asks the user to reduce context (`base_coder.py:1396-1416`).
- When the model returns no valid edit blocks, the response `"I didn't see any properly formatted edits"` is returned (`base_prompts.py:8`).

There is **no confidence threshold mechanism** — the AI never says "I'm not sure" in a structured way. Instead, the system relies on edit application success/failure as a binary signal.

### 5. How is appropriate autonomy level determined?

Autonomy is **determined entirely at startup via CLI flags and configuration files**. The defaults are chosen for a "power user" who wants maximum productivity:

- `auto_commits=True` — trust AI to manage its own commits
- `auto_lint=True` — trust AI to fix its own lint errors
- `dirty_commits=True` — auto-commit user's dirty state before AI edits
- `auto_accept_architect=True` — skip approval for architect->editor handoff

The user must explicitly opt into less autonomy (`--no-auto-commits`, `--no-auto-lint`, `--no-auto-accept-architect`) or more autonomy (`--yes-always`). There is no gradual scale or AI-judged confidence mechanism.

### 6. What safeguards exist against autonomous mistakes?

| Safeguard | Mechanism | File:Line |
|-----------|-----------|-----------|
| Git history | Every edit auto-committed, always recoverable | `repo.py:131-314` |
| Undo command | `/undo` reverts last aider commit | `commands.py:553-655` |
| Dirty commit before edits | Repo state preserved before AI edits | `base_coder.py:2175-2189` |
| Linting | Auto-lint after edits catches syntax errors | `base_coder.py:1599-1607` |
| Edit format validation | SEARCH/REPLACE blocks must exactly match | `editblock_coder.py:364-383` |
| Reflection limit | Max 3 AI self-correction rounds | `base_coder.py:101` |
| File scope restriction | `.aiderignore`, `--subtree-only` | `repo.py:532-565` |
| Read-only files | Files added as `--read` are protected | `base_coder.py:478-485` |
| Attribution | Commits attributed with "(aider)" suffix | `repo.py:294-308` |
| Keyboard interrupt | Double ^C exits safely | `base_coder.py:986-1000` |
| Dry-run mode | `--dry-run` prevents any file writes | `args.py:509-513` |
| Context window limit | Token limit check before sending | `base_coder.py:1396-1416` |

### 7. How does the system handle edge cases?

- **Context window exceeded**: Reports detailed token usage and offers suggestions (`base_coder.py:1628-1679`).
- **Malformed AI response**: Captures, shows error, requests correction from AI (`base_coder.py:2305-2316`).
- **Edit block fails to match**: Reports which lines failed, suggests similar lines (`editblock_coder.py:84-124`).
- **File already edited elsewhere**: Dirty commit preserves work before AI edits (`base_coder.py:2175-2189`).
- **API/key errors**: Attempts OpenRouter OAuth flow, suggests URLs, retries with backoff (`main.py:786-820`, `base_coder.py:1461-1488`).
- **AI creates a file that already exists**: `allowed_to_edit()` checks handle this (`base_coder.py:2226-2228`).
- **Keyboard interrupt**: Cool-down timer requires double ^C to exit (`base_coder.py:986-1000`).
- **Empty response from LLM**: Warning shown to user (`base_coder.py:1974-1975`).

### 8. What is the philosophy: "AI-first" or "human-first"?

**AI-first with human veto.** The default configuration optimizes for maximum AI productivity:

- The AI is trusted to write code, create files, commit, lint, and fix errors autonomously
- The human steps in only when the AI wants to expand its scope (new files beyond chat, shell access, additional context)
- The system prompt tells the AI to "Create new files without asking!" (`editblock_prompts.py:17`)
- The architect mode ships with auto-accept enabled (`auto_accept_architect=True`)

The philosophy is: **"The AI does the work; the human reviews the outputs."** This is reinforced by the commit structure (every edit is a clean git commit) and the `/undo` safety net. The human is positioned as a reviewer/approver, not a co-writer.

However, the veto boundaries are meaningful: the human must explicitly opt in to running shell commands (`explicit_yes_required=True`), adding files to chat, and scraping URLs. These represent the system's "airlock" — actions that touch the user's system or network require explicit consent.

## Architectural Decisions

- **Git-centric safety**: Every AI edit is automatically committed (`repo.py:131-314`), creating a full audit trail and enabling `/undo` (`commands.py:553-655`). This is the core trust mechanism — autonomy is granted because it's always reversible.

- **Edit format as autonomy boundary**: The edit format (`diff`, `whole`, `architect`, `ask`) determines what the LLM can do. Ask mode = zero autonomy. Code mode = full autonomy. This is the primary mechanism for varying autonomy levels.

- **Reflection loop instead of confidence scores**: Rather than assessing confidence, aider uses a retry-on-failure model. If edits don't apply, the error is sent back to the AI up to 3 times (`base_coder.py:101`). This is simple and effective but provides no graceful degradation when the AI is confused.

- **Dual model architecture (architect mode)**: When enabled, one model plans and another implements (`architect_coder.py:37-44`). This adds a built-in review layer between planning and execution.

- **Autonomy configuration via CLI only**: All autonomy settings are set at startup via flags. There's no per-workflow, per-agent, or runtime autonomy adjustment.

## Notable Patterns

- **Pervasive `confirm_ask` pattern**: All approval gates use `io.confirm_ask()` providing a consistent UX for "human in the loop" decisions.
- **Auto-attribution**: Git authorship is tagged with "(aider)" (`repo.py:294-308`) and optional Co-authored-by trailers (`repo.py:248-252`), making AI contributions transparent.
- **Ignore mechanism**: `.aiderignore` file (`repo.py:128-129`) and `--subtree-only` flag (`args.py:434-438`) let users define file-level autonomy boundaries.
- **Read-only files**: `--read` flag lets users grant partial file access (reference without editing) (`base_coder.py:478-485`).

## Tradeoffs

| Tradeoff | Choice | Consequence |
|----------|--------|-------------|
| Safety vs. speed | Default to auto-commits + auto-lint | Fast iteration, but AI can commit broken code |
| Trust vs. control | Default to AI-first with veto gates | Human must actively deny, not approve |
| Simplicity vs. nuance | Single session-wide autonomy config | Cannot vary autonomy per workflow or file type |
| Recovery vs. prevention | Git undo > pre-approval | Easy recovery, but mistakes do get committed |
| User friction | Yes-always flag to bypass all gates | One flag can disable ALL safety mechanisms |

## Failure Modes / Edge Cases

1. **`--yes-always` disables all safeguards** (`args.py:760-764`). In CI or automated contexts, this one flag bypasses every approval gate including shell command execution and file edits outside chat.
2. **AI hallucinates file paths** can create arbitrary new files without human approval (`editblock_prompts.py:17`). While `allowed_to_edit()` gates editing existing files outside chat, new files bypass this check.
3. **No confidence-based fallback** when the AI doesn't understand the task. The reflection loop retries blindly up to 3 times; after that, it gives up with no graceful degradation.
4. **Auto-commit races**: If the user makes local changes while AI is editing, `dirty_commits` auto-commits user changes first (`base_coder.py:2175-2189`), which could interleave different work.
5. **Shell command auto-execution risk**: Although shell commands require explicit approval, the AI could craft a dangerous command. The system does not analyze or warn about the command itself.

## Future Considerations

- Per-workflow or per-directory autonomy levels (e.g., "always ask before editing tests/").
- Confidence thresholds that trigger human handoff (e.g., "don't auto-commit if match confidence < 80%").
- Autonomy profiles (e.g., "conservative," "balanced," "full") that bundle multiple flags.
- Pre-commit hook integration for additional safety.
- Read-only mode that works on a per-line or per-function basis rather than per-file.

## Questions / Gaps

- No clear evidence of how the system handles partial edits where the AI modifies only part of a large file correctly but corrupts unrelated parts.
- No mechanism for the user to pause/resume autonomous mode mid-session.
- The `.aiderignore` file supports gitignore-style patterns but there's no documentation on whether it can be hot-reloaded.
- No evidence of an explicit "confidence score" being computed for AI responses; the system relies entirely on edit application success/failure.

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `aider`.
