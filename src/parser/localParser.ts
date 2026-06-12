import type { DrawingAction } from '../domain/actions'
import type { Shape } from '../domain/shapes'
import type { LocalParserExample, LocalParserOptions, ParseResult } from './parserTypes'

const DEFAULT_COLOR = '#111827'

const COLOR_MAP = [
  ['红色', '#ef4444'],
  ['蓝色', '#3b82f6'],
  ['黑色', '#111827'],
  ['绿色', '#22c55e'],
  ['黄色', '#eab308'],
] as const

export const LOCAL_PARSER_EXAMPLES: LocalParserExample[] = [
  { input: '给我画一个太阳', expectedActionType: 'add_shape' },
  { input: '画一个笑脸', expectedActionType: 'add_shape' },
  { input: '画一棵树', expectedActionType: 'add_shape' },
  { input: '画一座房子', expectedActionType: 'add_shape' },
  { input: '画一个红色圆形', expectedActionType: 'add_shape' },
  { input: '画一个绿色椭圆', expectedActionType: 'add_shape' },
  { input: '画一个黄色三角形', expectedActionType: 'add_shape' },
  { input: '画一个蓝色矩形', expectedActionType: 'add_shape' },
  { input: '画一条黑色线', expectedActionType: 'add_shape' },
  { input: '写上你好', expectedActionType: 'add_shape' },
  { input: '清空画布', expectedActionType: 'clear_canvas' },
  { input: '撤销', expectedActionType: 'undo' },
]

function normalizeText(rawText: string) {
  return rawText.replace(/\s+/g, '').trim()
}

function resolveColor(text: string) {
  return COLOR_MAP.find(([name]) => text.includes(name))?.[1] ?? DEFAULT_COLOR
}

