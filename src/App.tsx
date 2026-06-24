import { useRef, useReducer, useState, type FormEvent } from 'react'
import { CanvasBoard } from './components/CanvasBoard'
import { CommandHistory } from './components/CommandHistory'
import { SketchLayer } from './components/SketchLayer'
import { FlowchartLayer } from './components/FlowchartLayer'
import { PlanCompanion } from './components/PlanCompanion'
import { PlanConfirmOverlay } from './components/PlanConfirmOverlay'
import { SidebarNav } from './components/SidebarNav'
import { ConfigPage } from './components/ConfigPage'
import { VoiceStatusBar } from './components/VoiceStatusBar'
import { ModePresetPanel } from './components/ModePresetPanel'
import { FeedbackPanel } from './components/FeedbackPanel'
import { getActionFeedback, getBatchFeedback, type FeedbackState } from './domain/feedback'
import {
  drawingReducer,
  initialDrawingState,
} from './domain/reducer'
import { CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_ZONES, type CanvasZone, type Shape } from './domain/shapes'
import type { DrawingAction } from './domain/actions'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useLLMStatus } from './hooks/useLLMStatus'
import { routeCommands } from './parser/commandRouter'
import { extractSpatialZone } from './parser/localParser'
import { parseSketchXML } from './sketch/sketchParser'
import { fitBezierCurve } from './sketch/bezierFitter'
import { gridToPixel } from './sketch/svgRenderer'
import { captureCanvas } from './sketch/canvasCapture'
import {
  parseLocalAdjustment,
  applyLocalAdjustment,
  getAdjustmentFeedback,
} from './domain/sketchTransform'
import type { RenderedStroke, RawStroke, BezierSegment, ControlPoint } from './sketch/types'
import type { FlowchartModel } from './sketch/flowchartTypes'
import {
  type AppPage,
  type DrawingMode,
  MODE_PRESETS,
  isDrawingMode,
  CONFIG_MODE,
} from './components/ModePresets'
import './App.css'

const GRID_RES = 50
const LOW_TRANSCRIPT_CONFIDENCE = 0.65

type TranscriptReview = {
  originalText: string
  suggestedText?: string
  reason: 'ambiguous_draw_verb' | 'low_confidence'
}

function normalizeVoiceText(text: string): string {
  return text.trim().replace(/[\s，,。.!！?？]/g, '')
}

function createDrawVerbSuggestion(text: string): string | null {
  const normalized = normalizeVoiceText(text)
  const corrected = normalized
    .replace(/换(?=一只|一个|一张|张|个)/, '画')
    .replace(/话(?=一只|一个|一张|张|个)/, '画')
    .replace(/化(?=一只|一个|一张|张|个)/, '画')

  return corrected !== normalized ? corrected : null
}

function isLocalSystemCommand(text: string): boolean {
  return /^(清空|清除|擦掉|撤销|后退|取消|算了|重来|不要|确认|开始画|可以|就这样|好|行)/.test(normalizeVoiceText(text))
}

function shouldReviewTranscript(
  text: string,
  confidence: number | undefined,
  hasEditableContext: boolean,
): TranscriptReview | null {
  if (hasEditableContext || isLocalSystemCommand(text)) {
    return null
  }

  const suggestedText = createDrawVerbSuggestion(text)
  if (suggestedText) {
    return {
      originalText: normalizeVoiceText(text),
      suggestedText,
      reason: 'ambiguous_draw_verb',
    }
  }

  if (typeof confidence === 'number' && confidence < LOW_TRANSCRIPT_CONFIDENCE) {
    return {
      originalText: normalizeVoiceText(text),
      reason: 'low_confidence',
    }
  }

  return null
}

function parseTranscriptCorrection(review: TranscriptReview, spokenText: string): string | null {
  const normalized = normalizeVoiceText(spokenText)
  const original = review.originalText
  const explicitReplacement =
    normalized.match(/^不是(.+?)是(.+)$/) ??
    normalized.match(/^把(.+?)改成(.+)$/) ??
    normalized.match(/^把(.+?)换成(.+)$/)

  if (explicitReplacement) {
    const [, from, to] = explicitReplacement
    if (from && to && original.includes(from)) {
      return original.replace(from, to)
    }
  }

  if (/^(画|帮我画|请画|请你画|给我画)/.test(normalized)) {
    return normalized
  }

  return null
}

function buildTranscriptReviewMessage(review: TranscriptReview): string {
  if (review.suggestedText) {
    return `我听到：${review.originalText}。是不是想说：${review.suggestedText}？说确认按建议继续，或说重说。`
  }

  return `我听到：${review.originalText}。这句可能没听清，说确认继续，或说重说。`
}

