# Dimension 04: Review Orchestration & Agent Flow

## Purpose

Understand how code review agents structure the review process across one-shot prompts, multi-step workflows, specialised agents, tool calls, and verification passes.

## Background

A basic AI reviewer sends a diff to an LLM and asks for feedback. A stronger reviewer decomposes the task: summarise PR, classify files, gather context, review for correctness, review for security, check tests, verify findings, remove duplicates, rank severity, and publish comments. The orchestration layer determines whether the system feels like a toy prompt or a serious review agent.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Locate the main review workflow.
   * Identify whether review is single-pass or multi-pass.
   * Identify specialised agents, tools, chains, or stages.
   * Trace how intermediate outputs are passed between stages.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/04-review-orchestration-and-agent-flow/{repo-name}.md`.

## Evidence

For each repo, collect:

* Main review orchestration code
* Agent/task definitions
* Prompt chains
* Tool invocation flow
* Intermediate data structures
* Retry/error-handling logic
* Review lifecycle diagrams if available

## Questions

1. Is review performed in one pass or multiple passes?
2. Are there specialised review stages?
3. Does the system separate summarisation, analysis, verification, and publishing?
4. Are intermediate results structured or just free-text?
5. How does the system handle failures and partial results?
6. Does the workflow support extensibility?
7. Could Ultraplan insert its own governance and contract-review stages into this flow?

## Analysis Axes

* **Workflow decomposition**: Is the review broken into meaningful stages?
* **Agent specialisation**: Are different concerns handled separately?
* **State management**: Are intermediate results represented clearly?
* **Extensibility**: Can new review passes be added cleanly?
* **Reliability**: Can the system recover from failed stages?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                      |
| ----- | ---------------------------------------------------------------------------- |
| 1–3   | One-shot prompt with little orchestration                                    |
| 4–6   | Some staged processing but unclear boundaries                                |
| 7–8   | Clean multi-stage review workflow                                            |
| 9–10  | Excellent agent orchestration with clear stages, state, and extension points |

Fast heuristic:

> "Could I add a new specialised reviewer without rewriting the whole system?"

## Output

Write findings to `reports/source/04-review-orchestration-and-agent-flow/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Review lifecycle
* Agent/stage breakdown
* Intermediate state model
* Failure handling
* Patterns to copy or avoid