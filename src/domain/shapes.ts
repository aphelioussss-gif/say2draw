export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 500

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

export type PolygonPoint = {
  x: number
  y: number
}

export type PolygonShape = ShapeBase & {
  type: 'polygon'
  points: PolygonPoint[]
}

export type TextShape = ShapeBase & {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize?: number
  align?: CanvasTextAlign
}

export type Shape = CircleShape | EllipseShape | RectShape | LineShape | PolygonShape | TextShape
