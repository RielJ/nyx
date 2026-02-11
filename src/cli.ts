import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";
import pc from "picocolors";
import { createCache, createNoopCache } from "./cache.js";
import { type Diagnostic, findNonCanonicalClasses } from "./canonicalize.js";
import { hashConfig, loadConfigFile, resolveConfig } from "./config.js";
import { loadDesignSystem, resolveCssPath } from "./design-system.js";
import { applyFixes } from "./fixer.js";
import { formatDiagnostics } from "./reporter.js";
import { createScanner } from "./scanner.js";
import { findUnsortedClasses, type SortStrategy } from "./sorter.js";

const EXTENSIONS = new Set([
	"html",
	"htm",
	"jsx",
	"tsx",
	"vue",
	"svelte",
	"astro",
	"erb",
	"ejs",
	"hbs",
	"handlebars",
	"php",
	"blade.php",
	"twig",
	"njk",
	"liquid",
	"pug",
	"slim",
	"haml",
	"mdx",
	"md",
	"rs",
	"ex",
	"heex",
	"clj",
	"cljs",
]);

function getExtension(filePath: string): string {
	const base = path.basename(filePath);
	// Handle compound extensions like .blade.php
	const parts = base.split(".");
	if (parts.length > 2) {
		return parts.slice(-2).join(".");
	}
	return parts.pop() || "html";
}

function isTemplateFile(filePath: string): boolean {
	if (filePath.endsWith(".css")) return false;
	const ext = getExtension(filePath);
	return EXTENSIONS.has(ext);
}

