import fs from "node:fs";
import path from "node:path";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";

const TAILWIND_IMPORT_RE = /@import\s+['"]tailwindcss['"]/;

const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	".nuxt",
	".output",
]);

function detectCssEntryPoint(base: string): string | null {
	// Walk the project directory looking for any .css file with @import "tailwindcss"
	const found = findCssWithTailwind(base, 3);
	return found;
}

function findCssWithTailwind(dir: string, maxDepth: number): string | null {
	if (maxDepth < 0) return null;

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return null;
	}

	// Check CSS files in this directory first
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
		const fullPath = path.join(dir, entry.name);
		try {
			const content = fs.readFileSync(fullPath, "utf-8");
			if (TAILWIND_IMPORT_RE.test(content)) {
				return fullPath;
			}
		} catch {}
	}

	// Then recurse into subdirectories
	for (const entry of entries) {
		if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
		const result = findCssWithTailwind(
			path.join(dir, entry.name),
			maxDepth - 1,
		);
		if (result) return result;
	}

	return null;
}

export type DesignSystem = Awaited<
	ReturnType<typeof __unstable__loadDesignSystem>
>;

export function resolveCssPath(options: {
	base: string;
	css?: string;
}): string {
	let cssPath: string;

	if (options.css) {
		cssPath = path.resolve(options.base, options.css);
	} else {
		const detected = detectCssEntryPoint(options.base);
		if (!detected) {
			throw new Error(
				'Could not find a CSS entry point with `@import "tailwindcss"`. ' +
					"Specify one with --css <path>.",
			);
		}
		cssPath = detected;
	}

	if (!fs.existsSync(cssPath)) {
		throw new Error(`CSS file not found: ${cssPath}`);
	}

	return cssPath;
}

export async function loadDesignSystem(options: {
	base: string;
	css?: string;
}): Promise<DesignSystem> {
	const cssPath = resolveCssPath(options);
	const cssContent = fs.readFileSync(cssPath, "utf-8");
	return __unstable__loadDesignSystem(cssContent, {
		base: path.dirname(cssPath),
	});
}
