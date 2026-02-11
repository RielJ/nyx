# nyx

Tailwind CSS class formatter and linter. Canonicalizes non-standard class names and sorts classes using Tailwind's official ordering.

Built on top of `@tailwindcss/oxide` and the Tailwind v4 design system.

## Install

```bash
npm install -g @rielj/nyx
```

## Usage

### Check (lint + format)

```bash
nyx check src/
nyx check "src/**/*.tsx"
```

### Lint

Find non-canonical Tailwind classes (e.g. `tw-bg-red-500` -> `bg-red-500`):

```bash
nyx lint src/
```

### Format

Sort Tailwind classes in the recommended order:

```bash
nyx format src/
```

### Auto-fix

Add `--fix` to any command to write changes to disk:

```bash
nyx check --fix src/
nyx lint --fix src/
nyx format --fix src/
```

## Options

| Flag | Description |
|---|---|
| `--css <path>` | Path to CSS entry point |
| `--fix` | Auto-fix issues |
| `--strategy <name>` | Sort strategy: `tailwind` (default) or `alphabetical` |
| `--rem <px>` | Root font size in px (default: 16) |
| `--collapse` | Collapse e.g. `mt-2 mr-2 mb-2 ml-2` into `m-2` |
| `--json` | Output diagnostics as JSON |
| `--quiet` | Only show summary |

## Supported file types

`.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `.erb`, `.ejs`, `.hbs`, `.php`, `.blade.php`, `.twig`, `.njk`, `.liquid`, `.pug`, `.slim`, `.haml`, `.mdx`, `.md`, `.rs`, `.ex`, `.heex`, `.clj`, `.cljs`

## License

MIT
