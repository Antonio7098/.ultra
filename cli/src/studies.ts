import { execSync } from "child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "fs";
import { join } from "path";
import {
	STUDIES_DIR,
	OPENCODE_BIN,
	OPENCODE_CONFIG_PATH,
	ULTRA_ROOT,
	loadConfig,
	resolveStudyDir,
} from "./paths.js";
import { buildSprintPrompt } from "./config.js";
import { runOpenCodeWithFallback } from "./opencode.js";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type Source = {
	name: string;
	path: string;
	type: "dir" | "file";
	applicableDimensions?: string[];
};

export type Dimension = {
	number: string;
	name: string;
	title: string;
	file: string;
};

interface TaskState {
	dimensionNumber: string;
	dimensionName: string;
	dimensionTitle: string;
	sourceName: string;
	status: "pending" | "running" | "completed" | "failed";
	attempts: number;
	lastError: string | null;
	lastAttemptAt: string | null;
	nextRetryAt: string | null;
	completedAt: string | null;
}

interface SynthesisState {
	dimensionNumber: string;
	dimensionName: string;
	dimensionTitle: string;
	status: "pending" | "running" | "completed" | "failed";
	attempts: number;
	lastError: string | null;
	lastAttemptAt: string | null;
	nextRetryAt: string | null;
	completedAt: string | null;
}

interface RunState {
	version: number;
	createdAt: string;
	updatedAt: string;
	batchSize: number;
	tasks: TaskState[];
	synthesisTasks: SynthesisState[];
	isComplete: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Discovery
// ──────────────────────────────────────────────────────────────────────────────

export function discoverSources(ROOT: string): Source[] {
	const srcDir = join(ROOT, "sources");
	if (!existsSync(srcDir)) return [];
	const items = readdirSync(srcDir)
		.filter((d) => !d.startsWith("."))
		.sort();
	const sources: Source[] = [];
	for (const item of items) {
		const fullPath = join(srcDir, item);
		if (statSync(fullPath).isDirectory()) {
			sources.push({ name: item, path: fullPath, type: "dir" });
		} else if (item.endsWith(".md")) {
			const name = item.replace(/\.md$/, "");
			const fm = parseFrontmatter(fullPath);
			sources.push({
				name,
				path: fullPath,
				type: "file",
				applicableDimensions: fm.applicableDimensions,
			});
		}
	}
	return sources;
}

export function discoverDimensions(ROOT: string): Dimension[] {
	const dimDir = join(ROOT, "dimensions");
	if (!existsSync(dimDir)) return [];
	return readdirSync(dimDir)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.map((file) => {
			const dash = file.indexOf("-");
			const number = dash > 0 ? file.slice(0, dash) : file.replace(".md", "");
			const name = file.slice(dash + 1).replace(".md", "");
			const content = readFileSync(join(dimDir, file), "utf-8");
			const title =
				content.split("\n")[0]?.replace(/^#\s*/i, "").trim() || name;
			return { number, name, title, file };
		});
}

export function resolveDimension(ref: string, all: Dimension[]): Dimension {
	const match = all.filter(
		(d) =>
			d.number === ref ||
			`${d.number}-${d.name}` === ref ||
			`${d.number}-${d.name}`.startsWith(ref) ||
			d.name.startsWith(ref),
	);
	if (match.length === 0) throw new Error(`Dimension "${ref}" not found`);
	if (match.length > 1)
		throw new Error(
			`Dimension "${ref}" is ambiguous: ${match.map((d) => `${d.number}-${d.name}`).join(", ")}`,
		);
	return match[0];
}

export function resolveSource(ref: string, all: Source[]): Source {
	const match = all.filter((s) => s.name === ref || s.name.startsWith(ref));
	if (match.length === 0) throw new Error(`Source "${ref}" not found`);
	if (match.length > 1)
		throw new Error(
			`Source "${ref}" is ambiguous: ${match.map((s) => s.name).join(", ")}`,
		);
	return match[0];
}

function parseFrontmatter(filePath: string): {
	applicableDimensions?: string[];
} {
	try {
		const content = readFileSync(filePath, "utf-8");
		if (!content.startsWith("---")) return {};
		const endIdx = content.indexOf("---", 3);
		if (endIdx === -1) return {};
		const frontmatter = content.slice(3, endIdx).trim();
		const lines = frontmatter.split("\n");
		const result: { applicableDimensions?: string[] } = {};
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed === "applicable_dimensions:") {
				result.applicableDimensions = [];
			} else if (result.applicableDimensions && trimmed.startsWith("- ")) {
				const val = trimmed.slice(2).trim();
				result.applicableDimensions.push(
					val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"),
				);
			}
		}
		return result;
	} catch {
		return {};
	}
}

function stripFrontmatter(content: string): string {
	if (content.startsWith("---")) {
		const endIdx = content.indexOf("---", 3);
		if (endIdx > 0) return content.slice(endIdx + 3).trimStart();
	}
	return content;
}

