import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";

const TEST_ROOT = join(process.cwd(), ".ultra", "cli", "__tests__", "cli-root");

function freshDir(name: string): string {
	const d = join(TEST_ROOT, name);
	rmSync(d, { force: true, recursive: true });
	mkdirSync(d, { recursive: true });
	return d;
}

function seedProjectInputsForSprintDir(sprintDir: string): void {
	const projectDir = join(sprintDir, "..", "..");
	mkdirSync(join(projectDir, "docs"), { recursive: true });
	writeFileSync(
		join(projectDir, "project-index.md"),
		"# Project Index\n",
		"utf-8",
	);
	writeFileSync(join(projectDir, "docs", "PRD.md"), "# PRD\n", "utf-8");
	writeFileSync(join(projectDir, "docs", "TRD.md"), "# TRD\n", "utf-8");
	writeFileSync(
		join(sprintDir, "requirements.md"),
		[
			"# Requirements",
			"",
			"## Sprint Goal",
			"- Goal",
			"",
			"## Required Outputs",
			"- Output",
			"",
			"## Acceptance Criteria",
			"- AC",
			"",
			"## Non-Goals",
			"- NG",
		].join("\n"),
		"utf-8",
	);
}

function sprintIndexNoAreaReasoning(): string {
	return [
		"# Sprint Index",
		"",
		"## Sprint Scope",
		"- scope: test",
		"",
		"## Selected Contracts",
		"| C | W |",
		"| --- | --- |",
		"",
		"## Selected Evidence Reports",
		"| Report | Path | Covers |",
		"| --- | --- | --- |",
		"| 01-project-structure | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | layout |",
		"",
		"## Selected Reasoning Templates",
		"| Template | Output Path | Why Selected |",
		"| --- | --- | --- |",
		"| *None* | — | no area reasoning |",
		"",
		"## Required Review Protocols",
		"| P |",
		"| --- |",
	].join("\n");
}

beforeEach(() => {
	mkdirSync(TEST_ROOT, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_ROOT, { force: true, recursive: true });
});

describe("paths.ts", () => {
	test("ULTRA_ROOT points to the .ultra/ governance directory", async () => {
		const { ULTRA_ROOT } = await import("../src/paths.js");
		expect(ULTRA_ROOT).toBeTruthy();
		expect(existsSync(join(ULTRA_ROOT, "config.json"))).toBe(true);
	});

	test("STUDIES_DIR points to .ultra/studies", async () => {
		const { STUDIES_DIR } = await import("../src/paths.js");
		expect(STUDIES_DIR).toContain(".ultra/studies");
		expect(existsSync(STUDIES_DIR)).toBe(true);
	});

	test("PROJECTS_DIR points to .ultra/projects", async () => {
		const { PROJECTS_DIR } = await import("../src/paths.js");
		expect(PROJECTS_DIR).toContain(".ultra/projects");
		expect(existsSync(PROJECTS_DIR)).toBe(true);
	});

	test("PROMPTS_DIR points to .ultra/prompts", async () => {
		const { PROMPTS_DIR } = await import("../src/paths.js");
		expect(PROMPTS_DIR).toContain(".ultra/prompts");
		expect(existsSync(PROMPTS_DIR)).toBe(true);
	});

	test("CONFIG_PATH points to .ultra/config.json", async () => {
		const { CONFIG_PATH } = await import("../src/paths.js");
		expect(CONFIG_PATH).toContain(".ultra/config.json");
	});

	test("loadConfig returns a config object (file-backed or fallback)", async () => {
		const { loadConfig } = await import("../src/paths.js");
		const config = loadConfig();
		expect(config).toBeTruthy();
		// Config always has at least one known field
		// The file (version/structure/layers) or fallback (defaultModel) should be present
		const hasFileKeys = typeof (config as any).version !== "undefined";
		const hasModelKeys = typeof (config as any).defaultModel !== "undefined";
		expect(hasFileKeys || hasModelKeys).toBe(true);
	});

	test("resolveStudyDir returns valid path", async () => {
		const { resolveStudyDir } = await import("../src/paths.js");
		const path = resolveStudyDir("go-cli-study");
		expect(path).toContain("go-cli-study");
	});

	test("resolveProjectDir returns valid path", async () => {
		const { resolveProjectDir } = await import("../src/paths.js");
		const path = resolveProjectDir("agentwrap");
		expect(path).toContain("agentwrap");
		expect(path).toContain("projects");
	});

	test("resolveSprintDir returns valid path", async () => {
		const { resolveSprintDir } = await import("../src/paths.js");
		const path = resolveSprintDir("agentwrap", "02-core-runtime-contract");
		expect(path).toContain("agentwrap");
		expect(path).toContain("sprints");
		expect(path).toContain("02-core-runtime-contract");
	});

	test("fileExists returns true for existing .ultra/config.json", async () => {
		const { fileExists, CONFIG_PATH } = await import("../src/paths.js");
		// CONFIG_PATH is .ultra/config.json — it must exist
		expect(fileExists(CONFIG_PATH)).toBe(true);
	});

	test("fileExists returns false for non-existing files", async () => {
		const { fileExists } = await import("../src/paths.js");
		expect(fileExists("/nonexistent/path/to/file.json")).toBe(false);
	});

	test("findOpenCode returns a non-empty string", async () => {
		const { findOpenCode } = await import("../src/paths.js");
		const bin = findOpenCode();
		expect(typeof bin).toBe("string");
		expect(bin.length).toBeGreaterThan(0);
	});
});

