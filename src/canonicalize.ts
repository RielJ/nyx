import type { DesignSystem } from './design-system.js'
import { extractCandidatesWithPositions } from './scanner.js'

export interface CanonicalizeOptions {
  rem?: number
  collapse?: boolean
}

export interface Diagnostic {
  file: string
  line: number
  column: number
  offset: number
  length: number
  original: string
  canonical: string
  lineContent: string
}

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

export function findNonCanonicalClasses(
  designSystem: DesignSystem,
  content: string,
  extension: string,
  filePath: string,
  options: CanonicalizeOptions = {},
): Diagnostic[] {
  const candidates = extractCandidatesWithPositions(content, extension)
  const diagnostics: Diagnostic[] = []

  for (const { rawCandidate, start } of candidates) {
    const [canonical] = designSystem.canonicalizeCandidates([rawCandidate], {
      rem: options.rem,
      collapse: false,
    })

    if (canonical && canonical !== rawCandidate) {
      const { line, column } = offsetToLineColumn(content, start)
      diagnostics.push({
        file: filePath,
        line,
        column,
        offset: start,
        length: rawCandidate.length,
        original: rawCandidate,
        canonical,
        lineContent: getLineContent(content, start),
      })
    }
  }

  return diagnostics
}
