import { beforeAll, describe, expect, it } from "bun:test";
import path from "node:path";
import { type DesignSystem, loadDesignSystem } from "../src/design-system.js";
import { applyFixes } from "../src/fixer.js";
import { findUnsortedClasses } from "../src/sorter.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures");

describe("findUnsortedClasses", () => {
	let designSystem: DesignSystem;

	beforeAll(async () => {
		designSystem = await loadDesignSystem({
			base: FIXTURES_DIR,
			css: "css/app.css",
		});
	});

	describe("tailwind strategy (default)", () => {
		it("should detect unsorted classes", () => {
			const content = '<div class="flex mt-4">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe("mt-4 flex");
		});

		it("should not flag already-sorted classes", () => {
			const content = '<div class="mt-4 flex items-center">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(0);
		});

		it("should handle className attribute", () => {
			const content = '<div className="items-center flex mt-4">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.tsx",
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe("mt-4 flex items-center");
		});

		it("should handle single-quoted attributes", () => {
			const content = "<div class='flex mt-4'>";
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe("mt-4 flex");
		});

		it("should skip single-class attributes", () => {
			const content = '<div class="flex">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(0);
		});

		it("should skip empty class attributes", () => {
			const content = '<div class="">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(0);
		});

		it("should preserve unknown classes at the start", () => {
			const content = '<div class="flex custom-class mt-4">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe("custom-class mt-4 flex");
		});

		it("should report correct line and column", () => {
			const content = 'line1\n<div class="flex mt-4">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].line).toBe(2);
			expect(diagnostics[0].column).toBeGreaterThan(1);
		});

		it("should work with applyFixes to sort classes", () => {
			const content = '<div class="flex mt-4">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
			);
			const fixed = applyFixes(content, diagnostics);

			expect(fixed).toBe('<div class="mt-4 flex">');
		});
	});

	describe("alphabetical strategy", () => {
		const opts = { strategy: "alphabetical" as const };

		it("should sort classes alphabetically", () => {
			const content = '<div class="mt-4 flex">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe("flex mt-4");
		});

		it("should not flag already-sorted classes", () => {
			const content = '<div class="flex items-center mt-4">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(0);
		});

		it("should sort flex w-full flex-col items-center justify-center overflow-y-auto", () => {
			const content =
				'<div class="flex w-full flex-col items-center justify-center overflow-y-auto">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"flex flex-col items-center justify-center overflow-y-auto w-full",
			);
		});

		it("should sort pointer-events-none z-50 grid ...", () => {
			const content =
				'<div class="pointer-events-none z-50 grid h-full max-h-none w-full max-w-none items-center justify-items-center overflow-hidden overscroll-contain bg-transparent opacity-0">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"bg-transparent grid h-full items-center justify-items-center max-h-none max-w-none opacity-0 overflow-hidden overscroll-contain pointer-events-none w-full z-50",
			);
		});

		it("should sort button-pop absolute top-2 right-2 size-6 cursor-pointer rounded-full", () => {
			const content =
				'<div class="button-pop absolute top-2 right-2 size-6 cursor-pointer rounded-full">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"absolute button-pop cursor-pointer right-2 rounded-full size-6 top-2",
			);
		});

		it("should sort flex items-center justify-between gap-2", () => {
			const content = '<div class="flex items-center justify-between gap-2">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"flex gap-2 items-center justify-between",
			);
		});

		it("should sort button-pop flex h-12 cursor-pointer ... long class list", () => {
			const content =
				'<div class="button-pop flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-yellow-300 px-4 font-bold text-sm shadow-xs">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"bg-yellow-300 button-pop cursor-pointer flex font-bold gap-2 h-12 items-center justify-center px-4 rounded-xl shadow-xs text-sm",
			);
		});

		it("should sort -z-1 col-start-1 row-start-1 self-stretch justify-self-stretch", () => {
			const content =
				'<div class="-z-1 col-start-1 row-start-1 self-stretch justify-self-stretch">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"-z-1 col-start-1 justify-self-stretch row-start-1 self-stretch",
			);
		});

		it("should sort mb-5 text-center font-bold text-3xl", () => {
			const content = '<div class="mb-5 text-center font-bold text-3xl">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"font-bold mb-5 text-3xl text-center",
			);
		});

		it("should sort grid grid-cols-2 gap-1 px-1 text-sm", () => {
			const content = '<div class="grid grid-cols-2 gap-1 px-1 text-sm">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"gap-1 grid grid-cols-2 px-1 text-sm",
			);
		});

		it("should sort flex aspect-square w-full snap-x snap-mandatory overflow-x-scroll scroll-smooth rounded-2xl shadow-lg", () => {
			const content =
				'<div class="flex aspect-square w-full snap-x snap-mandatory overflow-x-scroll scroll-smooth rounded-2xl shadow-lg">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe(
				"aspect-square flex overflow-x-scroll rounded-2xl scroll-smooth shadow-lg snap-mandatory snap-x w-full",
			);
		});

		it("should sort button-pop mx-auto block w-fit", () => {
			const content = '<div class="button-pop mx-auto block w-fit">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);

			expect(diagnostics).toHaveLength(1);
			expect(diagnostics[0].canonical).toBe("block button-pop mx-auto w-fit");
		});

		it("should work with applyFixes", () => {
			const content = '<div class="mt-4 flex bg-red-500">';
			const diagnostics = findUnsortedClasses(
				designSystem,
				content,
				"test.html",
				opts,
			);
			const fixed = applyFixes(content, diagnostics);

			expect(fixed).toBe('<div class="bg-red-500 flex mt-4">');
		});
	});
});
