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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color)
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
      const x = typeof s.x === 'number' ? clamp(s.x, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X) : 400
      const y = typeof s.y === 'number' ? clamp(s.y, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y) : 250
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

    case 'rect': {
      const x = typeof s.x === 'number' ? clamp(s.x, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X) : 320
      const y = typeof s.y === 'number' ? clamp(s.y, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y) : 190
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
      const x1 = typeof s.x1 === 'number' ? clamp(s.x1, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X) : 240
      const y1 = typeof s.y1 === 'number' ? clamp(s.y1, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y) : 250
      const x2 = typeof s.x2 === 'number' ? clamp(s.x2, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X) : 560
      const y2 = typeof s.y2 === 'number' ? clamp(s.y2, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y) : 250
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

    case 'text': {
      const x = typeof s.x === 'number' ? clamp(s.x, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_X) : 400
      const y = typeof s.y === 'number' ? clamp(s.y, MIN_SHAPE_VALUE, MAX_SHAPE_VALUE_Y) : 250
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
