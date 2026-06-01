# Go Todo CLI — Product Requirements Document

## Overview

A minimal, fast, composable todo-list CLI written in Go. Modeled on proven Go CLI patterns (cobra, urfave-cli, gh-cli) distilled from the go-cli-study evidence. The primary user is developers who live in the terminal.

## Goals

1. **Add tasks** — `todo add <text>` with optional due date and priority
2. **List tasks** — `todo list` with filtering by status (done/pending), priority, and due date
3. **Complete tasks** — `todo done <id>` marks a task as done
4. **Remove tasks** — `todo rm <id>` deletes a task permanently
5. **Persist tasks** — JSON file storage in `~/.config/go-todo/tasks.json` (or `$XDG_CONFIG_HOME`)
6. **Shell completion** — generate completions for bash/zsh/fish
7. **Extensible architecture** — clear separation so new commands (e.g., `todo edit`, `todo tag`) can be added without refactoring core

## Non-Goals

- No web UI or API
- No sync/sharing between machines
- No team features
- No markdown/rich-text task content

## User Experience

- Command names follow `urfave-cli` conventions: `todo <command> [args] [flags]`
- All output is plain text, machine-parseable
- Errors are descriptive and actionable
- First-run creates config directory automatically
- `todo --help` shows usage for any command
- No mandatory interactive prompts (all args on command line)

## Evidence Sources

- `.ultra/studies/go-cli-study/` — go-task, gh-cli, urfave-cli, mitchellh-cli evidence
- The project should demonstrate: subcommand routing, config-path resolution, flag parsing, error handling, IO abstraction, and testability — all grounded in the go-cli-study patterns.
