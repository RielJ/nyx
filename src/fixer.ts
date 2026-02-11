import type { Diagnostic } from "./canonicalize.js";

interface StringChange {
	start: number;
	end: number;
	replacement: string;
}

export function applyFixes(content: string, diagnostics: Diagnostic[]): string {
	if (diagnostics.length === 0) return content;

	const changes: StringChange[] = diagnostics.map((d) => ({
		start: d.offset,
		end: d.offset + d.length,
		replacement: d.canonical,
	}));

	return spliceChangesIntoString(content, changes);
}

function spliceChangesIntoString(str: string, changes: StringChange[]): string {
	if (!changes[0]) return str;

	changes.sort((a, b) => a.end - b.end || a.start - b.start);

	let result = "";
	let previous = changes[0];

	result += str.slice(0, previous.start);
	result += previous.replacement;

	for (let i = 1; i < changes.length; ++i) {
		const change = changes[i];
		result += str.slice(previous.end, change.start);
		result += change.replacement;
		previous = change;
	}

	result += str.slice(previous.end);
	return result;
}
