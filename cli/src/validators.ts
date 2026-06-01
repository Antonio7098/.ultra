import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { StageName } from "./state.js";

export interface ValidationResult {
	valid: boolean;
	reason?: string;
}

function projectDirFromSprintDir(sprintDir: string): string {
	return join(sprintDir, "..", "..");
}

function requireInputFiles(paths: string[]): ValidationResult | null {
	const missing = paths.filter((p) => !existsSync(p));
	if (missing.length > 0) {
		return {
			valid: false,
			reason: `missing required input(s): ${missing.map((p) => p.split("/").slice(-3).join("/")).join(", ")}`,
		};
	}
	return null;
}

function getProjectDocsInputFiles(sprintDir: string): string[] {
	const projectDir = projectDirFromSprintDir(sprintDir);
	const docsDir = join(projectDir, "docs");
	if (!existsSync(docsDir)) return [];
	return readdirSync(docsDir)
		.filter((f) => f.endsWith(".md") && !f.startsWith("."))
		.sort()
		.map((f) => join(docsDir, f));
}

function coreSupportingInputs(sprintDir: string): string[] {
	const projectDir = projectDirFromSprintDir(sprintDir);
	const docs = getProjectDocsInputFiles(sprintDir);
	return [
		join(projectDir, "project-index.md"),
		join(sprintDir, "requirements.md"),
		...docs,
	];
}

function requireCoreSupportingInputs(sprintDir: string): ValidationResult | null {
	const missingInputs = requireInputFiles([
		join(projectDirFromSprintDir(sprintDir), "project-index.md"),
		join(sprintDir, "requirements.md"),
	]);
	if (missingInputs) return missingInputs;
	const docs = getProjectDocsInputFiles(sprintDir);
	if (docs.length === 0) {
		return { valid: false, reason: "missing required input(s): docs/*.md" };
	}
	return null;
}

