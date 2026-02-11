import fs from 'node:fs'
import path from 'node:path'
import { defineCommand, runMain } from 'citty'
import pc from 'picocolors'
import { findNonCanonicalClasses, type Diagnostic } from './canonicalize.js'
import { loadDesignSystem } from './design-system.js'
import { applyFixes } from './fixer.js'
import { formatDiagnostics } from './reporter.js'
import { createScanner } from './scanner.js'
import { findUnsortedClasses, type SortStrategy } from './sorter.js'

const EXTENSIONS = new Set([
  'html', 'htm', 'jsx', 'tsx', 'vue', 'svelte', 'astro',
  'erb', 'ejs', 'hbs', 'handlebars', 'php', 'blade.php',
  'twig', 'njk', 'liquid', 'pug', 'slim', 'haml',
  'mdx', 'md', 'rs', 'ex', 'heex', 'clj', 'cljs',
])

function getExtension(filePath: string): string {
  const base = path.basename(filePath)
  // Handle compound extensions like .blade.php
  const parts = base.split('.')
  if (parts.length > 2) {
    return parts.slice(-2).join('.')
  }
  return parts.pop() || 'html'
}

function isTemplateFile(filePath: string): boolean {
  if (filePath.endsWith('.css')) return false
  const ext = getExtension(filePath)
  return EXTENSIONS.has(ext)
}

const format = defineCommand({
  meta: { name: 'format', description: 'Sort Tailwind CSS classes' },
  args: {
    css: { type: 'string', description: 'Path to CSS entry point' },
    strategy: { type: 'string', description: 'Sort strategy: tailwind or alphabetical (default: tailwind)' },
    fix: { type: 'boolean', description: 'Auto-fix issues', default: false },
    json: { type: 'boolean', description: 'Output diagnostics as JSON', default: false },
    quiet: { type: 'boolean', description: 'Only show summary', default: false },
  },
  run: async ({ args, rawArgs }) => {
    const paths = rawArgs.filter((a) => !a.startsWith('-'))
    await run(paths, args, ['format'])
  },
})

const lint = defineCommand({
  meta: { name: 'lint', description: 'Check for non-canonical Tailwind CSS classes' },
  args: {
    css: { type: 'string', description: 'Path to CSS entry point' },
    rem: { type: 'string', description: 'Root font size in px (default: 16)' },
    collapse: { type: 'boolean', description: 'Collapse e.g. mt-2 mr-2 mb-2 ml-2 → m-2', default: false },
    fix: { type: 'boolean', description: 'Auto-fix issues', default: false },
    json: { type: 'boolean', description: 'Output diagnostics as JSON', default: false },
    quiet: { type: 'boolean', description: 'Only show summary', default: false },
  },
  run: async ({ args, rawArgs }) => {
    const paths = rawArgs.filter((a) => !a.startsWith('-'))
    await run(paths, args, ['lint'])
  },
})

const check = defineCommand({
  meta: { name: 'check', description: 'Run format and lint checks' },
  args: {
    css: { type: 'string', description: 'Path to CSS entry point' },
    strategy: { type: 'string', description: 'Sort strategy: tailwind or alphabetical (default: tailwind)' },
    rem: { type: 'string', description: 'Root font size in px (default: 16)' },
    collapse: { type: 'boolean', description: 'Collapse e.g. mt-2 mr-2 mb-2 ml-2 → m-2', default: false },
    fix: { type: 'boolean', description: 'Auto-fix issues', default: false },
    json: { type: 'boolean', description: 'Output diagnostics as JSON', default: false },
    quiet: { type: 'boolean', description: 'Only show summary', default: false },
  },
  run: async ({ args, rawArgs }) => {
    const paths = rawArgs.filter((a) => !a.startsWith('-'))
    await run(paths, args, ['format', 'lint'])
  },
})

const main = defineCommand({
  meta: {
    name: 'nyx',
    version: '0.1.0',
    description: 'Tailwind CSS class formatter and linter',
  },
  subCommands: { format, lint, check },
})

async function run(
  paths: string[],
  args: {
    css?: string
    strategy?: string
    rem?: string
    collapse?: boolean
    fix?: boolean
    json?: boolean
    quiet?: boolean
  },
  kinds: ('format' | 'lint')[],
) {
  const base = process.cwd()
  const remValue = args.rem ? Number(args.rem) : 16
  const mode = args.fix ? 'fix' : 'check'
  const strategy = (args.strategy as SortStrategy) ?? 'tailwind'

  // Load design system
  let designSystem
  try {
    designSystem = await loadDesignSystem({ base, css: args.css })
  } catch (err) {
    console.error(pc.red((err as Error).message))
    process.exit(1)
  }

  // Discover files
  const filesToProcess = discoverFiles(base, paths)

  if (filesToProcess.length === 0) {
    console.error(pc.yellow('No template files found to process.'))
    process.exit(0)
  }

  // Process files for each kind (format first, then lint on potentially fixed content)
  let hasIssues = false

  for (const kind of kinds) {
    const diagnosticsByFile = new Map<string, Diagnostic[]>()
    let totalDiagnostics = 0

    for (const filePath of filesToProcess) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const ext = getExtension(filePath)
      const relativePath = path.relative(base, filePath)

      const diagnostics = kind === 'format'
        ? findUnsortedClasses(designSystem, content, relativePath, { strategy })
        : findNonCanonicalClasses(designSystem, content, ext, relativePath, {
            rem: remValue,
            collapse: args.collapse,
          })

      if (diagnostics.length > 0) {
        if (args.fix) {
          const fixed = applyFixes(content, diagnostics)
          fs.writeFileSync(filePath, fixed, 'utf-8')
        }
        diagnosticsByFile.set(relativePath, diagnostics)
        totalDiagnostics += diagnostics.length
      }
    }

    // Report
    const output = formatDiagnostics(diagnosticsByFile, {
      mode,
      kind,
      json: args.json,
      quiet: args.quiet,
    })

    if (output) {
      console.log(output)
    }

    if (totalDiagnostics === 0) {
      if (!args.quiet && !args.json) {
        const msg = kind === 'format'
          ? 'All classes are properly sorted.'
          : 'No non-canonical classes found.'
        console.log(pc.green(msg))
      }
    }

    if (totalDiagnostics > 0) {
      hasIssues = true
    }
  }

  // Exit with code 1 in check mode when issues found (for CI)
  if (!args.fix && hasIssues) {
    process.exit(1)
  }
}

function discoverFiles(base: string, paths: string[]): string[] {
  if (paths.length > 0) {
    // Explicit paths provided — expand directories
    const files: string[] = []
    for (const p of paths) {
      const resolved = path.resolve(base, p)
      if (fs.statSync(resolved).isDirectory()) {
        files.push(...walkDir(resolved))
      } else if (isTemplateFile(resolved)) {
        files.push(resolved)
      }
    }
    return files
  }

  // Use oxide Scanner to discover files
  const scanner = createScanner([
    { base, pattern: '**/*', negated: false },
  ])

  return scanner.files.filter((f) => !f.endsWith('.css') && isTemplateFile(f))
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      files.push(...walkDir(fullPath))
    } else if (isTemplateFile(fullPath)) {
      files.push(fullPath)
    }
  }
  return files
}

runMain(main)
