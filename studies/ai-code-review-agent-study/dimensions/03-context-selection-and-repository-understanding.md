# Dimension 03: Context Selection & Repository Understanding

## Purpose

Understand how review agents gather useful repository context beyond the changed diff, including related files, documentation, dependency graphs, tests, ownership rules, and architectural conventions.

## Background

Good code review depends on context. A changed file may only make sense when compared with nearby modules, tests, existing patterns, README files, architectural docs, or previous implementations. Poor AI reviewers either review only the diff and miss important issues, or dump too much context into the model and degrade review quality. Elite systems select context deliberately.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify how the tool chooses context files.
   * Check whether it reads only changed files or additional related files.
   * Look for repository indexing, embeddings, grep/search, AST, dependency graph, or import traversal.
   * Identify how context is compressed before being sent to an LLM.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/03-context-selection-and-repository-understanding/{repo-name}.md`.

## Evidence

For each repo, collect:

* Context gathering code
* File selection algorithms
* Token budgeting logic
* Repository indexing logic
* Use of embeddings/search/grep/tree-sitter/AST
* Prompt construction examples
* Tests for context selection

## Questions

1. What context is included besides the diff?
2. How does the system decide which files are relevant?
3. Does it use static imports, semantic search, lexical search, or heuristics?
4. How does it avoid overwhelming the model with too much context?
5. Does it understand tests, docs, configs, and architectural files?
6. Can it identify repository conventions?
7. Would this approach work for larger enterprise repositories?

## Analysis Axes

* **Context precision**: Does it select genuinely relevant context?
* **Context recall**: Does it avoid missing important surrounding files?
* **Token discipline**: Does it manage context size explicitly?
* **Repository awareness**: Does it understand project structure and conventions?
* **Scalability**: Does the approach still work on large repos?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                     |
| ----- | --------------------------------------------------------------------------- |
| 1–3   | Reviews only raw diffs with little surrounding context                      |
| 4–6   | Adds nearby files or simple heuristics but lacks strong selection           |
| 7–8   | Good context retrieval with explicit budgeting                              |
| 9–10  | Excellent repository understanding with precise, scalable context selection |

Fast heuristic:

> "Would this reviewer understand why the changed code fits or does not fit the existing codebase?"

## Output

Write findings to `reports/source/03-context-selection-and-repository-understanding/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Context sources used
* Selection algorithm
* Token management strategy
* Repository understanding patterns
* Ideas to adapt for Ultraplan