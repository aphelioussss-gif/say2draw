import type { DrawingAction, ParseSource } from '../domain/actions'
import type { Shape } from '../domain/shapes'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../domain/shapes'

// Safety boundaries
const MAX_TEXT_LENGTH = 50
const MAX_BATCH_SIZE = 10
const MIN_SHAPE_VALUE = 0
const MAX_SHAPE_VALUE_X = CANVAS_WIDTH
const MAX_SHAPE_VALUE_Y = CANVAS_HEIGHT
const MIN_RADIUS = 10
const MAX_RADIUS = 200
const MIN_SIZE = 10
const MAX_SIZE = 400
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 72
const MIN_LINE_WIDTH = 1
const MAX_LINE_WIDTH = 20
const MIN_POLYLINE_POINTS = 2
const MAX_POLYLINE_POINTS = 10
const MIN_POLYGON_POINTS = 3
const MAX_POLYGON_POINTS = 8
const MIN_ANGLE = -360
const MAX_ANGLE = 360
const JITTER_RANGE = 6

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function jitter(value: number): number {
  return value + (Math.random() - 0.5) * JITTER_RANGE
}

function clampCoordinate(value: number, min: number, max: number): number {
  return clamp(jitter(value), min, max)
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color)
}

function validatePoints(
  points: unknown,
  minPoints: number,
  maxPoints: number,
): { x: number; y: number }[] | null {
  if (!Array.isArray(points)) {
    return null
  }

  const validated = points
    .slice(0, maxPoints)
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null
      }

      const p = point as Record<string, unknown>
      if (typeof p.x !== 'number' || typeof p.y !== 'number') {
        return null
      }

      return {
        x: clampCoordinate(p.x, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X),
        y: clampCoordinate(p.y, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y),
      }
    })
    .filter((point): point is { x: number; y: number } => point !== null)

  return validated.length >= minPoints ? validated : null
}

