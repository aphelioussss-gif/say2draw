import { type CanvasZone } from '../domain/shapes'
import type { ParseResult, LocalParserOptions } from './parserTypes'

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

/**
 * Minimal local parser — only handles clear and undo.
 * All drawing commands go through the unified sketch pipeline.
 */
export function parseLocalCommand(
  rawText: string,
  options: LocalParserOptions = {},
): ParseResult {
  const text = rawText.replace(/\s+/g, '').trim()
  const createdAt = options.createdAt ?? new Date().toISOString()

  if (
    text.includes('清空') ||
    text.includes('清除') ||
    text.includes('清屏') ||
    text.includes('擦掉画布') ||
    text.includes('擦除画布')
  ) {
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

  return {
    ok: false,
    rawText,
    parseSource: 'local',
    createdAt,
    message: '',
  }
}
