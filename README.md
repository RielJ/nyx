# nyx

Tailwind CSS class formatter and linter. Canonicalizes non-standard class names and sorts classes using Tailwind's official ordering.

Built on top of `@tailwindcss/oxide` and the Tailwind v4 design system.

## Install

```bash
npm install -g @rielj/nyx
```

## Quick start

```bash
nyx init        # scaffold nyx.config.json
nyx check src/  # lint + format check
nyx check --fix src/  # auto-fix
```

## Commands

### `nyx init`

Create a `nyx.config.json` in the current directory with default settings:

```bash
nyx init
```

### `nyx check`

Run both lint and format checks:

```bash
nyx check src/
nyx check --fix src/
```

### `nyx lint`

Find non-canonical Tailwind classes (e.g. `tw-bg-red-500` -> `bg-red-500`):

```bash
nyx lint src/
nyx lint --fix src/
```

### `nyx format`

Sort Tailwind classes in the recommended order:

```bash
nyx format src/
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
| `--cache` | Enable file-level caching to skip unchanged files |
| `--json` | Output diagnostics as JSON |
| `--quiet` | Only show summary |
| `--verbose` | Show full diagnostics in fix mode |

## Config file

Create a `nyx.config.json` in your project root (or run `nyx init`):

```json
{
  "$schema": "./node_modules/@rielj/nyx/schema.json",
  "rem": 16,
  "collapse": false,
  "strategy": "tailwind"
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `css` | `string` | auto-detect | Path to CSS entry point |
| `rem` | `number` | `16` | Root font size in px |
| `collapse` | `boolean` | `false` | Collapse longhand utilities into shorthand |
| `strategy` | `"tailwind" \| "alphabetical"` | `"tailwind"` | Class sort strategy |
| `cache` | `boolean` | auto | Enable file-level caching (on by default when nyx is locally installed) |

CLI flags override config file values.

## Supported file types

`.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `.erb`, `.ejs`, `.hbs`, `.php`, `.blade.php`, `.twig`, `.njk`, `.liquid`, `.pug`, `.slim`, `.haml`, `.mdx`, `.md`, `.rs`, `.ex`, `.heex`, `.clj`, `.cljs`

## License

MIT
