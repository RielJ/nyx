import type { DesignSystem } from './design-system.js'
import type { Diagnostic } from './canonicalize.js'

export type SortStrategy = 'tailwind' | 'alphabetical'

export interface SortOptions {
  strategy?: SortStrategy
}

const CLASS_ATTR_RE = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function offsetToLineColumn(content: string, offset: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

function getLineContent(content: string, offset: number): string {
  let start = offset
  while (start > 0 && content[start - 1] !== '\n') {
    start--
  }
  let end = offset
  while (end < content.length && content[end] !== '\n') {
    end++
  }
  return content.slice(start, end)
}

export function findUnsortedClasses(
  designSystem: DesignSystem,
  content: string,
  filePath: string,
  options: SortOptions = {},
): Diagnostic[] {
  const strategy = options.strategy ?? 'tailwind'
  const diagnostics: Diagnostic[] = []

  CLASS_ATTR_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = CLASS_ATTR_RE.exec(content)) !== null) {
    const classValue = match[1] ?? match[2]
    if (!classValue) continue

    const quoteChar = match[1] !== undefined ? '"' : "'"
    const valueOffset = match.index + match[0].indexOf(quoteChar) + 1

    const classes = classValue.split(/\s+/).filter(Boolean)
    if (classes.length <= 1) continue

    const sorted = strategy === 'alphabetical'
      ? sortAlphabetical(classes)
      : sortTailwind(designSystem, classes)
    const sortedValue = sorted.join(' ')
    const originalValue = classes.join(' ')

    if (sortedValue !== originalValue) {
      const { line, column } = offsetToLineColumn(content, valueOffset)
      diagnostics.push({
        file: filePath,
        line,
        column,
        offset: valueOffset,
        length: classValue.length,
        original: classValue,
        canonical: sortedValue,
        lineContent: getLineContent(content, valueOffset),
      })
    }
  }

  return diagnostics
}

function sortAlphabetical(classes: string[]): string[] {
  return [...classes].sort((a, b) => a.localeCompare(b))
}

function sortTailwind(designSystem: DesignSystem, classes: string[]): string[] {
  const ordered = designSystem.getClassOrder(classes)

  const unknown: string[] = []
  const known: [string, bigint][] = []

  for (const [cls, order] of ordered) {
    if (order === null) {
      unknown.push(cls)
    } else {
      known.push([cls, order])
    }
  }

  known.sort((a, b) => {
    if (a[1] < b[1]) return -1
    if (a[1] > b[1]) return 1
    return 0
  })

  return [...unknown, ...known.map(([cls]) => cls)]
}
