export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 500

/** 9-zone spatial layout. Each zone provides a default center point in pixels. */
export const CANVAS_ZONES: Record<string, { cx: number; cy: number }> = {
  center:       { cx: 400, cy: 250 },
  top:          { cx: 400, cy: 380 },
  bottom:       { cx: 400, cy: 120 },
  left:         { cx: 150, cy: 250 },
  right:        { cx: 650, cy: 250 },
  topLeft:      { cx: 150, cy: 380 },
  topRight:     { cx: 650, cy: 380 },
  bottomLeft:   { cx: 150, cy: 120 },
  bottomRight:  { cx: 650, cy: 120 },
}

export type CanvasZone = keyof typeof CANVAS_ZONES

type ShapeBase = {
  id: string
  stroke?: string
  fill?: string
  lineWidth?: number
}

export type CircleShape = ShapeBase & {
  type: 'circle'
  x: number
  y: number
  radius: number
}

export type EllipseShape = ShapeBase & {
  type: 'ellipse'
  x: number
  y: number
  radiusX: number
  radiusY: number
}

export type RectShape = ShapeBase & {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export type LineShape = ShapeBase & {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export type PolylinePoint = {
  x: number
  y: number
}

export type PolylineShape = ShapeBase & {
  type: 'polyline'
  points: PolylinePoint[]
}

export type PolygonPoint = {
  x: number
  y: number
}

export type PolygonShape = ShapeBase & {
  type: 'polygon'
  points: PolygonPoint[]
}

export type ArcShape = ShapeBase & {
  type: 'arc'
  x: number
  y: number
  radius: number
  startAngle: number
  endAngle: number
}

export type TextShape = ShapeBase & {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize?: number
  align?: CanvasTextAlign
}

export type Shape =
  | CircleShape
  | EllipseShape
  | RectShape
  | LineShape
  | PolylineShape
  | PolygonShape
  | ArcShape
  | TextShape