describe("config.ts", () => {
	test("buildSprintPrompt substitutes project and sprint-slug", async () => {
		const { buildSprintPrompt } = await import("../src/config.js");
		const { ULTRA_ROOT } = await import("../src/paths.js");
		const promptPath = join(ULTRA_ROOT, "prompts", "plan-sprint.md");
		const result = buildSprintPrompt(promptPath, "my-project", "01-foo");
		expect(result).toContain(".ultra/projects/my-project");
		expect(result).toContain("my-project");
		expect(result).toContain("01-foo");
	});

	test("buildSprintPrompt removes unexpanded {target}", async () => {
		const { buildSprintPrompt } = await import("../src/config.js");
		const { ULTRA_ROOT } = await import("../src/paths.js");
		const promptPath = join(ULTRA_ROOT, "prompts", "plan-sprint.md");
		const result = buildSprintPrompt(promptPath, "my-project", "01-foo");
		expect(result).not.toContain("{target}");
	});

	test("buildSprintPrompt handles extraSubstitutions by replacing placeholders", async () => {
		const { buildSprintPrompt } = await import("../src/config.js");
		// Create a temp prompt file with a {goal} placeholder
		const { tmpdir } = await import("os");
		const { writeFileSync, unlinkSync } = await import("fs");
		const tmp = join(tmpdir(), "test-prompt-tmp.md");
		writeFileSync(tmp, "Goal: {goal}\nProject: {project}", "utf-8");
		const result = buildSprintPrompt(tmp, "test-proj", "sprint-1", {
			goal: "Implement feature X",
		});
		expect(result).toContain("Implement feature X");
		expect(result).toContain("test-proj");
		unlinkSync(tmp);
	});
});

describe("state.ts", () => {
	test("initFlowState creates flow-state.json with all 7 stages", async () => {
		const { initFlowState, loadFlowState } = await import("../src/state.js");
		const d = freshDir("state-1");
		const state = initFlowState("test-project", "01-test", d);
		expect(state.version).toBe(1);
		expect(state.project).toBe("test-project");
		expect(state.sprint).toBe("01-test");
		expect(Object.keys(state.stages)).toHaveLength(8);
		expect(state.stages["sprint-index"].status).toBe("missing");
	});

	test("initFlowState returns existing state without overwriting", async () => {
		const { initFlowState, loadFlowState, saveFlowState, updateStageState } =
			await import("../src/state.js");
		const d = freshDir("state-2");
		initFlowState("test-project", "01-test", d);
		const s1 = loadFlowState(d)!;
		s1.stages["sprint-index"].status = "complete";
		// Manually save (updateStageState does not auto-save)
		saveFlowState(d, s1);
		const s2 = initFlowState("test-project", "01-test", d);
		expect(s2.stages["sprint-index"].status).toBe("complete");
	});

	test("initFlowState clears stale skipped area-reasoning when templates are selected but files are missing", async () => {
		const { initFlowState, saveFlowState } = await import("../src/state.js");
		const d = freshDir("state-2b");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			[
				"# Sprint Index",
				"",
				"## Sprint Scope",
				"- scope: test",
				"",
				"## Selected Contracts",
				"| Contract | Why Selected |",
				"| --- | --- |",
				"| Architecture | layout |",
				"",
				"## Selected Evidence Reports",
				"| Report | Path | Covers |",
				"| --- | --- | --- |",
				"| 01-project-structure | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | layout |",
				"",
				"## Selected Reasoning Templates",
				"| Template | Output Path | Why Selected |",
				"| --- | --- | --- |",
				"| Architecture | `.ultra/projects/test-proj/sprints/01-test/reasoning/architecture.md` | needed |",
				"",
				"## Required Review Protocols",
				"| Protocol |",
				"| --- |",
			].join("\n"),
			"utf-8",
		);
		const stale = initFlowState("test-proj", "01-test", d);
		stale.stages["area-reasoning"].status = "skipped";
		saveFlowState(d, stale);
		const refreshed = initFlowState("test-proj", "01-test", d);
		expect(refreshed.stages["area-reasoning"].status).toBe("missing");
	});

	test("loadFlowState returns null for missing directory", async () => {
		const { loadFlowState } = await import("../src/state.js");
		expect(loadFlowState("/nonexistent/dir")).toBeNull();
	});

	test("loadFlowState returns state for existing file", async () => {
		const { initFlowState, loadFlowState } = await import("../src/state.js");
		const d = freshDir("state-3");
		initFlowState("test-project", "01-test", d);
		const loaded = loadFlowState(d);
		expect(loaded).not.toBeNull();
		expect(loaded!.project).toBe("test-project");
	});

	test("sliceStages(null, 'plan') returns start-to-plan stages", async () => {
		const { sliceStages } = await import("../src/state.js");
		expect(sliceStages(null, "plan")).toEqual([
			"requirements",
			"sprint-index",
			"technical-handbook",
			"area-reasoning",
			"reasoning",
			"plan",
		]);
	});

	test("sliceStages('reasoning', 'review') returns range", async () => {
		const { sliceStages } = await import("../src/state.js");
		expect(sliceStages("reasoning", "review")).toEqual([
			"reasoning",
			"plan",
			"implementation",
			"review",
		]);
	});

	test("sliceStages('sprint-index', 'sprint-index') returns single stage", async () => {
		const { sliceStages } = await import("../src/state.js");
		expect(sliceStages("sprint-index", "sprint-index")).toEqual([
			"sprint-index",
		]);
	});

	test("updateStageState modifies the in-memory state object", async () => {
		const { initFlowState, updateStageState } = await import("../src/state.js");
		const d = freshDir("state-4");
		initFlowState("test-project", "01-test", d);
		const s = initFlowState("test-project", "01-test", d);
		expect(s.stages["sprint-index"].status).toBe("missing");
		updateStageState(s, "sprint-index", "complete");
		expect(s.stages["sprint-index"].status).toBe("complete");
		expect(s.stages["sprint-index"].lastRunAt).toBeTruthy();
	});

	test("STAGE_ORDER has 8 stages in correct order", async () => {
		const { STAGE_ORDER } = await import("../src/state.js");
		expect(STAGE_ORDER).toEqual([
			"requirements",
			"sprint-index",
			"technical-handbook",
			"area-reasoning",
			"reasoning",
			"plan",
			"implementation",
			"review",
		]);
	});

	test("STAGE_PATHS maps each stage to a path", async () => {
		const { STAGE_PATHS } = await import("../src/state.js");
		expect(STAGE_PATHS["requirements"]).toBe("requirements.md");
		expect(STAGE_PATHS["sprint-index"]).toBe("sprint-index.md");
		expect(STAGE_PATHS["reasoning"]).toBe("reasoning.md");
		expect(STAGE_PATHS["plan"]).toBe("plan.md");
		expect(STAGE_PATHS["review"]).toBe("review.md");
		expect(STAGE_PATHS["technical-handbook"]).toBe("technical-handbook.md");
		expect(STAGE_PATHS["area-reasoning"]).toBe("reasoning/");
		expect(STAGE_PATHS["implementation"]).toBe(".run-state.json");
	});
});

