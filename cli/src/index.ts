#!/usr/bin/env bun

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

import {
	ULTRA_ROOT,
	STUDIES_DIR,
	PROJECTS_DIR,
	resolveStudyDir,
	resolveProjectDir,
	loadConfig,
} from "./paths.js";
import {
	cmdStudyList,
	cmdStudyRun,
	cmdStudyRunAll,
	cmdStudyRunLoop,
	cmdStudyStatus,
} from "./studies.js";
import {
	cmdSprintPlan,
	cmdSprintExecute,
	cmdSprintReview,
	cmdSprintFlow,
	cmdSprintStatus,
} from "./sprint.js";
import { STAGE_ORDER, type StageName } from "./state.js";

// ──────────────────────────────────────────────────────────────────────────────
// Meta commands (stub — delegated to meta.ts)
// ──────────────────────────────────────────────────────────────────────────────

async function cmdMetaList(): Promise<void> {
	console.log("\nMeta studies are not yet migrated to .ultra/cli");
	console.log("  Use: study meta list (legacy ultraplan/cli)");
	console.log("");
}

async function cmdMetaRun(): Promise<void> {
	console.log("\nMeta commands not yet migrated to .ultra/cli");
	console.log("  Use: study meta <command> (legacy ultraplan/cli)");
	console.log("");
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function listStudies(): string[] {
	try {
		return readdirSync(STUDIES_DIR)
			.filter(
				(d) =>
					!d.startsWith(".") && statSync(join(STUDIES_DIR, d)).isDirectory(),
			)
			.sort();
	} catch {
		return [];
	}
}

function listProjects(): string[] {
	try {
		return readdirSync(PROJECTS_DIR)
			.filter(
				(d) =>
					!d.startsWith(".") && statSync(join(PROJECTS_DIR, d)).isDirectory(),
			)
			.sort();
	} catch {
		return [];
	}
}

function showHelp(): void {
	console.log(`
Ultra CLI — Sprint Flow Orchestrator & Study Runner

Usage:
  ultra <command> [options]

Commands:

  study <name> list
  ultra study list <name>
  ultra study run <name> <dimension-ref> <source-name> [options]
  ultra study run-all <name> [options]
  ultra study run-loop <name> [options]
  ultra study status <name>

  ultra sprint plan <project> <sprint-slug> [options]
  ultra sprint execute <project> <sprint-slug> [options]
  ultra sprint review <project> <sprint-slug> [options]
  ultra sprint flow <project> <sprint-slug> [options]
  ultra sprint status <project> <sprint-slug>

Sprint flow options:
  --from <stage>         starting stage (default: start)
  --to <stage>           ending stage (required)
  --force                run even if artifact exists
  --no-skip              do not skip existing valid artifacts
  --auto-prereqs         generate missing prerequisites
  --dry-run              print planned actions only
  --model <model>        override model
  --variant <variant>    override model variant
  --timeout <ms>         execution timeout in milliseconds

Supported stages:
  sprint-index, technical-handbook, area-reasoning, reasoning, plan, implementation, review

Available studies:
  ${
		listStudies()
			.map((s) => `  ${s}`)
			.join("\n  ") || "  (none)"
	}

Available projects:
  ${
		listProjects()
			.map((p) => `  ${p}`)
			.join("\n  ") || "  (none)"
	}

Examples:
  ultra study list go-cli-study
  ultra study run go-cli-study 01-project-structure gh-cli
  ultra sprint flow agentwrap 02-core-runtime-contract --from sprint-index --to plan --dry-run
  ultra sprint flow agentwrap 02-core-runtime-contract --from reasoning --to review --force

`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (!args.length || args[0] === "--help" || args[0] === "-h") {
		showHelp();
		process.exit(0);
	}

	const CONFIG = loadConfig();

	// ── Backward compat: 'study' subcommand ──────────────────────────────────
	if (args[0] === "study") {
		if (args.length < 2) {
			showHelp();
			process.exit(1);
		}

		// Handle both new shape (ultra study <name> <cmd>) and
		// old shape (ultra study list <name>, ultra study run <name> ...)
		const studyCommands = ["list", "run", "run-all", "run-loop", "status"];
		let studyName: string;
		let cmd: string | undefined;

		if (studyCommands.includes(args[1])) {
			// Old shape: ultra study <cmd> <name>
			cmd = args[1];
			studyName = args[2] ?? "";
		} else {
			// New shape: ultra study <name> <cmd>
			studyName = args[1];
			cmd = args[2];
		}

		const studyDir = resolveStudyDir(studyName);
		if (!existsSync(studyDir) || !statSync(studyDir).isDirectory()) {
			console.error(
				`\nError: Study "${studyName}" not found in .ultra/studies/`,
			);
			const available = listStudies();
			if (available.length > 0) {
				console.log(`\nAvailable studies:\n  ${available.join("\n  ")}\n`);
			}
			process.exit(1);
		}

		const modelIdx = args.indexOf("--model");
		const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
		const variantIdx = args.indexOf("--variant");
		const variant = variantIdx >= 0 ? args[variantIdx + 1] : undefined;
		const dryRun = args.includes("--dry-run");
		const parallelIdx = args.indexOf("--parallel");
		const parallel =
			parallelIdx >= 0 ? parseInt(args[parallelIdx + 1], 10) : undefined;
		const batchIdx = args.indexOf("--batch-size");
		const batchSize =
			batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) : CONFIG.defaultParallel;
		const timeoutIdx = args.indexOf("--timeout");
		const timeout =
			timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1], 10) : undefined;

		// Build positional args — skip flags, skip cmd, skip studyName
		// New shape: args = ["study", "<name>", "<cmd>", ...flags, arg1, arg2]
		// Old shape: args = ["study", "<cmd>", "<name>", ...flags, arg1, arg2]
		// For new shape, positional starts at args[3]
		// For old shape, positional starts at args[4] (args[3] is the name which we already have)
		// In both cases, positional = args.slice(3).filter(a => !a.startsWith("--") && a !== cmd && a !== studyName)
		const positional = args
			.slice(3)
			.filter((a) => !a.startsWith("--") && a !== cmd && a !== studyName);

		switch (cmd) {
			case "list":
				await cmdStudyList(studyName);
				break;
			case "run":
				if (positional.length < 2) {
					console.error(
						"Usage: ultra study run <name> <dimension-ref> <source-name>",
					);
					process.exit(1);
				}
				await cmdStudyRun(studyName, positional[0], positional[1], {
					model,
					variant,
					dryRun,
					timeoutMs: timeout,
				});
				break;
			case "run-all":
				await cmdStudyRunAll(studyName, {
					model,
					variant,
					dryRun,
					parallel,
					timeoutMs: timeout,
				});
				break;
			case "run-loop":
				await cmdStudyRunLoop(studyName, {
					model,
					variant,
					dryRun,
					batchSize,
					timeoutMs: timeout,
				});
				break;
			case "status":
				await cmdStudyStatus(studyName);
				break;
			default:
				if (!cmd || cmd === "--help") {
					showHelp();
				} else {
					console.error(`Unknown study command: "${cmd}"`);
					process.exit(1);
				}
		}
		process.exit(0);
	}

	// ── Sprint commands ────────────────────────────────────────────────────────
	if (args[0] === "sprint") {
		if (args.length < 2) {
			showHelp();
			process.exit(1);
		}

		const sprintCmd = args[1];
		const modelIdx = args.indexOf("--model");
		const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
		const variantIdx = args.indexOf("--variant");
		const variant = variantIdx >= 0 ? args[variantIdx + 1] : undefined;
		const dryRun = args.includes("--dry-run");
		const timeoutIdx = args.indexOf("--timeout");
		const timeout =
			timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1], 10) : undefined;
		const fromIdx = args.indexOf("--from");
		const toIdx = args.indexOf("--to");
		const force = args.includes("--force");
		const noSkip = args.includes("--no-skip");
		const autoPrereqs = args.includes("--auto-prereqs");
		const contextWindowIdx = args.indexOf("--context-window");
		const contextWindow =
			contextWindowIdx >= 0
				? parseInt(args[contextWindowIdx + 1], 10)
				: undefined;

		switch (sprintCmd) {
			case "plan": {
				if (args.length < 4) {
					console.error(
						"Usage: ultra sprint plan <project> <sprint-slug> [options]",
					);
					process.exit(1);
				}
				await cmdSprintPlan(args[2], args[3], {
					model,
					variant,
					dryRun,
					timeoutMs: timeout,
					contextWindow,
				});
				break;
			}
			case "execute": {
				if (args.length < 4) {
					console.error(
						"Usage: ultra sprint execute <project> <sprint-slug> [options]",
					);
					process.exit(1);
				}
				await cmdSprintExecute(args[2], args[3], {
					model,
					variant,
					dryRun,
					timeoutMs: timeout,
				});
				break;
			}
			case "review": {
				if (args.length < 4) {
					console.error(
						"Usage: ultra sprint review <project> <sprint-slug> [options]",
					);
					process.exit(1);
				}
				await cmdSprintReview(args[2], args[3], {
					model,
					variant,
					dryRun,
					timeoutMs: timeout,
				});
				break;
			}
			case "flow": {
				if (args.length < 4) {
					showSprintFlowHelp();
					process.exit(1);
				}
				const from =
					fromIdx >= 0 ? (args[fromIdx + 1] as StageName) : undefined;
				const to = toIdx >= 0 ? (args[toIdx + 1] as StageName) : undefined;
				if (!to) {
					console.error("--to <stage> is required");
					showSprintFlowHelp();
					process.exit(1);
				}
				if (from && !STAGE_ORDER.includes(from)) {
					console.error(`Invalid --from stage: ${from}`);
					console.error(`Valid stages: ${STAGE_ORDER.join(", ")}`);
					process.exit(1);
				}
				if (!STAGE_ORDER.includes(to)) {
					console.error(`Invalid --to stage: ${to}`);
					console.error(`Valid stages: ${STAGE_ORDER.join(", ")}`);
					process.exit(1);
				}
				await cmdSprintFlow(args[2], args[3], {
					from,
					to,
					force,
					noSkip,
					autoPrereqs,
					dryRun,
					model,
					variant,
					timeoutMs: timeout,
				});
				break;
			}
			case "status": {
				if (args.length < 4) {
					console.error("Usage: ultra sprint status <project> <sprint-slug>");
					process.exit(1);
				}
				await cmdSprintStatus(args[2], args[3]);
				break;
			}
			default:
				console.error(`Unknown sprint command: "${sprintCmd}"`);
				showHelp();
				process.exit(1);
		}
		process.exit(0);
	}

	// ── Meta commands ───────────────────────────────────────────────────────────
	if (args[0] === "meta") {
		const metaArgs = args.slice(1);
		if (
			metaArgs.length === 0 ||
			metaArgs[0] === "--help" ||
			metaArgs[0] === "-h"
		) {
			await cmdMetaList();
			process.exit(0);
		}
		const metaCmd = metaArgs[0];
		if (metaCmd === "list") {
			await cmdMetaList();
			process.exit(0);
		}
		console.error(`Meta command "${metaCmd}" not yet migrated to .ultra/cli`);
		process.exit(1);
	}

	// ── Forward compatibility: 'study' commands without 'study' prefix ───────
	// Check if first arg looks like a study name
	const studyDir = resolveStudyDir(args[0]);
	if (existsSync(studyDir) && statSync(studyDir).isDirectory()) {
		// Treat args[0] as study name, args[1] as command
		const studyName = args[0];
		const cmd = args[1];
		const modelIdx = args.indexOf("--model");
		const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
		const variantIdx = args.indexOf("--variant");
		const variant = variantIdx >= 0 ? args[variantIdx + 1] : undefined;
		const dryRun = args.includes("--dry-run");
		const parallelIdx = args.indexOf("--parallel");
		const parallel =
			parallelIdx >= 0 ? parseInt(args[parallelIdx + 1], 10) : undefined;
		const batchIdx = args.indexOf("--batch-size");
		const batchSize =
			batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) : CONFIG.defaultParallel;
		const timeoutIdx = args.indexOf("--timeout");
		const timeout =
			timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1], 10) : undefined;
		const positional = args.slice(2).filter((a) => !a.startsWith("--"));

		switch (cmd) {
			case "list":
				await cmdStudyList(studyName);
				break;
			case "run":
				if (positional.length < 2) {
					console.error(
						"Usage: ultra <name> run <dimension-ref> <source-name>",
					);
					process.exit(1);
				}
				await cmdStudyRun(studyName, positional[0], positional[1], {
					model,
					variant,
					dryRun,
					timeoutMs: timeout,
				});
				break;
			case "run-all":
				await cmdStudyRunAll(studyName, {
					model,
					variant,
					dryRun,
					parallel,
					timeoutMs: timeout,
				});
				break;
			case "run-loop":
				await cmdStudyRunLoop(studyName, {
					model,
					variant,
					dryRun,
					batchSize,
					timeoutMs: timeout,
				});
				break;
			case "status":
				await cmdStudyStatus(studyName);
				break;
			default:
				// Not a study command — show help
				showHelp();
				process.exit(1);
		}
		process.exit(0);
	}

	// ── Not recognized ─────────────────────────────────────────────────────────
	showHelp();
	process.exit(1);
}

function showSprintFlowHelp(): void {
	console.error(`
Sprint flow usage: ultra sprint flow <project> <sprint-slug> --from <stage> --to <stage> [options]

Supported stages:
  ${STAGE_ORDER.join(", ")}

Options:
  --from <stage>       starting stage (default: start)
  --to <stage>         ending stage (required)
  --force              run even if artifact exists
  --no-skip            do not skip existing valid artifacts
  --auto-prereqs       allow required upstream prerequisites to be generated
  --dry-run            print planned actions only
  --model <model>      override model
  --variant <variant>  override model variant
  --timeout <ms>       execution timeout
`);
}

main().catch((err) => {
	console.error(
		`\nFatal: ${err instanceof Error ? err.message : String(err)}\n`,
	);
	process.exit(1);
});
