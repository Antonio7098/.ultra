# Dimension 06: Static Analysis & Tool Integration

## Purpose

Understand how AI code review agents integrate deterministic tools such as linters, type checkers, test runners, security scanners, formatters, and static analysers.

## Background

LLMs are useful reviewers, but they are unreliable when used alone. Strong review systems combine deterministic tools with AI interpretation. Linters catch style and syntax issues, type checkers catch contract violations, test runners catch regressions, Semgrep catches security patterns, and AI can explain or prioritise the results. The best systems do not ask the model to guess what tools can prove.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify all external tools the review agent can run.
   * Check whether tool output is parsed structurally.
   * Determine how tool findings are combined with LLM findings.
   * Look for support for user-configurable commands.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/06-static-analysis-and-tool-integration/{repo-name}.md`.

## Evidence

For each repo, collect:

* Linter integrations
* Test runner integrations
* Security scanner integrations
* Tool execution code
* Output parsers
* CI examples
* Configuration for custom commands

## Questions

1. What deterministic tools does the system run?
2. Are tool results treated as first-class findings?
3. Does the LLM interpret tool output or generate separate comments?
4. Can users configure their own commands?
5. How are tool failures handled?
6. Does the system distinguish proven issues from model-inferred issues?
7. How could Ultraplan combine deterministic checks with AI review?

## Analysis Axes

* **Tool coverage**: How many useful deterministic checks are supported?
* **Structured parsing**: Are outputs parsed or pasted as text?
* **Trust separation**: Are tool findings distinguished from LLM opinions?
* **Configurability**: Can teams plug in their own tools?
* **Review value**: Does the AI add explanation, prioritisation, or deduplication?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                       |
| ----- | ------------------------------------------------------------- |
| 1–3   | No meaningful deterministic tool integration                  |
| 4–6   | Basic tool execution but weak parsing or integration          |
| 7–8   | Good static analysis integration with structured findings     |
| 9–10  | Excellent hybrid review model combining tools, AI, and policy |

Fast heuristic:

> "Does this system use the LLM for judgement rather than guessing things static tools could know?"

## Output

Write findings to `reports/source/06-static-analysis-and-tool-integration/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Supported tools
* Tool execution model
* Result parsing strategy
* AI/tool interaction pattern
* Recommended Ultraplan integration ideas