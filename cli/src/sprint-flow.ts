import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { PROJECTS_DIR, ULTRA_ROOT, loadConfig } from "./paths.js";
import { buildSprintPrompt } from "./config.js";
import { runOpenCodeWithFallback } from "./opencode.js";
import {
	STAGE_ORDER,
	type StageName,
	type FlowState,
	initFlowState,
	updateStageState,
	sliceStages,
	saveFlowState,
	getStageIndex,
} from "./state.js";
import { validateStage, getStageDescription, validateSprintIndexSubset, getSelectedAreaReasoningTemplates } from "./validators.js";

export interface SprintFlowOptions {
	from?: StageName;
	to: StageName;
	force?: boolean;
	noSkip?: boolean;
	autoPrereqs?: boolean;
	dryRun?: boolean;
	model?: string;
	variant?: string;
	timeoutMs?: number;
}

const STAGE_PROMPTS: Record<StageName, string | null> = {
	requirements: "create-requirements.md",
	"sprint-index": "create-sprint-index.md",
	"technical-handbook": "create-technical-handbook.md",
	"area-reasoning": "create-area-reasoning.md",
	reasoning: "create-sprint-reasoning.md",
	plan: "plan-sprint.md",
	implementation: "execute-sprint.md",
	review: "review.md",
};

