import { spawn } from "child_process";
import { OPENCODE_BIN, OPENCODE_CONFIG_PATH } from "./paths.js";

export interface RunResult {
	code: number;
	rateLimited: boolean;
	rateLimitModel: string | null;
}

export interface RunOpenCodeOptions {
	model?: string;
	variant?: string;
	timeoutMs?: number;
	primaryModel: string;
	backupModel: string;
	extraEnv?: Record<string, string>;
	prompt: string;
	workingDir: string;
	format?: string;
}

export async function runOpenCode(
	opts: RunOpenCodeOptions,
): Promise<RunResult> {
	return new Promise((resolvePromise, reject) => {
		const args: string[] = ["run", opts.prompt];
		args.push("--dir", opts.workingDir);
		args.push("--format", opts.format ?? "json");
		if (opts.model) {
			args.push("--model", opts.model);
		}
		if (opts.variant) {
			args.push("--variant", opts.variant);
		}
		args.push("--dangerously-skip-permissions");

		let rateLimited = false;
		let rateLimitModel: string | null = null;
		const activeModel = opts.model || opts.primaryModel;

		const child = spawn(OPENCODE_BIN, args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				OPENCODE_CONFIG: OPENCODE_CONFIG_PATH,
				...opts.extraEnv,
			},
		});

		const timer = opts.timeoutMs
			? setTimeout(() => {
					console.error(
						`\n✗ Timed out after ${opts.timeoutMs / 1000}s, killing process...`,
					);
					child.kill();
				}, opts.timeoutMs)
			: null;

		child.stdout?.on("data", (chunk: Buffer) => {
			process.stdout.write(chunk);
		});

		let stderrBuf = "";
		child.stderr?.on("data", (chunk: Buffer) => {
			stderrBuf += chunk.toString();
		});

		child.on("close", (code) => {
			if (timer) clearTimeout(timer);
			const stderrLower = stderrBuf.toLowerCase();
			if (
				stderrLower.includes("rate limit") ||
				stderrLower.includes("rate_limit") ||
				stderrLower.includes("429") ||
				stderrLower.includes("too many requests") ||
				stderrLower.includes("quota exceeded") ||
				stderrLower.includes("monthly quota") ||
				stderrLower.includes("insufficient quota")
			) {
				rateLimited = true;
				rateLimitModel = activeModel;
			}
			resolvePromise({ code: code ?? 1, rateLimited, rateLimitModel });
		});
		child.on("error", (err) => {
			if (timer) clearTimeout(timer);
			reject(err);
		});
	});
}

export async function runOpenCodeWithFallback(
	opts: RunOpenCodeOptions,
): Promise<RunResult> {
	let result = await runOpenCode(opts);

	if (result.rateLimited && result.code === 0 && opts.backupModel) {
		console.log(
			`  ⚠ Rate limit detected on ${result.rateLimitModel}, retrying with backup model...`,
		);
		result = await runOpenCode({ ...opts, model: opts.backupModel });
	}

	return result;
}
