import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCache, createNoopCache } from "../src/cache.js";

describe("createNoopCache", () => {
	it("isFileCached always returns false", () => {
		const cache = createNoopCache();
		expect(cache.isFileCached("/any/path")).toBe(false);
	});

	it("methods do not throw", () => {
		const cache = createNoopCache();
		expect(() => cache.markClean("/any/path")).not.toThrow();
		expect(() => cache.markDirty("/any/path")).not.toThrow();
		expect(() => cache.write()).not.toThrow();
	});
});

describe("createCache", () => {
	let tmpDir: string;
	let testFile: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nyx-cache-test-"));
		// Create node_modules so cache dir can be created inside
		fs.mkdirSync(path.join(tmpDir, "node_modules"), { recursive: true });
		// Create a test file
		testFile = path.join(tmpDir, "test.tsx");
		fs.writeFileSync(testFile, '<div class="flex mt-4">', "utf-8");
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const opts = (overrides?: { version?: string; configHash?: string }) => ({
		base: tmpDir,
		version: "0.0.3",
		configHash: "abc123",
		...overrides,
	});

	it("starts fresh when no existing cache", () => {
		const cache = createCache(opts());
		expect(cache.isFileCached(testFile)).toBe(false);
	});

	it("marks file as clean and detects cache hit", () => {
		const cache = createCache(opts());
		cache.markClean(testFile);
		expect(cache.isFileCached(testFile)).toBe(true);
	});

	it("detects mtime change as cache miss", () => {
		const cache = createCache(opts());
		cache.markClean(testFile);

		// Modify the file (changes mtime and possibly size)
		const originalMtime = fs.statSync(testFile).mtimeMs;
		// Force a different mtime by writing new content
		fs.writeFileSync(testFile, '<div class="flex mt-4 bg-red-500">', "utf-8");
		// Ensure mtime actually changed (file system granularity)
		const newStat = fs.statSync(testFile);
		if (newStat.mtimeMs === originalMtime) {
			// Skip this assertion if filesystem doesn't have enough granularity
			return;
		}

		expect(cache.isFileCached(testFile)).toBe(false);
	});

	it("detects size change as cache miss", () => {
		const cache = createCache(opts());
		cache.markClean(testFile);

		// Write different-sized content
		fs.writeFileSync(
			testFile,
			'<div class="flex mt-4 bg-red-500 text-white p-4">',
			"utf-8",
		);

		expect(cache.isFileCached(testFile)).toBe(false);
	});

	it("persists cache to disk and reloads", () => {
		const cache1 = createCache(opts());
		cache1.markClean(testFile);
		cache1.write();

		// New cache instance should pick up persisted data
		const cache2 = createCache(opts());
		expect(cache2.isFileCached(testFile)).toBe(true);
	});

	it("discards cache on version mismatch", () => {
		const cache1 = createCache(opts());
		cache1.markClean(testFile);
		cache1.write();

		const cache2 = createCache(opts({ version: "0.0.4" }));
		expect(cache2.isFileCached(testFile)).toBe(false);
	});

	it("discards cache on configHash mismatch", () => {
		const cache1 = createCache(opts());
		cache1.markClean(testFile);
		cache1.write();

		const cache2 = createCache(opts({ configHash: "different" }));
		expect(cache2.isFileCached(testFile)).toBe(false);
	});

	it("handles corrupted JSON gracefully", () => {
		const cacheDir = path.join(tmpDir, "node_modules/.cache/nyx");
		fs.mkdirSync(cacheDir, { recursive: true });
		fs.writeFileSync(
			path.join(cacheDir, "cache.json"),
			"{ corrupted }",
			"utf-8",
		);

		const cache = createCache(opts());
		expect(cache.isFileCached(testFile)).toBe(false);
	});

	it("handles deleted file as cache miss", () => {
		const cache = createCache(opts());
		cache.markClean(testFile);

		fs.unlinkSync(testFile);
		expect(cache.isFileCached(testFile)).toBe(false);
	});

	it("markDirty removes file from cache", () => {
		const cache = createCache(opts());
		cache.markClean(testFile);
		expect(cache.isFileCached(testFile)).toBe(true);

		cache.markDirty(testFile);
		expect(cache.isFileCached(testFile)).toBe(false);
	});

	it("write creates cache directory if missing", () => {
		const cache = createCache(opts());
		cache.markClean(testFile);
		cache.write();

		const cachePath = path.join(tmpDir, "node_modules/.cache/nyx/cache.json");
		expect(fs.existsSync(cachePath)).toBe(true);
	});
});
