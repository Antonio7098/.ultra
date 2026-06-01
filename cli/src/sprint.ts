import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "fs";
import { join } from "path";
import { ULTRA_ROOT, PROJECTS_DIR, loadConfig } from "./paths.js";
import { buildSprintPrompt } from "./config.js";
import { runOpenCodeWithFallback } from "./opencode.js";
import { cmdSprintFlow } from "./sprint-flow.js";
import { initFlowState } from "./state.js";

export { cmdSprintFlow };

// ──────────────────────────────────────────────────────────────────────────────
// Sprint commands
// ──────────────────────────────────────────────────────────────────────────────

export async function cmdSprintPlan(
	project: string,
	sprintSlug: string,
	opts: {
		model?: string;
		variant?: string;
		dryRun?: boolean;
		timeoutMs?: number;
		contextWindow?: number;
	},
): Promise<void> {
	const projectDir = join(PROJECTS_DIR, project);
	if (!existsSync(projectDir)) {
		console.error(
			`\nError: Project "${project}" not found at .ultra/projects/${project}`,
		);
		process.exit(1);
	}

	const promptPath = join(ULTRA_ROOT, "prompts", "plan-sprint.md");
	if (!existsSync(promptPath)) {
		console.error(
			`\nError: Sprint planning prompt not found at .ultra/prompts/plan-sprint.md`,
		);
		process.exit(1);
	}

	const prompt = buildSprintPrompt(promptPath, project, sprintSlug);
	const sprintDir = join(projectDir, "sprints", sprintSlug);
	const outputFile = join(sprintDir, "plan.md");

	if (opts.dryRun) {
		console.log(`\n=== DRY RUN: plan-sprint ${project} ${sprintSlug} ===\n`);
		console.log(`Prompt file: ${promptPath}`);
		console.log(`Output file: ${outputFile}`);
		console.log(`Model: ${opts.model || "sprintPlanningModel"}`);
		console.log("");
		return;
	}

	mkdirSync(sprintDir, { recursive: true });

	const extraEnv: Record<string, string> = {};
	if (opts.contextWindow && opts.model) {
		const slashIdx = opts.model.indexOf("/");
		if (slashIdx > 0) {
			const provider = opts.model.slice(0, slashIdx);
			const modelName = opts.model.slice(slashIdx + 1);
			extraEnv.OPENCODE_CONFIG_CONTENT = JSON.stringify({
				provider: {
					[provider]: {
						models: {
							[modelName]: {
								limit: { context: opts.contextWindow, output: 64000 },
							},
						},
					},
				},
			});
		}
	}

	console.log(`\n▶ Planning sprint ${sprintSlug} for project ${project}...\n`);

	const CONFIG = loadConfig();
	const { code } = await runOpenCodeWithFallback({
		prompt,
		workingDir: ULTRA_ROOT,
		model: opts.model || CONFIG.sprintPlanningModel,
		variant: opts.variant,
		timeoutMs: opts.timeoutMs,
		primaryModel: CONFIG.sprintPlanningModel,
		backupModel: CONFIG.backupModel,
		extraEnv,
	});

	if (code === 0) {
		console.log(`\n✓ Sprint plan written: ${outputFile}`);
	} else {
		console.error(`\n✗ Sprint planning failed (exit code ${code})`);
		process.exit(code);
	}
}

export async function cmdSprintExecute(
	project: string,
	sprintSlug: string,
	opts: {
		model?: string;
		variant?: string;
		dryRun?: boolean;
		timeoutMs?: number;
	},
): Promise<void> {
	const projectDir = join(PROJECTS_DIR, project);
	if (!existsSync(projectDir)) {
		console.error(
			`\nError: Project "${project}" not found at .ultra/projects/${project}`,
		);
		process.exit(1);
	}

	const sprintDir = join(projectDir, "sprints", sprintSlug);
	const planPath = join(sprintDir, "plan.md");
	const reasoningPath = join(sprintDir, "reasoning.md");

	const missing: string[] = [];
	if (!existsSync(planPath)) missing.push("plan.md");
	if (!existsSync(reasoningPath)) missing.push("reasoning.md");

	if (missing.length > 0) {
		console.error(
			`\nError: Cannot execute sprint "${sprintSlug}" for project "${project}". Missing required planning artefacts:\n`,
		);
		for (const p of missing) console.error(`  ✗ ${sprintDir}/${p}`);
		console.error(
			`\n  Run 'ultra sprint plan ${project} ${sprintSlug}' to generate the missing artefacts.\n`,
		);
		process.exit(1);
	}

	const promptPath = join(ULTRA_ROOT, "prompts", "execute-sprint.md");
	if (!existsSync(promptPath)) {
		console.error(
			`\nError: Sprint execution prompt not found at .ultra/prompts/execute-sprint.md`,
		);
		process.exit(1);
	}

	const prompt = buildSprintPrompt(promptPath, project, sprintSlug);

	if (opts.dryRun) {
		console.log(`\n=== DRY RUN: execute-sprint ${project} ${sprintSlug} ===\n`);
		console.log(`Prompt file: ${promptPath}`);
		console.log(`Sprint dir: ${sprintDir}`);
		console.log(`Model: ${opts.model || "sprintExecutionModel"}`);
		console.log("");
		return;
	}

	console.log(`\n▶ Executing sprint ${sprintSlug} for project ${project}...\n`);

	const CONFIG = loadConfig();
	const { code } = await runOpenCodeWithFallback({
		prompt,
		workingDir: ULTRA_ROOT,
		model: opts.model || CONFIG.sprintExecutionModel,
		variant: opts.variant,
		timeoutMs: opts.timeoutMs,
		primaryModel: CONFIG.sprintExecutionModel,
		backupModel: CONFIG.backupModel,
	});

	if (code === 0) {
		console.log(`\n✓ Sprint execution complete`);
	} else {
		console.error(`\n✗ Sprint execution failed (exit code ${code})`);
		process.exit(code);
	}
}

