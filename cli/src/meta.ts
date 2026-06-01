// Meta commands are not yet migrated to .ultra/cli
// They still live in ultraplan/cli as 'study meta ...'

export async function cmdMetaList(): Promise<void> {
	console.log("\nMeta commands are not yet migrated to .ultra/cli");
	console.log("  Use: study meta list (legacy ultraplan/cli)");
	console.log("");
}

export async function cmdMetaPlan(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export async function cmdMetaMaterialize(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export async function cmdMetaIndex(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export async function cmdMetaSynthesize(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export async function cmdMetaRunLoop(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export async function cmdMetaStatus(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export async function cmdMetaInitialise(): Promise<void> {
	console.error("Meta commands not yet migrated to .ultra/cli");
	process.exit(1);
}

export function discoverMetaStudies(): string[] {
	return [];
}
