import { Scanner } from '@tailwindcss/oxide'

export interface CandidateWithPosition {
  rawCandidate: string
  start: number
  end: number
}

export function extractCandidatesWithPositions(
  content: string,
  extension: string = 'html',
): CandidateWithPosition[] {
  const scanner = new Scanner({})
  const result = scanner.getCandidatesWithPositions({ content, extension })

  const candidates: CandidateWithPosition[] = []
  for (const { candidate: rawCandidate, position: start } of result) {
    candidates.push({ rawCandidate, start, end: start + rawCandidate.length })
  }
  return candidates
}

export interface SourceEntry {
  base: string
  pattern: string
  negated: boolean
}

export function createScanner(sources: SourceEntry[]) {
  const scanner = new Scanner({ sources })
  return {
    get files(): string[] {
      return scanner.files
    },
    extractCandidatesWithPositions(content: string, extension: string) {
      return extractCandidatesWithPositions(content, extension)
    },
  }
}
