import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, join, isAbsolute } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// Resolve .ultra/ root from the CLI source file location
// .ultra/cli/src/index.ts → .ultra/ (two levels up from .ultra/cli/src/)
const __cliDir = fileURLToPath(new URL(".", import.meta.url));
export const ULTRA_ROOT = resolve(__cliDir, "../..");
export const STUDIES_DIR = join(ULTRA_ROOT, "studies");
export const PROJECTS_DIR = join(ULTRA_ROOT, "projects");
export const PROMPTS_DIR = join(ULTRA_ROOT, "prompts");
export const TEMPLATES_DIR = join(ULTRA_ROOT, "system", "templates");
export const SYSTEM_DIR = join(ULTRA_ROOT, "system");
export const CONFIG_PATH = join(ULTRA_ROOT, "config.json");

export interface Config {
	defaultModel: string;
	primaryModel: string;
	backupModel: string;
	defaultVariant: string;
	defaultParallel: number;
	defaultTimeoutMs: number;
	sprintPlanningModel: string;
	sprintPlanningContextWindow: number;
	sprintExecutionModel: string;
	sprintExecutionVariant: string;
}

export function loadConfig(): Config {
	try {
		return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
	} catch {
		return {
			defaultModel: "minimax-coding-plan/MiniMax-M2.7",
			primaryModel: "minimax-coding-plan/MiniMax-M2.7",
			backupModel: "opencode/deepseek-v4-flash-free",
			defaultVariant: "high",
			defaultParallel: 3,
			defaultTimeoutMs: 1800000,
			sprintPlanningModel: "openai/gpt-5.5",
			sprintPlanningContextWindow: 1000000,
			sprintExecutionModel: "openai/gpt-5.5",
			sprintExecutionVariant: "low",
		};
	}
}

export function resolveUltraRoot(cwd?: string): string {
	let root = cwd ?? process.cwd();
	if (!existsSync(join(root, ".ultra", "config.json"))) {
		let prev = "";
		while (
			prev !== root &&
			existsSync(join(root, "..", ".ultra", "config.json"))
		) {
			prev = root;
			root = resolve(root, "..");
		}
	}
	return root;
}

export function resolveProjectDir(project: string): string {
	return join(PROJECTS_DIR, project);
}

export function resolveSprintDir(project: string, sprintSlug: string): string {
	return join(PROJECTS_DIR, project, "sprints", sprintSlug);
}

export function resolveStudyDir(studyName: string): string {
	return join(STUDIES_DIR, studyName);
}

export function resolvePrompt(name: string): string {
	return join(PROMPTS_DIR, name);
}

export function resolveTemplate(name: string): string {
	return join(TEMPLATES_DIR, name);
}

export function readFile(filePath: string): string {
	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return "";
	}
}

export function fileExists(filePath: string): boolean {
	return existsSync(filePath);
}

export function ensureDir(dirPath: string): void {
	mkdirSync(dirPath, { recursive: true });
}

export function findOpenCode(): string {
	const candidates = [
		"opencode",
		join(homedir(), ".opencode", "bin", "opencode"),
	];
	for (const c of candidates) {
		try {
			const r = execSync(`command -v ${c}`, { encoding: "utf-8" }).trim();
			if (r) return r;
		} catch {
			/* try next */
		}
	}
	return "opencode";
}

export const OPENCODE_BIN = findOpenCode();
export const OPENCODE_CONFIG_PATH = resolve(
	import.meta.dirname,
	"../opencode-config.json",
);