function validateShape(shape: unknown): Shape | null {
  if (!shape || typeof shape !== 'object') {
    return null
  }

  const s = shape as Record<string, unknown>

  if (!s.type || typeof s.type !== 'string') {
    return null
  }

  const id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  switch (s.type) {
    case 'circle': {
      const x = clampCoordinate(typeof s.x === 'number' ? s.x : 400, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y = clampCoordinate(typeof s.y === 'number' ? s.y : 250, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const radius = typeof s.radius === 'number' ? clamp(s.radius, MIN_RADIUS, MAX_RADIUS) : 60
      const fill = typeof s.fill === 'string' && isValidHexColor(s.fill) ? s.fill : '#111827'
      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 4

      return {
        id,
        type: 'circle',
        x,
        y,
        radius,
        fill,
        stroke,
        lineWidth,
      }
    }

    case 'ellipse': {
      const x = clampCoordinate(typeof s.x === 'number' ? s.x : 400, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y = clampCoordinate(typeof s.y === 'number' ? s.y : 250, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const radiusX = typeof s.radiusX === 'number' ? clamp(s.radiusX, MIN_RADIUS, MAX_RADIUS) : 80
      const radiusY = typeof s.radiusY === 'number' ? clamp(s.radiusY, MIN_RADIUS, MAX_RADIUS) : 45
      const fill = typeof s.fill === 'string' && isValidHexColor(s.fill) ? s.fill : '#111827'
      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 4

      return {
        id,
        type: 'ellipse',
        x,
        y,
        radiusX,
        radiusY,
        fill,
        stroke,
        lineWidth,
      }
    }

    case 'rect': {
      const x = clampCoordinate(typeof s.x === 'number' ? s.x : 320, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y = clampCoordinate(typeof s.y === 'number' ? s.y : 190, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const width = typeof s.width === 'number' ? clamp(s.width, MIN_SIZE, MAX_SIZE) : 160
      const height = typeof s.height === 'number' ? clamp(s.height, MIN_SIZE, MAX_SIZE) : 120
      const fill = typeof s.fill === 'string' && isValidHexColor(s.fill) ? s.fill : '#111827'
      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 4

      return {
        id,
        type: 'rect',
        x,
        y,
        width,
        height,
        fill,
        stroke,
        lineWidth,
      }
    }

    case 'line': {
      const x1 = clampCoordinate(typeof s.x1 === 'number' ? s.x1 : 240, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y1 = clampCoordinate(typeof s.y1 === 'number' ? s.y1 : 250, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const x2 = clampCoordinate(typeof s.x2 === 'number' ? s.x2 : 560, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y2 = clampCoordinate(typeof s.y2 === 'number' ? s.y2 : 250, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 6

      return {
        id,
        type: 'line',
        x1,
        y1,
        x2,
        y2,
        stroke,
        lineWidth,
      }
    }

    case 'polyline': {
      const points = validatePoints(s.points, MIN_POLYLINE_POINTS, MAX_POLYLINE_POINTS)
      if (!points) {
        return null
      }

      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 4

      return {
        id,
        type: 'polyline',
        points,
        stroke,
        lineWidth,
      }
    }

    case 'polygon': {
      const points = validatePoints(s.points, MIN_POLYGON_POINTS, MAX_POLYGON_POINTS)
      if (!points) {
        return null
      }

      const fill = typeof s.fill === 'string' && isValidHexColor(s.fill) ? s.fill : '#111827'
      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 4

      return {
        id,
        type: 'polygon',
        points,
        fill,
        stroke,
        lineWidth,
      }
    }

    case 'arc': {
      const x = clampCoordinate(typeof s.x === 'number' ? s.x : 400, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y = clampCoordinate(typeof s.y === 'number' ? s.y : 250, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const radius = typeof s.radius === 'number' ? clamp(s.radius, MIN_RADIUS, MAX_RADIUS) : 60
      const startAngle = typeof s.startAngle === 'number' ? clamp(s.startAngle, MIN_ANGLE, MAX_ANGLE) : 0
      const endAngle = typeof s.endAngle === 'number' ? clamp(s.endAngle, MIN_ANGLE, MAX_ANGLE) : 180
      const stroke = typeof s.stroke === 'string' && isValidHexColor(s.stroke) ? s.stroke : '#111827'
      const lineWidth = typeof s.lineWidth === 'number' ? clamp(s.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH) : 4

      return {
        id,
        type: 'arc',
        x,
        y,
        radius,
        startAngle,
        endAngle,
        stroke,
        lineWidth,
      }
    }

    case 'text': {
      const x = clampCoordinate(typeof s.x === 'number' ? s.x : 400, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X)
      const y = clampCoordinate(typeof s.y === 'number' ? s.y : 250, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y)
      const text = typeof s.text === 'string' ? s.text.slice(0, MAX_TEXT_LENGTH) : ''
      const fontSize = typeof s.fontSize === 'number' ? clamp(s.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE) : 36
      const fill = typeof s.fill === 'string' && isValidHexColor(s.fill) ? s.fill : '#111827'

      if (!text) {
        return null
      }

      return {
        id,
        type: 'text',
        x,
        y,
        text,
        fontSize,
        fill,
      }
    }

    default:
      return null
  }
}

export function validateAction(
  raw: unknown,
  rawText: string,
  createdAt: string,
): DrawingAction | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.type !== 'string') {
    return null
  }

  const parseSource: ParseSource = 'llm'

  switch (obj.type) {
    case 'add_shape': {
      const shape = validateShape(obj.shape)
      if (!shape) {
        return null
      }
      return {
        type: 'add_shape',
        rawText,
        parseSource,
        createdAt,
        shape,
      }
    }

    case 'clear_canvas':
      return {
        type: 'clear_canvas',
        rawText,
        parseSource,
        createdAt,
      }

    case 'undo':
      return {
        type: 'undo',
        rawText,
        parseSource,
        createdAt,
      }

    case 'ask_clarification': {
      const message = typeof obj.clarification === 'string'
        ? obj.clarification.slice(0, 200)
        : '我不太确定你的意思，能再说详细一点吗？'
      return {
        type: 'parse_error',
        rawText,
        parseSource,
        createdAt,
        message,
      }
    }

    default:
      return null
  }
}

export function validateBatchActions(
  raw: unknown,
  rawText: string,
  createdAt: string,
): DrawingAction[] | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const obj = raw as Record<string, unknown>

  if (!Array.isArray(obj.actions)) {
    return null
  }

  const actions = obj.actions.slice(0, MAX_BATCH_SIZE)
  const validated: DrawingAction[] = []

  for (const action of actions) {
    const valid = validateAction(action, rawText, createdAt)
    if (valid) {
      validated.push(valid)
    }
  }

  return validated.length > 0 ? validated : null
}
