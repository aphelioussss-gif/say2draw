import type { BezierSegment, ControlPoint, RenderedStroke } from './types'

/**
 * Convert a single Bézier segment to SVG path data (the "d" attribute).
 */
function segmentToPathData(segment: BezierSegment): string {
  if (segment.length === 0) return ''

  const [x0, y0] = segment[0]
  let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`

  if (segment.length === 1) {
    // Dot — nothing more needed
  } else if (segment.length === 2) {
    // Line
    const [x1, y1] = segment[1]
    d += ` L ${x1.toFixed(1)} ${y1.toFixed(1)}`
  } else if (segment.length === 3) {
    // Quadratic Bézier
    const [x1, y1] = segment[1]
    const [x2, y2] = segment[2]
    d += ` Q ${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
  } else {
    // Cubic Bézier (4+ control points, use first 4)
    const [x1, y1] = segment[1]
    const [x2, y2] = segment[2]
    const [x3, y3] = segment[3]
    d += ` C ${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} ${x3.toFixed(1)} ${y3.toFixed(1)}`
  }

  return d
}

/**
 * Render a single stroke group to SVG string.
 */
function renderStrokeGroup(stroke: RenderedStroke, index: number, strokeWidth: number): string {
  const paths = stroke.segments
    .map((seg) => {
      const d = segmentToPathData(seg)
      return d ? `<path d="${d}"/>` : ''
    })
    .filter(Boolean)
    .join('\n    ')

  const color = stroke.color || '#111827'
  const label = stroke.label && stroke.labelPoint
    ? `<text x="${stroke.labelPoint[0].toFixed(1)}" y="${stroke.labelPoint[1].toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="#111827" stroke="none" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="18" font-weight="650">${escapeSvgText(stroke.label)}</text>`
    : ''

  return `<g id="s${index + 1}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
    ${paths}
    ${label}
  </g>`
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Render an array of fitted strokes into a complete SVG string.
 */
export function renderStrokesToSVG(
  strokes: RenderedStroke[],
  config: { width: number; height: number; strokeWidth?: number },
): string {
  const { width, height, strokeWidth = 2.35 } = config

  const groups = strokes
    .map((s, i) => renderStrokeGroup(s, i, strokeWidth))
    .join('\n')

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="sketch-layer" style="overflow:hidden">
${groups}
</svg>`
}

/**
 * Convenience: grid coordinate → pixel coordinate.
 * Maps (gridX, gridY) from 1..gridRes to pixel space.
 * gridY=1 maps to bottom (max pixel y), gridY=gridRes maps to top (y=0).
 */
export function gridToPixel(
  gridX: number,
  gridY: number,
  gridRes: number,
  canvasWidth: number,
  canvasHeight: number,
): ControlPoint {
  const px = ((gridX - 0.5) / gridRes) * canvasWidth
  const py = canvasHeight - ((gridY - 0.5) / gridRes) * canvasHeight
  return [px, py]
}
