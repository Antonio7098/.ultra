# Ultra CLI Test Project — TRD

## Constraints

1. The CLI must resolve paths correctly in both:
   - Governance repo layout (`.ultra/` at repo root)
   - Project layout (`.ultra/` at project root)
2. All paths must use `.ultra/` prefix, not `ultraplan/` or `targets/`
3. Sprint flow must skip stages that have valid artifacts
4. Sprint flow must not re-run stages that are complete unless `--force` is passed

## Quality Gates

1. All 42 unit tests pass
2. `ultra --help` shows all commands
3. `ultra study list <name>` lists dimensions and sources
4. `ultra sprint status <project> <sprint>` shows correct artifact states
5. `ultra sprint flow <project> <sprint> --dry-run` prints planned actions without executing

## Testing Approach

- Unit tests for each module (paths, state, validators, config)
- Integration tests for CLI commands using dry-run mode
- No real model calls required for validation