describe("validators.ts", () => {
	test("validateRequirements fails for missing file", async () => {
		const { validateStage } = await import("../src/validators.js");
		const d = freshDir("validators-req-1");
		const result = validateStage("requirements", d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("file missing");
	});

	test("validateRequirements fails when placeholder present", async () => {
		const { validateStage } = await import("../src/validators.js");
		const d = freshDir("validators-req-2");
		writeFileSync(
			join(d, "requirements.md"),
			"# Sprint Requirements\n\n[placeholder]\n",
			"utf-8",
		);
		const result = validateStage("requirements", d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("placeholder");
	});

	test("validateRequirements fails when required sections missing", async () => {
		const { validateStage } = await import("../src/validators.js");
		const d = freshDir("validators-req-3");
		writeFileSync(
			join(d, "requirements.md"),
			"# Sprint Requirements\n\n## Sprint Goal\ndone\n",
			"utf-8",
		);
		const result = validateStage("requirements", d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("missing section");
	});

	test("validateRequirements passes valid requirements", async () => {
		const { validateStage } = await import("../src/validators.js");
		const d = freshDir("validators-req-4");
		writeFileSync(
			join(d, "requirements.md"),
			"# Sprint Requirements\n\n## Sprint Goal\ndo the thing\n\n## Required Outputs\n| out | path | desc |\n|---|---|---|\n\n## Acceptance Criteria\n- [ ] done\n\n## Non-Goals\n- nothing\n",
			"utf-8",
		);
		const result = validateStage("requirements", d);
		expect(result.valid).toBe(true);
	});

	test("validateStage('sprint-index') returns invalid for missing file", async () => {
		const { validateStage } = await import("../src/validators.js");
		const d = freshDir("validators-1");
		seedProjectInputsForSprintDir(d);
		const result = validateStage("sprint-index", d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("file missing");
	});

	test("validateSprintIndex fails when placeholder present", async () => {
		const { validateSprintIndex } = await import("../src/validators.js");
		const d = freshDir("validators-2");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			"# Sprint Index\n\n[placeholder]\n",
			"utf-8",
		);
		const result = validateSprintIndex(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("placeholder");
	});

	test("validateSprintIndex fails when required sections missing", async () => {
		const { validateSprintIndex } = await import("../src/validators.js");
		const d = freshDir("validators-3");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			"# Sprint Index\n\nNo real content.\n",
			"utf-8",
		);
		const result = validateSprintIndex(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("missing section");
	});

	test("validateSprintIndex passes valid sprint index with all sections", async () => {
		const { validateSprintIndex } = await import("../src/validators.js");
		const d = freshDir("validators-4");
		seedProjectInputsForSprintDir(d);
		const content = [
			"# Sprint Index",
			"",
			"## Sprint Scope",
			"- Goal: test",
			"",
			"## Selected Contracts",
			"| Contract | Why Selected |",
			"| --- | --- |",
			"",
			"## Selected Evidence Reports",
			"| Report | Path | Covers |",
			"| --- | --- | --- |",
			"| 01-project-structure | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | layout |",
			"",
			"## Selected Reasoning Templates",
			"| Template | Why Selected |",
			"| --- | --- |",
			"",
			"## Required Review Protocols",
			"| Protocol |",
			"| --- |",
		].join("\n");
		writeFileSync(join(d, "sprint-index.md"), content, "utf-8");
		const result = validateSprintIndex(d);
		expect(result.valid).toBe(true);
	});

	test("validateTechnicalHandbook fails for missing file", async () => {
		const { validateTechnicalHandbook } = await import("../src/validators.js");
		const d = freshDir("validators-5");
		const result = validateTechnicalHandbook(d);
		expect(result.valid).toBe(false);
	});

	test("validateTechnicalHandbook passes valid handbook", async () => {
		const { validateTechnicalHandbook } = await import("../src/validators.js");
		const d = freshDir("validators-6");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexNoAreaReasoning(),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			[
				"# Technical Handbook",
				"",
				"## Selected Studies And Reports",
				"| Study | Finding |",
				"",
				"## Relevant Patterns",
				"- Pattern: test",
				"",
				"## Trade-Offs",
				"| Trade-Off | Benefit |",
				"| --- | --- |",
			].join("\n"),
			"utf-8",
		);
		const result = validateTechnicalHandbook(d);
		expect(result.valid).toBe(true);
	});

	test("validateTechnicalHandbook fails when sprint-index has no selected evidence reports", async () => {
		const { validateTechnicalHandbook } = await import("../src/validators.js");
		const d = freshDir("validators-6b");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			[
				"# Sprint Index",
				"",
				"## Sprint Scope",
				"- scope: test",
				"",
				"## Selected Contracts",
				"| Contract | Why Selected |",
				"| --- | --- |",
				"| Architecture | layout |",
				"",
				"## Selected Reasoning Templates",
				"| Template | Output Path | Why Selected |",
				"| --- | --- | --- |",
				"| *None* | — | no area reasoning |",
				"",
				"## Required Review Protocols",
				"| Protocol |",
				"| --- |",
			].join("\n"),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			[
				"# Technical Handbook",
				"",
				"## Selected Studies And Reports",
				"| Study | Finding |",
				"",
				"## Relevant Patterns",
				"- Pattern: test",
				"",
				"## Trade-Offs",
				"| Trade-Off | Benefit |",
				"| --- | --- |",
			].join("\n"),
			"utf-8",
		);
		const result = validateTechnicalHandbook(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("selected evidence reports");
	});

	test("validateReasoning fails for missing file", async () => {
		const { validateReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-7");
		const result = validateReasoning(d);
		expect(result.valid).toBe(false);
	});

	test("validateReasoning passes valid reasoning", async () => {
		const { validateReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-8");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexNoAreaReasoning(),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "reasoning.md"),
			[
				"# Sprint Reasoning",
				"",
				"## Final Decisions",
				"- Decision 1",
				"",
				"## Expected Evidence",
				"- Evidence 1",
				"",
				"## Assumptions And Risks",
				"- Risk 1",
			].join("\n"),
			"utf-8",
		);
		const result = validateReasoning(d);
		expect(result.valid).toBe(true);
	});

	test("validateReasoning fails when selected area reasoning file is missing", async () => {
		const { validateReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-8b");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "reasoning.md"),
			"# Sprint Reasoning\n\n## Final Decisions\n- D1\n\n## Expected Evidence\n- E1\n\n## Assumptions And Risks\n- R1\n",
			"utf-8",
		);
		const result = validateReasoning(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("missing required area reasoning file");
	});

	test("validatePlan passes valid plan", async () => {
		const { validatePlan } = await import("../src/validators.js");
		const d = freshDir("validators-9");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexNoAreaReasoning(),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "reasoning.md"),
			"# Sprint Reasoning\n\n## Final Decisions\n\n## Expected Evidence\n\n## Assumptions And Risks\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "plan.md"),
			[
				"# Sprint Plan",
				"",
				"## Decisions To Execute",
				"- Decision 1",
				"",
				"## Tasks",
				"- [ ] Task 1",
				"",
				"## Evidence Checklist",
				"- [ ] Test evidence",
				"",
				"sprint-reasoning.md",
			].join("\n"),
			"utf-8",
		);
		const result = validatePlan(d);
		expect(result.valid).toBe(true);
	});

	test("validatePlan fails plan without citing reasoning", async () => {
		const { validatePlan } = await import("../src/validators.js");
		const d = freshDir("validators-10");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexNoAreaReasoning(),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "reasoning.md"),
			"# Sprint Reasoning\n\n## Final Decisions\n\n## Expected Evidence\n\n## Assumptions And Risks\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "plan.md"),
			[
				"# Sprint Plan",
				"",
				"## Decisions To Execute",
				"- Decision 1",
				"",
				"## Tasks",
				"- [ ] Task 1",
				"",
				"## Evidence Checklist",
				"- [ ] Test evidence",
			].join("\n"),
			"utf-8",
		);
		const result = validatePlan(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("does not cite reasoning");
	});

	test("validateReview passes valid review", async () => {
		const { validateReview } = await import("../src/validators.js");
		const d = freshDir("validators-11");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexNoAreaReasoning(),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "reasoning.md"),
			"# Sprint Reasoning\n\n## Final Decisions\n\n## Expected Evidence\n\n## Assumptions And Risks\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "plan.md"),
			"# Sprint Plan\n\n## Decisions To Execute\n\n## Tasks\n\n## Evidence Checklist\n\nreasoning.md\n",
			"utf-8",
		);
		writeFileSync(join(d, ".run-state.json"), "{}", "utf-8");
		writeFileSync(
			join(d, "review.md"),
			[
				"# Sprint Review",
				"",
				"## Decision Conformance",
				"- Decision 1: yes",
				"",
				"## Final Assessment",
				"- Status: accepted",
			].join("\n"),
			"utf-8",
		);
		const result = validateReview(d);
		expect(result.valid).toBe(true);
	});

	const sprintIndexWithTemplates = [
		"# Sprint Index",
		"",
		"## Sprint Scope",
		"- scope: test",
		"",
		"## Selected Contracts",
		"| C | W |",
		"| --- | --- |",
		"",
		"## Selected Evidence Reports",
		"| Report | Path | Covers |",
		"| --- | --- | --- |",
		"| 01-project-structure | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | layout |",
		"",
		"## Selected Reasoning Templates",
		"| Template | Output Path | Why Selected |",
		"| --- | --- | --- |",
		"| Architecture | `.ultra/projects/test-proj/sprints/01-test/reasoning/architecture.md` | layering |",
		"",
		"## Required Review Protocols",
		"| P |",
		"| --- |",
	].join("\n");

	test("validateAreaReasoning fails when reasoning dir is missing", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-1");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		// Add sprint-index with selected templates so the stage is applicable
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("reasoning directory missing");
	});

	test("validateAreaReasoning fails when no .md files in reasoning dir", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-2");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		mkdirSync(join(d, "reasoning"), { recursive: true });
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("no reasoning files found");
	});

	test("validateAreaReasoning fails when file contains placeholders", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-3");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		mkdirSync(join(d, "reasoning"), { recursive: true });
		writeFileSync(
			join(d, "reasoning", "architecture.md"),
			"# API Design\n\n[placeholder]\n",
			"utf-8",
		);
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("placeholders");
	});

	test("validateAreaReasoning fails when file is missing ## Area Decisions", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-4");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		mkdirSync(join(d, "reasoning"), { recursive: true });
		writeFileSync(
			join(d, "reasoning", "architecture.md"),
			"# API Design\n\n## Trade-Offs\n| T | B |\n|---|---|\n",
			"utf-8",
		);
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('missing section "## Area Decisions"');
	});

	test("validateAreaReasoning fails when file is missing ## Trade-Offs", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-5");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		mkdirSync(join(d, "reasoning"), { recursive: true });
		writeFileSync(
			join(d, "reasoning", "architecture.md"),
			"# API Design\n\n## Area Decisions\n- Decision 1\n",
			"utf-8",
		);
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('missing section "## Trade-Offs"');
	});

	test("validateAreaReasoning passes valid area reasoning files", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-6");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexWithTemplates,
			"utf-8",
		);
		mkdirSync(join(d, "reasoning"), { recursive: true });
		writeFileSync(
			join(d, "reasoning", "architecture.md"),
			[
				"# API Design",
				"",
				"## Area Decisions",
				"- Decision 1: use REST",
				"",
				"## Trade-Offs",
				"| Trade-off | Benefit | Cost |",
				"|---|---|---|",
			].join("\n"),
			"utf-8",
		);
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(true);
	});

	test("validateAreaReasoning returns skipped when no templates selected", async () => {
		const { validateAreaReasoning } = await import("../src/validators.js");
		const d = freshDir("validators-area-7");
		seedProjectInputsForSprintDir(d);
		// sprint-index explicitly selects no reasoning templates
		writeFileSync(
			join(d, "sprint-index.md"),
			[
				"# Sprint Index",
				"",
				"## Selected Reasoning Templates",
				"| Template | Output Path | Why Selected |",
				"| --- | --- | --- |",
				"| *None* | — | No reasoning templates needed for this sprint. |",
			].join("\n"),
			"utf-8",
		);
		// No reasoning/ directory — should return skipped (valid) since no templates selected
		const result = validateAreaReasoning(d);
		expect(result.valid).toBe(true);
		expect(result.reason).toContain("no reasoning templates selected");
	});

	test("getStageDescription returns descriptions", async () => {
		const { getStageDescription } = await import("../src/validators.js");
		expect(getStageDescription("sprint-index")).toContain("Sprint Index");
		expect(getStageDescription("reasoning")).toContain("Sprint Reasoning");
		expect(getStageDescription("plan")).toContain("Sprint Plan");
		expect(getStageDescription("review")).toContain("Sprint Review");
	});
});