function getSelectedEvidenceReportPaths(sprintDir: string): string[] {
	const path = join(sprintDir, "sprint-index.md");
	if (!existsSync(path)) return [];

	const content = readFileSync(path, "utf-8");
	const sectionMatch = content.match(
		/(?:^##\s*Selected\s*Evidence\s*Reports|\n##\s*Selected\s*Evidence\s*Reports)[^#]*/im,
	);
	if (!sectionMatch) return [];

	const reports: string[] = [];
	for (const line of sectionMatch[0].split("\n")) {
		if (
			line.match(/^\|[\s\-:|]+\|$/) ||
			line.startsWith("| Report") ||
			line.startsWith("| --- ")
		)
			continue;
		if (!line.startsWith("|")) continue;
		const cells = line.split("|").map((c) => c.trim());
		const pathCell = (cells[2] ?? "").replace(/`/g, "");
		if (pathCell === "—" || pathCell === "") continue;
		const match = pathCell.match(/(\.ultra\/studies\/[\w\-./]+\.md)/);
		if (match?.[1]) reports.push(match[1]);
	}

	return reports;
}

function getSelectedAreaReasoningOutputFiles(sprintDir: string): string[] {
	const path = join(sprintDir, "sprint-index.md");
	if (!existsSync(path)) return [];

	const content = readFileSync(path, "utf-8");
	const sectionMatch = content.match(
		/(?:^##\s*Selected\s*Reasoning\s*Templates|\n##\s*Selected\s*Reasoning\s*Templates)[^#]*/im,
	);
	if (!sectionMatch) return [];

	const files: string[] = [];
	for (const line of sectionMatch[0].split("\n")) {
		if (
			line.match(/^\|[\s\-:|]+\|$/) ||
			line.startsWith("| Template") ||
			line.startsWith("| --- ")
		)
			continue;
		if (!line.startsWith("|")) continue;
		const cells = line.split("|").map((c) => c.trim());
		const templateCell = cells[1] ?? "";
		if (templateCell === "*None*") return [];
		const outputCell = (cells[2] ?? "").replace(/`/g, "");
		const outputMatch = outputCell.match(/reasoning\/([^/`]+\.md)/i);
		if (outputMatch) {
			files.push(outputMatch[1]);
			continue;
		}
		if (templateCell && !templateCell.startsWith("*")) {
			files.push(`${templateCell.toLowerCase().replace(/\s+/g, "-")}.md`);
		}
	}

	return files;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: requirements
// ──────────────────────────────────────────────────────────────────────────────

export function validateRequirements(sprintDir: string): ValidationResult {
	const path = join(sprintDir, "requirements.md");
	if (!existsSync(path)) return { valid: false, reason: "file missing" };

	const content = readFileSync(path, "utf-8");
	if (content.includes("[placeholder]") || content.includes("[PLACEHOLDER]")) {
		return { valid: false, reason: "contains placeholders" };
	}

	const requiredSections = [
		"## Sprint Goal",
		"## Required Outputs",
		"## Acceptance Criteria",
		"## Non-Goals",
	];

	for (const section of requiredSections) {
		if (!content.includes(section)) {
			return { valid: false, reason: `missing section: ${section}` };
		}
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: sprint-index
// ──────────────────────────────────────────────────────────────────────────────

export function validateSprintIndex(sprintDir: string): ValidationResult {
	const missingInputs = requireCoreSupportingInputs(sprintDir);
	if (missingInputs) return missingInputs;

	const path = join(sprintDir, "sprint-index.md");
	if (!existsSync(path)) return { valid: false, reason: "file missing" };

	const content = readFileSync(path, "utf-8");
	if (content.includes("[placeholder]") || content.includes("[PLACEHOLDER]")) {
		return { valid: false, reason: "contains placeholders" };
	}

	const requiredSections = [
		"## Sprint Scope",
		"## Selected Contracts",
		"## Selected Evidence Reports",
		"## Selected Reasoning Templates",
		"## Required Review Protocols",
	];

	for (const section of requiredSections) {
		if (!content.includes(section)) {
			return { valid: false, reason: `missing section: ${section}` };
		}
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: technical-handbook
// ──────────────────────────────────────────────────────────────────────────────

export function validateTechnicalHandbook(sprintDir: string): ValidationResult {
	const missingInputs = requireCoreSupportingInputs(sprintDir);
	if (missingInputs) return missingInputs;
	const sprintIndexMissing = requireInputFiles([join(sprintDir, "sprint-index.md")]);
	if (sprintIndexMissing) return sprintIndexMissing;

	const selectedEvidenceReports = getSelectedEvidenceReportPaths(sprintDir);
	if (selectedEvidenceReports.length === 0) {
		return {
			valid: false,
			reason: "sprint-index.md missing selected evidence reports",
		};
	}

	const path = join(sprintDir, "technical-handbook.md");
	if (!existsSync(path)) return { valid: false, reason: "file missing" };

	const content = readFileSync(path, "utf-8");
	if (content.includes("[placeholder]") || content.includes("[PLACEHOLDER]")) {
		return { valid: false, reason: "contains placeholders" };
	}

	const requiredSections = [
		"## Selected Studies And Reports",
		"## Relevant Patterns",
		"## Trade-Offs",
	];

	for (const section of requiredSections) {
		if (!content.includes(section)) {
			return { valid: false, reason: `missing section: ${section}` };
		}
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: reasoning
// ──────────────────────────────────────────────────────────────────────────────

export function validateReasoning(sprintDir: string): ValidationResult {
	const coreMissingInputs = requireCoreSupportingInputs(sprintDir);
	if (coreMissingInputs) return coreMissingInputs;
	const missingInputs = requireInputFiles([
		join(sprintDir, "sprint-index.md"),
		join(sprintDir, "technical-handbook.md"),
	]);
	if (missingInputs) return missingInputs;

	const expectedAreaFiles = getSelectedAreaReasoningOutputFiles(sprintDir);
	if (expectedAreaFiles.length > 0) {
		const missingAreaFiles = expectedAreaFiles.filter(
			(file) => !existsSync(join(sprintDir, "reasoning", file)),
		);
		if (missingAreaFiles.length > 0) {
			return {
				valid: false,
				reason: `missing required area reasoning file(s): ${missingAreaFiles.join(", ")}`,
			};
		}
	}

	const path = join(sprintDir, "reasoning.md");
	if (!existsSync(path)) return { valid: false, reason: "file missing" };

	const content = readFileSync(path, "utf-8");
	if (content.includes("[placeholder]") || content.includes("[PLACEHOLDER]")) {
		return { valid: false, reason: "contains placeholders" };
	}

	const requiredSections = [
		"## Final Decisions",
		"## Expected Evidence",
		"## Assumptions And Risks",
	];

	for (const section of requiredSections) {
		if (!content.includes(section)) {
			return { valid: false, reason: `missing section: ${section}` };
		}
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: plan
// ──────────────────────────────────────────────────────────────────────────────

export function validatePlan(sprintDir: string): ValidationResult {
	const coreMissingInputs = requireCoreSupportingInputs(sprintDir);
	if (coreMissingInputs) return coreMissingInputs;
	const missingInputs = requireInputFiles([
		join(sprintDir, "sprint-index.md"),
		join(sprintDir, "technical-handbook.md"),
		join(sprintDir, "reasoning.md"),
	]);
	if (missingInputs) return missingInputs;

	const expectedAreaFiles = getSelectedAreaReasoningOutputFiles(sprintDir);
	if (expectedAreaFiles.length > 0) {
		const missingAreaFiles = expectedAreaFiles.filter(
			(file) => !existsSync(join(sprintDir, "reasoning", file)),
		);
		if (missingAreaFiles.length > 0) {
			return {
				valid: false,
				reason: `missing required area reasoning file(s): ${missingAreaFiles.join(", ")}`,
			};
		}
	}

	const path = join(sprintDir, "plan.md");
	if (!existsSync(path)) return { valid: false, reason: "file missing" };

	const content = readFileSync(path, "utf-8");
	if (content.includes("[placeholder]") || content.includes("[PLACEHOLDER]")) {
		return { valid: false, reason: "contains placeholders" };
	}

	const requiredSections = [
		"## Decisions To Execute",
		"## Tasks",
		"## Evidence Checklist",
	];

	for (const section of requiredSections) {
		if (!content.includes(section)) {
			return { valid: false, reason: `missing section: ${section}` };
		}
	}

	if (
		!content.includes("sprint-reasoning.md") &&
		!content.includes("reasoning.md")
	) {
		return { valid: false, reason: "plan does not cite reasoning source" };
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: review
// ──────────────────────────────────────────────────────────────────────────────

export function validateReview(sprintDir: string): ValidationResult {
	const coreMissingInputs = requireCoreSupportingInputs(sprintDir);
	if (coreMissingInputs) return coreMissingInputs;
	const missingInputs = requireInputFiles([
		join(sprintDir, "sprint-index.md"),
		join(sprintDir, "technical-handbook.md"),
		join(sprintDir, "reasoning.md"),
		join(sprintDir, "plan.md"),
		join(sprintDir, ".run-state.json"),
	]);
	if (missingInputs) return missingInputs;

	const expectedAreaFiles = getSelectedAreaReasoningOutputFiles(sprintDir);
	if (expectedAreaFiles.length > 0) {
		const missingAreaFiles = expectedAreaFiles.filter(
			(file) => !existsSync(join(sprintDir, "reasoning", file)),
		);
		if (missingAreaFiles.length > 0) {
			return {
				valid: false,
				reason: `missing required area reasoning file(s): ${missingAreaFiles.join(", ")}`,
			};
		}
	}

	const path = join(sprintDir, "review.md");
	if (!existsSync(path)) return { valid: false, reason: "file missing" };

	const content = readFileSync(path, "utf-8");
	if (content.includes("[placeholder]") || content.includes("[PLACEHOLDER]")) {
		return { valid: false, reason: "contains placeholders" };
	}

	const requiredSections = ["## Decision Conformance", "## Final Assessment"];

	for (const section of requiredSections) {
		if (!content.includes(section)) {
			return { valid: false, reason: `missing section: ${section}` };
		}
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Area-reasoning: input helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parses sprint-index.md and returns the list of selected area reasoning
 * template names (e.g. ["architecture", "testing", "persistence"]). Returns
 * an empty array if no templates are selected or if sprint-index is missing.
 */
export function getSelectedAreaReasoningTemplates(sprintDir: string): string[] {
	const path = join(sprintDir, "sprint-index.md");
	if (!existsSync(path)) return [];

	const content = readFileSync(path, "utf-8");

	// Find the "Selected Reasoning Templates" section and parse its table.
	// We look for the heading, then grab the table rows until a blank line or
	// the next heading.
	const sectionMatch = content.match(
		/(?:^##\s*Selected\s*Reasoning\s*Templates|\n##\s*Selected\s*Reasoning\s*Templates)[^#]*/im,
	);
	if (!sectionMatch) return [];

	const section = sectionMatch[0];
	const lines = section.split("\n");
	const templates: string[] = [];

	for (const line of lines) {
		// Skip separator rows and the header row
		if (
			line.match(/^\|[\s\-:|]+\|$/) ||
			line.startsWith("| Template") ||
			line.startsWith("| --- ")
		)
			continue;
		if (!line.startsWith("|")) continue;

		const cells = line.split("|").map((c) => c.trim());
		// First cell: template name (may be "*None*")
		const firstCell = cells[1] ?? "";
		// Second cell: output path (optional), may contain a template identifier
		// We just need the template name — use the first cell or derive from path
		// Format: | Architecture | `.ultra/system/reasoning/architecture_reasoning_template.md` | ... |
		// Or:     | *None* | — | ... |
		if (firstCell === "*None*") return []; // explicit none → no area reasoning

		// Extract template name from the first cell: "Architecture" → "architecture"
		// Also try the second cell if it looks like a path
		const secondCell = cells[2] ?? "";
		const pathCell = secondCell.includes(".md") ? secondCell : firstCell;

		// Match: `architecture_reasoning_template.md` or `testing-strategy-reasoning-template.md`
		const tmplMatch = pathCell.match(/`([^`]+)_reasoning(_template)?\.md`/i);
		if (tmplMatch) {
			// Derive area name from filename: "architecture_reasoning_template.md" → "architecture"
			const filename = tmplMatch[1].toLowerCase();
			// Strip type suffix: "testing-strategy" → "testing-strategy"
			templates.push(filename);
		} else if (firstCell && !firstCell.startsWith("*")) {
			// Fallback: use first cell as-is, lowercase, spaces → hyphens
			const name = firstCell.toLowerCase().replace(/\s+/g, "-");
			templates.push(name);
		}
	}

	return templates;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stage: area-reasoning
// ──────────────────────────────────────────────────────────────────────────────

const AREA_REASONING_REQUIRED_SECTIONS = ["## Area Decisions", "## Trade-Offs"];

/**
 * Returns "skipped" if no reasoning templates are selected in sprint-index.
 * Returns "invalid" if sprint-index is missing (stage is applicable but can't run).
 * Returns the usual ValidationResult otherwise.
 */
export function validateAreaReasoning(sprintDir: string): ValidationResult {
	const sprintIndexPath = join(sprintDir, "sprint-index.md");

	// If sprint-index doesn't exist, the stage can't determine applicability —
	// treat as invalid so the flow runs it and creates a valid sprint-index first.
	if (!existsSync(sprintIndexPath)) {
		return {
			valid: false,
			reason: "sprint-index.md missing — cannot determine selected templates",
		};
	}

	const selected = getSelectedAreaReasoningTemplates(sprintDir);

	// No templates selected → stage is not applicable for this sprint.
	if (selected.length === 0) {
		return { valid: true, reason: "no reasoning templates selected (skipped)" };
	}

	const coreMissingInputs = requireCoreSupportingInputs(sprintDir);
	if (coreMissingInputs) return coreMissingInputs;
	const missingInputs = requireInputFiles([join(sprintDir, "technical-handbook.md")]);
	if (missingInputs) return missingInputs;

	const reasonDir = join(sprintDir, "reasoning");
	if (!existsSync(reasonDir)) {
		return { valid: false, reason: "reasoning directory missing" };
	}

	const files = readdirSync(reasonDir).filter(
		(f) => f.endsWith(".md") && !f.startsWith("."),
	);
	if (files.length === 0) {
		return { valid: false, reason: "no reasoning files found" };
	}

	const expectedFiles = getSelectedAreaReasoningOutputFiles(sprintDir);
	const missingExpectedFiles = expectedFiles.filter((f) => !files.includes(f));
	if (missingExpectedFiles.length > 0) {
		return {
			valid: false,
			reason: `missing required area reasoning file(s): ${missingExpectedFiles.join(", ")}`,
		};
	}

	for (const file of files) {
		const content = readFileSync(join(reasonDir, file), "utf-8");
		if (
			content.includes("[placeholder]") ||
			content.includes("[PLACEHOLDER]")
		) {
			return { valid: false, reason: `contains placeholders in ${file}` };
		}
		for (const section of AREA_REASONING_REQUIRED_SECTIONS) {
			if (!content.includes(section)) {
				return {
					valid: false,
					reason: `missing section "${section}" in ${file}`,
				};
			}
		}
	}

	return { valid: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Dispatch
// ──────────────────────────────────────────────────────────────────────────────

export function validateStage(
	stageName: StageName,
	sprintDir: string,
): ValidationResult {
	switch (stageName) {
		case "requirements":
			return validateRequirements(sprintDir);
		case "sprint-index":
			return validateSprintIndex(sprintDir);
		case "technical-handbook":
			return validateTechnicalHandbook(sprintDir);
		case "area-reasoning":
			return validateAreaReasoning(sprintDir);
		case "reasoning":
			return validateReasoning(sprintDir);
		case "plan":
			return validatePlan(sprintDir);
		case "review":
			return validateReview(sprintDir);
		case "implementation": {
			// Implementation is "valid" when .run-state.json exists — written by the
			// execute-sprint prompt as proof that implementation was executed.
			const coreMissingInputs = requireCoreSupportingInputs(sprintDir);
			if (coreMissingInputs) return coreMissingInputs;
			const implMissingInputs = requireInputFiles([
				join(sprintDir, "sprint-index.md"),
				join(sprintDir, "technical-handbook.md"),
				join(sprintDir, "reasoning.md"),
				join(sprintDir, "plan.md"),
			]);
			if (implMissingInputs) return implMissingInputs;
			const expectedAreaFiles = getSelectedAreaReasoningOutputFiles(sprintDir);
			const missingAreaFiles = expectedAreaFiles.filter(
				(file) => !existsSync(join(sprintDir, "reasoning", file)),
			);
			if (missingAreaFiles.length > 0) {
				return {
					valid: false,
					reason: `missing required area reasoning file(s): ${missingAreaFiles.join(", ")}`,
				};
			}
			return {
				valid: existsSync(join(sprintDir, ".run-state.json")),
				reason: existsSync(join(sprintDir, ".run-state.json"))
					? undefined
					: "implementation not started (no .run-state.json)",
			};
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Sprint index subset validation
// ──────────────────────────────────────────────────────────────────────────────

/** Extract all file/directory paths from markdown table cells (lines starting with |). */
function extractPathsFromTables(content: string): string[] {
	const paths: string[] = [];
	const lines = content.split("\n");
	for (const line of lines) {
		if (!line.startsWith("|") || line.match(/^\|[\s\-:|]+\|$/)) continue;
		const cells = line.split("|").map((c) => c.trim());
		for (const cell of cells) {
			// Extract paths starting with .ultra/system/ or .ultra/studies/
			const cellCopy = cell.replace(/`([^`]+)`/g, "$1"); // strip backticks
			// Require whitespace, opening bracket, or cell-start before path
			const matches = cellCopy.matchAll(
				/(?:^|[\s([])(\.ultra\/(?:system|studies)\/[\w\-./]+)/g,
			);
			for (const m of matches) {
				if (m[1]) paths.push(m[1]);
			}
		}
	}
	return paths;
}

/**
 * Validates that a sprint index is a proper subset of its project index.
 * All contracts, reasoning templates, protocols, and study/evidence paths
 * referenced in the sprint index must appear in the project index.
 */
export function validateSprintIndexSubset(
	sprintDir: string,
	projectDir: string,
): ValidationResult {
	const sprintIndexPath = join(sprintDir, "sprint-index.md");
	if (!existsSync(sprintIndexPath)) {
		return { valid: false, reason: "sprint-index.md not found" };
	}

	const projectIndexPath = join(projectDir, "project-index.md");
	if (!existsSync(projectIndexPath)) {
		return { valid: false, reason: "project-index.md not found" };
	}

	const sprintContent = readFileSync(sprintIndexPath, "utf-8");
	const projectContent = readFileSync(projectIndexPath, "utf-8");

	const sprintPaths = extractPathsFromTables(sprintContent);
	if (sprintPaths.length === 0) {
		return {
			valid: false,
			reason: "no paths found in sprint-index.md tables",
		};
	}

	const missing: string[] = [];
	for (const path of sprintPaths) {
		// Normalize: remove leading ./
		const normalized = path.replace(/^\.\//, "");
		// Check if the path (or any of its segments as prefixes) appear in the project index
		// We check for substring presence since paths are referenced inline
		if (!projectContent.includes(normalized)) {
			missing.push(normalized);
		}
	}

	if (missing.length > 0) {
		return {
			valid: false,
			reason: `sprint index references ${missing.length} item(s) not in project index: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " ..." : ""}`,
		};
	}

	return { valid: true };
}

export function getStageDescription(stageName: StageName): string {
	switch (stageName) {
		case "requirements":
			return "Sprint Requirements — authoritative sprint contract (goal, outputs, acceptance criteria)";
		case "sprint-index":
			return "Sprint Index — select contracts, studies, reasoning templates, and review protocols";
		case "technical-handbook":
			return "Technical Handbook — distill selected studies into patterns, trade-offs, and questions";
		case "area-reasoning":
			return "Area Reasoning — per-area decisions (optional)";
		case "reasoning":
			return "Sprint Reasoning — final decisions, trade-offs, risks, and expected evidence";
		case "plan":
			return "Sprint Plan — task execution plan derived from reasoning";
		case "implementation":
			return "Implementation — execute the plan";
		case "review":
			return "Sprint Review — conformance check against sprint artifacts";
	}
}
