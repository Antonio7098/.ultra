# Ultra CLI

Ultra is a local CLI for running `.ultra/` governance workflows. It has two main jobs:

- Run architecture studies across a matrix of study dimensions and source repositories or documents.
- Orchestrate project sprint artifacts from requirements through planning, implementation, and review.

The CLI is implemented in `cli/src/` and is intended to be run from this `.ultra/` workspace. It uses `opencode` as the agent runtime for commands that generate or update artifacts.

## Repository Layout

```text
.ultra/
  cli/                 Bun/TypeScript CLI package
  config.json          Workspace configuration
  prompts/             Prompt files used by study and sprint commands
  projects/            Project execution workspaces
  studies/             Architecture study workspaces (hellosales-architecture, opencode-wrap-study, ai-agent-systems)
  system/              Contracts, templates, protocols, and reasoning guidance
```

Important generated artifacts:

- `studies/<study>/reports/source/<dimension>/<source>.md` - per-source study analysis.
- `studies/<study>/reports/final/<dimension>.md` - synthesized study report.
- `studies/<study>/.run-state.json` - resumable study loop state.
- `projects/<project>/sprints/<sprint>/requirements.md` - sprint requirements.
- `projects/<project>/sprints/<sprint>/sprint-index.md` - selected sprint scope and evidence.
- `projects/<project>/sprints/<sprint>/technical-handbook.md` - implementation context.
- `projects/<project>/sprints/<sprint>/reasoning/` - optional area-specific reasoning.
- `projects/<project>/sprints/<sprint>/reasoning.md` - sprint-level reasoning.
- `projects/<project>/sprints/<sprint>/plan.md` - implementation plan.
- `projects/<project>/sprints/<sprint>/review.md` - review output.
- `projects/<project>/sprints/<sprint>/flow-state.json` - resumable sprint flow state.

## Requirements

