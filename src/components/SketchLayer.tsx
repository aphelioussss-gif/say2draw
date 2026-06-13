import type { RenderedStroke } from '../sketch/types'
import { renderStrokesToSVG } from '../sketch/svgRenderer'

type SketchLayerProps = {
  strokes: RenderedStroke[]
  width: number
  height: number
}

export function SketchLayer({ strokes, width, height }: SketchLayerProps) {
  if (strokes.length === 0) return null

  const svgString = renderStrokesToSVG(strokes, { width, height })

  return (
    <div
      className="sketch-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 10,
      }}
      aria-label="Sketch stroke layer"
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}
