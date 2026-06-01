import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PROJECTS_DIR } from "./paths.js";

export interface StageState {
	status: "missing" | "draft" | "ready" | "complete" | "failed" | "skipped";
	path: string;
	lastRunAt?: string;
	error?: string;
}

export interface FlowState {
	version: number;
	project: string;
	sprint: string;
	updatedAt: string;
	stages: Record<string, StageState>;
}

export const STAGE_ORDER = [
	"requirements",
	"sprint-index",
	"technical-handbook",
	"area-reasoning",
	"reasoning",
	"plan",
	"implementation",
	"review",
] as const;

export type StageName = (typeof STAGE_ORDER)[number];

export const STAGE_PATHS: Record<StageName, string> = {
	requirements: "requirements.md",
	"sprint-index": "sprint-index.md",
	"technical-handbook": "technical-handbook.md",
	"area-reasoning": "reasoning/",
	reasoning: "reasoning.md",
	plan: "plan.md",
	implementation: ".run-state.json",
	review: "review.md",
};

export const STAGE_PROMPTS: Record<StageName, string> = {
	requirements: "create-requirements.md",
	"sprint-index": "create-sprint-index.md",
	"technical-handbook": "create-technical-handbook.md",
	"area-reasoning": "create-area-reasoning.md",
	reasoning: "create-sprint-reasoning.md",
	plan: "plan-sprint.md",
	implementation: "execute-sprint.md",
	review: "review.md",
};

export function loadFlowState(sprintDir: string): FlowState | null {
	const path = join(sprintDir, "flow-state.json");
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
}

export function saveFlowState(sprintDir: string, state: FlowState): void {
	state.updatedAt = new Date().toISOString();
	writeFileSync(
		join(sprintDir, "flow-state.json"),
		JSON.stringify(state, null, 2),
		"utf-8",
	);
}

/**
 * Inspect existing sprint artifacts and update stage statuses accordingly.
 * This allows resuming on sprints that were created before flow-state.json existed.
 * Pass projectDir to check whether area-reasoning templates were actually selected.
 */
export function inspectSprintArtifacts(
	sprintDir: string,
	state: FlowState,
	projectDir?: string,
): FlowState {
	// Requirements
	if (existsSync(join(sprintDir, "requirements.md"))) {
		state.stages["requirements"] = {
			...state.stages["requirements"],
			status: "ready",
		};
	}

	// Sprint index
	if (existsSync(join(sprintDir, "sprint-index.md"))) {
		state.stages["sprint-index"] = {
			...state.stages["sprint-index"],
			status: "ready",
		};
	}

	// Technical handbook
	if (existsSync(join(sprintDir, "technical-handbook.md"))) {
		state.stages["technical-handbook"] = {
			...state.stages["technical-handbook"],
			status: "ready",
		};
	}

	// Area reasoning: only mark ready if sprint-index selected templates AND
	// reasoning/ contains .md files.  If no templates were selected, leave as missing.
	if (projectDir) {
		// Import lazily to avoid circular dependency at module level
		const { getSelectedAreaReasoningTemplates } = require("./validators.js");
		const selected = getSelectedAreaReasoningTemplates(sprintDir);
		if (selected.length === 0) {
			// Only mark skipped if sprint-index exists AND has no templates selected.
			// If sprint-index doesn't exist yet, we can't determine applicability —
			// leave as "missing" so the flow re-evaluates after sprint-index is created.
			const sprintIndexPath = join(sprintDir, "sprint-index.md");
			if (existsSync(sprintIndexPath)) {
				state.stages["area-reasoning"] = {
					...state.stages["area-reasoning"],
					status: "skipped",
				};
			} else {
				state.stages["area-reasoning"] = {
					...state.stages["area-reasoning"],
					status: "missing",
				};
			}
		} else {
			const reasonDir = join(sprintDir, "reasoning");
			if (existsSync(reasonDir)) {
				const files = readdirSync(reasonDir).filter(
					(f) => f.endsWith(".md") && !f.startsWith("."),
				);
				if (files.length > 0) {
					state.stages["area-reasoning"] = {
						...state.stages["area-reasoning"],
						status: "ready",
					};
				} else {
					state.stages["area-reasoning"] = {
						...state.stages["area-reasoning"],
						status: "missing",
					};
				}
			} else {
				state.stages["area-reasoning"] = {
					...state.stages["area-reasoning"],
					status: "missing",
				};
			}
		}
	} else {
		// No projectDir passed — fall back to checking for files only
		const reasonDir = join(sprintDir, "reasoning");
		if (existsSync(reasonDir)) {
			const files = readdirSync(reasonDir).filter(
				(f) => f.endsWith(".md") && !f.startsWith("."),
			);
			if (files.length > 0) {
				state.stages["area-reasoning"] = {
					...state.stages["area-reasoning"],
					status: "ready",
				};
			}
		}
	}

	// Sprint reasoning (reasoning.md)
	if (existsSync(join(sprintDir, "reasoning.md"))) {
		state.stages["reasoning"] = {
			...state.stages["reasoning"],
			status: "ready",
		};
	}

	// Plan
	if (existsSync(join(sprintDir, "plan.md"))) {
		state.stages["plan"] = { ...state.stages["plan"], status: "ready" };
	}

	// Implementation (check for .run-state.json in sprint dir OR implementation markers)
	if (existsSync(join(sprintDir, ".run-state.json"))) {
		state.stages["implementation"] = {
			...state.stages["implementation"],
			status: "ready",
		};
	}

	// Review
	if (existsSync(join(sprintDir, "review.md"))) {
		state.stages["review"] = { ...state.stages["review"], status: "ready" };
	}

	return state;
}