- [Bun](https://bun.sh/) for running the TypeScript CLI.
- `opencode` available on `PATH`, or installed at `~/.opencode/bin/opencode`.
- Model/provider credentials configured for `opencode`.
- A `.ultra/` workspace containing `config.json`, `prompts/`, `projects/`, `studies/`, and `system/`.

The CLI resolves the workspace root from its own location: `cli/src/index.ts` resolves two directories up to `.ultra/`. Run it from this repository unless you have installed it in a way that preserves that relationship.

## Installation

From the `.ultra/cli` package:

```bash
cd cli
bun install
```

Run the CLI directly:

```bash
bun run src/index.ts --help
```

Or use the package script:

```bash
bun run ultra --help
```

For a global `ultra` command during local development, link or install the package using your preferred Bun workflow from `cli/`. The package exposes this binary:

```json
{
  "bin": {
    "ultra": "./src/index.ts"
  }
}
```

## Configuration

The CLI reads `.ultra/config.json` through `cli/src/paths.ts`. If model fields are missing, the code has fallback defaults for:

- `defaultModel`
- `primaryModel`
- `backupModel`
- `defaultVariant`
- `defaultParallel`
- `defaultTimeoutMs`
- `sprintPlanningModel`
- `sprintPlanningContextWindow`
- `sprintExecutionModel`
- `sprintExecutionVariant`

Common runtime overrides are available on commands:

- `--model <model>` - override the configured model.
- `--variant <variant>` - override the configured model variant.
- `--timeout <ms>` - set an execution timeout in milliseconds.
- `--dry-run` - print planned actions or prompts without running `opencode`.

## Command Overview

```bash
ultra --help
```

Top-level command groups:

- `ultra study ...` - inspect, run, resume, and synthesize studies.
- `ultra sprint ...` - generate and inspect sprint artifacts.
- `ultra meta ...` - currently a migration stub.

## Studies

A study lives at:

```text
studies/<study-name>/
  dimensions/
  sources/
  reports/
```

Dimensions are Markdown files in `dimensions/`. Sources are either directories or Markdown files in `sources/`.

Markdown source files may include frontmatter like:

```yaml
---
applicable_dimensions:
  - "01"
  - "03"
---
```

When present, `applicable_dimensions` limits that source document to specific dimensions.

### List a Study

```bash
ultra study list <study>
```

Examples:

```bash
ultra study list hellosales-architecture
ultra study list opencode-wrap-study
ultra study list ai-agent-systems
```

This prints available sources and dimensions for the study.

The CLI also supports a newer argument order:

```bash
ultra study <study> list
```

And a shorthand form when the first argument matches a study directory:

```bash
ultra <study> list
```

### Run One Study Analysis

```bash
ultra study run <study> <dimension-ref> <source-name> [options]
```

Examples:

```bash
ultra study run hellosales-architecture 01-project-structure cli
ultra study run opencode-wrap-study 02-process-session-lifecycle t3code --model openai/gpt-5.5
ultra study run hellosales-architecture 03 pocketbase --dry-run
ultra study run ai-agent-systems 01-execution-semantics opencode
```

`<dimension-ref>` can match:

- The dimension number, such as `01`.
- The full dimension slug, such as `01-project-structure-boundaries`.
- A unique prefix of the slug or name.

The command builds an inline prompt from:

- `prompts/base.md`
- the selected study dimension
- the selected source or source document
- `system/templates/repo-analysis.md`

For directory sources, the agent is instructed to stay inside that source directory and cite code with file paths and line numbers.

### Run All Study Analyses

```bash
ultra study run-all <study> [options]
```

Examples:

```bash
ultra study run-all hellosales-architecture
ultra study run-all hellosales-architecture --parallel 2 --timeout 1800000
ultra study run-all opencode-wrap-study --dry-run
ultra study run-all ai-agent-systems --parallel 4 --timeout 1800000
```

This command:

1. Runs every applicable dimension/source analysis.
2. Writes per-source reports under `reports/source/`.
3. Runs synthesis for each dimension.
4. Writes final reports under `reports/final/`.

Use `--parallel <n>` to control concurrent `opencode` runs. If omitted, the CLI uses `defaultParallel` from config or fallback defaults.

### Run a Resumable Study Loop

```bash
ultra study run-loop <study> [options]
```

Examples:

```bash
ultra study run-loop hellosales-architecture
ultra study run-loop hellosales-architecture --batch-size 3
ultra study run-loop hellosales-architecture --batch-size 2 --model minimax-coding-plan/MiniMax-M2.7
ultra study run-loop ai-agent-systems --batch-size 3
```

`run-loop` is the most robust mode for large studies. It creates or resumes:

```text
studies/<study>/.run-state.json
```

The loop tracks each analysis and synthesis task as `pending`, `running`, `completed`, or `failed`. Failed tasks are retried with increasing backoff. If interrupted with `Ctrl-C`, the CLI saves state before exiting.

Use this mode when a study is large, expensive, rate-limited, or likely to run across multiple sessions.

### Check Study Status

```bash
ultra study status <study>
```

This reads `.run-state.json` and prints:

- created and updated timestamps
- completed analysis count
- completed synthesis count
- pending or failed work
- retry timing for failed tasks

## Sprints

A project lives at:

```text
projects/<project>/
  docs/
  project-index.md
  sprints/
```

A sprint lives at:

```text
projects/<project>/sprints/<sprint-slug>/
```

The sprint commands use prompt files from `prompts/` and write artifacts into the sprint directory.

## Sprint Flow Stages

The full sprint flow order is:

1. `requirements`
2. `sprint-index`
3. `technical-handbook`
4. `area-reasoning`
5. `reasoning`
6. `plan`
7. `implementation`
8. `review`

Each stage maps to an artifact:

| Stage | Artifact |
| --- | --- |
| `requirements` | `requirements.md` |
| `sprint-index` | `sprint-index.md` |
| `technical-handbook` | `technical-handbook.md` |
| `area-reasoning` | `reasoning/` |
| `reasoning` | `reasoning.md` |
| `plan` | `plan.md` |
| `implementation` | `.run-state.json` or implementation markers |
| `review` | `review.md` |

The flow state is stored in:

```text
projects/<project>/sprints/<sprint-slug>/flow-state.json
```

Existing artifacts are inspected when flow state is initialized or loaded, so older sprints can be resumed.

## Sprint Commands

### Plan a Sprint

```bash
ultra sprint plan <project> <sprint-slug> [options]
```

Examples:

```bash
ultra sprint plan agentwrap 02-core-runtime-contract
ultra sprint plan agentwrap 02-core-runtime-contract --dry-run
ultra sprint plan agentwrap 02-core-runtime-contract --from requirements --to plan --model openai/gpt-5.5 --variant high --context-window 1000000
```

This uses `prompts/plan-sprint.md` and writes:

```text
projects/<project>/sprints/<sprint-slug>/plan.md
```

The command creates the sprint directory if needed.

`--context-window <tokens>` is supported when `--model <provider/model>` is also provided. The CLI passes an `OPENCODE_CONFIG_CONTENT` override for that model with the requested context limit.

### Execute a Sprint

```bash
ultra sprint execute <project> <sprint-slug> [options]
```

Examples:

```bash
ultra sprint execute agentwrap 02-core-runtime-contract
ultra sprint execute agentwrap 02-core-runtime-contract --dry-run
```

Execution requires both:

- `plan.md`
- `reasoning.md`

If either file is missing, the command exits with instructions to generate the missing planning artifacts.

### Review a Sprint

```bash
ultra sprint review <project> <sprint-slug> [options]
```

Examples:

```bash
ultra sprint review agentwrap 02-core-runtime-contract
ultra sprint review agentwrap 02-core-runtime-contract --model openai/gpt-5.5
```

Review requires `plan.md` and uses `prompts/review.md`.

### Run a Sprint Flow

```bash
ultra sprint flow <project> <sprint-slug> --to <stage> [options]
```

Examples:

```bash
ultra sprint flow agentwrap 02-core-runtime-contract --to plan --dry-run
ultra sprint flow agentwrap 02-core-runtime-contract --from requirements --to review
ultra sprint flow agentwrap 02-core-runtime-contract --from reasoning --to review --force
ultra sprint flow agentwrap 02-core-runtime-contract --to plan --auto-prereqs
```

Flow options:

- `--from <stage>` - starting stage. Defaults to the beginning of the flow.
- `--to <stage>` - ending stage. Required.
- `--force` - run selected stages even if flow state marks them complete.
- `--no-skip` - run stages even when existing artifacts appear valid.
- `--auto-prereqs` - allow missing upstream prerequisites to be generated when they are inside the requested range.
- `--dry-run` - print the planned stage run without executing.
- `--model <model>` - override the model used for every executed stage.
- `--variant <variant>` - override the model variant.
- `--timeout <ms>` - override the stage timeout.

The flow command skips valid artifacts by default. Use `--force` or `--no-skip` when you want to regenerate output.

`area-reasoning` is skipped automatically when `sprint-index.md` does not select any reasoning templates.

### Check Sprint Status

```bash
ultra sprint status <project> <sprint-slug>
```

This prints artifact presence and flow state for the sprint.

## Model Fallbacks and Rate Limits

The CLI runs `opencode` through `cli/src/opencode.ts`.

Every agent run is executed as:

```bash
opencode run <inline-prompt> --dir <working-dir> --format json --dangerously-skip-permissions
```

The CLI passes:

- `OPENCODE_CONFIG=<path-to-cli/opencode-config.json>`
- any command-specific environment overrides
- `--model` and `--variant` when provided or configured

The wrapper watches stderr for common rate-limit and quota messages, including `rate limit`, `429`, `too many requests`, and `quota exceeded`. When rate limiting is detected, it can retry with the configured backup model.

## Recommended Workflows

### Explore a Study Before Running It

```bash
ultra study list <study>
ultra study run <study> <dimension> <source> --dry-run
ultra study run <study> <dimension> <source>
```

Use this for validating prompts and source selection before spending model budget on the full matrix.

### Run a Large Study Reliably

```bash
ultra study run-loop <study> --batch-size 3
ultra study status <study>
```

If the run is interrupted or rate-limited, run the same `run-loop` command again to resume from `.run-state.json`.

### Generate Planning Artifacts for a Sprint

```bash
ultra sprint flow <project> <sprint-slug> --to plan --dry-run
ultra sprint flow <project> <sprint-slug> --to plan
ultra sprint status <project> <sprint-slug>
```

### Continue an Existing Sprint

```bash
ultra sprint status <project> <sprint-slug>
ultra sprint flow <project> <sprint-slug> --from reasoning --to review
```

Use `--force` when you intentionally want to rerun completed stages.

## Testing the CLI

From `cli/`:

```bash
bun test
```

Watch mode:

```bash
bun test --watch
```

The tests cover path resolution, prompt substitution, flow state initialization, artifact inspection, stage slicing, and validation behavior.

## Troubleshooting

### `Study "<name>" not found`

The CLI looks for:

```text
studies/<name>/
```

Run `ultra --help` to see discovered studies, or verify the directory name.

### `Project "<name>" not found`

The CLI looks for:

```text
projects/<name>/
```

Create the project directory and required project inputs before running sprint commands.

### `--to <stage> is required`

`ultra sprint flow` always requires an explicit target stage:

```bash
ultra sprint flow <project> <sprint> --to plan
```

### A Sprint Stage Was Skipped

Flow skips stages when existing artifacts validate successfully or when `flow-state.json` marks the stage complete. Use:

```bash
ultra sprint flow <project> <sprint> --from <stage> --to <stage> --force
```

Or:

```bash
ultra sprint flow <project> <sprint> --from <stage> --to <stage> --no-skip
```

### `area-reasoning` Is Skipped

This is expected when `sprint-index.md` does not select any reasoning templates. Select templates in the sprint index if area reasoning is required.

### `opencode` Is Not Found

The CLI tries:

1. `opencode` on `PATH`
2. `~/.opencode/bin/opencode`

Install `opencode` or add it to `PATH`.

### A Study Loop Looks Stuck

Check status:

```bash
ultra study status <study>
```

Failed tasks may be waiting for retry backoff. The status output includes retry timestamps.

### Completed Study Tasks Were Reset

On resume, `run-loop` verifies that completed per-source report files still exist. If a task is marked completed but its report is missing, the task is reset to pending so the state file does not drift from the filesystem.

## Current Limitations

- `meta` commands are not migrated into this CLI yet. The command currently prints a migration notice.
- The CLI is tightly coupled to the `.ultra/` directory layout.
- Agent commands run with `--dangerously-skip-permissions`, so use this CLI only in a workspace where that trust boundary is acceptable.
- Study filtering hooks exist internally for dimension and source filters, but the public argument parser currently exposes the main study options rather than dedicated filter flags.

