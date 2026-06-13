import { useRef, useReducer, useState } from 'react'
import { CanvasBoard } from './components/CanvasBoard'
import { CommandHistory } from './components/CommandHistory'
import { DevControls } from './components/DevControls'
import { VoicePanel } from './components/VoicePanel'
import { SketchLayer } from './components/SketchLayer'
import { getActionFeedback, getBatchFeedback } from './domain/feedback'
import {
  drawingReducer,
  initialDrawingState,
} from './domain/reducer'
import { CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_ZONES, type Shape } from './domain/shapes'
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
import type { RenderedStroke, RawStroke, BezierSegment, ControlPoint } from './sketch/types'
import './App.css'

const GRID_RES = 50

const commandExamples = [
  '画一只猫',
  '在左边画太阳和树',
  '在右上角写上你好',
  '长一点 · 往右移 · 就这样',
]

const systemCommands = [
  '撤销',
  '清空画布',
]

const devShapeTemplates: Shape[] = [
  {
    id: 'template-circle',
    type: 'circle',
    x: 150,
    y: 150,
    radius: 58,
    fill: '#fee2e2',
    stroke: '#ef4444',
    lineWidth: 4,
  },
  {
    id: 'template-rect',
    type: 'rect',
    x: 500,
    y: 92,
    width: 170,
    height: 116,
    fill: '#dbeafe',
    stroke: '#3b82f6',
    lineWidth: 4,
  },
  {
    id: 'template-line',
    type: 'line',
    x1: 190,
    y1: 330,
    x2: 610,
    y2: 332,
    stroke: '#22c55e',
    lineWidth: 6,
  },
  {
    id: 'template-text',
    type: 'text',
    x: 400,
    y: 260,
    text: '你好 Say2Draw',
    fill: '#111827',
    fontSize: 34,
  },
]

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

function normalizeSketchPoints(strokes: ControlPoint[][]): ControlPoint[][] {
  const bounds = getSketchPixelBounds(strokes)
  if (!bounds) return strokes

  const targetWidth = CANVAS_WIDTH * 0.68
  const targetHeight = CANVAS_HEIGHT * 0.68
  const minTargetWidth = CANVAS_WIDTH * 0.36
  const minTargetHeight = CANVAS_HEIGHT * 0.34
  const fitScale = Math.min(targetWidth / bounds.width, targetHeight / bounds.height)
  const readableScale = Math.max(minTargetWidth / bounds.width, minTargetHeight / bounds.height)
  const scale = Math.max(0.55, Math.min(1.22, fitScale, readableScale))
  const centerX = bounds.minX + bounds.width / 2
  const centerY = bounds.minY + bounds.height / 2
  const targetCenterX = CANVAS_WIDTH / 2
  const targetCenterY = CANVAS_HEIGHT / 2

  return strokes.map((stroke) =>
    stroke.map(([x, y]) => [
      targetCenterX + (x - centerX) * scale,
      targetCenterY + (y - centerY) * scale,
    ]),
  )
}

// ---- Helper: fit LLM strokes into renderable segments ----
function fitAndRenderStrokes(rawStrokes: RawStroke[]): RenderedStroke[] {
  const pixelStrokes = rawStrokes.map((raw) =>
    raw.points.map((cell) => {
      const m = cell.match(/x(\d+)y(\d+)/)
      if (!m) return [0, 0] as [number, number]
      return gridToPixel(parseInt(m[1], 10), parseInt(m[2], 10), GRID_RES, CANVAS_WIDTH, CANVAS_HEIGHT)
    }),
  )
  const normalizedStrokes = normalizeSketchPoints(pixelStrokes)

  return rawStrokes.map((raw, i) => {
    const sampledPoints = normalizedStrokes[i] ?? []
    const tValues = raw.tValues.length === sampledPoints.length
      ? raw.tValues
      : Array.from({ length: sampledPoints.length }, (_, j) =>
          sampledPoints.length === 1 ? 0 : j / (sampledPoints.length - 1),
        )

    const segments = fitBezierCurve(sampledPoints as [number, number][], tValues)

    // filter out empty segments
    const validSegments: BezierSegment[] = segments.filter(
      (seg) => seg.length > 0,
    )

    return {
      id: raw.id || `stroke-${i}`,
      segments: validSegments,
    }
  }).filter((s) => s.segments.length > 0)
}

