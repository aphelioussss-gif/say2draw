import type { Shape } from '../domain/shapes'
import { CANVAS_ZONES, type CanvasZone } from '../domain/shapes'
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

/**
 * Extract spatial zone hint from voice input.
 * Recognizes: 左边/右边/上面/下面/中间/左上角/右上角/左下角/右下角
 * Returns null if no spatial hint detected.
 */
export function extractSpatialZone(rawText: string): CanvasZone | null {
  const t = rawText.replace(/\s+/g, '')
  if (/左上角|左上/.test(t)) return 'topLeft'
  if (/右上角|右上/.test(t)) return 'topRight'
  if (/左下角|左下/.test(t)) return 'bottomLeft'
  if (/右下角|右下/.test(t)) return 'bottomRight'
  if (/左边|左侧|左面/.test(t)) return 'left'
  if (/右边|右侧|右面/.test(t)) return 'right'
  if (/上面|上方|上边|顶部/.test(t)) return 'top'
  if (/下面|下方|下边|底部/.test(t)) return 'bottom'
  if (/中间|中央|中心/.test(t)) return 'center'
  return null
}

// ---- Shape factories (zone-aware) ----

function createCircle(id: string, color: string, zone?: CanvasZone): Shape {
  const pos = zone ? CANVAS_ZONES[zone] : CANVAS_ZONES.center
  return {
    id,
    type: 'circle',
    x: pos.cx,
    y: pos.cy,
    radius: 60,
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createEllipse(id: string, color: string, zone?: CanvasZone): Shape {
  const pos = zone ? CANVAS_ZONES[zone] : CANVAS_ZONES.center
  return {
    id,
    type: 'ellipse',
    x: pos.cx,
    y: pos.cy,
    radiusX: 90,
    radiusY: 52,
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createRect(id: string, color: string, zone?: CanvasZone): Shape {
  const pos = zone ? CANVAS_ZONES[zone] : CANVAS_ZONES.center
  return {
    id,
    type: 'rect',
    x: pos.cx - 80,
    y: pos.cy - 60,
    width: 160,
    height: 120,
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createTriangle(id: string, color: string, zone?: CanvasZone): Shape {
  const pos = zone ? CANVAS_ZONES[zone] : CANVAS_ZONES.center
  return {
    id,
    type: 'polygon',
    points: [
      { x: pos.cx, y: pos.cy - 100 },
      { x: pos.cx + 120, y: pos.cy + 100 },
      { x: pos.cx - 120, y: pos.cy + 100 },
    ],
    fill: color,
    stroke: color,
    lineWidth: 4,
  }
}

function createLine(id: string, color: string, zone?: CanvasZone): Shape {
  const pos = zone ? CANVAS_ZONES[zone] : CANVAS_ZONES.center
  return {
    id,
    type: 'line',
    x1: pos.cx - 160,
    y1: pos.cy,
    x2: pos.cx + 160,
    y2: pos.cy,
    stroke: color,
    lineWidth: 6,
  }
}

function createTextShape(id: string, text: string, color: string, zone?: CanvasZone): Shape {
  const pos = zone ? CANVAS_ZONES[zone] : CANVAS_ZONES.center
  return {
    id,
    type: 'text',
    x: pos.cx,
    y: pos.cy,
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
  const zone = extractSpatialZone(rawText)

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
        shape: createCircle(createId(), color, zone ?? undefined),
        zone,
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
        shape: createEllipse(createId(), color, zone ?? undefined),
        zone,
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
        shape: createTriangle(createId(), color, zone ?? undefined),
        zone,
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
        shape: createRect(createId(), color, zone ?? undefined),
        zone,
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
        shape: createLine(createId(), color, zone ?? undefined),
        zone,
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
          shape: createTextShape(createId(), content, color, zone ?? undefined),
          zone,
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
