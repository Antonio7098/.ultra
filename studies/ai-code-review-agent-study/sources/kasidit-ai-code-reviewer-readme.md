---
applicable_dimensions:
  - "01"
  - "02"
  - "05"
  - "08"
  - "13"
---

# kasidit-wansudon: ai-code-reviewer

**Source**: https://github.com/kasidit-wansudon/ai-code-reviewer
**README**: https://raw.githubusercontent.com/kasidit-wansudon/ai-code-reviewer/main/README.md

---

# ai-code-reviewer

GitHub Action that automatically reviews Pull Requests using LLMs. Analyzes the diff, identifies bugs, security issues, and style problems, then posts inline comments.

[![Go Version](https://img.shields.io/badge/Go-1.21+-blue)](https://golang.org)
[![GitHub Action](https://img.shields.io/badge/GitHub-Action-black)](https://github.com/features/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- Triggered on Pull Request open/update
- Fetches PR diff from GitHub API
- Parses unified diff → per-file, per-hunk context
- Sends to LLM (via llm-gateway or direct OpenAI)
- Posts inline review comments on specific lines
- Summary comment on PR with overall assessment
- Configurable: file types, severity threshold, max files
- Supports: Go, PHP, TypeScript, Python, SQL

## Usage

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: kasidit-wansudon/ai-code-reviewer@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          model: "gpt-4o-mini"
          review-level: "standard"     # minimal | standard | thorough
          max-files: 10
          file-extensions: "go,php,ts,sql"
          post-summary: true
```

## Review Comment Format

```
🔍 **Potential Issue** (severity: medium)

This SQL query is vulnerable to injection if `$userInput` is not sanitized.

**Suggestion:**
Use parameterized queries instead:
```php
$stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$userId]);
```
```

## Summary Comment Format

```markdown
## AI Code Review Summary

**Files reviewed:** 5 | **Issues found:** 3 | **Model:** gpt-4o-mini

| Severity | Count |
|----------|-------|
| 🔴 High  | 0 |
| 🟡 Medium | 2 |
| 🔵 Low   | 1 |

### Key Findings
- `src/PaymentService.php:45` — Missing input validation
- `migrations/003_add_index.sql:12` — Index on large table may lock
```

## Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | | GitHub token for API + comments |
| `openai-api-key` | Yes* | | OpenAI key (*or use `llm-gateway-url`) |
| `llm-gateway-url` | No | | Use self-hosted llm-gateway instead |
| `model` | No | `gpt-4o-mini` | LLM model |
| `review-level` | No | `standard` | Depth of review |
| `max-files` | No | `10` | Max files to review per PR |
| `file-extensions` | No | all | Comma-separated extensions |
| `severity-threshold` | No | `low` | Min severity to post comment |
| `post-summary` | No | `true` | Post summary comment on PR |

## Project Structure

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

## Related Projects

- [llm-gateway](https://github.com/kasidit-wansudon/llm-gateway)
- [ci-pipeline-templates](https://github.com/kasidit-wansudon/ci-pipeline-templates)

## License

MIT