export function initFlowState(
	project: string,
	sprint: string,
	sprintDir: string,
): FlowState {
	const existing = loadFlowState(sprintDir);
	if (existing) {
		// Even with existing state, re-inspect artifacts in case they were
		// created since the last run (e.g. manually or by previous CLI version)
		// We need the projectDir to check whether area-reasoning was selected.
		const projectDir = join(PROJECTS_DIR, project);
		const updated = inspectSprintArtifacts(sprintDir, existing, projectDir);
		// Add any new stages that were added to STAGE_ORDER since the state was created
		for (const stageName of STAGE_ORDER) {
			if (!updated.stages[stageName]) {
				updated.stages[stageName] = {
					status: "missing",
					path: STAGE_PATHS[stageName],
				};
			}
		}
		saveFlowState(sprintDir, updated);
		return updated;
	}

	const state: FlowState = {
		version: 1,
		project,
		sprint,
		updatedAt: new Date().toISOString(),
		stages: {},
	};

	for (const stageName of STAGE_ORDER) {
		state.stages[stageName] = {
			status: "missing",
			path: STAGE_PATHS[stageName],
		};
	}

	// Inspect existing artifacts with projectDir so area-reasoning is checked correctly
	const projectDir = join(PROJECTS_DIR ?? "", project);
	inspectSprintArtifacts(sprintDir, state, projectDir);

	saveFlowState(sprintDir, state);
	return state;
}

export function updateStageState(
	state: FlowState,
	stageName: StageName,
	status: StageState["status"],
	error?: string,
): void {
	state.stages[stageName] = {
		...state.stages[stageName],
		status,
		lastRunAt: new Date().toISOString(),
		error,
	};
}

export function getStageIndex(stage: StageName): number {
	return STAGE_ORDER.indexOf(stage);
}

export function sliceStages(
	fromStage: StageName | null,
	toStage: StageName,
): StageName[] {
	const fromIdx = fromStage ? getStageIndex(fromStage) : 0;
	const toIdx = getStageIndex(toStage);
	return STAGE_ORDER.slice(fromIdx, toIdx + 1);
}

export function flowStateToString(state: FlowState | null): string {
	if (!state) return "  (no flow state)";
	const lines: string[] = [];
	for (const [name, info] of Object.entries(state.stages)) {
		const when = info.lastRunAt ? ` @ ${info.lastRunAt.split("T")[0]}` : "";
		const err = info.error ? ` — ${info.error}` : "";
		lines.push(`  [${info.status}] ${name}${when}${err}`);
	}
	return lines.join("\n");
}
