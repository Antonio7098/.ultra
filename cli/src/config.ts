import { readFileSync } from "fs";
import { join } from "path";
import type { Config } from "./paths.js";
import { loadConfig } from "./paths.js";

export type { Config };
export { loadConfig };
export { findOpenCode, OPENCODE_BIN } from "./paths.js";

export function buildSprintPrompt(
	promptFile: string,
	project: string,
	sprintSlug: string,
	extraSubstitutions?: Record<string, string>,
): string {
	let prompt = readFileSync(promptFile, "utf-8");

	// New .ultra/ paths
	prompt = prompt.replace(/\{project\}/g, project);
	prompt = prompt.replace(/\{sprint-slug\}/g, sprintSlug);
	prompt = prompt.replace(
		/\.ultra\/projects\/\{project\}/g,
		`.ultra/projects/${project}`,
	);
	prompt = prompt.replace(/targets\/\{target\}/g, `.ultra/projects/${project}`);
	prompt = prompt.replace(/targets\/\.ultra/g, `.ultra/projects`);

	// Backward compat: also handle {target} in old prompts
	prompt = prompt.replace(/\{target\}/g, project);

	// Sprint-specific path substitutions
	prompt = prompt.replace(
		/\{sprint\}/g,
		`.ultra/projects/${project}/sprints/${sprintSlug}`,
	);

	if (extraSubstitutions) {
		for (const [key, value] of Object.entries(extraSubstitutions)) {
			prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
		}
	}

	return prompt;
}