function App() {
  const [state, dispatch] = useReducer(drawingReducer, initialDrawingState)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const nextShapeIndexRef = useRef(0)
  const speechFeedback = useSpeechSynthesis()
  const llmStatus = useLLMStatus()

  // ---- Sketch stroke state ----
  const [sketchStrokes, setSketchStrokes] = useState<RenderedStroke[]>([])
  const [sketchMode, setSketchMode] = useState<{
    concept: string
    rawStrokes: RawStroke[]
  } | null>(null)
  // TODO(PR19): add loading overlay when isGeneratingSketch is true
  const [, setIsGeneratingSketch] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ---- Helpers ----

  function createTimestamp() {
    return new Date().toISOString()
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

  /** Try up to 5 offset attempts to avoid overlap. Returns adjusted shape or original. */
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
    return shape // give up, accept overlap
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

  /** Check if shapes are all close to default center — meaning they need distribution. */
  function shapesNeedDistribution(shapes: Shape[]): boolean {
    if (shapes.length <= 1) return false
    // If more than 2 shapes with same-ish center → distribute
    const centers = shapes.map(shapeCenter)
    const allNearCenter = centers.every((c) => Math.abs(c.cx - 400) < 20 && Math.abs(c.cy - 250) < 20)
    if (allNearCenter) return true
    // If any two shapes overlap → distribute
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        if (boxesOverlap(shapeBBox(shapes[i]), shapeBBox(shapes[j]))) return true
      }
    }
    return false
  }

  /** Distribute shapes across zones, avoiding overlap with existing shapes. */
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

  // ---- Sketch generation ----

  async function handleGenerateSketch(rawText: string) {
    // If sketch already exists on canvas, route to multimodal edit (accumulation)
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
    setFeedbackMessage('正在绘制草图...')
    speechFeedback.speak('正在绘制草图...', {
      onEnd: () => { /* keep waiting for API response */ },
    })

    try {
      const zone = extractSpatialZone(rawText)
      const res = await fetch('/api/sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, zone }),
      })
      const data = await res.json()

      if (data.ok && data.sketch) {
        console.log('[Sketch] Response received, length:', data.sketch.length)
        const parsed = parseSketchXML(data.sketch, GRID_RES)
        console.log('[Sketch] Parsed:', parsed ? `${parsed.strokes.length} strokes` : 'NULL')
        if (parsed && parsed.strokes.length > 0) {
          const rendered = fitAndRenderStrokes(parsed.strokes)
          console.log('[Sketch] Rendered:', rendered.length, 'renderable strokes')
          setSketchStrokes(rendered)
          setSketchMode({ concept: parsed.concept, rawStrokes: parsed.strokes })

          dispatch({
            type: 'generate_sketch',
            rawText,
            parseSource: 'llm',
            createdAt: createTimestamp(),
            message: `Generated sketch: ${parsed.concept}`,
          })

          const message = `已为你画了${parsed.concept}的草图`
          setFeedbackMessage(message)
          speechFeedback.speak(message, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      // Log failure details for debugging
      console.warn('[Sketch] Generation failed:', { rawText, zone, ok: data.ok, hasSketch: !!data.sketch, error: data.error })
      setFeedbackMessage('草图生成失败，请重试')
      speechFeedback.speak('草图生成失败，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } catch {
      setFeedbackMessage('网络错误，请重试')
      speechFeedback.speak('网络错误，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  // ---- Sketch editing (multimodal) ----

  async function handleSketchEdit(instruction: string, accumulate = false) {
    if (!sketchMode) return

    setIsGeneratingSketch(true)
    const screenshot = captureCanvas(canvasRef.current)

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
        }),
      })
      const data = await res.json()

      if (data.ok && data.sketch) {
        const parsed = parseSketchXML(data.sketch, GRID_RES)
        if (parsed && parsed.strokes.length > 0) {
          const rendered = fitAndRenderStrokes(parsed.strokes)
          if (accumulate) {
            // Append new strokes to existing ones
            setSketchStrokes((prev) => [...prev, ...rendered])
          } else {
            setSketchStrokes(rendered)
          }
          setSketchMode({ ...sketchMode, rawStrokes: parsed.strokes })

          const feedback = `好的，已按"${instruction}"调整`
          setFeedbackMessage(feedback)
          speechFeedback.speak(feedback, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
      }

      console.warn('[SketchEdit] Edit failed:', { instruction, accumulate, ok: data.ok, hasSketch: !!data.sketch, error: data.error })
      setFeedbackMessage('调整失败，请重试')
      speechFeedback.speak('调整失败，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } catch {
      setFeedbackMessage('网络错误，请重试')
      speechFeedback.speak('网络错误，请重试', {
        onEnd: () => {
          if (!speech.isManuallyPausedRef.current) speech.resumeListening()
        },
      })
    } finally {
      setIsGeneratingSketch(false)
    }
  }

  // ---- Speech Recognition ----

  const speech = useSpeechRecognition({
    shouldIgnoreResult: () => speechFeedback.isSpeaking,
    onFinalTranscript: (transcript) => {
      speech.pauseListening()

      // Sketch modifier routing: sketch mode only
      if (sketchMode !== null && /^(长一点|长一些|加长|短一点|短一些|缩短|大一点|大一些|放大|小一点|小一些|缩小|往左|往右|往上|往下|颜色改|改颜色|重来|就这样|可以了|好了|算了|不画了)/.test(transcript.trim())) {
        if (/^(就这样|可以了|好了|算了|不画了)/.test(transcript.trim())) {
          setSketchMode(null)
          setFeedbackMessage('好的，草图已确认')
          speechFeedback.speak('好的，草图已确认', {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) speech.resumeListening()
            },
          })
          return
        }
        handleSketchEdit(transcript)
        return
      }

      setFeedbackMessage('思考中...')

      routeCommands(transcript).then((actions) => {
        // Intercept generate_sketch — the unified drawing pipeline
        const sketchAction = actions.find((a) => a.type === 'generate_sketch')
        if (sketchAction) {
          handleGenerateSketch(transcript)
          return
        }

        // Batch execution with dual-layer clear/undo
        if (actions.length > 1) {
          handleBatchActions(actions, transcript)
          return
        }

        executeBatch(actions, 0)
      })

      function handleBatchActions(actions: DrawingAction[], rawText: string) {
        // Filter sketch actions
        const sketchActs = actions.filter((a) => a.type === 'generate_sketch')
        if (sketchActs.length > 0) {
          handleGenerateSketch(rawText)
          return
        }

        // A4: Conditional multi-object distribution
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
        setFeedbackMessage(message)
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
        // A2: Avoid overlap for add_shape from non-dev sources
        if (action.type === 'add_shape' && action.shape && action.parseSource !== 'dev') {
          const adjusted: DrawingAction = { ...action, shape: avoidOverlap(action.shape, state.shapes) }
          dispatch(adjusted)
        } else {
          dispatch(action)
        }
        setFeedbackMessage(message)
        speechFeedback.speak(message, {
          onEnd: () => {
            executeBatch(actions, index + 1)
          },
        })
      }

      /** Apply action with dual-layer clear/undo. Returns true if handled here. */
      function applyActionWithDualLayer(action: DrawingAction): boolean {
        if (action.type === 'generate_sketch') {
          handleGenerateSketch(action.rawText)
          return true
        }

        if (action.type === 'clear_canvas') {
          dispatch(action)
          setSketchStrokes([])
          setSketchMode(null)
          return false // let caller handle feedback
        }

        if (action.type === 'undo') {
          // Sketch layer takes priority
          if (sketchStrokes.length > 0) {
            setSketchStrokes([])
            setSketchMode(null)
            setFeedbackMessage('已撤销草图')
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

  function handleAddShape() {
    const index = nextShapeIndexRef.current
    const template = devShapeTemplates[index % devShapeTemplates.length]
    const shape = {
      ...template,
      id: `dev-${template.type}-${index}`,
    }

    nextShapeIndexRef.current += 1

    dispatch({
      type: 'add_shape',
      shape,
      rawText: `DEV add ${shape.type}`,
      parseSource: 'dev',
      createdAt: createTimestamp(),
    })
    setFeedbackMessage('已添加开发测试图形')
  }

  function handleClearCanvas() {
    dispatch({
      type: 'clear_canvas',
      rawText: 'DEV clear canvas',
      parseSource: 'dev',
      createdAt: createTimestamp(),
    })
    setSketchStrokes([])
    setSketchMode(null)
    setFeedbackMessage('已清空画布')
  }

  function handleUndo() {
    if (sketchStrokes.length > 0) {
      setSketchStrokes([])
      setSketchMode(null)
      setFeedbackMessage('已撤销草图')
      return
    }
    dispatch({
      type: 'undo',
      rawText: 'DEV undo',
      parseSource: 'dev',
      createdAt: createTimestamp(),
    })
    setFeedbackMessage('已撤销上一步')
  }

  return (
    <main className="app-shell" aria-label="Say2Draw application scaffold">
      <header className="status-bar">
        <div>
          <p className="eyebrow">Say2Draw</p>
          <h1>以声绘色</h1>
        </div>
        <div className="status-pill" aria-label={`Voice status: ${speech.status}`}>
          <span className={`status-dot ${speech.status}`} aria-hidden="true" />
          <span>{speech.status}</span>
        </div>
      </header>

      <section className="workspace" aria-label="Voice drawing workspace">
        <VoicePanel
          status={speech.status}
          interimTranscript={speech.interimTranscript}
          finalTranscript={speech.finalTranscript}
          errorMessage={speech.errorMessage}
          isSupported={speech.isSupported}
          commandExamples={commandExamples}
          systemCommands={systemCommands}
          onPauseListening={speech.pauseListening}
          onResumeListening={speech.resumeListening}
          feedbackMessage={feedbackMessage}
          isFeedbackSpeaking={speechFeedback.isSpeaking}
          isFeedbackVoiceSupported={speechFeedback.isSupported}
          llmStatus={llmStatus}
        />

        <section className="canvas-area" aria-label="Canvas board">
          <div className="canvas-stage" style={{ position: 'relative' }}>
            <CanvasBoard
              ref={canvasRef}
              shapes={state.shapes}
              hasOverlayContent={sketchStrokes.length > 0}
            />
            <SketchLayer
              strokes={sketchStrokes}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            />
            <DevControls
              shapes={state.shapes}
              canUndo={state.past.length > 0 || sketchStrokes.length > 0}
              onAddShape={handleAddShape}
              onClearCanvas={handleClearCanvas}
              onUndo={handleUndo}
            />
          </div>
        </section>

        <aside className="history-panel" aria-label="Command history">
          <div className="panel-heading">
            <h2>Command History</h2>
          </div>

          <CommandHistory records={state.history} />
        </aside>
      </section>
    </main>
  )
}

export default App