function getSketchPixelBounds(strokes: ControlPoint[][]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  strokes.forEach((stroke) => {
    stroke.forEach(([x, y]) => {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    })
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function createSketchNormalizer(
  strokes: ControlPoint[][],
  options: { normalize?: boolean; zone?: CanvasZone | null } = {},
): (point: ControlPoint) => ControlPoint {
  const bounds = getSketchPixelBounds(strokes)
  if (!bounds || options.normalize === false) return (point) => point

  const targetWidth = CANVAS_WIDTH * 0.68
  const targetHeight = CANVAS_HEIGHT * 0.68
  const minTargetWidth = CANVAS_WIDTH * 0.36
  const minTargetHeight = CANVAS_HEIGHT * 0.34
  const fitScale = Math.min(targetWidth / bounds.width, targetHeight / bounds.height)
  const readableScale = Math.max(minTargetWidth / bounds.width, minTargetHeight / bounds.height)
  const scale = Math.max(0.55, Math.min(1.22, fitScale, readableScale))
  const centerX = bounds.minX + bounds.width / 2
  const centerY = bounds.minY + bounds.height / 2
  const zoneCenter = options.zone ? CANVAS_ZONES[options.zone] : null
  const targetCenterX = zoneCenter?.cx ?? CANVAS_WIDTH / 2
  const targetCenterY = zoneCenter?.cy ?? CANVAS_HEIGHT / 2

  return ([x, y]) => [
    targetCenterX + (x - centerX) * scale,
    targetCenterY + (y - centerY) * scale,
  ]
}

function getRenderedBounds(strokes: RenderedStroke[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  strokes.forEach((stroke) => {
    stroke.segments.forEach((segment) => {
      segment.forEach(([x, y]) => {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      })
    })
    if (stroke.labelPoint) {
      minX = Math.min(minX, stroke.labelPoint[0])
      minY = Math.min(minY, stroke.labelPoint[1])
      maxX = Math.max(maxX, stroke.labelPoint[0])
      maxY = Math.max(maxY, stroke.labelPoint[1])
    }
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

function shiftRenderedStrokesToZone(strokes: RenderedStroke[], zone: CanvasZone | null | undefined): RenderedStroke[] {
  if (!zone) return strokes
  const bounds = getRenderedBounds(strokes)
  const target = CANVAS_ZONES[zone]
  if (!bounds || !target) return strokes

  const currentCx = bounds.minX + bounds.width / 2
  const currentCy = bounds.minY + bounds.height / 2
  let dx = target.cx - currentCx
  let dy = target.cy - currentCy

  if (bounds.minX + dx < 0) dx = -bounds.minX
  if (bounds.maxX + dx > CANVAS_WIDTH) dx = CANVAS_WIDTH - bounds.maxX
  if (bounds.minY + dy < 0) dy = -bounds.minY
  if (bounds.maxY + dy > CANVAS_HEIGHT) dy = CANVAS_HEIGHT - bounds.maxY

  const shiftPoint = ([x, y]: ControlPoint): ControlPoint => [x + dx, y + dy]
  return strokes.map((stroke) => ({
    ...stroke,
    segments: stroke.segments.map((segment) => segment.map(shiftPoint)),
    labelPoint: stroke.labelPoint ? shiftPoint(stroke.labelPoint) : undefined,
  }))
}

function gridCellToPixel(cell: string): ControlPoint | null {
  const m = cell.match(/x(\d+)y(\d+)/)
  if (!m) return null
  return gridToPixel(parseInt(m[1], 10), parseInt(m[2], 10), GRID_RES, CANVAS_WIDTH, CANVAS_HEIGHT)
}

function normalizeLabelPoint(raw: RawStroke, normalizePoint: (point: ControlPoint) => ControlPoint): ControlPoint | undefined {
  if (!raw.labelPoint) return undefined
  const point = gridCellToPixel(raw.labelPoint)
  return point ? normalizePoint(point) : undefined
}

function fitAndRenderStrokes(
  rawStrokes: RawStroke[],
  options: { normalize?: boolean; zone?: CanvasZone | null } = {},
): RenderedStroke[] {
  const pixelStrokes = rawStrokes.map((raw) =>
    raw.points.map((cell) => gridCellToPixel(cell) ?? [0, 0] as [number, number]),
  )
  const normalizePoint = createSketchNormalizer(pixelStrokes, options)
  const normalizedStrokes = pixelStrokes.map((stroke) =>
    stroke.map((point) => normalizePoint(point)),
  )

  const rendered = rawStrokes.map((raw, i) => {
    const sampledPoints = normalizedStrokes[i] ?? []
    const tValues = raw.tValues.length === sampledPoints.length
      ? raw.tValues
      : Array.from({ length: sampledPoints.length }, (_, j) =>
          sampledPoints.length === 1 ? 0 : j / (sampledPoints.length - 1),
        )

    const segments = fitBezierCurve(sampledPoints as [number, number][], tValues)

    const validSegments: BezierSegment[] = segments.filter(
      (seg) => seg.length > 0,
    )

    return {
      id: raw.id || `stroke-${i}`,
      segments: validSegments,
      color: raw.color || '#111827',
      label: raw.label,
      labelPoint: normalizeLabelPoint(raw, normalizePoint),
    }
  }).filter((s) => s.segments.length > 0)

  return shiftRenderedStrokesToZone(rendered, options.zone)
}

function App() {
  const [state, dispatch] = useReducer(drawingReducer, initialDrawingState)
  const [feedback, setFeedback] = useState<FeedbackState>({ status: 'idle' })

  function updateFeedback(patch: Partial<FeedbackState>) {
    setFeedback((prev) => ({ ...prev, ...patch }))
  }
  const speechFeedback = useSpeechSynthesis()
  const llmStatus = useLLMStatus()

  // ---- Page navigation ----
  const [activePage, setActivePage] = useState<AppPage>('story_scene')

  // ---- Sketch stroke state ----
  const [sketchStrokes, setSketchStrokes] = useState<RenderedStroke[]>([])
  const [sketchMode, setSketchMode] = useState<{
    concept: string
    rawStrokes: RawStroke[]
    approvedPlan?: PendingPlan
    flowchartModel?: FlowchartModel
    flowchartTransform?: { dx: number; dy: number; scale: number }
    lastSnapshot?: { strokes: RenderedStroke[]; rawStrokes: RawStroke[] }
  } | null>(null)
  const [, setIsGeneratingSketch] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ---- Plan state (Plan→Confirm→Execute flow) ----
  type PlanConnection = { from: string; to: string; direction: string }

  type PendingPlan = {
    originalText: string
    intentType?: string
    compositionRationale?: string
    sceneType?: string
    previewText: string
    drawingOrder?: string[]
    connections?: PlanConnection[]
    elements: Array<{ name: string; position: string; color: string; role: string; details?: string[] }>
  }
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null)
  const [pendingTranscriptReview, setPendingTranscriptReview] = useState<TranscriptReview | null>(null)
  const [devCommand, setDevCommand] = useState('')
  const showDevInput = import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev')

  // ---- Current drawing mode (only meaningful on drawing pages) ----
  const activeMode: DrawingMode = isDrawingMode(activePage) ? activePage : 'story_scene'
  const currentPreset = MODE_PRESETS[activeMode]

  // ---- Helpers ----

  function createTimestamp() {
    return new Date().toISOString()
  }

  function applyFlowchartAdjustment(adj: ReturnType<typeof parseLocalAdjustment>) {
    if (!adj) return false
    if (!sketchMode?.flowchartModel) return false

    setSketchMode((prev) => {
      if (!prev?.flowchartModel) return prev
      const current = prev.flowchartTransform || { dx: 0, dy: 0, scale: 1 }
      if (adj.type === 'move') {
        return { ...prev, flowchartTransform: { ...current, dx: current.dx + adj.dx, dy: current.dy + adj.dy } }
      }
      if (adj.type === 'scale') {
        return { ...prev, flowchartTransform: { ...current, scale: Math.max(0.75, Math.min(1.35, current.scale * adj.factor)) } }
      }
      return prev
    })

    return adj.type !== 'color'
  }

  // ---- Bounding box helpers (A2: overlap avoidance) ----

  interface BBox { minX: number; minY: number; maxX: number; maxY: number }

  function shapeBBox(shape: Shape): BBox {
    switch (shape.type) {
      case 'circle':
        return { minX: shape.x - shape.radius, minY: shape.y - shape.radius, maxX: shape.x + shape.radius, maxY: shape.y + shape.radius }
      case 'ellipse':
        return { minX: shape.x - shape.radiusX, minY: shape.y - shape.radiusY, maxX: shape.x + shape.radiusX, maxY: shape.y + shape.radiusY }
      case 'rect':
        return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.width, maxY: shape.y + shape.height }
      case 'line':
        return { minX: Math.min(shape.x1, shape.x2), minY: Math.min(shape.y1, shape.y2), maxX: Math.max(shape.x1, shape.x2), maxY: Math.max(shape.y1, shape.y2) }
      case 'text': {
        const estimatedW = (shape.text?.length ?? 2) * (shape.fontSize ?? 32) * 0.6
        const estimatedH = (shape.fontSize ?? 32) * 1.2
        return { minX: shape.x - estimatedW / 2, minY: shape.y - estimatedH / 2, maxX: shape.x + estimatedW / 2, maxY: shape.y + estimatedH / 2 }
      }
      case 'polyline':
      case 'polygon': {
        const xs = shape.points.map((p) => p.x)
        const ys = shape.points.map((p) => p.y)
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
      }
      case 'arc':
        return { minX: shape.x - shape.radius, minY: shape.y - shape.radius, maxX: shape.x + shape.radius, maxY: shape.y + shape.radius }
      default:
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    }
  }

  function boxesOverlap(a: BBox, b: BBox): boolean {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
  }

  function shapeCenter(shape: Shape): { cx: number; cy: number } {
    const bb = shapeBBox(shape)
    return { cx: (bb.minX + bb.maxX) / 2, cy: (bb.minY + bb.maxY) / 2 }
  }

  function avoidOverlap(shape: Shape, existing: Shape[]): Shape {
    if (existing.length === 0) return shape
    const bb = shapeBBox(shape)
    const overlaps = existing.some((s) => boxesOverlap(bb, shapeBBox(s)))
    if (!overlaps) return shape

    const offsets = [
      { dx: 90, dy: 0 }, { dx: -90, dy: 0 }, { dx: 0, dy: 80 }, { dx: 0, dy: -80 }, { dx: 50, dy: 50 },
    ]
    for (const { dx, dy } of offsets) {
      const candidate = shiftShapePixels(shape, dx, dy)
      const cbb = shapeBBox(candidate)
      if (!existing.some((s) => boxesOverlap(cbb, shapeBBox(s)))) {
        return candidate
      }
    }
    return shape
  }

  function shiftShapePixels(shape: Shape, dx: number, dy: number): Shape {
    const s = { ...shape }
    if ('x' in s && typeof s.x === 'number') (s as Record<string, unknown>).x = s.x + dx
    if ('y' in s && typeof s.y === 'number') (s as Record<string, unknown>).y = s.y + dy
    if ('x1' in s && typeof s.x1 === 'number') (s as Record<string, unknown>).x1 = s.x1 + dx
    if ('x2' in s && typeof s.x2 === 'number') (s as Record<string, unknown>).x2 = s.x2 + dx
    if ('y1' in s && typeof s.y1 === 'number') (s as Record<string, unknown>).y1 = s.y1 + dy
    if ('y2' in s && typeof s.y2 === 'number') (s as Record<string, unknown>).y2 = s.y2 + dy
    if ('points' in s && Array.isArray(s.points)) {
      (s as Record<string, unknown>).points = s.points.map((p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy }))
    }
    return s
  }

  // ---- Multi-object distribution (A4) ----

  const ZONE_DIST_ORDER: Array<keyof typeof CANVAS_ZONES> = [
    'center', 'top', 'left', 'right', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
  ]

  function shapesNeedDistribution(shapes: Shape[]): boolean {
    if (shapes.length <= 1) return false
    const centers = shapes.map(shapeCenter)
    const allNearCenter = centers.every((c) => Math.abs(c.cx - 400) < 20 && Math.abs(c.cy - 250) < 20)
    if (allNearCenter) return true
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        if (boxesOverlap(shapeBBox(shapes[i]), shapeBBox(shapes[j]))) return true
      }
    }
    return false
  }

  function distributeShapes(shapes: Shape[], existing: Shape[]): Shape[] {
    return shapes.map((shape, i) => {
      const zoneKey = ZONE_DIST_ORDER[i % ZONE_DIST_ORDER.length]
      const zone = CANVAS_ZONES[zoneKey]
      const centered = shiftShapeToZone(shape, zone.cx, zone.cy)
      return avoidOverlap(centered, [...existing, ...shapes.slice(0, i)])
    })
  }

  function shiftShapeToZone(shape: Shape, cx: number, cy: number): Shape {
    const center = shapeCenter(shape)
    return shiftShapePixels(shape, cx - center.cx, cy - center.cy)
  }

  // ---- Sketch generation (Plan→Confirm→Execute) ----

  async function handleGenerateSketch(rawText: string) {
    if (sketchMode !== null) {
      const zone = extractSpatialZone(rawText)
      const zoneNames: Record<string, string> = {
        center: '中间', top: '上方', bottom: '下方', left: '左边', right: '右边',
        topLeft: '左上角', topRight: '右上角', bottomLeft: '左下角', bottomRight: '右下角',
      }
      const zoneHint = zone ? `在画布${zoneNames[zone] || zone}添加：` : '在画布上添加：'
      handleSketchEdit(`${zoneHint}${rawText}`, true)
      return
    }

    setIsGeneratingSketch(true)
    updateFeedback({ status: 'thinking' })

    try {
      const res = await fetch('/api/sketch-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          mode: activeMode,
          promptHint: currentPreset.promptHint,
          planFocus: currentPreset.planFocus,
        }),
      })
      const data = await res.json()

      if (data.ok && data.plan) {
        setPendingPlan({ ...data.plan, originalText: rawText })
        const preview = data.plan.previewText || '已生成绘图计划'
        const message = `${preview}。可以说确认开始画，取消重来，也可以继续说你想怎么改。`
        updateFeedback({ result: message, status: 'success' })
        if (!speech.isManuallyPausedRef.current) {
          speech.resumeListening()
        }
        speechFeedback.speak(message, {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
        return
      }

      updateFeedback({ result: '计划生成失败，请重试', status: 'error', suggestion: '请换一种描述方式再试' })
      speechFeedback.speak('计划生成失败，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } catch {
      updateFeedback({ result: '网络错误，请重试', status: 'error' })
      speechFeedback.speak('网络错误，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  async function revisePendingPlan(revision: string) {
    if (!pendingPlan) return

    const currentPlan = pendingPlan
    setIsGeneratingSketch(true)
    updateFeedback({ status: 'thinking' })

    try {
      const res = await fetch('/api/sketch-plan/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: currentPlan,
          revision,
          mode: activeMode,
          promptHint: currentPreset.promptHint,
          planFocus: currentPreset.planFocus,
        }),
      })
      const data = await res.json()

      if (data.ok && data.plan) {
        const revisedPlan = { ...data.plan, originalText: currentPlan.originalText }
        setPendingPlan(revisedPlan)
        const message = `${data.plan.previewText || '计划已更新'}。已按你的意见调整，确认就开始画，也可以继续修改。`
        updateFeedback({ result: message, status: 'success' })
        speechFeedback.speak(message, {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
        return
      }

      updateFeedback({ result: '计划调整失败', status: 'error', suggestion: '请换一种说法' })
      speechFeedback.speak('计划调整失败，请换一种说法', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } catch {
      updateFeedback({ result: '网络错误，请重试', status: 'error' })
      speechFeedback.speak('网络错误，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  async function executeApprovedPlan() {
    if (!pendingPlan) return
    setIsGeneratingSketch(true)
    updateFeedback({ status: 'thinking' })
    const plan = pendingPlan
    setPendingPlan(null)

    try {
      const zone = extractSpatialZone(plan.originalText)
      const res = await fetch('/api/sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: plan.originalText,
          zone,
          approvedPlan: plan,
          mode: activeMode,
          promptHint: currentPreset.promptHint,
        }),
      })
      const data = await res.json()

      if (data.ok && data.sketch) {
        const parsed = parseSketchXML(data.sketch, GRID_RES)
        if (parsed && parsed.strokes.length > 0) {
          const hasFlowchartModel = !!data.model
          const rendered = hasFlowchartModel ? [] : fitAndRenderStrokes(parsed.strokes, { zone, normalize: true })
          setSketchStrokes(rendered)
          setSketchMode({
            concept: parsed.concept,
            rawStrokes: parsed.strokes,
            approvedPlan: plan,
            flowchartModel: data.model,
            flowchartTransform: hasFlowchartModel ? { dx: 0, dy: 0, scale: 1 } : undefined,
          })

          dispatch({
            type: 'generate_sketch',
            rawText: plan.originalText,
            parseSource: 'llm',
            createdAt: createTimestamp(),
            message: `Generated sketch: ${parsed.concept}`,
          })

          const message = `已为你画了${parsed.concept}的草图。你可以继续说：加一点细节、轮廓更清楚、放大主体。`
          updateFeedback({ result: message, status: 'success' })
          speechFeedback.speak(message, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      console.warn('[Sketch] Execution failed:', { ok: data.ok, hasSketch: !!data.sketch, error: data.error })
      updateFeedback({ result: '草图生成失败，请重试', status: 'error' })
      speechFeedback.speak('草图生成失败，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } catch {
      updateFeedback({ result: '网络错误，请重试', status: 'error' })
      speechFeedback.speak('网络错误，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  // ---- Flowchart layout adjustment (LLM understands intent, code renders deterministically) ----

  async function handleFlowchartLayoutAdjust(instruction: string) {
    if (!sketchMode?.approvedPlan) return

    // Save snapshot for undo before applying changes
    const snapshot = { strokes: [...sketchStrokes], rawStrokes: [...(sketchMode.rawStrokes || [])] }
    setSketchMode((prev) => prev ? { ...prev, lastSnapshot: snapshot } : null)

    setIsGeneratingSketch(true)
    updateFeedback({ status: 'thinking' })

    try {
      const res = await fetch('/api/sketch-flowchart-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: sketchMode.approvedPlan,
          instruction,
          currentModel: sketchMode.flowchartModel,
        }),
      })
      const data = await res.json()

      if (data.ok && data.sketch) {
        const parsed = parseSketchXML(data.sketch, GRID_RES)
        if (parsed && parsed.strokes.length > 0) {
          const hasFlowchartModel = !!data.model || !!sketchMode.flowchartModel
          const rendered = hasFlowchartModel ? [] : fitAndRenderStrokes(parsed.strokes, { normalize: true })
          setSketchStrokes(rendered)
          setSketchMode((prev) => prev ? {
            ...prev,
            rawStrokes: parsed.strokes,
            flowchartModel: data.model || prev.flowchartModel,
            flowchartTransform: data.model ? (prev.flowchartTransform || { dx: 0, dy: 0, scale: 1 }) : prev.flowchartTransform,
          } : null)

          const feedbackMsg = data.explanation || `好的，已按你"${instruction}"调整了流程图布局`
          updateFeedback({ result: feedbackMsg, status: 'success' })
          speechFeedback.speak(feedbackMsg, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      console.warn('[FlowchartLayout] Failed:', { ok: data.ok, hasSketch: !!data.sketch, error: data.error })
      updateFeedback({ result: '流程图调整失败，请重试', status: 'error' })
      speechFeedback.speak('流程图调整失败，请重试')
    } catch (error) {
      console.error('[FlowchartLayout] Error:', error)
      updateFeedback({ result: '网络错误，请重试', status: 'error' })
      speechFeedback.speak('网络错误，请重试')
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  // ---- Sketch editing (multimodal) ----

  async function handleSketchEdit(instruction: string, accumulate = false) {
    if (!sketchMode) return

    setIsGeneratingSketch(true)
    const screenshot = captureCanvas(canvasRef.current)
    const snapshot = { strokes: [...sketchStrokes], rawStrokes: [...(sketchMode.rawStrokes || [])] }

    try {
      const zone = extractSpatialZone(instruction)
      const res = await fetch('/api/sketch-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          currentImage: screenshot,
          previousConcept: sketchMode.concept,
          zone,
          accumulate,
          mode: activeMode,
          promptHint: currentPreset.promptHint,
        }),
      })
      const data = await res.json()

      if (data.ok && data.sketch) {
        const parsed = parseSketchXML(data.sketch, GRID_RES)
        if (parsed && parsed.strokes.length > 0) {
          const rendered = fitAndRenderStrokes(parsed.strokes, { zone, normalize: !accumulate })
          if (accumulate) {
            setSketchStrokes((prev) => [...prev, ...rendered])
          } else {
            setSketchStrokes(rendered)
          }
          setSketchMode((prev) => prev ? {
            ...prev,
            rawStrokes: accumulate ? [...prev.rawStrokes, ...parsed.strokes] : parsed.strokes,
            lastSnapshot: snapshot,
          } : null)

          const feedbackEdit = accumulate ? `好的，已添加新元素：${instruction}` : `好的，已按"${instruction}"调整`
          updateFeedback({ result: feedbackEdit, status: 'success' })
          speechFeedback.speak(feedbackEdit, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      // Handle structured error codes from server
      if (data.code === 'LLM_NOT_CONFIGURED') {
        updateFeedback({ result: 'LLM Key 未配置', status: 'error', suggestion: '请先在设置页配置 LLM Key，或说"往右一点""放大"等简单调整' })
        speechFeedback.speak('需要先配置 LLM Key 才能进行复杂调整。你可以先试试说"往右一点""放大""改颜色"。', {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
        return
      }
      if (data.code === 'VISION_NOT_SUPPORTED') {
        updateFeedback({ result: '当前模型不支持图片输入', status: 'error', suggestion: '请到设置页换一个支持视觉的模型' })
        speechFeedback.speak('当前模型不支持图片输入，请到设置页换一个支持视觉的模型。', {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
        return
      }
      if (data.code === 'INVALID_XML') {
        updateFeedback({ result: '模型未返回可绘制格式', status: 'error', suggestion: '说"重新排版流程图"再试一次' })
        speechFeedback.speak('模型没返回可画的格式，请说重新排版流程图再试一次。', {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
        return
      }

      console.warn('[SketchEdit] Edit failed:', { instruction, accumulate, ok: data.ok, hasSketch: !!data.sketch, error: data.error, code: data.code })
      updateFeedback({ result: '调整失败，请重试', status: 'error' })
      speechFeedback.speak('调整失败，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } catch {
      updateFeedback({ result: '网络错误，请重试', status: 'error' })
      speechFeedback.speak('网络错误，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  // ---- Dev command input ----

  function restoreSketchSnapshot() {
    if (sketchMode?.lastSnapshot) {
      const restored = sketchMode.lastSnapshot
      setSketchStrokes(restored.strokes)
      setSketchMode((prev) => prev ? { ...prev, rawStrokes: restored.rawStrokes, lastSnapshot: undefined } : null)
      updateFeedback({ result: '已恢复到上一版', status: 'success' })
      speechFeedback.speak('好的，已恢复到上一版', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
      return true
    }

    updateFeedback({ result: '没有可恢复的上一版', status: 'error' })
    speechFeedback.speak('没有可恢复的上一版', {
      onEnd: () => {
        if (!speech.isManuallyPausedRef.current) speech.resumeListening()
      },
    })
    return true
  }

  async function handleDevCommandSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const transcript = devCommand.trim()
    if (!transcript) return
    setDevCommand('')
    updateFeedback({ heardText: transcript, status: 'thinking' })

    if (/^(清空|清除|清屏|擦掉画布|擦除画布)$/.test(transcript)) {
      dispatch({ type: 'clear_canvas', rawText: transcript, parseSource: 'local', createdAt: createTimestamp() })
      setSketchStrokes([])
      setSketchMode(null)
      setPendingPlan(null)
      setPendingTranscriptReview(null)
      updateFeedback({ result: '已清空画布', status: 'success' })
      return
    }

    if (/^(撤销|后退)$/.test(transcript) && pendingPlan === null) {
      if (sketchMode !== null) {
        setSketchStrokes([])
        setSketchMode(null)
        updateFeedback({ result: '已撤销草图', status: 'success' })
        return
      }
      dispatch({ type: 'undo', rawText: transcript, parseSource: 'local', createdAt: createTimestamp() })
      updateFeedback({ result: '已撤销', status: 'success' })
      return
    }

    if (pendingPlan !== null) {
      if (/^(确认|开始画|可以|就这样|画吧|好|行)/.test(transcript)) {
        executeApprovedPlan()
        return
      }
      if (/^(取消|算了|重来|不要)/.test(transcript)) {
        setPendingPlan(null)
        setPendingTranscriptReview(null)
        updateFeedback({ result: '好的，已取消', status: 'success', suggestion: '请重新描述你想画的内容' })
        return
      }
      revisePendingPlan(transcript)
      return
    }

    if (sketchMode !== null) {
      if (/^(就这样|可以了|好了|算了|不画了)/.test(transcript)) {
        setSketchMode(null)
        updateFeedback({ result: '草图已确认', status: 'success' })
        return
      }

      if (/^(恢复上一版|撤回刚才|还原|撤销|后退)/.test(transcript)) {
        restoreSketchSnapshot()
        return
      }

      const localAdj = parseLocalAdjustment(transcript)
      if (localAdj) {
        const snapshot = { strokes: [...sketchStrokes], rawStrokes: [...(sketchMode.rawStrokes || [])] }
        setSketchMode((prev) => prev ? { ...prev, lastSnapshot: snapshot } : null)
        if (!applyFlowchartAdjustment(localAdj)) {
          setSketchStrokes((prev) => applyLocalAdjustment(prev, localAdj))
        }
        updateFeedback({ result: getAdjustmentFeedback(localAdj), status: 'success' })
        return
      }

      if (/宽松|太窄|太挤|散开|间距|文字居中|框太小|框压字|格子不对|不对|箭头|对齐|排版|重新排版|那里/.test(transcript) && sketchMode.approvedPlan?.intentType === 'flowchart') {
        handleFlowchartLayoutAdjust(transcript)
        return
      }

      if (/加细节|加一点|加些|再加|轮廓更清楚|改成更像|重新画|增加|删除|改得|我还想|帮我加|长一点|长一些|加长|短一点|短一些|缩短|重来/.test(transcript)) {
        const shouldAccumulate = /再加|增加|添加|帮我加|我还想加|旁边.*画|[左右上下]角.*加|[左右上下]边.*加/.test(transcript)
        handleSketchEdit(transcript, shouldAccumulate)
        return
      }
    }

    const actions = await routeCommands(transcript)
    const sketchAction = actions.find((a) => a.type === 'generate_sketch')
    if (sketchAction) {
      handleGenerateSketch(transcript)
      return
    }

    const clearAction = actions.find((a) => a.type === 'clear_canvas')
    if (clearAction) {
      dispatch(clearAction)
      setSketchStrokes([])
      setSketchMode(null)
      setPendingPlan(null)
      setPendingTranscriptReview(null)
      updateFeedback({ result: '已清空画布', status: 'success' })
      return
    }

    const undoAction = actions.find((a) => a.type === 'undo')
    if (undoAction) {
      if (sketchMode !== null) {
        setSketchStrokes([])
        setSketchMode(null)
        setPendingPlan(null)
        setPendingTranscriptReview(null)
        updateFeedback({ result: '已撤销草图', status: 'success' })
        return
      }
      dispatch(undoAction)
      updateFeedback({ result: '已撤销', status: 'success' })
      return
    }

    updateFeedback({ result: '开发输入未命中可执行指令', status: 'error', suggestion: '试试：画一个从语音输入到生成草图的流程图 / 确认 / 放大一点 / 在左上角加一个太阳' })
  }

  // ---- Speech Recognition ----

  const speech = useSpeechRecognition({
    shouldIgnoreResult: () => speechFeedback.isSpeaking,
    onFinalTranscript: (rawTranscript, metadata) => {
      speech.pauseListening({ manual: false })
      let transcript = rawTranscript
      const trimmedTranscript = normalizeVoiceText(rawTranscript)

      if (pendingTranscriptReview) {
        if (/^(确认|对|是的|按这个|继续|可以|好|行)$/.test(trimmedTranscript)) {
          transcript = pendingTranscriptReview.suggestedText ?? pendingTranscriptReview.originalText
          setPendingTranscriptReview(null)
        } else if (/^(重说|不对|重新听|重新识别|听错了|不是)$/.test(trimmedTranscript)) {
          setPendingTranscriptReview(null)
          updateFeedback({ result: '好的，请重新说一遍', status: 'success', suggestion: '请重新说一遍绘画指令' })
          speechFeedback.speak('好的，请重新说一遍绘画指令。', {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        } else {
          const correctedText = parseTranscriptCorrection(pendingTranscriptReview, rawTranscript)
          if (correctedText) {
            transcript = correctedText
            setPendingTranscriptReview(null)
          } else {
            const message = buildTranscriptReviewMessage(pendingTranscriptReview)
            updateFeedback({ heardText: pendingTranscriptReview.originalText, status: 'thinking', understoodAs: pendingTranscriptReview.suggestedText })
            speechFeedback.speak(message, {
              onEnd: () => {
                if (!speech.isManuallyPausedRef.current) speech.resumeListening()
              },
            })
            return
          }
        }
      } else {
        const review = shouldReviewTranscript(
          rawTranscript,
          metadata?.confidence,
          pendingPlan !== null || sketchMode !== null,
        )
        if (review) {
          const message = buildTranscriptReviewMessage(review)
          setPendingTranscriptReview(review)
          updateFeedback({ heardText: review.originalText, status: 'thinking', understoodAs: review.suggestedText })
          speechFeedback.speak(message, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      // Plan confirmation routing: confirm or cancel a pending plan
      updateFeedback({ heardText: transcript })
      const normalizedTranscript = transcript.trim()
      if (/^(清空|清除|清屏|擦掉画布|擦除画布)$/.test(normalizedTranscript)) {
        dispatch({ type: 'clear_canvas', rawText: transcript, parseSource: 'local', createdAt: createTimestamp() })
        setSketchStrokes([])
        setSketchMode(null)
        setPendingPlan(null)
        setPendingTranscriptReview(null)
        updateFeedback({ result: '已清空画布', status: 'success' })
        speechFeedback.speak('已清空画布', {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
        return
      }

      if (/^(撤销|后退)$/.test(normalizedTranscript) && pendingPlan === null) {
        if (sketchMode !== null) {
          setSketchStrokes([])
          setSketchMode(null)
          setPendingTranscriptReview(null)
          updateFeedback({ result: '已撤销草图', status: 'success' })
          speechFeedback.speak('已撤销草图', {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      if (pendingPlan !== null) {
        if (/^(确认|开始画|可以|就这样|画吧|好|行)/.test(transcript.trim())) {
          executeApprovedPlan()
          return
        }
        if (/^(取消|算了|重来|不要)/.test(transcript.trim())) {
          setPendingPlan(null)
          setPendingTranscriptReview(null)
          updateFeedback({ result: '好的，已取消', status: 'success', suggestion: '请重新描述你想画的内容' })
          speechFeedback.speak('好的，已取消。请重新描述你想画的内容。', {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
        // Refinement / elaboration phrases — revise plan without confirming
        if (/^(再详细|详细一点|说具体|展开一下|更详细|具体一点|解释一下|还不够|能再|再具体|展开说说)/.test(transcript.trim())) {
          revisePendingPlan('请把当前计划拆得更细，让元素和绘制顺序更具体')
          return
        }
        revisePendingPlan(transcript)
        return
      }

      // Sketch modifier routing: sketch mode only
      if (sketchMode !== null) {
        const trimmed = transcript.trim()

        // 1. Exit commands
        if (/^(就这样|可以了|好了|算了|不画了)/.test(trimmed)) {
          setSketchMode(null)
          updateFeedback({ result: '草图已确认', status: 'success' })
          speechFeedback.speak('好的，草图已确认', {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }

        // 1b. Undo / restore previous version
        if (/^(恢复上一版|撤回刚才|还原|撤销|后退)/.test(trimmed)) {
          if (sketchMode.lastSnapshot) {
            const restored = sketchMode.lastSnapshot
            setSketchStrokes(restored.strokes)
            setSketchMode((prev) => prev ? { ...prev, rawStrokes: restored.rawStrokes, lastSnapshot: undefined } : null)
            updateFeedback({ result: '已恢复到上一版', status: 'success' })
            speechFeedback.speak('好的，已恢复到上一版', {
              onEnd: () => {
                if (!speech.isManuallyPausedRef.current) speech.resumeListening()
              },
            })
          } else {
            updateFeedback({ result: '没有可恢复的上一版', status: 'error' })
            speechFeedback.speak('没有可恢复的上一版', {
              onEnd: () => {
                if (!speech.isManuallyPausedRef.current) speech.resumeListening()
              },
            })
          }
          return
        }

        // 2. Local deterministic adjustments (move/scale/color) — no LLM
        const localAdj = parseLocalAdjustment(trimmed)
        if (localAdj) {
          const snapshot = { strokes: [...sketchStrokes], rawStrokes: [...(sketchMode.rawStrokes || [])] }
          setSketchMode((prev) => prev ? { ...prev, lastSnapshot: snapshot } : null)
          if (!applyFlowchartAdjustment(localAdj)) {
            setSketchStrokes((prev) => applyLocalAdjustment(prev, localAdj))
          }
          const adjFeedback = getAdjustmentFeedback(localAdj)
          updateFeedback({ result: adjFeedback, status: 'success' })
          speechFeedback.speak(adjFeedback, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }

        // 3a. Flowchart layout adjustments — LLM understands intent, code renders deterministically
        if (/宽松|太窄|太挤|散开|间距|文字居中|框太小|框压字|格子不对|不对|箭头|对齐|排版|重新排版|那里/.test(trimmed)) {
          if (sketchMode.approvedPlan?.intentType === 'flowchart') {
            if (llmStatus !== 'configured') {
              updateFeedback({ result: 'LLM Key 未配置', status: 'error', suggestion: '请先在设置页配置 LLM Key，或说"往右一点""放大"等简单调整' })
              speechFeedback.speak('这个调整需要先配置 LLM Key。你可以先试试说"往右一点""放大""改颜色"。', {
                onEnd: () => {
                  if (!speech.isManuallyPausedRef.current) speech.resumeListening()
                },
              })
              return
            }
            handleFlowchartLayoutAdjust(transcript)
            return
          }
          // Non-flowchart sketch — treat layout as general vision edit
          if (llmStatus === 'configured') {
            handleSketchEdit(transcript)
          } else {
            updateFeedback({ result: 'LLM Key 未配置', status: 'error', suggestion: '请先在设置页配置 LLM Key，或说"往右一点""放大"等简单调整' })
            speechFeedback.speak('这个调整需要先配置 LLM Key。你可以先试试说"往右一点""放大""改颜色"。', {
              onEnd: () => {
                if (!speech.isManuallyPausedRef.current) speech.resumeListening()
              },
            })
          }
          return
        }

        // 3b. Other complex adjustments that need LLM with vision
        if (/加细节|加一点|加些|再加|轮廓更清楚|改成更像|重新画|增加|删除|改得|我还想|帮我加|长一点|长一些|加长|短一点|短一些|缩短|重来/.test(trimmed)) {
          const shouldAccumulate = /再加|增加|添加|帮我加|我还想加|旁边.*画|[左右上下]角.*加|[左右上下]边.*加/.test(trimmed)
          if (llmStatus !== 'configured' && !shouldAccumulate) {
            updateFeedback({ result: 'LLM Key 未配置', status: 'error', suggestion: '请先在设置页配置 LLM Key，或说"往右一点""放大"等简单调整' })
            speechFeedback.speak('这个调整需要先配置 LLM Key。你可以先试试说"往右一点""放大""改颜色"。', {
              onEnd: () => {
                if (!speech.isManuallyPausedRef.current) speech.resumeListening()
              },
            })
            return
          }
          handleSketchEdit(transcript, shouldAccumulate)
          return
        }

        // 4. Falls through to routeCommands (may route to handleGenerateSketch → handleSketchEdit)
      }

      updateFeedback({ status: 'thinking' })

      routeCommands(transcript).then((actions) => {
        // Clarification / refinement without context — prompt user to describe
        const clarifyAction = actions.find((a) => a.type === 'ask_clarification')
        if (clarifyAction) {
          updateFeedback({ result: '请先描述要画的内容', status: 'error', suggestion: '请先描述要画的内容' })
          speechFeedback.speak('你想让我把哪张图说得更详细？请先描述要画的内容。', {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }

        const sketchAction = actions.find((a) => a.type === 'generate_sketch')
        if (sketchAction) {
          handleGenerateSketch(transcript)
          return
        }

        if (actions.length > 1) {
          handleBatchActions(actions, transcript)
          return
        }

        executeBatch(actions, 0)
      })

      function handleBatchActions(actions: DrawingAction[], rawText: string) {
        const sketchActs = actions.filter((a) => a.type === 'generate_sketch')
        if (sketchActs.length > 0) {
          handleGenerateSketch(rawText)
          return
        }

        const addShapes = actions.filter((a) => a.type === 'add_shape' && a.shape)
        if (addShapes.length > 1) {
          const rawShapes = addShapes.map((a) => (a as DrawingAction & { shape: Shape }).shape)
          if (shapesNeedDistribution(rawShapes)) {
            const distributed = distributeShapes(rawShapes, state.shapes)
            let di = 0
            actions.forEach((action) => {
              if (action.type === 'add_shape' && action.shape && di < distributed.length) {
                const adjusted = { ...action, shape: distributed[di] }
                dispatch(adjusted)
                di++
              } else if (!applyActionWithDualLayer(action)) {
                dispatch(action)
              }
            })
          } else {
            actions.forEach((action) => {
              if (!applyActionWithDualLayer(action)) {
                if (action.type === 'add_shape' && action.shape) {
                  dispatch({ ...action, shape: avoidOverlap(action.shape, state.shapes) })
                } else {
                  dispatch(action)
                }
              }
            })
          }
        } else {
          actions.forEach((action) => {
            if (!applyActionWithDualLayer(action)) {
              if (action.type === 'add_shape' && action.shape) {
                dispatch({ ...action, shape: avoidOverlap(action.shape, state.shapes) })
              } else {
                dispatch(action)
              }
            }
          })
        }
        const message = getBatchFeedback(actions, rawText)
        updateFeedback({ result: message, status: 'success' })
        speechFeedback.speak(message, {
          onEnd: () => {
            if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          },
        })
      }

      function executeBatch(actions: DrawingAction[], index: number) {
        if (index >= actions.length) {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          return
        }

        const action = actions[index]
        const handled = applyActionWithDualLayer(action)

        if (handled) {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
          return
        }

        const message = getActionFeedback(action)
        if (action.type === 'add_shape' && action.shape && action.parseSource !== 'dev') {
          const adjusted: DrawingAction = { ...action, shape: avoidOverlap(action.shape, state.shapes) }
          dispatch(adjusted)
        } else {
          dispatch(action)
        }
        updateFeedback({ result: message, status: 'success' })
        speechFeedback.speak(message, {
          onEnd: () => {
            executeBatch(actions, index + 1)
          },
        })
      }

      function applyActionWithDualLayer(action: DrawingAction): boolean {
        if (action.type === 'generate_sketch') {
          handleGenerateSketch(action.rawText)
          return true
        }

        if (action.type === 'clear_canvas') {
          dispatch(action)
          setSketchStrokes([])
          setSketchMode(null)
          setPendingPlan(null)
          setPendingTranscriptReview(null)
          return false
        }

        if (action.type === 'undo') {
          if (sketchMode !== null) {
            setSketchStrokes([])
            setSketchMode(null)
            setPendingPlan(null)
            setPendingTranscriptReview(null)
            updateFeedback({ result: '已撤销草图', status: 'success' })
            speechFeedback.speak('已撤销草图', {
              onEnd: () => {
                if (!speech.isManuallyPausedRef.current) speech.resumeListening()
              },
            })
            return true
          }
          dispatch(action)
          return false
        }

        return false
      }
    },
  })

  // ---- Render ----

  const showConfig = activePage === CONFIG_MODE

  return (
    <div className="app-shell" aria-label="Say2Draw application scaffold">
      <SidebarNav
        activePage={activePage}
        onNavigate={setActivePage}
        voiceStatus={speech.status}
        llmStatus={llmStatus}
      />

      <main className="app-main">
        {showConfig ? (
          <ConfigPage llmStatus={llmStatus} />
        ) : (
          <div className="drawing-workspace">
            <div className="drawing-header">
              <div className="drawing-mode-title">
                <span className="drawing-mode-icon">{currentPreset.icon}</span>
                <h2>{currentPreset.label}</h2>
              </div>
              <VoiceStatusBar
                status={speech.status}
                interimTranscript={speech.interimTranscript}
                finalTranscript={speech.finalTranscript}
                transcriptReview={pendingTranscriptReview}
                errorMessage={speech.errorMessage}
                isSupported={speech.isSupported}
                onPauseListening={speech.pauseListening}
                onResumeListening={speech.resumeListening}
              />
            </div>

            <section className="canvas-area" aria-label="Canvas board">
              <div className="canvas-stage" style={{ position: 'relative' }}>
                <CanvasBoard
                  ref={canvasRef}
                  shapes={state.shapes}
                  hasOverlayContent={sketchStrokes.length > 0 || !!sketchMode?.flowchartModel || pendingPlan !== null}
                />
                {sketchMode?.flowchartModel ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: CANVAS_WIDTH,
                      height: CANVAS_HEIGHT,
                      pointerEvents: 'none',
                      transform: `translate(${sketchMode.flowchartTransform?.dx ?? 0}px, ${sketchMode.flowchartTransform?.dy ?? 0}px) scale(${sketchMode.flowchartTransform?.scale ?? 1})`,
                      transformOrigin: 'center center',
                      zIndex: 11,
                    }}
                  >
                    <FlowchartLayer
                      model={sketchMode.flowchartModel}
                      width={CANVAS_WIDTH}
                      height={CANVAS_HEIGHT}
                    />
                  </div>
                ) : (
                  <SketchLayer
                    strokes={sketchStrokes}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                  />
                )}
                <PlanConfirmOverlay plan={pendingPlan} voiceStatus={speech.status} />
              </div>
            </section>
          </div>
        )}

        <aside className="context-panel" aria-label="Context panel">
          <PlanCompanion plan={pendingPlan} />
          <ModePresetPanel mode={activeMode} />
          <FeedbackPanel feedback={feedback} />
          {showDevInput ? (
            <form className="dev-command-panel" onSubmit={handleDevCommandSubmit} aria-label="Development command input">
              <label htmlFor="dev-command-input">开发测试输入</label>
              <div className="dev-command-row">
                <input
                  id="dev-command-input"
                  value={devCommand}
                  onChange={(event) => setDevCommand(event.target.value)}
                  placeholder="输入模拟语音指令，如：确认 / 放大一点"
                />
                <button type="submit">执行</button>
              </div>
              <p>仅开发环境显示，用于宿舍/无声测试，不作为正式产品入口。</p>
            </form>
          ) : null}
          <div className="panel-heading">
            <h2>Command History</h2>
          </div>
          <CommandHistory records={state.history} />
        </aside>
      </main>
    </div>
  )
}

export default App
