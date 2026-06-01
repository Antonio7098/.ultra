# Dimension 13: User Experience & Review Output

## Purpose

Understand how code review agents communicate findings to developers through PR summaries, inline comments, check runs, markdown reports, status checks, and conversational commands.

## Background

Even a technically strong reviewer can fail if its output is annoying. Developers need concise summaries, actionable inline comments, clear severity labels, suggested fixes, and low-noise reporting. The best systems separate high-level PR summaries from blocking findings, optional suggestions, and educational explanations.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Inspect generated PR summaries.
   * Inspect inline comments.
   * Identify check-run/status output.
   * Check whether users can ask follow-up questions or trigger commands.
   * Assess output tone, structure, and actionability.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/13-user-experience-and-review-output/{repo-name}.md`.

## Evidence

For each repo, collect:

* Example PR reviews
* Markdown templates
* Inline comment templates
* Status/check run output
* Bot command documentation
* Suggested fix format
* Screenshots or demos where available

## Questions

1. What output does the reviewer generate?
2. Does it produce a PR summary?
3. Does it produce inline comments?
4. Does it produce check-run statuses?
5. Are findings grouped by severity or category?
6. Does it provide suggested fixes?
7. Can developers interact with the bot?
8. Is the tone concise, helpful, and non-annoying?

## Analysis Axes

* **Actionability**: Can developers immediately act on comments?
* **Signal-to-noise**: Does the output avoid clutter?
* **Information hierarchy**: Are blockers separated from suggestions?
* **Developer control**: Can users rerun, ask, suppress, or configure reviews?
* **Tone**: Does the reviewer feel like a helpful senior engineer?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                               |
| ----- | ------------------------------------------------------------------------------------- |
| 1–3   | Noisy, vague, or hard-to-use review output                                            |
| 4–6   | Useful output but inconsistent formatting or prioritisation                           |
| 7–8   | Clear, actionable, developer-friendly review output                                   |
| 9–10  | Excellent UX with summaries, inline comments, commands, and thoughtful prioritisation |

Fast heuristic:

> "Would developers welcome this reviewer or mute it?"

## Output

Write findings to `reports/source/13-user-experience-and-review-output/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Review output types
* Comment format
* Summary format
* Interaction model
* UX patterns worth copying