function getApplicableSources(
	allSources: Source[],
	dimension: Dimension,
): Source[] {
	const dimNum = dimension.number.replace(/^0+/, "");
	return allSources.filter((s) => {
		if (s.type === "file" && s.applicableDimensions) {
			return s.applicableDimensions.some(
				(ad) => ad.replace(/^0+/, "") === dimNum,
			);
		}
		return true;
	});
}

// ──────────────────────────────────────────────────────────────────────────────
// Prompt building
// ──────────────────────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return "";
	}
}

function buildPrompt(
	ROOT: string,
	dimension: Dimension,
	source: Source,
): string {
	const dimFile = join(ROOT, "dimensions", dimension.file);
	const templateFile = join(ULTRA_ROOT, "templates", "repo-analysis.md");
	const baseFile = join(ULTRA_ROOT, "prompts", "base.md");
	const outputFile = `reports/source/${dimension.number}-${dimension.name}/${source.name}.md`;

	const baseContent = readFile(baseFile);
	const dimContent = readFile(dimFile);
	const templateContent = readFile(templateFile);

	if (source.type === "file") {
		let sourceContent = readFile(source.path);
		sourceContent = stripFrontmatter(sourceContent);
		return [
			`# Study: ${dimension.title} — ${source.name}`,
			"",
			`Study **${source.name}** following the instructions below.`,
			"",
			"## Execution Instructions",
			"",
			baseContent || "(no base instructions)",
			"",
			"## Study Dimension",
			"",
			dimContent || "(no dimension content)",
			"",
			"## Source Document",
			"",
			`**${source.name}** (\`${source.path}\`)`,
			"",
			"### Document Content",
			"",
			sourceContent || "(empty document)",
			"",
			"## Instructions",
			"",
			"1. Follow the Execution Instructions above.",
			"2. Follow the Study Dimension above for the specific Steps, Evidence, and Questions.",
			"3. Analyze the document above in the context of the Study Dimension.",
			"4. Answer all the Study Dimension's Questions based on the document content.",
			`5. Write the analysis to \`${outputFile}\` using the Output Template below.`,
			"6. Do NOT attempt to access external files or code — all material is in the document above.",
			"",
			"## Output Template",
			"",
			templateContent || "(no template content)",
			"",
			"## Output",
			"",
			`- Per-source analysis: \`${outputFile}\``,
			"",
			"Work thoroughly.",
		].join("\n");
	}

	return [
		`# Study: ${dimension.title} — ${source.name}`,
		"",
		`Study **${source.name}** following the instructions below.`,
		"",
		"## Execution Instructions",
		"",
		baseContent || "(no base instructions)",
		"",
		"## Study Dimension",
		"",
		dimContent || "(no dimension content)",
		"",
		"## Target Source",
		"",
		`1. **${source.name}** (\`${source.path}\`)`,
		"",
		"## Instructions",
		"",
		"1. Follow the Execution Instructions above.",
		"2. Follow the Study Dimension above for the specific Steps, Evidence, and Questions.",
		"3. **HARD RULES**:",
		"   - When studying a source, NEVER access files outside that source's directory. BANNED.",
		"   - EVERY code mention MUST include `path/to/file.ts:NN`. No exceptions.",
		"4. Explore the source's code following the Study Dimension's Steps and Evidence sections.",
		"   Answer all the Study Dimension's Questions.",
		`5. Write the analysis to \`${outputFile}\` using the Output Template below.`,
		"",
		"## Output Template",
		"",
		templateContent || "(no template content)",
		"",
		"## Output",
		"",
		`- Per-source analysis: \`${outputFile}\``,
		"",
		"Work thoroughly. This is a comparative architecture study, not a surface skim.",
	].join("\n");
}

