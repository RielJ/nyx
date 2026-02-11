import { describe, expect, it } from "bun:test";
import type { Diagnostic } from "../src/canonicalize.js";
import { applyFixes } from "../src/fixer.js";

describe("applyFixes", () => {
	it("should return content unchanged when no diagnostics", () => {
		const content = '<div class="flex items-center">hello</div>';
		expect(applyFixes(content, [])).toBe(content);
	});

	it("should replace a single class", () => {
		//              0123456789012
		const content = '<div class="h-[72px]">hello</div>';
		const diagnostics: Diagnostic[] = [
			{
				file: "test.html",
				line: 1,
				column: 13,
				offset: 12,
				length: 8,
				original: "h-[72px]",
				canonical: "h-18",
				lineContent: content,
			},
		];
		expect(applyFixes(content, diagnostics)).toBe(
			'<div class="h-18">hello</div>',
		);
	});

	it("should replace multiple classes in the same line", () => {
		//              012345678901234567890123456
		const content = '<div class="h-[72px] px-[50px]">hello</div>';
		const diagnostics: Diagnostic[] = [
			{
				file: "test.html",
				line: 1,
				column: 13,
				offset: 12,
				length: 8,
				original: "h-[72px]",
				canonical: "h-18",
				lineContent: content,
			},
			{
				file: "test.html",
				line: 1,
				column: 22,
				offset: 21,
				length: 9,
				original: "px-[50px]",
				canonical: "px-[50px]",
				lineContent: content,
			},
		];
		const result = applyFixes(content, diagnostics);
		expect(result).toBe('<div class="h-18 px-[50px]">hello</div>');
	});

	it("should handle replacements that change string length", () => {
		//              0123456789012345678
		const content = 'class="h-[72px] w-[100px]"';
		const diagnostics: Diagnostic[] = [
			{
				file: "test.html",
				line: 1,
				column: 8,
				offset: 7,
				length: 8,
				original: "h-[72px]",
				canonical: "h-18",
				lineContent: content,
			},
			{
				file: "test.html",
				line: 1,
				column: 17,
				offset: 16,
				length: 9,
				original: "w-[100px]",
				canonical: "w-25",
				lineContent: content,
			},
		];
		expect(applyFixes(content, diagnostics)).toBe('class="h-18 w-25"');
	});
});