function createDefaultId() {
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createCircle(id: string, color: string): Shape {
  return {
    id,
    type: 'circle',
    x: 400,
    y: 250,
    radius: 60,
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createEllipse(id: string, color: string): Shape {
  return {
    id,
    type: 'ellipse',
    x: 400,
    y: 250,
    radiusX: 90,
    radiusY: 52,
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createRect(id: string, color: string): Shape {
  return {
    id,
    type: 'rect',
    x: 320,
    y: 190,
    width: 160,
    height: 120,
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createTriangle(id: string, color: string): Shape {
  return {
    id,
    type: 'polygon',
    points: [
      { x: 400, y: 150 },
      { x: 520, y: 350 },
      { x: 280, y: 350 },
    ],
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createLine(id: string, color: string): Shape {
  return {
    id,
    type: 'line',
    x1: 240,
    y1: 250,
    x2: 560,
    y2: 250,
    stroke: color,
    lineWidth: 6,
  }
}

function createTextShape(id: string, text: string, color: string): Shape {
  return {
    id,
    type: 'text',
    x: 400,
    y: 250,
    text,
    fill: color,
    fontSize: 36,
  }
}

function createAddShapeAction(
  shape: Shape,
  rawText: string,
  createdAt: string,
): DrawingAction {
  return {
    type: 'add_shape',
    rawText,
    parseSource: 'local',
    createdAt,
    shape,
  }
}

function createSunShapes(createId: () => string): Shape[] {
  const centerX = 610
  const centerY = 120
  const color = '#eab308'

  return [
    {
      id: createId(),
      type: 'circle',
      x: centerX,
      y: centerY,
      radius: 46,
      fill: color,
      stroke: color,
      lineWidth: 4,
    },
    { id: createId(), type: 'line', x1: centerX, y1: 48, x2: centerX, y2: 22, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: centerX, y1: 192, x2: centerX, y2: 218, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: 538, y1: centerY, x2: 512, y2: centerY, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: 682, y1: centerY, x2: 708, y2: centerY, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: 560, y1: 70, x2: 540, y2: 50, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: 660, y1: 70, x2: 680, y2: 50, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: 560, y1: 170, x2: 540, y2: 190, stroke: color, lineWidth: 5 },
    { id: createId(), type: 'line', x1: 660, y1: 170, x2: 680, y2: 190, stroke: color, lineWidth: 5 },
  ]
}

function createSmileShapes(createId: () => string): Shape[] {
  return [
    { id: createId(), type: 'circle', x: 400, y: 250, radius: 105, fill: '#eab308', stroke: '#111827', lineWidth: 4 },
    { id: createId(), type: 'circle', x: 360, y: 220, radius: 12, fill: '#111827', stroke: '#111827', lineWidth: 3 },
    { id: createId(), type: 'circle', x: 440, y: 220, radius: 12, fill: '#111827', stroke: '#111827', lineWidth: 3 },
    {
      id: createId(),
      type: 'polygon',
      points: [
        { x: 345, y: 285 },
        { x: 380, y: 318 },
        { x: 420, y: 318 },
        { x: 455, y: 285 },
        { x: 400, y: 338 },
      ],
      fill: '#ef4444',
      stroke: '#111827',
      lineWidth: 3,
    },
  ]
}

function createTreeShapes(createId: () => string): Shape[] {
  return [
    { id: createId(), type: 'rect', x: 372, y: 285, width: 56, height: 135, fill: '#92400e', stroke: '#111827', lineWidth: 4 },
    { id: createId(), type: 'ellipse', x: 400, y: 225, radiusX: 105, radiusY: 82, fill: '#22c55e', stroke: '#111827', lineWidth: 4 },
    { id: createId(), type: 'circle', x: 342, y: 250, radius: 52, fill: '#22c55e', stroke: '#111827', lineWidth: 3 },
    { id: createId(), type: 'circle', x: 458, y: 250, radius: 52, fill: '#22c55e', stroke: '#111827', lineWidth: 3 },
  ]
}

function createHouseShapes(createId: () => string): Shape[] {
  return [
    { id: createId(), type: 'rect', x: 285, y: 230, width: 230, height: 160, fill: '#dbeafe', stroke: '#111827', lineWidth: 4 },
    {
      id: createId(),
      type: 'polygon',
      points: [
        { x: 255, y: 235 },
        { x: 400, y: 120 },
        { x: 545, y: 235 },
      ],
      fill: '#ef4444',
      stroke: '#111827',
      lineWidth: 4,
    },
    { id: createId(), type: 'rect', x: 378, y: 315, width: 44, height: 75, fill: '#92400e', stroke: '#111827', lineWidth: 3 },
    { id: createId(), type: 'rect', x: 315, y: 265, width: 42, height: 42, fill: '#ffffff', stroke: '#111827', lineWidth: 3 },
    { id: createId(), type: 'rect', x: 443, y: 265, width: 42, height: 42, fill: '#ffffff', stroke: '#111827', lineWidth: 3 },
  ]
}

export function parseLocalCommands(
  rawText: string,
  options: LocalParserOptions = {},
): DrawingAction[] | null {
  const text = normalizeText(rawText)
  const createdAt = options.createdAt ?? new Date().toISOString()
  const createId = options.createId ?? createDefaultId

  let shapes: Shape[] | null = null
  if (text.includes('太阳')) shapes = createSunShapes(createId)
  else if (text.includes('笑脸')) shapes = createSmileShapes(createId)
  else if (text.includes('树')) shapes = createTreeShapes(createId)
  else if (text.includes('房子') || text.includes('房屋')) shapes = createHouseShapes(createId)

  return shapes?.map((shape) => createAddShapeAction(shape, rawText, createdAt)) ?? null
}

export function parseLocalCommand(
  rawText: string,
  options: LocalParserOptions = {},
): ParseResult {
  const text = normalizeText(rawText)
  const createdAt = options.createdAt ?? new Date().toISOString()
  const createId = options.createId ?? createDefaultId
  const color = resolveColor(text)

  if (text.includes('清空画布') || text.includes('清除画布')) {
    return {
      ok: true,
      action: {
        type: 'clear_canvas',
        rawText,
        parseSource: 'local',
        createdAt,
      },
    }
  }

  if (text.includes('撤销')) {
    return {
      ok: true,
      action: {
        type: 'undo',
        rawText,
        parseSource: 'local',
        createdAt,
      },
    }
  }

  if (text.includes('圆') && !text.includes('椭圆')) {
    return {
      ok: true,
      action: {
        type: 'add_shape',
        rawText,
        parseSource: 'local',
        createdAt,
        shape: createCircle(createId(), color),
      },
    }
  }

  if (text.includes('椭圆')) {
    return {
      ok: true,
      action: {
        type: 'add_shape',
        rawText,
        parseSource: 'local',
        createdAt,
        shape: createEllipse(createId(), color),
      },
    }
  }

  if (text.includes('三角形') || text.includes('三角')) {
    return {
      ok: true,
      action: {
        type: 'add_shape',
        rawText,
        parseSource: 'local',
        createdAt,
        shape: createTriangle(createId(), color),
      },
    }
  }

  if (text.includes('矩形') || text.includes('方形') || text.includes('长方形')) {
    return {
      ok: true,
      action: {
        type: 'add_shape',
        rawText,
        parseSource: 'local',
        createdAt,
        shape: createRect(createId(), color),
      },
    }
  }

  if (text.includes('线') || text.includes('直线')) {
    return {
      ok: true,
      action: {
        type: 'add_shape',
        rawText,
        parseSource: 'local',
        createdAt,
        shape: createLine(createId(), color),
      },
    }
  }

  if (text.startsWith('写上') || text.startsWith('写')) {
    const content = text.replace(/^写上?/, '')

    if (content) {
      return {
        ok: true,
        action: {
          type: 'add_shape',
          rawText,
          parseSource: 'local',
          createdAt,
          shape: createTextShape(createId(), content, color),
        },
      }
    }
  }

  return {
    ok: false,
    rawText,
    parseSource: 'local',
    createdAt,
    message: '本地解析器暂时不支持这条指令。',
  }
}
