import type { RenderedStroke, BezierSegment, ControlPoint } from '../sketch/types'

// ---- Canvas boundaries ----
const CANVAS_W = 800
const CANVAS_H = 500

// ---- Adjustment constants ----
const MOVE_STEP = 60
const SCALE_UP = 1.12
const SCALE_DOWN = 0.9

// ---- Six-color palette ----
const COLOR_PALETTE: Record<string, string> = {
  黑: '#111827',
  黑色: '#111827',
  红: '#ef4444',
  红色: '#ef4444',
  蓝: '#3b82f6',
  蓝色: '#3b82f6',
  绿: '#22c55e',
  绿色: '#22c55e',
  黄: '#eab308',
  黄色: '#eab308',
  白: '#f9fafb',
  白色: '#f9fafb',
}

// ---- Types ----
export type LocalAdjustment =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'scale'; factor: number }
  | { type: 'color'; hex: string }

// ---- Detection (loose match anywhere in transcript) ----
export function isLocalAdjustment(transcript: string): boolean {
  return /往[左右上下]|放[左右上下]边|向右|向左|向上|向下|大一点|大一些|放大|小一点|小一些|缩小|改成[黑红蓝绿黄白]|换成[黑红蓝绿黄白]|颜色改|改颜色/.test(transcript)
}

// ---- Parsing ----
export function parseLocalAdjustment(transcript: string): LocalAdjustment | null {
  // Color change: "改成蓝色" / "换成绿色" / "颜色改成红色"
  const colorMatch = transcript.match(/(?:改成|换成|颜色改成|颜色换成)([黑红蓝绿黄白]色?)/)
  if (colorMatch) {
    const key = colorMatch[1].replace('色', '')
    const hex = COLOR_PALETTE[key]
    if (hex) return { type: 'color', hex }
  }

  // Scale
  if (/大一点|大一些|放大/.test(transcript)) return { type: 'scale', factor: SCALE_UP }
  if (/小一点|小一些|缩小/.test(transcript)) return { type: 'scale', factor: SCALE_DOWN }

  // Move
  if (/往右|右边|向右|放右边/.test(transcript)) return { type: 'move', dx: MOVE_STEP, dy: 0 }
  if (/往左|左边|向左|放左边/.test(transcript)) return { type: 'move', dx: -MOVE_STEP, dy: 0 }
  if (/往上|上边|向上|放上边/.test(transcript)) return { type: 'move', dx: 0, dy: -MOVE_STEP }
  if (/往下|下边|向下|放下边/.test(transcript)) return { type: 'move', dx: 0, dy: MOVE_STEP }

  return null
}

// ---- Clamp helpers ----
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function getSketchBounds(strokes: RenderedStroke[]): {
  cx: number; cy: number
  minX: number; minY: number
  maxX: number; maxY: number
} | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const s of strokes) {
    for (const seg of s.segments) {
      for (const [x, y] of seg) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (!Number.isFinite(minX)) return null

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    minX,
    minY,
    maxX,
    maxY,
  }
}

// ---- Point transforms ----
function shiftPoint(pt: ControlPoint, dx: number, dy: number): ControlPoint {
  return [clamp(pt[0] + dx, 0, CANVAS_W), clamp(pt[1] + dy, 0, CANVAS_H)]
}

function scalePoint(pt: ControlPoint, cx: number, cy: number, factor: number): ControlPoint {
  return [
    clamp(cx + (pt[0] - cx) * factor, 0, CANVAS_W),
    clamp(cy + (pt[1] - cy) * factor, 0, CANVAS_H),
  ]
}

// ---- Apply adjustment to all strokes ----
export function applyLocalAdjustment(
  strokes: RenderedStroke[],
  adj: LocalAdjustment,
): RenderedStroke[] {
  return strokes.map((s) => {
    if (adj.type === 'move') {
      const segments: BezierSegment[] = s.segments.map((seg) =>
        seg.map((pt) => shiftPoint(pt, adj.dx, adj.dy)))
      const labelPoint = s.labelPoint ? shiftPoint(s.labelPoint, adj.dx, adj.dy) : undefined
      return { ...s, segments, labelPoint }
    }

    if (adj.type === 'scale') {
      const bounds = getSketchBounds(strokes)
      if (!bounds) return s
      const segments: BezierSegment[] = s.segments.map((seg) =>
        seg.map((pt) => scalePoint(pt, bounds.cx, bounds.cy, adj.factor)))
      const labelPoint = s.labelPoint
        ? scalePoint(s.labelPoint, bounds.cx, bounds.cy, adj.factor)
        : undefined
      return { ...s, segments, labelPoint }
    }

    // color
    return { ...s, color: adj.hex }
  })
}

// ---- User-facing feedback ----
export function getAdjustmentFeedback(adj: LocalAdjustment): string {
  if (adj.type === 'move') {
    if (adj.dx > 0) return '好的，已往右移动'
    if (adj.dx < 0) return '好的，已往左移动'
    if (adj.dy > 0) return '好的，已往下移动'
    return '好的，已往上移动'
  }
  if (adj.type === 'scale') {
    return adj.factor > 1 ? '好的，已放大一点' : '好的，已缩小一点'
  }
  // color — find the Chinese name for the hex
  const entry = Object.entries(COLOR_PALETTE).find(([, h]) => h === adj.hex)
  const name = entry ? entry[0] : ''
  return `好的，已改成${name}`
}