export async function cmdSprintFlow(
	project: string,
	sprintSlug: string,
	opts: SprintFlowOptions,
): Promise<void> {
	const projectDir = join(PROJECTS_DIR, project);
	if (!existsSync(projectDir)) {
		console.error(
			`\nError: Project "${project}" not found at .ultra/projects/${project}`,
		);
		process.exit(1);
	}

	const sprintDir = join(projectDir, "sprints", sprintSlug);
	if (!existsSync(sprintDir)) {
		console.error(
			`\nError: Sprint "${sprintSlug}" not found at .ultra/projects/${project}/sprints/${sprintSlug}`,
		);
		console.error(`  Run 'ultra sprint plan ${project} ${sprintSlug}' first.`);
		process.exit(1);
	}

	// Init or load flow state
	const state = initFlowState(project, sprintSlug, sprintDir);
	const {
		from,
		to,
		force,
		noSkip,
		autoPrereqs,
		dryRun,
		model,
		variant,
		timeoutMs,
	} = opts;

	// Determine stage range
	const requested = sliceStages(from ?? null, to);
	const CONFIG = loadConfig();

	console.log(`\nSprint Flow: ${project}/${sprintSlug}`);
	console.log(`Range: ${from ?? "start"} → ${to}`);
	console.log(
		`Options: force=${force}, noSkip=${noSkip}, autoPrereqs=${autoPrereqs}, dryRun=${dryRun}`,
	);
	console.log("");

	if (dryRun) {
		console.log("=== DRY RUN ===\n");
	}

	// Determine which stages need to run
	const stagesToRun: StageName[] = [];
	const skippedStages: { stage: StageName; reason: string }[] = [];

	for (const stageName of requested) {
		// Check if prerequisites exist
		const prereqs = getPrerequisites(stageName);
		for (const prereq of prereqs) {
			const prereqPath = join(
				sprintDir,
				prereq === "sprint-index" ? "sprint-index.md" : `${prereq}.md`,
			);
			if (!existsSync(prereqPath) && prereq !== "sprint-index") {
				if (autoPrereqs) {
					if (
						!stagesToRun.includes(prereq as StageName) &&
						requested.includes(prereq as StageName)
					) {
						stagesToRun.push(prereq as StageName);
					}
				}
			}
		}

		// area-reasoning: skip if no templates are selected in sprint-index
		if (stageName === "area-reasoning") {
			const selected = getSelectedAreaReasoningTemplates(sprintDir);
			if (selected.length === 0) {
				skippedStages.push({
					stage: stageName,
					reason: "no reasoning templates selected — stage skipped",
				});
				updateStageState(state, stageName, "skipped");
				saveFlowState(sprintDir, state);
				continue;
			}
		}

		// Validate stage
		const validation = validateStage(stageName, sprintDir);
		const stageState = state.stages[stageName];

		if (force) {
			stagesToRun.push(stageName);
			continue;
		}

		if (stageState?.status === "complete") {
			skippedStages.push({ stage: stageName, reason: "already complete" });
			continue;
		}

		if (
			stageState?.status === "skipped" &&
			validation.valid &&
			validation.reason?.includes("skipped")
		) {
			skippedStages.push({ stage: stageName, reason: "skipped" });
			continue;
		}

		if (noSkip) {
			stagesToRun.push(stageName);
			continue;
		}

		if (validation.valid && stageState?.status !== "failed") {
			skippedStages.push({
				stage: stageName,
				reason: validation.reason ?? "valid",
			});
			continue;
		}

		stagesToRun.push(stageName);
	}

	// Print plan
	if (skippedStages.length > 0) {
		console.log("Skipped (valid):");
		for (const s of skippedStages) {
			console.log(`  ⊘ ${s.stage} — ${s.reason}`);
		}
		console.log("");
	}

	if (stagesToRun.length === 0) {
		console.log("No stages to run. All artifacts are valid.");
		console.log("\nFlow state:");
		printFlowState(state);
		return;
	}

	console.log("Stages to run:");
	for (const stageName of stagesToRun) {
		const desc = getStageDescription(stageName);
		console.log(`  ▶ ${stageName} — ${desc}`);
	}
	console.log("");

	if (dryRun) {
		console.log("Dry run — no stages executed.");
		console.log("\nFlow state:");
		printFlowState(state);
		return;
	}

	// Execute stages in order
	for (const stageName of stagesToRun) {
		console.log(`\n${"=".repeat(60)}`);
		console.log(`Running stage: ${stageName}`);
		console.log(`${"=".repeat(60)}\n`);

		const promptFile = join(
			ULTRA_ROOT,
			"prompts",
			STAGE_PROMPTS[stageName] ?? "",
		);
		const hasPrompt = existsSync(promptFile);

		if (!hasPrompt) {
			console.log(
				`⚠ No prompt found for stage "${stageName}" at ${promptFile}`,
			);
			console.log("  Marking as complete (manual stage).");
			updateStageState(state, stageName, "complete");
			saveFlowState(sprintDir, state);
			continue;
		}

		const prompt = buildSprintPrompt(promptFile, project, sprintSlug);

		const { code, rateLimited } = await runOpenCodeWithFallback({
			prompt,
			workingDir: ULTRA_ROOT,
			model: model ?? CONFIG.defaultModel,
			variant: variant ?? CONFIG.defaultVariant,
			timeoutMs: timeoutMs ?? CONFIG.defaultTimeoutMs,
			primaryModel: CONFIG.primaryModel,
			backupModel: CONFIG.backupModel,
		});

		if (code === 0) {
			// For sprint-index, additionally validate that all selections are a subset of project index
			if (stageName === "sprint-index") {
				const projectDir = join(PROJECTS_DIR, project);
				const subsetResult = validateSprintIndexSubset(sprintDir, projectDir);
				if (!subsetResult.valid) {
					console.error(
						`\n⚠ Sprint index failed subset validation: ${subsetResult.reason}`,
					);
					updateStageState(state, stageName, "failed", "subset validation");
					saveFlowState(sprintDir, state);
					continue;
				}
			}
			updateStageState(state, stageName, "complete");
			console.log(`\n✓ Stage "${stageName}" completed`);
		} else if (rateLimited) {
			updateStageState(state, stageName, "failed", "rate limited");
			console.error(`\n✗ Stage "${stageName}" failed: rate limited`);
		} else {
			updateStageState(state, stageName, "failed", `exit code ${code}`);
			console.error(`\n✗ Stage "${stageName}" failed (exit code ${code})`);
		}

		saveFlowState(sprintDir, state);
	}

	console.log("\n" + "=".repeat(60));
	console.log("Flow complete");
	console.log("=".repeat(60) + "\n");

	printFlowState(state);
}

function getPrerequisites(stageName: StageName): StageName[] {
	const idx = STAGE_ORDER.indexOf(stageName);
	if (idx <= 0) return [];
	return STAGE_ORDER.slice(0, idx) as StageName[];
}

function printFlowState(state: FlowState): void {
	for (const [name, info] of Object.entries(state.stages)) {
		const when = info.lastRunAt ? ` @ ${info.lastRunAt.split("T")[0]}` : "";
		const err = info.error ? ` ✗ ${info.error}` : "";
		console.log(`  [${info.status}] ${name}${when}${err}`);
	}
}
