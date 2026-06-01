# Dimension 05: Prompt & Policy System

## Purpose

Understand how code review agents define, organise, customise, and apply prompts, review instructions, coding standards, and project-specific policies.

## Background

Prompt design is the behavioural core of an AI review agent. However, production systems need more than a single giant prompt. They need reusable prompt templates, project-level rules, language-specific instructions, severity definitions, output schemas, and mechanisms for teams to customise review behaviour. For Ultraplan, this is especially important because project contracts, sprint rules, and architectural guidance should become first-class review inputs.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Locate prompt templates and system instructions.
   * Identify custom configuration options.
   * Check whether prompts are versioned, modular, or hardcoded.
   * Determine how project-specific rules are injected.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/05-prompt-and-policy-system/{repo-name}.md`.

## Evidence

For each repo, collect:

* Prompt files
* Configuration files
* System/developer/user prompt construction
* Rule or policy injection logic
* Output format instructions
* Language-specific prompts
* Examples of custom user rules

## Questions

1. Where are prompts stored?
2. Are prompts hardcoded or configurable?
3. Can users add project-specific review instructions?
4. Does the system distinguish global rules, repo rules, and PR-specific context?
5. Does it use structured output schemas?
6. How does it prevent vague or overly subjective review comments?
7. Could Ultraplan inject contracts, sprint docs, and architecture rules into this prompt system?

## Analysis Axes

* **Prompt modularity**: Are prompts decomposed into reusable parts?
* **Policy expressiveness**: Can teams encode real review standards?
* **Configurability**: Can behaviour be changed without code changes?
* **Output discipline**: Does the prompt force actionable findings?
* **Governance fit**: Can formal rules be connected to review output?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| 1–3   | Hardcoded prompt with little customisation                                       |
| 4–6   | Some configurable instructions but weak structure                                |
| 7–8   | Modular prompt system with useful project-level rules                            |
| 9–10  | Excellent policy-driven prompt architecture with structured, auditable behaviour |

Fast heuristic:

> "Could I make this reviewer enforce my project's engineering rules without editing core code?"

## Output

Write findings to `reports/source/05-prompt-and-policy-system/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Prompt structure
* Configuration model
* Policy injection mechanism
* Output schema strategy
* Relevance to Ultraplan contracts