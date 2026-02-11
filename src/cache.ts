import fs from "node:fs";
import path from "node:path";

export interface CacheFileEntry {
	mtimeMs: number;
	size: number;
}

export interface CacheData {
	version: string;
	configHash: string;
	files: Record<string, CacheFileEntry>;
}

export interface CacheManager {
	isFileCached(absolutePath: string): boolean;
	markClean(absolutePath: string): void;
	markDirty(absolutePath: string): void;
	write(): void;
}

const CACHE_DIR = "node_modules/.cache/nyx";
const CACHE_FILE = "cache.json";

export function createCache(options: {
	base: string;
	version: string;
	configHash: string;
}): CacheManager {
	const cacheDir = path.join(options.base, CACHE_DIR);
	const cachePath = path.join(cacheDir, CACHE_FILE);

	let data: CacheData = {
		version: options.version,
		configHash: options.configHash,
		files: {},
	};

	// Try to load existing cache
	try {
		if (fs.existsSync(cachePath)) {
			const raw = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as CacheData;
			if (
				raw.version === options.version &&
				raw.configHash === options.configHash
			) {
				data = raw;
			} else {
				// Version or config changed — start fresh
				data.files = {};
			}
		}
	} catch {
		// Corrupted cache — start fresh
		data.files = {};
	}

	return {
		isFileCached(absolutePath: string): boolean {
			const entry = data.files[absolutePath];
			if (!entry) return false;

			try {
				const stat = fs.statSync(absolutePath);
				return stat.mtimeMs === entry.mtimeMs && stat.size === entry.size;
			} catch {
				// File was deleted
				return false;
			}
		},

		markClean(absolutePath: string): void {
			try {
				const stat = fs.statSync(absolutePath);
				data.files[absolutePath] = {
					mtimeMs: stat.mtimeMs,
					size: stat.size,
				};
			} catch {
				// File gone — skip
			}
		},

		markDirty(absolutePath: string): void {
			delete data.files[absolutePath];
		},

		write(): void {
			try {
				fs.mkdirSync(cacheDir, { recursive: true });
				fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
			} catch {
				// Best-effort — don't crash the CLI over cache writes
			}
		},
	};
}

export function createNoopCache(): CacheManager {
	return {
		isFileCached(): boolean {
			return false;
		},
		markClean(): void {},
		markDirty(): void {},
		write(): void {},
	};
}