describe("validateSprintIndexSubset", () => {
	// Compute PROJECTS_DIR matching paths.ts resolution (two levels up from .ultra/cli/src/)
	const __cliDir = fileURLToPath(new URL(".", import.meta.url));
	const ULTRA_ROOT_COMPUTED = resolve(__cliDir, "../..");
	const PROJECTS_DIR = join(ULTRA_ROOT_COMPUTED, "projects");

	test("passes when sprint index references items in project index", async () => {
		const { validateSprintIndexSubset } = await import("../src/validators.js");
		// go-todo sprint-index references .ultra/system/contracts/core/architecture.md
		// which is in the project index
		const result = validateSprintIndexSubset(
			join(PROJECTS_DIR, "go-todo", "sprints", "01-project-structure"),
			join(PROJECTS_DIR, "go-todo"),
		);
		expect(result.valid).toBe(true);
	});

	test("fails when sprint index references item not in project index", async () => {
		const { validateSprintIndexSubset } = await import("../src/validators.js");
		const { mkdtemp, rm } = await import("fs/promises");
		const sprintDir = await mkdtemp("ultra-test-sprint-");
		const projectDir = await mkdtemp("ultra-test-project-");
		try {
			writeFileSync(
				join(projectDir, "project-index.md"),
				"# Project Index\n\n## Active Contract Pool\n\n| Contract | Path | Applies To |\n|---|---|---|\n| Architecture | `.ultra/system/contracts/core/architecture.md` | all |\n",
				"utf-8",
			);
			// sprint-index references a contract (testing.md) NOT in the project pool
			writeFileSync(
				join(sprintDir, "sprint-index.md"),
				"# Sprint Index\n\n## Selected Contracts\n\n| Contract | Why |\n|---|---|\n| Architecture | `.ultra/system/contracts/core/architecture.md` | layering |\n| Testing | `.ultra/system/contracts/core/testing.md` | unit tests |\n",
				"utf-8",
			);
			const result = validateSprintIndexSubset(sprintDir, projectDir);
			// testing.md is NOT in project index → invalid
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("testing.md");
		} finally {
			await rm(sprintDir, { recursive: true, force: true });
			await rm(projectDir, { recursive: true, force: true });
		}
	});

	test("fails when sprint index references missing path", async () => {
		const { validateSprintIndexSubset } = await import("../src/validators.js");
		const { mkdtemp, rm } = await import("fs/promises");
		const sprintDir = await mkdtemp("ultra-test-sprint-");
		const projectDir = await mkdtemp("ultra-test-project-");
		try {
			writeFileSync(
				join(projectDir, "project-index.md"),
				"# Project Index\n\n## Active Contract Pool\n\n| Contract | Path |\n|---|---|\n| Architecture | `.ultra/system/contracts/core/architecture.md` |\n",
				"utf-8",
			);
			// sprint-index references a non-existent contract
			writeFileSync(
				join(sprintDir, "sprint-index.md"),
				"# Sprint Index\n\n## Selected Contracts\n\n| Contract | Why |\n|---|---|\n| NonExistent | `.ultra/system/contracts/core/nonexistent.md` |\n",
				"utf-8",
			);
			const result = validateSprintIndexSubset(sprintDir, projectDir);
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("nonexistent.md");
		} finally {
			await rm(sprintDir, { recursive: true, force: true });
			await rm(projectDir, { recursive: true, force: true });
		}
	});

	test("fails when sprint-index.md is missing", async () => {
		const { validateSprintIndexSubset } = await import("../src/validators.js");
		const { mkdtemp, rm } = await import("fs/promises");
		const sprintDir = await mkdtemp("ultra-test-sprint-");
		const projectDir = await mkdtemp("ultra-test-project-");
		try {
			writeFileSync(
				join(projectDir, "project-index.md"),
				"# Project Index\n",
				"utf-8",
			);
			const result = validateSprintIndexSubset(sprintDir, projectDir);
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("not found");
		} finally {
			await rm(sprintDir, { recursive: true, force: true });
			await rm(projectDir, { recursive: true, force: true });
		}
	});

	test("fails when project-index.md is missing", async () => {
		const { validateSprintIndexSubset } = await import("../src/validators.js");
		const { mkdtemp, rm } = await import("fs/promises");
		const sprintDir = await mkdtemp("ultra-test-sprint-");
		const projectDir = await mkdtemp("ultra-test-project-");
		try {
			writeFileSync(
				join(sprintDir, "sprint-index.md"),
				"# Sprint Index\n\n## Selected Contracts\n\n| Contract | Why |\n|---|---|\n| Architecture | test |\n",
				"utf-8",
			);
			const result = validateSprintIndexSubset(sprintDir, projectDir);
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("not found");
		} finally {
			await rm(sprintDir, { recursive: true, force: true });
			await rm(projectDir, { recursive: true, force: true });
		}
	});
});

