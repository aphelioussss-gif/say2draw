/** LLM raw output for a single stroke */
export type RawStroke = {
  points: string[]   // ['x13y27', 'x24y27', ...]
  tValues: number[]  // [0.0, 0.3, 0.5, 1.0]
  id?: string        // semantic label ("head", "left ear", etc.)
  color?: string     // hex color from six-color palette, defaults to #111827
  label?: string     // optional text rendered near this stroke, useful for diagrams
  labelPoint?: string // grid coordinate for the label anchor
}

/** Parsed sketch from LLM XML output */
export type SketchOutput = {
  concept: string
  strokes: RawStroke[]
}

/** A 2D control point after Bézier fitting */
export type ControlPoint = [number, number]

/** One Bézier segment: 1-4 control points (dot/line/quadratic/cubic) */
export type BezierSegment = ControlPoint[]

/** A fully processed stroke ready for SVG rendering */
export type RenderedStroke = {
  id: string
  segments: BezierSegment[]
  color: string
  label?: string
  labelPoint?: ControlPoint
}

/** Grid configuration for coordinate mapping */
export type GridConfig = {
  gridRes: number       // grid cells per axis (50)
  canvasWidth: number   // pixel width of target canvas
  canvasHeight: number  // pixel height of target canvas
}
