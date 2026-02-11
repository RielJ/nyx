import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { findNonCanonicalClasses } from "../src/canonicalize.js";
import { type DesignSystem, loadDesignSystem } from "../src/design-system.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures");

describe("findNonCanonicalClasses", () => {
	let designSystem: DesignSystem;

	beforeAll(async () => {
		designSystem = await loadDesignSystem({
			base: FIXTURES_DIR,
			css: "css/app.css",
		});
	});

	it("should detect h-[72px] as non-canonical (with rem)", () => {
		const content = '<div class="h-[72px]">';
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"html",
			"test.html",
			{
				rem: 16,
			},
		);

		const match = diagnostics.find((d) => d.original === "h-[72px]");
		expect(match).toBeDefined();
		expect(match?.canonical).toBe("h-18");
	});

	it("should detect p-[16px] as non-canonical (with rem)", () => {
		const content = '<div class="p-[16px]">';
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"html",
			"test.html",
			{
				rem: 16,
			},
		);

		const match = diagnostics.find((d) => d.original === "p-[16px]");
		expect(match).toBeDefined();
		expect(match?.canonical).toBe("p-4");
	});

	it("should not flag already-canonical classes", () => {
		const content = '<div class="flex items-center h-18">';
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"html",
			"test.html",
			{
				rem: 16,
			},
		);

		expect(diagnostics).toHaveLength(0);
	});

	it("should report correct line and column", () => {
		const content = 'line1\n<div class="h-[72px]">';
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"html",
			"test.html",
			{
				rem: 16,
			},
		);

		const match = diagnostics.find((d) => d.original === "h-[72px]");
		expect(match).toBeDefined();
		expect(match?.line).toBe(2);
		expect(match?.column).toBeGreaterThan(1);
	});

	it("should handle TSX content", () => {
		const content = `export function App() {
  return <div className="h-[72px] p-[16px]">hello</div>
}`;
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"tsx",
			"test.tsx",
			{
				rem: 16,
			},
		);

		expect(diagnostics.length).toBeGreaterThanOrEqual(1);
		const hMatch = diagnostics.find((d) => d.original === "h-[72px]");
		expect(hMatch).toBeDefined();
		expect(hMatch?.canonical).toBe("h-18");
	});

	it("should support rem option for px-to-rem conversion", () => {
		const content = '<div class="mt-[16px]">';
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"html",
			"test.html",
			{
				rem: 16,
			},
		);

		const match = diagnostics.find((d) => d.original === "mt-[16px]");
		expect(match).toBeDefined();
		expect(match?.canonical).toBe("mt-4");
	});

	it("should canonicalize arbitrary properties to utilities", () => {
		// [display:_flex] → flex (Tailwind knows flex is display:flex)
		const content = '<div class="[display:_flex]">';
		const diagnostics = findNonCanonicalClasses(
			designSystem,
			content,
			"html",
			"test.html",
		);

		const match = diagnostics.find((d) => d.original === "[display:_flex]");
		expect(match).toBeDefined();
		expect(match?.canonical).toBe("flex");
	});
});