describe("studies.ts", () => {
	test("discoverSources finds sources in go-cli-study", async () => {
		const { discoverSources } = await import("../src/studies.js");
		const { STUDIES_DIR } = await import("../src/paths.js");
		const goCliStudyDir = join(STUDIES_DIR, "go-cli-study");
		if (!existsSync(goCliStudyDir)) return;

		const sources = discoverSources(goCliStudyDir);
		expect(sources.length).toBeGreaterThan(0);
		expect(sources[0].name).toBeTruthy();
		const firstType = sources[0].type;
		expect(firstType === "dir" || firstType === "file").toBe(true);
	});

	test("discoverDimensions finds dimensions in go-cli-study", async () => {
		const { discoverDimensions } = await import("../src/studies.js");
		const { STUDIES_DIR } = await import("../src/paths.js");
		const goCliStudyDir = join(STUDIES_DIR, "go-cli-study");
		if (!existsSync(join(goCliStudyDir, "dimensions"))) return;

		const dims = discoverDimensions(goCliStudyDir);
		expect(dims.length).toBeGreaterThan(0);
		expect(dims[0].number).toBeTruthy();
		expect(dims[0].name).toBeTruthy();
		expect(dims[0].title).toBeTruthy();
	});

	test("resolveDimension finds dimension by number", async () => {
		const { discoverDimensions, resolveDimension } = await import(
			"../src/studies.js"
		);
		const { STUDIES_DIR } = await import("../src/paths.js");
		const goCliStudyDir = join(STUDIES_DIR, "go-cli-study");
		if (!existsSync(join(goCliStudyDir, "dimensions"))) return;

		const dims = discoverDimensions(goCliStudyDir);
		const dim = resolveDimension("01", dims);
		expect(dim.number).toBe("01");
	});

	test("resolveDimension finds dimension by name prefix", async () => {
		const { discoverDimensions, resolveDimension } = await import(
			"../src/studies.js"
		);
		const { STUDIES_DIR } = await import("../src/paths.js");
		const goCliStudyDir = join(STUDIES_DIR, "go-cli-study");
		if (!existsSync(join(goCliStudyDir, "dimensions"))) return;

		const dims = discoverDimensions(goCliStudyDir);
		const firstDim = dims[0];
		if (firstDim && firstDim.name.length >= 4) {
			const resolved = resolveDimension(firstDim.name.slice(0, 4), dims);
			expect(resolved.name).toBe(firstDim.name);
		}
	});

	test("resolveDimension throws for non-existent dimension", async () => {
		const { discoverDimensions, resolveDimension } = await import(
			"../src/studies.js"
		);
		const { STUDIES_DIR } = await import("../src/paths.js");
		const goCliStudyDir = join(STUDIES_DIR, "go-cli-study");
		if (!existsSync(join(goCliStudyDir, "dimensions"))) return;

		const dims = discoverDimensions(goCliStudyDir);
		expect(() => resolveDimension("99-does-not-exist", dims)).toThrow();
	});
});

