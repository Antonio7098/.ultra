# Dimension 11: Architecture & Maintainability Review

## Purpose

Understand how review agents identify maintainability problems, architectural drift, poor boundaries, excessive complexity, duplication, and code that does not fit existing project patterns.

## Background

Most code review value is not syntax-level. It is architectural judgement: "Does this belong here?", "Is this abstraction earned?", "Did this change jam new behaviour into the wrong layer?", "Is this module becoming a dumping ground?" These are exactly the areas where a custom Ultraplan reviewer could outperform generic tools by using project-specific architecture contracts and sprint reasoning docs.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify maintainability and architecture review prompts.
   * Check whether the system reads project structure and existing patterns.
   * Look for rules about complexity, abstraction, coupling, layering, and testability.
   * Inspect examples of architecture-related comments.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/11-architecture-and-maintainability-review/{repo-name}.md`.

## Evidence

For each repo, collect:

* Architecture review prompts
* Maintainability rules
* Project-structure analysis code
* Context selection for related modules
* Examples of comments about complexity or design
* Configuration for project-specific architecture rules

## Questions

1. Does the reviewer check architectural fit?
2. Does it understand module boundaries?
3. Does it detect unnecessary abstraction?
4. Does it detect when complexity has become justified and refactoring is needed?
5. Does it compare new code with existing patterns?
6. Does it flag duplicated or parallel abstractions?
7. Could this support Ultraplan's module-driven architecture rules?

## Analysis Axes

* **Architectural awareness**: Does it reason beyond the changed lines?
* **Boundary detection**: Can it identify layer or module violations?
* **Complexity judgement**: Does it avoid both overengineering and under-refactoring?
* **Pattern alignment**: Does it compare changes with existing conventions?
* **Actionability**: Are design comments concrete enough to fix?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                            |
| ----- | ---------------------------------------------------------------------------------- |
| 1–3   | Mostly superficial style or syntax comments                                        |
| 4–6   | Some maintainability review but limited architectural context                      |
| 7–8   | Good design review with useful project-pattern awareness                           |
| 9–10  | Excellent architecture reviewer capable of detecting drift and boundary violations |

Fast heuristic:

> "Would this reviewer catch code that works today but damages the architecture tomorrow?"

## Output

Write findings to `reports/source/11-architecture-and-maintainability-review/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Architecture review strategy
* Maintainability categories
* Context requirements
* Examples of useful and weak comments
* Ideas for Ultraplan architecture contracts