export async function cmdSprintReview(
	project: string,
	sprintSlug: string,
	opts: {
		model?: string;
		variant?: string;
		dryRun?: boolean;
		timeoutMs?: number;
	},
): Promise<void> {
	const projectDir = join(PROJECTS_DIR, project);
	if (!existsSync(projectDir)) {
		console.error(
			`\nError: Project "${project}" not found at .ultra/projects/${project}`,
		);
		process.exit(1);
	}

	const sprintDir = join(projectDir, "sprints", sprintSlug);
	const planPath = join(sprintDir, "plan.md");

	if (!existsSync(planPath)) {
		console.error(`\nError: Sprint plan not found at ${planPath}`);
		console.error(`  Run 'ultra sprint plan ${project} ${sprintSlug}' first.`);
		process.exit(1);
	}

	const promptPath = join(ULTRA_ROOT, "prompts", "review.md");
	if (!existsSync(promptPath)) {
		console.error(
			`\nError: Sprint review prompt not found at .ultra/prompts/review.md`,
		);
		process.exit(1);
	}

	const prompt = buildSprintPrompt(promptPath, project, sprintSlug);

	if (opts.dryRun) {
		console.log(`\n=== DRY RUN: review ${project} ${sprintSlug} ===\n`);
		console.log(`Prompt file: ${promptPath}`);
		console.log(`Sprint dir: ${sprintDir}`);
		console.log("");
		return;
	}

	console.log(`\n▶ Reviewing sprint ${sprintSlug} for project ${project}...\n`);

	const CONFIG = loadConfig();
	const { code } = await runOpenCodeWithFallback({
		prompt,
		workingDir: ULTRA_ROOT,
		model: opts.model || CONFIG.defaultModel,
		variant: opts.variant,
		timeoutMs: opts.timeoutMs,
		primaryModel: CONFIG.primaryModel,
		backupModel: CONFIG.backupModel,
	});

	if (code === 0) {
		console.log(`\n✓ Sprint review complete`);
	} else {
		console.error(`\n✗ Sprint review failed (exit code ${code})`);
		process.exit(code);
	}
}

export async function cmdSprintStatus(
	project: string,
	sprintSlug: string,
): Promise<void> {
	const sprintDir = join(PROJECTS_DIR, project, "sprints", sprintSlug);
	if (!existsSync(sprintDir)) {
		console.error(
			`\nError: Sprint "${sprintSlug}" not found for project "${project}"`,
		);
		process.exit(1);
	}

	console.log(`\nSprint: ${sprintSlug}  |  Project: ${project}\n`);
	console.log(`Sprint dir: ${sprintDir}\n`);

	const artifacts = [
		{ name: "Sprint Requirements", file: "requirements.md" },
		{ name: "Sprint Index", file: "sprint-index.md" },
		{ name: "Technical Handbook", file: "technical-handbook.md" },
		{ name: "Sprint Reasoning", file: "reasoning.md" },
		{ name: "Sprint Plan", file: "plan.md" },
		{ name: "Review", file: "review.md" },
		{ name: "Flow State", file: "flow-state.json" },
	];

	for (const a of artifacts) {
		const path = join(sprintDir, a.file);
		const exists = existsSync(path);
		const marker = exists ? "✓" : "✗";
		console.log(`  ${marker} ${a.name}: ${a.file}`);
	}

	// Show reasoning subdir
	const reasonDir = join(sprintDir, "reasoning");
	if (existsSync(reasonDir)) {
		const files = readdirSync(reasonDir).filter((f) => !f.startsWith("."));
		if (files.length > 0) {
			console.log(`\n  Area reasoning:`);
			for (const f of files) {
				console.log(`    ✓ ${f}`);
			}
		}
	}

	// Show flow-state via initFlowState (which adds any new stages)
	const state = initFlowState(project, sprintSlug, sprintDir);
	console.log(`\n  Flow state version: ${state.version}`);
	console.log(`  Updated: ${state.updatedAt}`);
	for (const [name, info] of Object.entries(state.stages)) {
		const when = info.lastRunAt ? ` (${info.lastRunAt})` : "";
		console.log(`    [${info.status}] ${name}${when}`);
	}

	console.log("");
}
