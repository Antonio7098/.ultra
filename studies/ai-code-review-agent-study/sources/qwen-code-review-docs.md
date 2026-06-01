---
applicable_dimensions:
  - "01"
  - "02"
  - "03"
  - "04"
  - "05"
  - "08"
  - "13"
---

# Qwen Code: Code Review Feature

**Source**: https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/code-review.md

---

## Qwen Code Review

Qwen Code provides a code review feature that leverages Qwen's language model capabilities to analyze pull requests and provide intelligent feedback. The code review feature is designed to work as both a local CLI tool and integrated with GitHub workflows.

## Overview

The Qwen Code review system includes:

- **Local PR Review Command** - Review PRs from the command line
- **GitHub Integration** - Automated review posting to GitHub PRs
- **Rule Injection** - Custom review rules loaded from repository files
- **Security Model** - Rules loaded from base branch, not PR branch

## Key Features

### Diff Analysis
- Parses unified diff format into structured per-file, per-hunk context
- Maps findings back to specific line numbers
- Handles multiple file types

### Context Selection
- Loads additional context from the repository
- Reads custom rules from `.qwen/rules/` directory
- Uses base branch for rule loading (prevents malicious rule injection from PRs)

### Inline Comments
- Posts comments on specific lines in the PR
- Generates summary comments
- Provides severity categorization

### Security: Base Branch Rule Loading

A critical security feature: Qwen Code loads review rules from the **base branch**, not from the PR branch. This prevents malicious actors from:
1. Creating a PR with custom rules that grant approval
2. Modifying rule definitions to bypass checks
3. Injecting prompts that manipulate the review behavior

This is a significant security design for open-source projects accepting PRs from external contributors.

## Command Structure

The code review feature is invoked through:
```bash
qwen code review --pr <pr-number>
```

With options for:
- Review depth level
- File type filtering
- Comment verbosity
- Rule file paths

## Rule File Format

Rules are stored in `.qwen/rules/` (or configurable path) and can include:
- Markdown files with review guidelines
- Language-specific rules
- Security checklists
- Coding standards

## Integration Model

### GitHub App Integration
Qwen Code can be installed as a GitHub App that:
- Listens for PR events
- Automatically triggers reviews
- Posts comments on behalf of the account
- Handles authentication via GitHub App

### CLI Integration
Local usage through CLI:
```bash
# Review a specific PR
qwen code review --pr 123

# Review with custom rules
qwen code review --pr 123 --rules-dir .qwen/rules

# Set review depth
qwen code review --pr 123 --level thorough
```

## Review Output

The review produces:

1. **Summary Comment** - Overall assessment of the PR
2. **Inline Comments** - Specific feedback on lines/files
3. **File-level Comments** - Issues spanning multiple lines
4. **Suggestion Fixes** - Proposed code changes where applicable

## Configuration

Configuration options include:
- `rules_dir` - Path to rules directory
- `model` - Which Qwen model to use
- `max_files` - Maximum files to review
- `severity_threshold` - Minimum severity to comment on
- `github_token` - GitHub authentication

## Design Principles

1. **Security First** - Rules from base branch only
2. **Developer Experience** - Clear, actionable feedback
3. **Flexibility** - Configurable for different team needs
4. **Integration** - Works with existing GitHub workflows