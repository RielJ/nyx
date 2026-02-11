import pc from "picocolors";
import type { Diagnostic } from "./canonicalize.js";

export interface ReporterOptions {
	json?: boolean;
	quiet?: boolean;
	verbose?: boolean;
	mode: "check" | "fix";
	kind?: "format" | "lint";
}

export function formatDiagnostics(
	diagnosticsByFile: Map<string, Diagnostic[]>,
	options: ReporterOptions,
): string {
	if (options.json) {
		return formatJson(diagnosticsByFile);
	}
	if (options.quiet) {
		return formatQuiet(diagnosticsByFile, options.mode, options.kind);
	}
	if (options.mode === "fix" && !options.verbose) {
		return formatQuiet(diagnosticsByFile, options.mode, options.kind);
	}
	return formatCodeframe(diagnosticsByFile, options.mode, options.kind);
}

function formatJson(diagnosticsByFile: Map<string, Diagnostic[]>): string {
	const output: Record<
		string,
		{ line: number; column: number; original: string; canonical: string }[]
	> = {};
	for (const [file, diagnostics] of diagnosticsByFile) {
		output[file] = diagnostics.map((d) => ({
			line: d.line,
			column: d.column,
			original: d.original,
			canonical: d.canonical,
		}));
	}
	return JSON.stringify(output, null, 2);
}

function formatQuiet(
	diagnosticsByFile: Map<string, Diagnostic[]>,
	mode: "check" | "fix",
	kind?: "format" | "lint",
): string {
	const { totalDiagnostics, totalFiles } = countTotals(diagnosticsByFile);
	if (totalDiagnostics === 0) return "";
	return formatSummary(totalDiagnostics, totalFiles, mode, kind);
}

function formatCodeframe(
	diagnosticsByFile: Map<string, Diagnostic[]>,
	mode: "check" | "fix",
	kind?: "format" | "lint",
): string {
	const lines: string[] = [];
	const { totalDiagnostics, totalFiles } = countTotals(diagnosticsByFile);
	const isFormat = kind === "format";

	if (totalDiagnostics === 0) return "";

	for (const [file, diagnostics] of diagnosticsByFile) {
		for (const d of diagnostics) {
			lines.push("");
			lines.push(
				`${pc.cyan(file)}${pc.dim(":")}${pc.yellow(String(d.line))}${pc.dim(":")}${pc.yellow(String(d.column))} ${pc.dim("warn")} ${pc.dim(isFormat ? "unsortedClasses" : "suggestCanonicalClasses")}`,
			);
			lines.push(
				isFormat
					? `  Classes should be sorted as ${pc.green(pc.bold(d.canonical))}`
					: `  The class ${pc.red(pc.bold(d.original))} can be written as ${pc.green(pc.bold(d.canonical))}`,
			);

			const contextLines = getContextLines(d);
			lines.push("");
			for (const cl of contextLines) {
				lines.push(cl);
			}
		}
	}

	lines.push("");
	lines.push(formatSummary(totalDiagnostics, totalFiles, mode, kind));

	return lines.join("\n");
}

function getContextLines(d: Diagnostic): string[] {
	const lines: string[] = [];
	const lineNum = String(d.line);
	const gutter = " ".repeat(lineNum.length + 2);

	// The line with the issue
	lines.push(`  ${pc.dim(lineNum)} ${pc.dim("│")} ${d.lineContent}`);

	// The underline
	const colOffset = d.column - 1;
	const underline =
		" ".repeat(colOffset) + pc.red("~".repeat(d.original.length));
	lines.push(`  ${gutter}${pc.dim("│")} ${underline}`);

	// Suggested fix
	const fixedLine =
		d.lineContent.slice(0, colOffset) +
		d.canonical +
		d.lineContent.slice(colOffset + d.original.length);
	lines.push(`  ${gutter}${pc.dim("│")} ${pc.dim("ℹ Suggested fix:")}`);
	lines.push(`  ${pc.dim(lineNum)} ${pc.dim("│")} ${fixedLine}`);

	const fixUnderline =
		" ".repeat(colOffset) + pc.green("~".repeat(d.canonical.length));
	lines.push(`  ${gutter}${pc.dim("│")} ${fixUnderline}`);

	return lines;
}

function countTotals(diagnosticsByFile: Map<string, Diagnostic[]>) {
	let totalDiagnostics = 0;
	let totalFiles = 0;
	for (const [, diagnostics] of diagnosticsByFile) {
		if (diagnostics.length > 0) {
			totalDiagnostics += diagnostics.length;
			totalFiles++;
		}
	}
	return { totalDiagnostics, totalFiles };
}

function formatSummary(
	count: number,
	files: number,
	mode: "check" | "fix",
	kind?: "format" | "lint",
): string {
	const fileWord = files === 1 ? "file" : "files";

	if (kind === "format") {
		const groupWord = count === 1 ? "class group" : "class groups";
		if (mode === "fix") {
			return pc.green(`Sorted ${count} ${groupWord} in ${files} ${fileWord}.`);
		}
		return pc.yellow(
			`Found ${count} unsorted ${groupWord} in ${files} ${fileWord}. Run ${pc.bold("nyx format --fix")} to apply.`,
		);
	}

	const classWord = count === 1 ? "class" : "classes";
	if (mode === "fix") {
		return pc.green(
			`Fixed ${count} non-canonical ${classWord} in ${files} ${fileWord}.`,
		);
	}
	return pc.yellow(
		`Found ${count} non-canonical ${classWord} in ${files} ${fileWord}. Run ${pc.bold("nyx lint --fix")} to apply.`,
	);
}
