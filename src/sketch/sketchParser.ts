import type { RawStroke, SketchOutput } from './types'

/**
 * Parse the LLM text output to extract <strokes> XML content.
 *
 * Handles potential issues:
 * - Markdown code fences
 * - Missing <answer> wrapper
 * - Coordinate values outside grid range
 * - Format inconsistencies
 */
export function parseSketchXML(llmOutput: string, gridRes: number): SketchOutput | null {
  let text = llmOutput

  // Strip markdown code fences
  text = text.replace(/```(?:xml)?\s*/gi, '').replace(/```/g, '')

  // Extract <strokes>...</strokes> block
  const strokesMatch = text.match(/<strokes>([\s\S]*?)<\/strokes>/)
  if (!strokesMatch) {
    console.warn('[sketchParser] No <strokes> block found in LLM output')
    return null
  }

  const strokesXML = strokesMatch[0]

  // Extract concept if present
  const conceptMatch = text.match(/<concept>([\s\S]*?)<\/concept>/)
  const concept = conceptMatch?.[1]?.trim() || 'sketch'

  // Parse individual strokes
  const strokes: RawStroke[] = []
  const strokeRegex = /<s(\d+)>([\s\S]*?)<\/s\1>/g

  let match: RegExpExecArray | null
  while ((match = strokeRegex.exec(strokesXML)) !== null) {
    const strokeContent = match[2]

    const pointsMatch = strokeContent.match(/<points>([\s\S]*?)<\/points>/)
    const tValuesMatch = strokeContent.match(/<t_values>([\s\S]*?)<\/t_values>/)
    const idMatch = strokeContent.match(/<id>([\s\S]*?)<\/id>/)

    if (!pointsMatch) continue

    // Parse points string: 'x13y27', 'x24y27', ...
    const pointsStr = pointsMatch[1]
    const points: string[] = []
    const pointRegex = /x(\d+)y(\d+)/g
    let pm: RegExpExecArray | null
    while ((pm = pointRegex.exec(pointsStr)) !== null) {
      const x = clampCoordinate(parseInt(pm[1], 10), gridRes)
      const y = clampCoordinate(parseInt(pm[2], 10), gridRes)
      points.push(`x${x}y${y}`)
    }

    if (points.length === 0) continue

    // Parse t_values
    let tValues: number[] = []
    if (tValuesMatch) {
      tValues = tValuesMatch[1]
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 1)
    }

    // If t_values are missing or wrong count, generate evenly spaced
    if (tValues.length !== points.length) {
      tValues = Array.from({ length: points.length }, (_, i) =>
        points.length === 1 ? 0 : i / (points.length - 1),
      )
    }

    strokes.push({
      points,
      tValues,
      id: idMatch?.[1]?.trim(),
    })
  }

  if (strokes.length === 0) {
    console.warn('[sketchParser] No strokes found in LLM output')
    return null
  }

  return { concept, strokes }
}

function clampCoordinate(value: number, max: number): number {
  return Math.max(1, Math.min(value, max))
}