describe("sprint-flow integration (end-to-end)", () => {
	// Compute PROJECTS_DIR using the same resolution as paths.ts (two levels up
	// from the CLI src directory) so cmdSprintFlow finds the test project.
	const __cliDir = fileURLToPath(new URL(".", import.meta.url));
	const ULTRA_ROOT_COMPUTED = resolve(__cliDir, "../..");
	const PROJECTS_DIR = join(ULTRA_ROOT_COMPUTED, "projects");
	const TEST_PROJECT = "_cli-integration-test";
	const TEST_SPRINT = "01-e2e";

	// Helper: capture stdout lines from an async fn
	async function captureStdout<T>(
		fn: () => Promise<T>,
	): Promise<{ lines: string[]; result: T }> {
		const lines: string[] = [];
		const orig = console.log;
		// @ts-expect-error — override console.log for the duration of fn
		console.log = (...args: any[]) => lines.push(args.map(String).join(" "));
		try {
			const result = await fn();
			return { lines, result };
		} finally {
			console.log = orig;
		}
	}

	// Clean up test project dir after each test (force: true = safe to call twice)
	afterEach(() => {
		rmSync(join(PROJECTS_DIR, TEST_PROJECT), { force: true, recursive: true });
	});

	test("dry-run flow skips ready stages and lists missing stages", async () => {
		const { cmdSprintFlow } = await import("../src/sprint-flow.js");

		// cmdSprintFlow internally calls resolveSprintDir which validates the
		// project exists at .ultra/projects/<name>, so we must create the project
		// dir in the real location.
		const projDir = join(PROJECTS_DIR, TEST_PROJECT);
		const sprintDir = join(projDir, "sprints", TEST_SPRINT);
		mkdirSync(sprintDir, { recursive: true });

		// Create valid reasoning.md and plan.md — inspectSprintArtifacts picks these up
		writeFileSync(
			join(sprintDir, "reasoning.md"),
			[
				"# Sprint Reasoning",
				"",
				"## Final Decisions",
				"- Decision: adopt REST",
				"",
				"## Expected Evidence",
				"- evidence: tests pass",
				"",
				"## Assumptions And Risks",
				"- Risk: time",
			].join("\n"),
			"utf-8",
		);
		writeFileSync(
			join(sprintDir, "plan.md"),
			[
				"# Sprint Plan",
				"",
				"## Decisions To Execute",
				"- REST API",
				"",
				"## Tasks",
				"- [ ] Task 1",
				"",
				"## Evidence Checklist",
				"- [ ] Tests",
				"",
				"reasoning.md",
			].join("\n"),
			"utf-8",
		);

		const { lines } = await captureStdout(() =>
			cmdSprintFlow(TEST_PROJECT, TEST_SPRINT, {
				from: "sprint-index",
				to: "plan",
				dryRun: true,
			}),
		);

		const output = lines.join("\n");

		// The plan output should mention sprint-index as something to run
		// and mention reasoning/plan as already ready/skipped
		expect(output).toContain("Sprint Flow:");
		expect(output).toContain(TEST_PROJECT);
		expect(output).toContain("Dry run — no stages executed");
		expect(output).toContain("sprint-index");
		expect(output).toContain("technical-handbook");
		// reasoning and plan are valid → should appear as skipped/ready
		expect(output).toContain("reasoning");
		expect(output).toContain("plan");
		// verify [ready] or "Skipped" appears for the valid stages
		const hasReadyOrSkipped =
			output.includes("[ready]") ||
			output.includes("Skipped") ||
			output.includes("⊘");
		expect(hasReadyOrSkipped).toBe(true);
	});

	test("inspectSprintArtifacts detects all pre-existing artifact files", async () => {
		const { inspectSprintArtifacts, initFlowState } = await import(
			"../src/state.js"
		);
		const { validateStage } = await import("../src/validators.js");

		const d = freshDir("flow-it-2");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);

		// Create a valid sprint-index
		writeFileSync(
			join(d, "sprint-index.md"),
			[
				"# Sprint Index",
				"",
				"## Sprint Scope",
				"- scope: test",
				"",
				"## Selected Contracts",
				"| C | W |",
				"| --- | --- |",
				"",
				"## Selected Evidence Reports",
				"| Report | Path | Covers |",
				"| --- | --- | --- |",
				"| 01-project-structure | `.ultra/studies/go-cli-study/reports/final/01-project-structure.md` | layout |",
				"",
				"## Selected Reasoning Templates",
				"| Template | Output Path | Why Selected |",
				"| --- | --- | --- |",
				"| Area API | `.ultra/projects/test-proj/sprints/01-test/reasoning/area-api.md` | needed |",
				"",
				"## Required Review Protocols",
				"| P |",
				"| --- |",
			].join("\n"),
			"utf-8",
		);

		// Create a valid reasoning
		writeFileSync(
			join(d, "reasoning.md"),
			[
				"# Sprint Reasoning",
				"",
				"## Final Decisions",
				"- D1",
				"",
				"## Expected Evidence",
				"- E1",
				"",
				"## Assumptions And Risks",
				"- R1",
			].join("\n"),
			"utf-8",
		);

		// Create area-reasoning files
		mkdirSync(join(d, "reasoning"), { recursive: true });
		writeFileSync(
			join(d, "reasoning", "area-api.md"),
			[
				"# API Area",
				"",
				"## Area Decisions",
				"- D1",
				"",
				"## Trade-Offs",
				"| T | B |",
				"| --- | --- |",
			].join("\n"),
			"utf-8",
		);

		// inspectSprintArtifacts(sprintDir, state) mutates and returns the FlowState
		// Pass projectDir so area-reasoning is correctly identified as selected.
		const state = initFlowState("test-proj", "01-test", d);
		const projectDir = join(PROJECTS_DIR, "test-proj");
		const result = inspectSprintArtifacts(d, state, projectDir);
		expect(result.stages["sprint-index"].status).toBe("ready");
		expect(result.stages["area-reasoning"].status).toBe("ready");
		expect(result.stages["reasoning"].status).toBe("ready");

		// Verify validateStage agrees with inspectSprintArtifacts
		expect(validateStage("sprint-index", d).valid).toBe(true);
		expect(validateStage("area-reasoning", d).valid).toBe(true);
		expect(validateStage("reasoning", d).valid).toBe(true);
		// Missing stages should still be invalid
		expect(validateStage("plan", d).valid).toBe(false);
		expect(validateStage("review", d).valid).toBe(false);
	});

	test("sliceStages + inspectSprintArtifacts correctly selects stages to run", async () => {
		const { inspectSprintArtifacts, sliceStages, initFlowState } = await import(
			"../src/state.js"
		);
		const { validateStage } = await import("../src/validators.js");

		const d = freshDir("flow-it-3");
		seedProjectInputsForSprintDir(d);
		writeFileSync(
			join(d, "sprint-index.md"),
			sprintIndexNoAreaReasoning(),
			"utf-8",
		);
		writeFileSync(
			join(d, "technical-handbook.md"),
			"# Handbook\n\n## Selected Studies And Reports\n\n## Relevant Patterns\n\n## Trade-Offs\n",
			"utf-8",
		);
		// Create valid reasoning and plan only
		writeFileSync(
			join(d, "reasoning.md"),
			"# Sprint Reasoning\n\n## Final Decisions\n- D1\n\n## Expected Evidence\n- E1\n\n## Assumptions And Risks\n- R1\n",
			"utf-8",
		);
		writeFileSync(
			join(d, "plan.md"),
			"# Sprint Plan\n\n## Decisions To Execute\n- D1\n\n## Tasks\n- [ ] T1\n\n## Evidence Checklist\n- [ ] E1\n\nreasoning.md\n",
			"utf-8",
		);

		// initFlowState starts all stages as "missing"
		const state = initFlowState("test-proj", "01-test", d);
		// inspectSprintArtifacts updates reasoning + plan to "ready"
		inspectSprintArtifacts(d, state);
		const range = sliceStages("sprint-index", "plan");

		// Classify each stage in the range
		const toRun: string[] = [];
		const toSkip: string[] = [];
		for (const stage of range) {
			const stageState = state.stages[stage]?.status ?? "missing";
			const validation = validateStage(stage, d);
			if (
				stageState === "ready" &&
				validation.valid &&
				stage !== "sprint-index"
			) {
				toSkip.push(stage);
			} else {
				toRun.push(stage);
			}
		}

		expect(toRun).toContain("sprint-index");
		expect(toSkip).toContain("technical-handbook");
		expect(toSkip).toContain("reasoning");
		expect(toSkip).toContain("plan");
	});
});
