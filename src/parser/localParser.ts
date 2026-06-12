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
  { input: '画一个红色圆形', expectedActionType: 'add_shape' },
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

  if (text.includes('圆形') || text.includes('圆')) {
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
