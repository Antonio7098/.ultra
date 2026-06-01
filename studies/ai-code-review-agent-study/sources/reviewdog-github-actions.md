---
applicable_dimensions:
  - "01"
  - "06"
  - "13"
  - "14"
---

# haya14busa: Automated Code Review on GitHub Actions with reviewdog for any languages/tools

**Author**: haya14busa
**Published**: September 16, 2019
**URL**: https://medium.com/@haya14busa/automated-code-review-on-github-actions-with-reviewdog-for-any-languages-tools-20285e04448e

---

## reviewdog meets GitHub Actions ♡

[reviewdog](https://github.com/reviewdog/reviewdog) is an automated code review tool which supports *any language* and *any tools* by providing generic ways to parse tools' output ([errorformat, checkstyle](https://github.com/reviewdog/reviewdog#input-format)).

From reviewdog [v0.9.13](https://github.com/reviewdog/reviewdog/releases/tag/v0.9.13), it now supports [GitHub Actions](https://github.com/features/actions) integration. You can use [github-pr-check reporter](https://github.com/reviewdog/reviewdog#reporter-github-checks--reportergithub-pr-check) to report results to GitHub Check with [GITHUB_TOKEN](https://help.github.com/en/articles/virtual-environments-for-github-actions#github_token-secret) which is automatically generated in GitHub Actions. No need to create a bot account and personal access token anymore and no need to install [reviewdog GitHub App](https://github.com/reviewdog/reviewdog#option-2-install-reviewdog-github-apps) too!

### Basic Setup

```yaml
- name: Setup reviewdog
  run: |
    mkdir -p $HOME/bin && curl -sfL https://raw.githubusercontent.com/reviewdog/reviewdog/master/install.sh| sh -s -- -b $HOME/bin
    echo ::add-path::$HOME/bin

# Example to run [misspell](https://github.com/client9/misspell).
- name: Run reviewdog
  env:
    REVIEWDOG_GITHUB_API_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    misspell . | reviewdog -efm="%f:%l:%c: %m" -name="misspell" -reporter=github-pr-check
```

### Public reviewdog GitHub Actions

You can also use published GitHub Actions too!

#### [reviewdog/action-misspell](https://github.com/reviewdog/action-misspell)

This is an example to use [reviewdog/action-misspell](https://github.com/reviewdog/action-misspell) which reports misspell result to find typos in Pull Requests.

```yaml
# [.github/workflows/reviewdog.yml](https://github.com/reviewdog/action-misspell/blob/master/.github/workflows/reviewdog.yml)
name: reviewdog
on: [pull_request]
jobs:
  misspell:
    name: runner / misspell
    runs-on: ubuntu-latest
    steps:
      - name: Check out code.
        uses: actions/checkout@v1
      - name: misspell
        uses: reviewdog/action-misspell@v1
        with:
          github_token: ${{ secrets.github_token }}
          locale: "US"
```

You can just copy&paste the above configuration to `.github/workflows/reviewdog.yml` and it should work!

#### [reviewdog/action-golangci-lint](https://github.com/reviewdog/action-golangci-lint)

I also created [reviewdog/action-golanci-lint](https://github.com/reviewdog/action-golangci-lint) for Go projects. This is a simple example to run [golangci-lint](https://github.com/golangci/golangci-lint).

```yaml
# [.github/workflows/reviewdog.yml](https://github.com/reviewdog/action-golangci-lint#githubworkflowsreviewdogyml)
name: reviewdog
on: [pull_request]
jobs:
  golangci-lint:
    name: runner / golangci-lint
    runs-on: ubuntu-latest
    steps:
      - name: Check out code into the Go module directory
        uses: actions/checkout@v1
      - name: golangci-lint
        uses: reviewdog/action-golangci-lint@v1
        with:
          github_token: ${{ secrets.github_token }}
```

And this is an advanced usage example to golangci-lint with config file and run individual linters (e.g. golint) separately and control the report level (to control GitHub Status Check).

```yaml
# [.github/workflows/reviewdog.yml](https://github.com/reviewdog/action-golangci-lint#advanced-usage-example)
name: reviewdog
on: [pull_request]
jobs:
  golangci-lint:
    name: runner / golangci-lint
    runs-on: ubuntu-latest
    steps:
      - name: Check out code into the Go module directory
        uses: actions/checkout@v1
      - name: golangci-lint
        uses: reviewdog/action-golangci-lint@v1 # Build with Dockerfile
        with:
          github_token: ${{ secrets.github_token }}
          # Can pass --config flag to change golangci-lint behavior.
          golangci_lint_flags: "--config=.github/.golangci.yml"

  # Use golint via golangci-lint binary with "warning" level.
  golint:
    name: runner / golint
    runs-on: ubuntu-latest
    steps:
      - name: Check out code into the Go module directory
        uses: actions/checkout@v1
      - name: golint
        uses: reviewdog/action-golangci-lint@v1
        with:
          github_token: ${{ secrets.github_token }}
          golangci_lint_flags: "--disable-all -E golint"
          tool_name: golint # Change reporter name.
          level: warning # GitHub Status Check won't become failure
                         # with this level.
```

### More reviewdog Actions!

I created 2 actions so far by myself and it was not difficult to create a GitHub Action using reviewdog. You can install and use reviewdog on your GitHub Actions for your projects, but if it's common workflow, we can create Public GitHub Actions for more and more languages and tools and let's share them!

Let me know if you created an action to list [available reviewdog actions](https://github.com/reviewdog/reviewdog#pubilc-reviewdog-github-actions) :)

**Hint:** reviewdog is already used by many kinds of projects including Go, Ruby, Javascript, PHP, Android, Rust, CommonLisp, Typo checkers, Japanese proofreading … and arbitrary languages and tools! All we need is to convert your setup config to sharable one and write small Dockerfile and GitHub Actions config. See [GitHub documents](https://help.github.com/en/articles/creating-a-docker-container-action) and [reviewdog/action-misspell](https://github.com/reviewdog/action-misspell), [reviewdog/action-golanci-lint](https://github.com/reviewdog/action-golangci-lint) for examples to create reviewdog actions.

### Note on GitHub Actions Integration

1. **GitHub Actions itself is still in beta as of writing!** Please [file bugs](https://github.com/reviewdog/reviewdog/issues) and/or report problems to GitHub support if you find any problems.
2. **Pull Requests from forked repositories**: [GITHUB_TOKEN](https://help.github.com/en/articles/virtual-environments-for-github-actions#github_token-secret) doesn't have write access if Pull Requests is from forked repositories, so reviewdog will report results to GitHub Actions Log console instead of using Check API.
3. **GitHub Actions is Awesome :)** Thank to GitHub Actions, it becomes very easy to set up and use reviewdog both for OSS and private projects. Please try [reviewdog/action-misspell](https://github.com/reviewdog/action-misspell) which should be useful for all kinds of projects which uses English if in doubt :)

### More about reviewdog

Please read [README](https://github.com/reviewdog/reviewdog) and previous [articles](https://github.com/reviewdog/reviewdog#articles) for more detail about reviewdog.

Please give it a shot and let me know if you find any problems and/or have feedback.