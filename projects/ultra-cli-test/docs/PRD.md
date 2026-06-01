# Ultra CLI Test Project — PRD

## Overview

This is a test project created to validate the `.ultra/cli` sprint flow. The project scope is intentionally small and self-referential — it tests that the CLI correctly orchestrates sprints, creates artifacts, and validates them.

## Goals

1. Validate that `ultra sprint flow` correctly discovers existing artifacts and skips valid stages
2. Validate that `ultra sprint flow --from/to` correctly slices the stage graph
3. Validate that `ultra sprint status` correctly reports artifact presence
4. Validate that `ultra study list` and other study commands work end-to-end
5. Test backward compatibility with both `study <name> <cmd>` and `study <cmd> <name>` argument orders

## Non-Goals

- This is not a real project — no real implementation expected
- No actual model calls should be needed to validate the flow

## Scope

Sprint 01-cli-migration:

- Create sprint index selecting minimal context
- Create technical handbook from existing evidence
- Create sprint reasoning with at least 2 decisions
- Create sprint plan with at least 2 tasks

## Evidence Sources

- `.ultra/cli/src/index.ts` — the main CLI entry point
- `.ultra/cli/src/paths.ts` — path resolution module
- `.ultra/prompts/` — prompt templates

## Success Criteria

1. `ultra sprint flow ultra-cli-test 01-cli-migration --from sprint-index --to plan --dry-run` shows correct stages
2. `ultra sprint status ultra-cli-test 01-cli-migration` shows all artifact states
3. `ultra study list go-cli-study` shows available sources
4. All unit tests pass
