---
applicable_dimensions:
  - "01"
  - "03"
  - "04"
  - "05"
  - "09"
  - "12"
  - "13"
  - "14"
---

# Continue: Code Review Bot with GitHub Actions

**Source**: https://docs.continue.dev/guides/github-pr-review-bot

---

Set up automated, context-aware pull request reviews using Continue CLI in GitHub Actions - privacy-first with custom rules

## What You'll Build

An automated pull request review system that:

-   Reviews code automatically when pull requests open or update
-   Applies your team's custom rules and standards
-   Runs in your GitHub Actions runner (code is sent directly to your configured LLM)
-   Posts actionable feedback as pull request comments
-   Responds to interactive review requests

## Why This Approach?

### Privacy-First

All logs and processing happen in your runner: Continue CLI runs in GitHub Actions → code to your LLM provider (OpenAI, Anthropic, etc.). No hosted Continue service reads your code.

### Customizable

Define team-specific rules in `.continue/rules/` that automatically apply to every pull request.

### Context Awareness

Leverage Continue's AI agent for intelligent, context-aware reviews with full control over your configuration.

## Prerequisites

Before starting, ensure you have:

-   A GitHub repository with pull requests
-   Continue account with **Hub access** - Read: [Understanding Configs](/guides/understanding-configs)
-   A Continue API key from [continue.dev/settings/api-keys](https://continue.dev/settings/api-keys)
-   Continue assistant configured for code reviews (or use our recommended default)

**Want to customize the review bot?**

You can remix the default review bot configuration at [continue.dev/continuedev/review-bot](https://continue.dev/continuedev/review-bot) to create your own personalized version with custom prompts, rules, and behaviors.

## Quick Setup (10 Minutes)

### 1. Configure Repository Secrets and Variables

Navigate to your repository settings: **Settings → Secrets and variables → Actions**

**Required Secrets:**

-   `CONTINUE_API_KEY` - Your Continue API key from [continue.dev/settings/api-keys](https://continue.dev/settings/api-keys)

**Optional (for better permissions):**

-   **Variables** tab: `APP_ID` - GitHub App ID (for enhanced API rate limits)
-   **Secrets** tab: `APP_PRIVATE_KEY` - GitHub App private key

### 2. Add Workflow File

Create a GitHub Actions workflow file at `.github/workflows/code-review.yml` with the provided configuration.

```yaml
name: Continue Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    # Only run on PRs or when @review-bot is mentioned
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@review-bot'))

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better context

      # Optional: Use GitHub App token for better rate limits
      - name: Generate App Token
        id: app-token
        if: vars.APP_ID != ''
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Continue CLI
        run: npm i -g @continuedev/cli

      - name: Get Pull Request Details
        id: pr
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token || github.token }}
        run: |
          # Get pull request number and details
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            PR_NUMBER=${{ github.event.pull_request.number }}
          else
            PR_NUMBER=$(jq -r .issue.number "$GITHUB_EVENT_PATH")
          fi

          echo "pr_number=$PR_NUMBER" >> $GITHUB_OUTPUT

          # Get pull request diff
          gh pr diff $PR_NUMBER > pr.diff

          # Get changed files
          gh pr view $PR_NUMBER --json files -q '.files[].path' > changed_files.txt

      - name: Run Continue Review
        env:
          CONTINUE_API_KEY: ${{ secrets.CONTINUE_API_KEY }}
          GH_TOKEN: ${{ steps.app-token.outputs.token || github.token }}
        run: |
          # Check if custom rules exist
          if [ -d ".continue/rules" ]; then
            echo "📋 Found custom rules in .continue/rules/"
            RULES_CONTEXT="Apply the custom rules found in .continue/rules/ directory."
          else
            echo "ℹ️  No custom rules found. Using general best practices."
            RULES_CONTEXT="Review for general best practices, security issues, and code quality."
          fi

          # Build review prompt
          PROMPT="Review this pull request with the following context:

          ## Changed Files
          $(cat changed_files.txt)

          ## Diff
          \`\`\`diff
          $(cat pr.diff)
          \`\`\`

          ## Instructions
          $RULES_CONTEXT

          Provide:
          1. A brief summary of changes
          2. Key findings (potential issues, security concerns, suggestions)
          3. Positive observations (good practices, improvements)
          4. Specific actionable recommendations

          Format as markdown suitable for a GitHub pull request comment."

          # Run Continue CLI in headless mode
          cn --config continuedev/review-bot \
             -p "$PROMPT" \
             --auto > review_output.md

      - name: Post Review Comment
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token || github.token }}
        run: |
          # Add header
          cat > review_comment.md <<'EOF'
          ## 🤖 AI Code Review

          EOF

          # Add review content
          cat review_output.md >> review_comment.md

          # Add footer
          cat >> review_comment.md <<'EOF'

          ---
          *Powered by [Continue](https://continue.dev) • Need a focused review? Comment `@review-bot check for [specific concern]`*
          EOF

          # Check for existing review comment
          EXISTING_COMMENT=$(gh pr view ${{ steps.pr.outputs.pr_number }} \
            --json comments -q '.comments[] | select(.body | contains("🤖 AI Code Review")) | .id' | head -1)

          if [ -n "$EXISTING_COMMENT" ]; then
            echo "Updating existing comment..."
            gh api --method PATCH \
              "repos/${{ github.repository }}/issues/comments/$EXISTING_COMMENT" \
              -f body="$(cat review_comment.md)"
          else
            echo "Creating new comment..."
            gh pr comment ${{ steps.pr.outputs.pr_number }} \
              --body-file review_comment.md
          fi
```

### 3. Create Custom Rules (Optional)

Define your team's standards in `.continue/rules/`:

**Example: Create `.continue/rules/security.md`:**

```markdown
---
globs: "**/*.{ts,tsx,js,jsx,py}"
description: "Security Review Standards"
alwaysApply: true
---

# Security Checklist

- No hardcoded credentials, API keys, or secrets
- All user inputs are validated and sanitized
- SQL queries use parameterization (no string concatenation)
- Authentication and authorization checks are in place
- Sensitive data is properly encrypted
- Error messages don't leak sensitive information
```

## How It Works

The workflow follows these steps:

1.  **Pull Request Created/Updated** - A pull request is opened or synchronized
2.  **Workflow Triggered** - GitHub Actions workflow starts automatically
3.  **Load Custom Rules** - Reads your team's rules from `.continue/rules/`
4.  **Get Pull Request Diff** - Fetches the diff and list of changed files
5.  **Continue CLI Analyzes Code** - AI agent reviews the code with your rules
6.  **Post or Update Review Comment** - Creates or updates a single PR comment with feedback

## Interactive Commands

Comment on any pull request to trigger focused reviews:

```
@review-bot check for security issues
@review-bot review the TypeScript types
@review-bot explain the architecture changes
@review-bot focus on error handling
```

The workflow will respond with a targeted review based on your request.

## Advanced Configuration

### Use Your Own Continue Config

By default, the workflow uses the `continuedev/review-bot` config optimized for code reviews. Replace `continuedev/review-bot` with your own config:

```yaml
- name: Run Continue Review
  env:
    CONTINUE_API_KEY: ${{ secrets.CONTINUE_API_KEY }}
    CONTINUE_ORG: your-org-name      # Add your org
    CONTINUE_CONFIG: username/config-name  # Add your config
  run: |
    cn --config $CONTINUE_ORG/$CONTINUE_CONFIG \
       -p "$PROMPT" \
       --auto > review_output.md
```

Store `CONTINUE_ORG` and `CONTINUE_CONFIG` as repository variables for easy updates.

## Example Output

Here's what a typical review comment looks like:

> ## 🤖 AI Code Review
>
> ### Summary
>
> This pull request introduces a new user authentication system with JWT tokens and password hashing. The implementation follows security best practices with a few minor suggestions.
>
> ### Key Findings
>
> **Security** ✅
>
> - Password hashing properly implemented with bcrypt
> - JWT tokens include appropriate expiry
> - Input validation present for all endpoints
>
> **Code Quality** 💡
>
> - Consider adding rate limiting to login endpoint
> - The `secretKey` should be loaded from environment variables, not hardcoded
> - Add unit tests for token expiration edge cases
>
> ### Positive Observations
>
> - Good separation of concerns with middleware pattern
> - Clear error messages for authentication failures
> - Proper async/await usage throughout
>
> ### Recommendations
>
> 1. Move `secretKey` to environment variables (see `.continue/rules/security.md`)
> 2. Add rate limiting middleware to prevent brute force attacks
> 3. Consider adding integration tests for the auth flow
> 4. Document the JWT payload structure
>
> ---
>
> *Powered by [Continue](https://continue.dev) • Need a focused review? Comment `@review-bot check for security`*

## What You've Built

After completing this setup, you have an **AI-powered code review system** that:

- ✅ **Runs automatically** - Reviews every pull request without manual intervention
- ✅ **Privacy-first** - CLI runs in your GitHub Actions runner, code sent directly to your configured LLM
- ✅ **Customizable** - Team-specific rules apply automatically
- ✅ **Interactive** - Responds to focused review requests
- ✅ **Continuous** - Updates reviews as pull requests change

### Continuous AI

Your pull request workflow now operates at **[Level 2 Continuous AI](https://blog.continue.dev/what-is-continuous-ai-a-developers-guide/)** - AI handles routine code review with human oversight through review and approval.

## Next Steps

1. **Test it out** - Create a test pull request and watch the review appear
2. **Refine rules** - Add more custom rules specific to your codebase
3. **Customize prompts** - Adjust the review prompt to match your team's style
4. **Add metrics** - Track review effectiveness over time
5. **Create team config** - Set up a shared Continue config for consistent reviews

## Inspiration & Resources

### CodeBunny

Original inspiration - Privacy-first AI code reviews: [https://github.com/bdougie/codebunny](https://github.com/bdougie/codebunny)

### Continue CLI Guide

Learn more about Continue CLI capabilities: [/guides/cli](/guides/cli)

### Continue Mission Control

Browse shared configs and create your own: [https://continue.dev/continuedev/review-bot](https://continue.dev/continuedev/review-bot)

### Rules Documentation

Deep dive into custom rules: [/customize/deep-dives/rules](/customize/deep-dives/rules)