function buildSynthesisPrompt(
	ROOT: string,
	dimension: Dimension,
	allSources: Source[],
): string {
	const dimFile = join(ROOT, "dimensions", dimension.file);
	const templateFile = join(ULTRA_ROOT, "templates", "report.md");
	const synthFile = join(ULTRA_ROOT, "prompts", "synthesize.md");
	const reportFile = `reports/final/${dimension.number}-${dimension.name}.md`;
	const analysisFiles = allSources
		.map(
			(s) =>
				`   - \`reports/source/${dimension.number}-${dimension.name}/${s.name}.md\``,
		)
		.join("\n");
	const sourcesList = allSources.map((s) => `- **${s.name}**`).join("\n");

	const synthContent = readFile(synthFile);
	const dimContent = readFile(dimFile);
	const templateContent = readFile(templateFile);

	return [
		`# Synthesis: ${dimension.title}`,
		"",
		"Read all per-source analysis files and create a combined study report.",
		"",
		"## Synthesis Instructions",
		"",
		synthContent || "(no synthesis instructions)",
		"",
		"## Study Dimension",
		"",
		dimContent || "(no dimension content)",
		"",
		"## Sources Studied",
		"",
		sourcesList,
		"",
		"## Per-Source Analysis Files to Read",
		"",
		analysisFiles,
		"",
		"## Instructions",
		"",
		"1. Read ALL per-source analysis files listed above.",
		"2. Follow the Synthesis Instructions and Study Dimension above.",
		`3. Write the report to \`${reportFile}\` using the Report Template below.`,
		"4. Fill in all template sections including cross-source comparison, synthesis, tradeoff matrix, and evidence index.",
		"5. Do NOT access any source code directly — all evidence is already captured in the analysis files.",
		"",
		"## Report Template",
		"",
		templateContent || "(no template content)",
		"",
		"## Output",
		"",
		`- Combined report: \`${reportFile}\``,
		"",
		"Work thoroughly. This is a comparative architecture study, not a surface skim.",
	].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────────

function loadState(ROOT: string): RunState | null {
	const stateFile = join(ROOT, ".run-state.json");
	try {
		if (existsSync(stateFile)) {
			return JSON.parse(readFileSync(stateFile, "utf-8"));
		}
	} catch {
		/* corrupted or missing */
	}
	return null;
}

function saveState(ROOT: string, state: RunState): void {
	const stateFile = join(ROOT, ".run-state.json");
	state.updatedAt = new Date().toISOString();
	writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

function findCompletedSources(
	ROOT: string,
	allSources: Source[],
	allDimensions: Dimension[],
): Set<string> {
	const done = new Set<string>();
	for (const s of allSources) {
		for (const d of allDimensions) {
			if (
				s.type === "file" &&
				s.applicableDimensions &&
				!s.applicableDimensions.some(
					(ad) => ad.replace(/^0+/, "") === d.number.replace(/^0+/, ""),
				)
			)
				continue;
			const analysisPath = join(
				ROOT,
				"reports/source",
				`${d.number}-${d.name}`,
				`${s.name}.md`,
			);
			if (existsSync(analysisPath)) done.add(`${s.name}-${d.number}`);
		}
	}
	return done;
}

function createInitialState(
	ROOT: string,
	allSources: Source[],
	allDimensions: Dimension[],
	batchSize: number,
): RunState {
	const completed = findCompletedSources(ROOT, allSources, allDimensions);
	let foundCount = 0;
	const taskStates: TaskState[] = [];
	for (const d of allDimensions) {
		const applicableSources = getApplicableSources(allSources, d);
		for (const s of applicableSources) {
			const key = `${s.name}-${d.number}`;
			const isDone = completed.has(key);
			if (isDone) foundCount++;
			taskStates.push({
				dimensionNumber: d.number,
				dimensionName: d.name,
				dimensionTitle: d.title,
				sourceName: s.name,
				status: isDone ? "completed" : "pending",
				attempts: isDone ? 1 : 0,
				lastError: null,
				lastAttemptAt: isDone ? new Date().toISOString() : null,
				nextRetryAt: null,
				completedAt: isDone ? new Date().toISOString() : null,
			});
		}
	}

	if (foundCount > 0) {
		console.log(
			`  Found ${foundCount} existing analysis file(s) — marking as completed`,
		);
	}

	const synthesisTasks: SynthesisState[] = [];
	for (const d of allDimensions) {
		const allDone = allSources.every((s) => {
			const task = taskStates.find(
				(t) => t.dimensionNumber === d.number && t.sourceName === s.name,
			);
			return task && task.status === "completed";
		});
		if (allDone && allSources.length > 0) {
			const reportPath = join(
				ROOT,
				"reports/final",
				`${d.number}-${d.name}.md`,
			);
			const reportExists = existsSync(reportPath);
			if (reportExists) {
				synthesisTasks.push({
					dimensionNumber: d.number,
					dimensionName: d.name,
					dimensionTitle: d.title,
					status: "completed",
					attempts: 1,
					lastError: null,
					lastAttemptAt: new Date().toISOString(),
					nextRetryAt: null,
					completedAt: new Date().toISOString(),
				});
				console.log(
					`  Synthesis for ${d.title} already complete — report found`,
				);
			}
		}
	}

	return {
		version: 1,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		batchSize,
		tasks: taskStates,
		synthesisTasks,
		isComplete: false,
	};
}

// ──────────────────────────────────────────────────────────────────────────────
// Backoff
// ──────────────────────────────────────────────────────────────────────────────

const BACKOFF_DELAYS = [
	0.5 * 3_600_000,
	1 * 3_600_000,
	1.5 * 3_600_000,
	2 * 3_600_000,
	3 * 3_600_000,
	5 * 3_600_000,
	7 * 3_600_000,
	9 * 3_600_000,
	12 * 3_600_000,
	15 * 3_600_000,
	18 * 3_600_000,
	24 * 3_600_000,
];

function getBackoffDelay(attempt: number): number {
	if (attempt <= 0) return 0;
	return BACKOFF_DELAYS[Math.min(attempt - 1, BACKOFF_DELAYS.length - 1)];
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function formatDuration(ms: number): string {
	if (ms <= 0) return "0s";
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.floor((ms % 3_600_000) / 60_000);
	const secs = Math.floor((ms % 60_000) / 1_000);
	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
	return parts.join(" ");
}

// ──────────────────────────────────────────────────────────────────────────────
// Commands
// ──────────────────────────────────────────────────────────────────────────────

function cmdList(ROOT: string): void {
	const sources = discoverSources(ROOT);
	const dimensions = discoverDimensions(ROOT);

	console.log("\nAvailable Sources:\n");
	for (const s of sources) {
		console.log(`  ${s.name}`);
	}

	console.log("\nAvailable Dimensions:\n");
	for (const d of dimensions) {
		console.log(`  ${d.number}-${d.name}.md — ${d.title}`);
	}

	console.log("\nUsage:\n");
	console.log("  ultra study list <study>");
	console.log(
		"  ultra study run <study> <dimension-ref> <source-name> [options]",
	);
	console.log("  ultra study run-all <study> [options]");
	console.log("  ultra study run-loop <study> [options]");
	console.log("  ultra study status <study>");
	console.log("  ultra sprint plan <project> <sprint-slug> [options]");
	console.log("  ultra sprint execute <project> <sprint-slug> [options]");
	console.log("  ultra sprint review <project> <sprint-slug> [options]");
	console.log("  ultra sprint flow <project> <sprint-slug> [options]\n");
}

function cmdStatus(ROOT: string): void {
	const state = loadState(ROOT);
	if (!state) {
		console.log("\nNo run state found. Start a run with: ultra study run-loop");
		return;
	}

	const analysisTotal = state.tasks.length;
	const analysisCompleted = state.tasks.filter(
		(t) => t.status === "completed",
	).length;
	const analysisPct =
		analysisTotal > 0
			? ((analysisCompleted / analysisTotal) * 100).toFixed(1)
			: "0.0";
	const synthTotal = state.synthesisTasks.length;
	const synthCompleted = state.synthesisTasks.filter(
		(s) => s.status === "completed",
	).length;
	const dimCount = new Set(state.tasks.map((t) => t.dimensionNumber)).size;

	console.log(`\nStarted: ${state.createdAt}`);
	console.log(`Updated: ${state.updatedAt}`);
	console.log(
		`Status: ${state.isComplete ? "✓ Complete" : "▶ In progress"}  |  Batch: ${state.batchSize}`,
	);

	if (analysisCompleted < analysisTotal || synthCompleted < synthTotal) {
		console.log("");
		console.log("Remaining:");
		for (const t of state.tasks) {
			if (t.status === "completed") continue;
			const label = `${t.dimensionTitle} × ${t.sourceName}`;
			if (t.status === "failed") {
				const retryStr = t.nextRetryAt ? `, retry at ${t.nextRetryAt}` : "";
				console.log(`  ✗ ${label} (attempt ${t.attempts}${retryStr})`);
				if (t.lastError) console.log(`    Error: ${t.lastError}`);
			} else {
				console.log(`  ○ ${label}`);
			}
		}
		for (const s of state.synthesisTasks) {
			if (s.status === "completed") continue;
			const label = `Synthesis: ${s.dimensionTitle}`;
			if (s.status === "failed") {
				const retryStr = s.nextRetryAt ? `, retry at ${s.nextRetryAt}` : "";
				console.log(`  ✗ ${label} (attempt ${s.attempts}${retryStr})`);
				if (s.lastError) console.log(`    Error: ${s.lastError}`);
			} else {
				console.log(`  ○ ${label}`);
			}
		}
		console.log("");
	}

	console.log(
		`Dimensions: ${dimCount}  |  Analyses: ${analysisCompleted}/${analysisTotal} (${analysisPct}%)`,
	);
	if (synthTotal > 0) {
		const grandTotal = analysisTotal + synthTotal;
		const grandCompleted = analysisCompleted + synthCompleted;
		console.log(
			`Synthesis:  ${synthCompleted}/${synthTotal}  |  Total: ${grandCompleted}/${grandTotal}`,
		);
	}
	console.log("");
}

function validateCompletedTasks(
	ROOT: string,
	state: RunState,
	allSources: Source[],
	allDimensions: Dimension[],
): number {
	let fixed = 0;
	for (const t of state.tasks) {
		if (t.status !== "completed") continue;
		const analysisPath = join(
			ROOT,
			"reports/source",
			`${t.dimensionNumber}-${t.dimensionName}`,
			`${t.sourceName}.md`,
		);
		if (!existsSync(analysisPath)) {
			console.log(
				`  ⚠ Analysis "${t.dimensionTitle} × ${t.sourceName}" marked completed but file missing — resetting to pending`,
			);
			t.status = "pending";
			t.attempts = 0;
			t.completedAt = null;
			t.lastAttemptAt = null;
			t.lastError = "Per-source analysis file missing on resume";
			fixed++;
		}
	}
	return fixed;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public study commands (called from index.ts)
// ──────────────────────────────────────────────────────────────────────────────

export async function cmdStudyList(studyName: string): Promise<void> {
	const studyDir = resolveStudyDir(studyName);
	if (!existsSync(studyDir) || !statSync(studyDir).isDirectory()) {
		console.error(`\nError: Study "${studyName}" not found in .ultra/studies/`);
		process.exit(1);
	}
	cmdList(studyDir);
}

export async function cmdStudyRun(
	studyName: string,
	dimensionRef: string,
	sourceRef: string,
	opts: {
		model?: string;
		variant?: string;
		dryRun?: boolean;
		timeoutMs?: number;
	},
): Promise<void> {
	const studyDir = resolveStudyDir(studyName);
	if (!existsSync(studyDir) || !statSync(studyDir).isDirectory()) {
		console.error(`\nError: Study "${studyName}" not found in .ultra/studies/`);
		process.exit(1);
	}
	const CONFIG = loadConfig();
	const allSources = discoverSources(studyDir);
	const allDimensions = discoverDimensions(studyDir);
	const dimension = resolveDimension(dimensionRef, allDimensions);
	const source = resolveSource(sourceRef, allSources);

	if (
		source.type === "file" &&
		source.applicableDimensions &&
		!source.applicableDimensions.some(
			(ad) => ad.replace(/^0+/, "") === dimension.number.replace(/^0+/, ""),
		)
	) {
		console.error(
			`\nError: Source "${source.name}" is not applicable to dimension "${dimension.title}"`,
		);
		process.exit(1);
	}

	const prompt = buildPrompt(studyDir, dimension, source);
	const resultsDir = join(
		studyDir,
		"reports/source",
		`${dimension.number}-${dimension.name}`,
	);

	if (opts.dryRun) {
		console.log(`\n=== DRY RUN: ${dimension.title} → ${source.name} ===\n`);
		console.log(prompt);
		console.log(
			`\nWould run: ${OPENCODE_BIN} run <inline-prompt> --dir ${studyDir}`,
		);
		return;
	}

	mkdirSync(resultsDir, { recursive: true });
	console.log(`\n▶ Studying ${dimension.title} on ${source.name}...\n`);

	const { code } = await runOpenCodeWithFallback({
		prompt,
		workingDir: studyDir,
		model: opts.model,
		variant: opts.variant,
		timeoutMs: opts.timeoutMs,
		primaryModel: CONFIG.primaryModel,
		backupModel: CONFIG.backupModel,
	});

	if (code === 0) {
		console.log(`\n✓ Analysis done: ${dimension.title} → ${source.name}`);
		console.log(`  File: ${resultsDir}/${source.name}.md`);
	} else {
		console.error(
			`\n✗ Failed (exit code ${code}): ${dimension.title} → ${source.name}`,
		);
		process.exit(code);
	}
}

export async function cmdStudyRunAll(
	studyName: string,
	opts: {
		model?: string;
		variant?: string;
		dryRun?: boolean;
		parallel?: number;
		timeoutMs?: number;
		dimensionFilter?: string[];
		sourceFilter?: string[];
	},
): Promise<void> {
	const studyDir = resolveStudyDir(studyName);
	if (!existsSync(studyDir) || !statSync(studyDir).isDirectory()) {
		console.error(`\nError: Study "${studyName}" not found in .ultra/studies/`);
		process.exit(1);
	}
	const CONFIG = loadConfig();
	const allSources = discoverSources(studyDir).filter(
		(s) => !opts.sourceFilter || opts.sourceFilter.includes(s.name),
	);
	const allDimensions = discoverDimensions(studyDir).filter(
		(d) => !opts.dimensionFilter || opts.dimensionFilter.includes(d.number),
	);

	if (allDimensions.length === 0 || allSources.length === 0) {
		console.error("No matching dimensions or sources found");
		process.exit(1);
	}

	const concurrency = opts.parallel ?? CONFIG.defaultParallel;
	const total = allDimensions.reduce(
		(sum, d) => sum + getApplicableSources(allSources, d).length,
		0,
	);
	console.log(
		`\n▶ Running ${total} analyses (${allDimensions.length} dimensions × ${allSources.length} sources)`,
	);
	console.log(`  Parallel: ${concurrency}\n`);

	const runWithConcurrency = async <T>(
		tasks: (() => Promise<T>)[],
		n: number,
	): Promise<T[]> => {
		const results: T[] = [];
		let idx = 0;
		async function worker(): Promise<void> {
			while (idx < tasks.length) {
				const i = idx++;
				results[i] = await tasks[i]();
			}
		}
		await Promise.all(
			Array.from({ length: Math.min(n, tasks.length) }, worker),
		);
		return results;
	};

	await runWithConcurrency(
		allDimensions.flatMap((dimension) => {
			const applicableSources = getApplicableSources(allSources, dimension);
			return applicableSources.map((source) => async () => {
				const prompt = buildPrompt(studyDir, dimension, source);
				const resultsDir = join(
					studyDir,
					"reports/source",
					`${dimension.number}-${dimension.name}`,
				);
				if (opts.dryRun) {
					console.log(`[DRY RUN] ${dimension.title} → ${source.name}`);
					return;
				}
				mkdirSync(resultsDir, { recursive: true });
				console.log(`[START] ${dimension.title} → ${source.name}`);
				const { code } = await runOpenCodeWithFallback({
					prompt,
					workingDir: studyDir,
					model: opts.model,
					variant: opts.variant,
					timeoutMs: opts.timeoutMs,
					primaryModel: CONFIG.primaryModel,
					backupModel: CONFIG.backupModel,
				});
				if (code === 0) {
					console.log(`[DONE]  ${dimension.title} → ${source.name}`);
				} else {
					console.error(
						`[FAIL]  ${dimension.title} → ${source.name} (exit ${code})`,
					);
				}
			});
		}),
		concurrency,
	);

	console.log("\n✓ All per-source analyses completed");
	console.log("\n▶ Running synthesis for each dimension...\n");

	await runWithConcurrency(
		allDimensions.map((dimension) => async () => {
			const applicableSources = getApplicableSources(allSources, dimension);
			const prompt = buildSynthesisPrompt(
				studyDir,
				dimension,
				applicableSources,
			);
			mkdirSync(join(studyDir, "reports/final"), { recursive: true });
			if (opts.dryRun) {
				console.log(`[DRY RUN] Synthesis: ${dimension.title}`);
				return;
			}
			console.log(`[SYNTHESIS] ${dimension.title}`);
			const { code } = await runOpenCodeWithFallback({
				prompt,
				workingDir: studyDir,
				model: opts.model,
				variant: opts.variant,
				timeoutMs: opts.timeoutMs,
				primaryModel: CONFIG.primaryModel,
				backupModel: CONFIG.backupModel,
			});
			if (code === 0) {
				console.log(`[DONE]  Synthesis: ${dimension.title}`);
			} else {
				console.error(`[FAIL]  Synthesis: ${dimension.title} (exit ${code})`);
			}
		}),
		concurrency,
	);

	console.log("\n✓ All studies completed");
}

export async function cmdStudyRunLoop(
	studyName: string,
	opts: {
		model?: string;
		variant?: string;
		dryRun?: boolean;
		batchSize: number;
		timeoutMs?: number;
		dimensionFilter?: string[];
		sourceFilter?: string[];
	},
): Promise<void> {
	const studyDir = resolveStudyDir(studyName);
	if (!existsSync(studyDir) || !statSync(studyDir).isDirectory()) {
		console.error(`\nError: Study "${studyName}" not found in .ultra/studies/`);
		process.exit(1);
	}
	const CONFIG = loadConfig();

	if (opts.dryRun) {
		const allSources = discoverSources(studyDir).filter(
			(s) => !opts.sourceFilter || opts.sourceFilter.includes(s.name),
		);
		const allDimensions = discoverDimensions(studyDir).filter(
			(d) => !opts.dimensionFilter || opts.dimensionFilter.includes(d.number),
		);
		if (allDimensions.length === 0 || allSources.length === 0) {
			console.error("No matching dimensions or sources found");
			process.exit(1);
		}
		const existing = loadState(studyDir);
		const total = allDimensions.reduce(
			(sum, d) => sum + getApplicableSources(allSources, d).length,
			0,
		);
		console.log(
			`\n[DRY RUN] Would run ${total} analyses + ${allDimensions.length} synthesis tasks (batch size: ${opts.batchSize}):\n`,
		);
		for (const d of allDimensions) {
			const applicableSources = getApplicableSources(allSources, d);
			for (const s of applicableSources) {
				const analysisPath = join(
					studyDir,
					"reports/source",
					`${d.number}-${d.name}`,
					`${s.name}.md`,
				);
				const exists = existsSync(analysisPath);
				const stateDone = existing?.tasks.find(
					(t) =>
						t.dimensionNumber === d.number &&
						t.sourceName === s.name &&
						t.status === "completed",
				);
				const tag = exists || stateDone ? " [done]" : "";
				console.log(`  ${d.title} × ${s.name}${tag}`);
			}
		}
		console.log("");
		return;
	}

	const allSources = discoverSources(studyDir).filter(
		(s) => !opts.sourceFilter || opts.sourceFilter.includes(s.name),
	);
	const allDimensions = discoverDimensions(studyDir).filter(
		(d) => !opts.dimensionFilter || opts.dimensionFilter.includes(d.number),
	);

	let state = loadState(studyDir);
	if (state) {
		console.log(`\n▶ Resuming existing run from ${state.createdAt}`);
		const fixed = validateCompletedTasks(
			studyDir,
			state,
			allSources,
			allDimensions,
		);
		if (fixed > 0) saveState(studyDir, state);
		cmdStatus(studyDir);
	} else {
		if (allDimensions.length === 0 || allSources.length === 0) {
			console.error("No matching dimensions or sources found");
			process.exit(1);
		}
		state = createInitialState(
			studyDir,
			allSources,
			allDimensions,
			opts.batchSize,
		);
		saveState(studyDir, state);
		const total = allDimensions.reduce(
			(sum, d) => sum + getApplicableSources(allSources, d).length,
			0,
		);
		console.log(
			`\n▶ Starting run: ${total} analyses + synthesis per dimension, batch size ${opts.batchSize}`,
		);
	}

	const runWithConcurrency = async <T>(
		tasks: (() => Promise<T>)[],
		n: number,
	): Promise<T[]> => {
		const results: T[] = [];
		let idx = 0;
		async function worker(): Promise<void> {
			while (idx < tasks.length) {
				const i = idx++;
				results[i] = await tasks[i]();
			}
		}
		await Promise.all(
			Array.from({ length: Math.min(n, tasks.length) }, worker),
		);
		return results;
	};

	process.on("SIGINT", () => {
		console.log("\n\n⚠ Interrupted. Saving state before exit...");
		saveState(studyDir, state!);
		console.log(`State saved. Run to resume.`);
		process.exit(130);
	});

	while (!state!.isComplete) {
		const now = Date.now();
		const synthDone = new Set(
			state!.synthesisTasks
				.filter((s) => s.status === "completed")
				.map((s) => s.dimensionNumber),
		);
		for (const d of allDimensions) {
			if (synthDone.has(d.number)) continue;
			const applicableSources = getApplicableSources(allSources, d);
			const allSourcesDone = applicableSources.every((s) => {
				const task = state!.tasks.find(
					(t) => t.dimensionNumber === d.number && t.sourceName === s.name,
				);
				return (
					task?.status === "completed" &&
					existsSync(
						join(
							studyDir,
							"reports/source",
							`${d.number}-${d.name}`,
							`${s.name}.md`,
						),
					)
				);
			});
			if (
				allSourcesDone &&
				!state!.synthesisTasks.find((s) => s.dimensionNumber === d.number)
			) {
				state!.synthesisTasks.push({
					dimensionNumber: d.number,
					dimensionName: d.name,
					dimensionTitle: d.title,
					status: "pending",
					attempts: 0,
					lastError: null,
					lastAttemptAt: null,
					nextRetryAt: null,
					completedAt: null,
				});
				console.log(`  ➜ Synthesis queued for ${d.title}`);
				saveState(studyDir, state!);
			}
		}

		let analysisCompletedCount = 0;
		const runnableAnalysis: TaskState[] = [];
		let earliestRetry = Infinity;

		for (const t of state!.tasks) {
			switch (t.status) {
				case "completed":
					analysisCompletedCount++;
					break;
				case "pending":
					runnableAnalysis.push(t);
					break;
				case "failed":
					if (t.nextRetryAt && now < new Date(t.nextRetryAt).getTime()) {
						earliestRetry = Math.min(
							earliestRetry,
							new Date(t.nextRetryAt).getTime(),
						);
					} else {
						t.status = "pending";
						runnableAnalysis.push(t);
					}
					break;
				case "running":
					t.status = "pending";
					runnableAnalysis.push(t);
					break;
			}
		}

		const runnableSynthesis: SynthesisState[] = [];
		for (const s of state!.synthesisTasks) {
			if (s.status === "completed") continue;
			if (
				s.status === "failed" &&
				s.nextRetryAt &&
				now < new Date(s.nextRetryAt).getTime()
			) {
				earliestRetry = Math.min(
					earliestRetry,
					new Date(s.nextRetryAt).getTime(),
				);
			} else if (s.status === "pending" || s.status === "failed") {
				s.status = "pending";
				runnableSynthesis.push(s);
			}
		}

		const totalTasks = state!.tasks.length + state!.synthesisTasks.length;
		const completedCount =
			state!.tasks.filter((t) => t.status === "completed").length +
			state!.synthesisTasks.filter((s) => s.status === "completed").length;

		if (completedCount === totalTasks) {
			state!.isComplete = true;
			saveState(studyDir, state!);
			cmdStatus(studyDir);
			console.log("\n✓ All tasks completed!");
			break;
		}

		if (runnableAnalysis.length === 0 && runnableSynthesis.length === 0) {
			if (earliestRetry < Infinity) {
				const wait = Math.min(
					earliestRetry - Date.now(),
					BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1],
				);
				if (wait > 0) {
					cmdStatus(studyDir);
					console.log(
						`⏳ All remaining tasks in backoff. Sleeping ${formatDuration(wait)} until next retry...`,
					);
					await sleep(wait);
					continue;
				}
			}
			await sleep(5_000);
			continue;
		}

		const runnable: (TaskState | SynthesisState)[] = [];
		const synthCount = Math.min(
			runnableSynthesis.length,
			Math.ceil(opts.batchSize / 2),
		);
		runnable.push(...runnableSynthesis.slice(0, synthCount));
		const analysisSlots = opts.batchSize - runnable.length;
		runnable.push(...runnableAnalysis.slice(0, analysisSlots));
		for (const t of runnable) {
			t.status = "running";
			t.lastAttemptAt = new Date().toISOString();
			t.attempts++;
		}
		saveState(studyDir, state!);

		await Promise.all(
			runnable.map(async (task) => {
				const isSynthesis = "dimensionName" in task && !("sourceName" in task);
				if (!isSynthesis) {
					const t = task as TaskState;
					const dim = allDimensions.find((d) => d.number === t.dimensionNumber);
					const source = allSources.find((s) => s.name === t.sourceName);
					if (!dim || !source) {
						t.status = "failed";
						t.lastError = "Dimension or source not found";
						const delay = getBackoffDelay(t.attempts);
						t.nextRetryAt =
							delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
						saveState(studyDir, state!);
						return;
					}
					const prompt = buildPrompt(studyDir, dim, source);
					const resultsDir = join(
						studyDir,
						"reports/source",
						`${t.dimensionNumber}-${t.dimensionName}`,
					);
					mkdirSync(resultsDir, { recursive: true });
					console.log(
						`  ▶ [${t.dimensionTitle} × ${t.sourceName}] attempt ${t.attempts}`,
					);
					const { code } = await runOpenCodeWithFallback({
						prompt,
						workingDir: studyDir,
						model: opts.model,
						variant: opts.variant,
						timeoutMs: opts.timeoutMs,
						primaryModel: CONFIG.primaryModel,
						backupModel: CONFIG.backupModel,
					});
					if (code === 0) {
						const analysisPath = join(
							studyDir,
							"reports/source",
							`${t.dimensionNumber}-${t.dimensionName}`,
							`${t.sourceName}.md`,
						);
						if (existsSync(analysisPath)) {
							t.status = "completed";
							t.completedAt = new Date().toISOString();
							console.log(
								`  ✓ [${t.dimensionTitle} × ${t.sourceName}] analysis written`,
							);
						} else {
							t.status = "failed";
							t.lastError = "Exit code 0 but analysis file was not generated";
							const delay = getBackoffDelay(t.attempts);
							t.nextRetryAt =
								delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
						}
					} else {
						t.status = "failed";
						t.lastError = `Exit code ${code}`;
						const delay = getBackoffDelay(t.attempts);
						t.nextRetryAt =
							delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
						console.log(
							`  ✗ [${t.dimensionTitle} × ${t.sourceName}] failed (attempt ${t.attempts})`,
						);
					}
					saveState(studyDir, state!);
				} else {
					const s = task as SynthesisState;
					const dim = allDimensions.find((d) => d.number === s.dimensionNumber);
					if (!dim) {
						s.status = "failed";
						s.lastError = "Dimension not found";
						const delay = getBackoffDelay(s.attempts);
						s.nextRetryAt =
							delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
						saveState(studyDir, state!);
						return;
					}
					const applicableSources = getApplicableSources(allSources, dim);
					const prompt = buildSynthesisPrompt(studyDir, dim, applicableSources);
					mkdirSync(join(studyDir, "reports/final"), { recursive: true });
					console.log(
						`  ▶ Synthesis [${s.dimensionTitle}] attempt ${s.attempts}`,
					);
					const { code } = await runOpenCodeWithFallback({
						prompt,
						workingDir: studyDir,
						model: opts.model,
						variant: opts.variant,
						timeoutMs: opts.timeoutMs,
						primaryModel: CONFIG.primaryModel,
						backupModel: CONFIG.backupModel,
					});
					if (code === 0) {
						const reportPath = join(
							studyDir,
							"reports/final",
							`${s.dimensionNumber}-${s.dimensionName}.md`,
						);
						if (existsSync(reportPath)) {
							s.status = "completed";
							s.completedAt = new Date().toISOString();
							s.lastError = null;
							console.log(`  ✓ Synthesis [${s.dimensionTitle}] report written`);
							try {
								execSync(
									`git add -A && git commit -m "chore: add final report for ${s.dimensionTitle}"`,
									{ cwd: ULTRA_ROOT, stdio: "pipe" },
								);
							} catch {
								/* noop */
							}
						} else {
							s.status = "failed";
							s.lastError = "Synthesis exit 0 but report missing";
							const delay = getBackoffDelay(s.attempts);
							s.nextRetryAt =
								delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
						}
					} else {
						s.status = "failed";
						s.lastError = `Exit code ${code}`;
						const delay = getBackoffDelay(s.attempts);
						s.nextRetryAt =
							delay > 0 ? new Date(Date.now() + delay).toISOString() : null;
						console.log(
							`  ✗ Synthesis [${s.dimensionTitle}] failed (attempt ${s.attempts})`,
						);
					}
					saveState(studyDir, state!);
				}
			}),
		);
	}
}

export async function cmdStudyStatus(studyName: string): Promise<void> {
	const studyDir = resolveStudyDir(studyName);
	if (!existsSync(studyDir) || !statSync(studyDir).isDirectory()) {
		console.error(`\nError: Study "${studyName}" not found in .ultra/studies/`);
		process.exit(1);
	}
	cmdStatus(studyDir);
}
