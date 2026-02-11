import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	hashConfig,
	loadConfigFile,
	type ResolvedConfig,
	resolveConfig,
} from "../src/config.js";

describe("loadConfigFile", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nyx-config-test-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns null when no config file exists", () => {
		expect(loadConfigFile(tmpDir)).toBeNull();
	});

	it("returns parsed config when file exists", () => {
		fs.writeFileSync(
			path.join(tmpDir, "nyx.config.json"),
			JSON.stringify({ rem: 14, collapse: true }),
		);
		const result = loadConfigFile(tmpDir);
		expect(result).toEqual({ rem: 14, collapse: true });
	});

	it("throws on invalid JSON", () => {
		fs.writeFileSync(path.join(tmpDir, "nyx.config.json"), "{ bad json }");
		expect(() => loadConfigFile(tmpDir)).toThrow();
	});
});

describe("resolveConfig", () => {
	const emptyCli = {};
	const emptyRawArgs: string[] = [];

	it("uses defaults when no config or CLI args", () => {
		const config = resolveConfig(emptyCli, null, emptyRawArgs);
		expect(config.rem).toBe(16);
		expect(config.collapse).toBe(false);
		expect(config.strategy).toBe("tailwind");
		expect(config.cache).toBe(false);
		expect(config.fix).toBe(false);
		expect(config.json).toBe(false);
		expect(config.quiet).toBe(false);
		expect(config.verbose).toBe(false);
	});

	it("applies config file values over defaults", () => {
		const configFile = {
			rem: 14,
			collapse: true,
			strategy: "alphabetical" as const,
		};
		const config = resolveConfig(emptyCli, configFile, emptyRawArgs);
		expect(config.rem).toBe(14);
		expect(config.collapse).toBe(true);
		expect(config.strategy).toBe("alphabetical");
	});

	it("CLI args override config file values", () => {
		const configFile = { rem: 14, collapse: true };
		const cliArgs = { rem: "20", collapse: false };
		const config = resolveConfig(cliArgs, configFile, emptyRawArgs);
		expect(config.rem).toBe(20);
		expect(config.collapse).toBe(false);
	});

	it("--no-cache overrides config cache: true", () => {
		const configFile = { cache: true };
		const cliArgs = {};
		const rawArgs = ["--no-cache", "src/"];
		const config = resolveConfig(cliArgs, configFile, rawArgs);
		expect(config.cache).toBe(false);
	});

	it("config cache: true is preserved when --no-cache not present", () => {
		const configFile = { cache: true };
		const config = resolveConfig(emptyCli, configFile, emptyRawArgs);
		expect(config.cache).toBe(true);
	});

	it("CLI --cache flag enables cache", () => {
		const config = resolveConfig({ cache: true }, null, emptyRawArgs);
		expect(config.cache).toBe(true);
	});
});

describe("hashConfig", () => {
	const baseConfig: ResolvedConfig = {
		rem: 16,
		collapse: false,
		strategy: "tailwind",
		cache: false,
		fix: false,
		json: false,
		quiet: false,
		verbose: false,
	};

	it("is deterministic", () => {
		const hash1 = hashConfig(baseConfig, '@import "tailwindcss";');
		const hash2 = hashConfig(baseConfig, '@import "tailwindcss";');
		expect(hash1).toBe(hash2);
	});

	it("returns 16 character hex string", () => {
		const hash = hashConfig(baseConfig, '@import "tailwindcss";');
		expect(hash).toMatch(/^[a-f0-9]{16}$/);
	});

	it("different rem values produce different hashes", () => {
		const hash1 = hashConfig(baseConfig, '@import "tailwindcss";');
		const hash2 = hashConfig(
			{ ...baseConfig, rem: 14 },
			'@import "tailwindcss";',
		);
		expect(hash1).not.toBe(hash2);
	});

	it("different CSS content produces different hashes", () => {
		const hash1 = hashConfig(baseConfig, '@import "tailwindcss";');
		const hash2 = hashConfig(baseConfig, '@import "tailwindcss"; @theme {}');
		expect(hash1).not.toBe(hash2);
	});

	it("different strategy produces different hashes", () => {
		const hash1 = hashConfig(baseConfig, '@import "tailwindcss";');
		const hash2 = hashConfig(
			{ ...baseConfig, strategy: "alphabetical" },
			'@import "tailwindcss";',
		);
		expect(hash1).not.toBe(hash2);
	});

	it("non-output-affecting options do not affect hash", () => {
		const hash1 = hashConfig(baseConfig, '@import "tailwindcss";');
		const hash2 = hashConfig(
			{ ...baseConfig, fix: true, json: true, quiet: true },
			'@import "tailwindcss";',
		);
		expect(hash1).toBe(hash2);
	});
});
