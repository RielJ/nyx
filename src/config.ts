import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface NyxConfigFile {
	css?: string;
	rem?: number;
	collapse?: boolean;
	strategy?: "tailwind" | "alphabetical";
	cache?: boolean;
}

export interface ResolvedConfig {
	css?: string;
	rem: number;
	collapse: boolean;
	strategy: "tailwind" | "alphabetical";
	cache: boolean;
	fix: boolean;
	json: boolean;
	quiet: boolean;
	verbose: boolean;
}

const CONFIG_FILENAME = "nyx.config.json";

export function loadConfigFile(base: string): NyxConfigFile | null {
	const configPath = path.join(base, CONFIG_FILENAME);
	if (!fs.existsSync(configPath)) return null;

	const raw = fs.readFileSync(configPath, "utf-8");
	return JSON.parse(raw) as NyxConfigFile;
}

export function resolveConfig(
	cliArgs: {
		css?: string;
		rem?: string;
		collapse?: boolean;
		strategy?: string;
		fix?: boolean;
		json?: boolean;
		quiet?: boolean;
		verbose?: boolean;
		cache?: boolean;
	},
	configFile: NyxConfigFile | null,
	rawArgs: string[],
): ResolvedConfig {
	const hasExplicitNoCache = rawArgs.includes("--no-cache");

	const defaults: ResolvedConfig = {
		css: undefined,
		rem: 16,
		collapse: false,
		strategy: "tailwind",
		cache: false,
		fix: false,
		json: false,
		quiet: false,
		verbose: false,
	};

	// Layer: defaults < config < CLI
	const config: ResolvedConfig = { ...defaults };

	// Apply config file values
	if (configFile) {
		if (configFile.css !== undefined) config.css = configFile.css;
		if (configFile.rem !== undefined) config.rem = configFile.rem;
		if (configFile.collapse !== undefined)
			config.collapse = configFile.collapse;
		if (configFile.strategy !== undefined)
			config.strategy = configFile.strategy;
		if (configFile.cache !== undefined) config.cache = configFile.cache;
	}

	// Apply CLI args (only override if explicitly provided)
	if (cliArgs.css !== undefined) config.css = cliArgs.css;
	if (cliArgs.rem !== undefined) config.rem = Number(cliArgs.rem);
	if (cliArgs.collapse !== undefined) config.collapse = cliArgs.collapse;
	if (cliArgs.strategy !== undefined)
		config.strategy = cliArgs.strategy as ResolvedConfig["strategy"];
	if (cliArgs.fix !== undefined) config.fix = cliArgs.fix;
	if (cliArgs.json !== undefined) config.json = cliArgs.json;
	if (cliArgs.quiet !== undefined) config.quiet = cliArgs.quiet;
	if (cliArgs.verbose !== undefined) config.verbose = cliArgs.verbose;
	if (cliArgs.cache !== undefined) config.cache = cliArgs.cache;

	// --no-cache explicitly overrides config
	if (hasExplicitNoCache) config.cache = false;

	return config;
}

export function hashConfig(config: ResolvedConfig, cssContent: string): string {
	const data =
		JSON.stringify({
			css: config.css,
			rem: config.rem,
			collapse: config.collapse,
			strategy: config.strategy,
		}) + cssContent;

	return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}