function getPackageVersion(): string {
	try {
		const pkgPath = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"..",
			"package.json",
		);
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

const format = defineCommand({
	meta: { name: "format", description: "Sort Tailwind CSS classes" },
	args: {
		css: { type: "string", description: "Path to CSS entry point" },
		strategy: {
			type: "string",
			description:
				"Sort strategy: tailwind or alphabetical (default: tailwind)",
		},
		fix: { type: "boolean", description: "Auto-fix issues", default: false },
		json: {
			type: "boolean",
			description: "Output diagnostics as JSON",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Only show summary",
			default: false,
		},
		verbose: {
			type: "boolean",
			description: "Show full diagnostics in fix mode",
			default: false,
		},
		cache: {
			type: "boolean",
			description: "Enable file-level caching",
			default: false,
		},
	},
	run: async ({ args, rawArgs }) => {
		const paths = rawArgs.filter((a) => !a.startsWith("-"));
		await run(paths, args, ["format"], rawArgs);
	},
});

const lint = defineCommand({
	meta: {
		name: "lint",
		description: "Check for non-canonical Tailwind CSS classes",
	},
	args: {
		css: { type: "string", description: "Path to CSS entry point" },
		rem: { type: "string", description: "Root font size in px (default: 16)" },
		collapse: {
			type: "boolean",
			description: "Collapse e.g. mt-2 mr-2 mb-2 ml-2 → m-2",
			default: false,
		},
		fix: { type: "boolean", description: "Auto-fix issues", default: false },
		json: {
			type: "boolean",
			description: "Output diagnostics as JSON",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Only show summary",
			default: false,
		},
		verbose: {
			type: "boolean",
			description: "Show full diagnostics in fix mode",
			default: false,
		},
		cache: {
			type: "boolean",
			description: "Enable file-level caching",
			default: false,
		},
	},
	run: async ({ args, rawArgs }) => {
		const paths = rawArgs.filter((a) => !a.startsWith("-"));
		await run(paths, args, ["lint"], rawArgs);
	},
});

const check = defineCommand({
	meta: { name: "check", description: "Run format and lint checks" },
	args: {
		css: { type: "string", description: "Path to CSS entry point" },
		strategy: {
			type: "string",
			description:
				"Sort strategy: tailwind or alphabetical (default: tailwind)",
		},
		rem: { type: "string", description: "Root font size in px (default: 16)" },
		collapse: {
			type: "boolean",
			description: "Collapse e.g. mt-2 mr-2 mb-2 ml-2 → m-2",
			default: false,
		},
		fix: { type: "boolean", description: "Auto-fix issues", default: false },
		json: {
			type: "boolean",
			description: "Output diagnostics as JSON",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Only show summary",
			default: false,
		},
		verbose: {
			type: "boolean",
			description: "Show full diagnostics in fix mode",
			default: false,
		},
		cache: {
			type: "boolean",
			description: "Enable file-level caching",
			default: false,
		},
	},
	run: async ({ args, rawArgs }) => {
		const paths = rawArgs.filter((a) => !a.startsWith("-"));
		await run(paths, args, ["format", "lint"], rawArgs);
	},
});

const main = defineCommand({
	meta: {
		name: "nyx",
		version: "0.1.0",
		description: "Tailwind CSS class formatter and linter",
	},
	subCommands: { format, lint, check },
});

async function run(
	paths: string[],
	args: {
		css?: string;
		strategy?: string;
		rem?: string;
		collapse?: boolean;
		fix?: boolean;
		json?: boolean;
		quiet?: boolean;
		verbose?: boolean;
		cache?: boolean;
	},
	kinds: ("format" | "lint")[],
	rawArgs: string[],
) {
	const base = process.cwd();

	// Load config file and resolve with CLI args
	const configFile = loadConfigFile(base);
	const config = resolveConfig(args, configFile, rawArgs);

	const mode = config.fix ? "fix" : "check";

	// Load design system
	let designSystem: Awaited<ReturnType<typeof loadDesignSystem>>;
	try {
		designSystem = await loadDesignSystem({ base, css: config.css });
	} catch (err) {
		console.error(pc.red((err as Error).message));
		process.exit(1);
	}

	// Initialize cache
	let cache: ReturnType<typeof createCache>;
	if (config.cache) {
		const cssPath = resolveCssPath({ base, css: config.css });
		const cssContent = fs.readFileSync(cssPath, "utf-8");
		const cfgHash = hashConfig(config, cssContent);
		const version = getPackageVersion();
		cache = createCache({ base, version, configHash: cfgHash });
	} else {
		cache = createNoopCache();
	}

	// Discover files
	const filesToProcess = discoverFiles(base, paths);

	if (filesToProcess.length === 0) {
		console.error(pc.yellow("No template files found to process."));
		process.exit(0);
	}

	// Pre-compute cached files before processing
	const previouslyCachedFiles = new Set<string>();
	for (const filePath of filesToProcess) {
		if (cache.isFileCached(filePath)) {
			previouslyCachedFiles.add(filePath);
		}
	}

	// Process files for each kind (format first, then lint on potentially fixed content)
	let hasIssues = false;
	const filesWithIssues = new Set<string>();

	for (const kind of kinds) {
		const diagnosticsByFile = new Map<string, Diagnostic[]>();
		let totalDiagnostics = 0;

		for (const filePath of filesToProcess) {
			if (previouslyCachedFiles.has(filePath)) continue;

			const content = fs.readFileSync(filePath, "utf-8");
			const ext = getExtension(filePath);
			const relativePath = path.relative(base, filePath);

			const diagnostics =
				kind === "format"
					? findUnsortedClasses(designSystem, content, relativePath, {
							strategy: config.strategy as SortStrategy,
						})
					: findNonCanonicalClasses(designSystem, content, ext, relativePath, {
							rem: config.rem,
							collapse: config.collapse,
						});

			if (diagnostics.length > 0) {
				filesWithIssues.add(filePath);
				if (config.fix) {
					const fixed = applyFixes(content, diagnostics);
					fs.writeFileSync(filePath, fixed, "utf-8");
					cache.markClean(filePath);
				}
				diagnosticsByFile.set(relativePath, diagnostics);
				totalDiagnostics += diagnostics.length;
			}
		}

		// Report
		const output = formatDiagnostics(diagnosticsByFile, {
			mode,
			kind,
			json: config.json,
			quiet: config.quiet,
			verbose: config.verbose,
		});

		if (output) {
			console.log(output);
		}

		if (totalDiagnostics === 0) {
			if (!config.quiet && !config.json) {
				const msg =
					kind === "format"
						? "All classes are properly sorted."
						: "No non-canonical classes found.";
				console.log(pc.green(msg));
			}
		}

		if (totalDiagnostics > 0) {
			hasIssues = true;
		}
	}

	// Mark clean any file that had no issues and wasn't previously cached
	for (const filePath of filesToProcess) {
		if (
			!filesWithIssues.has(filePath) &&
			!previouslyCachedFiles.has(filePath)
		) {
			cache.markClean(filePath);
		}
	}

	cache.write();

	// Exit with code 1 in check mode when issues found (for CI)
	if (!config.fix && hasIssues) {
		process.exit(1);
	}
}

function discoverFiles(base: string, paths: string[]): string[] {
	if (paths.length > 0) {
		// Explicit paths provided — expand directories
		const files: string[] = [];
		for (const p of paths) {
			const resolved = path.resolve(base, p);
			if (fs.statSync(resolved).isDirectory()) {
				files.push(...walkDir(resolved));
			} else if (isTemplateFile(resolved)) {
				files.push(resolved);
			}
		}
		return files;
	}

	// Use oxide Scanner to discover files
	const scanner = createScanner([{ base, pattern: "**/*", negated: false }]);

	return scanner.files.filter((f) => !f.endsWith(".css") && isTemplateFile(f));
}

function walkDir(dir: string): string[] {
	const files: string[] = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === ".git") continue;
			files.push(...walkDir(fullPath));
		} else if (isTemplateFile(fullPath)) {
			files.push(fullPath);
		}
	}
	return files;
}

runMain(main);
