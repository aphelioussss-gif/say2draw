import { useRef, useReducer, useState } from 'react'
import { CanvasBoard } from './components/CanvasBoard'
import { CommandHistory } from './components/CommandHistory'
import { DevControls } from './components/DevControls'
import { VoicePanel } from './components/VoicePanel'
import { getActionFeedback, getBatchFeedback, getSketchEnterFeedback, getSketchModifierFeedback } from './domain/feedback'
import {
  drawingReducer,
  initialDrawingState,
} from './domain/reducer'
import type { Shape } from './domain/shapes'
import type { DrawingAction, ActiveSketch, ShapePatch } from './domain/actions'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useLLMStatus } from './hooks/useLLMStatus'
import { routeCommands } from './parser/commandRouter'
import './App.css'

const commandExamples = [
  '画一个红色圆形',
  '写上你好',
  '撤销上一步',
  '清空画布',
  '画一个太阳、两朵云和一棵树',
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

function App() {
  const [state, dispatch] = useReducer(drawingReducer, initialDrawingState)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [activeSketch, setActiveSketch] = useState<ActiveSketch | null>(null)
  const activeSketchRef = useRef<ActiveSketch | null>(null)
  const nextShapeIndexRef = useRef(0)
  const speechFeedback = useSpeechSynthesis()
  const llmStatus = useLLMStatus()

  // --- Sketch Mode Helpers (defined before useSpeechRecognition for closure access) ---

  const COLOR_MAP: Record<string, string> = {
    '红色': '#ef4444', '红': '#ef4444',
    '蓝色': '#3b82f6', '蓝': '#3b82f6',
    '绿色': '#22c55e', '绿': '#22c55e',
    '黄色': '#eab308', '黄': '#eab308',
    '黑色': '#111827', '黑': '#111827',
    '白色': '#f9fafb', '白': '#f9fafb',
  }

  function createTimestamp() {
    return new Date().toISOString()
  }

  function extractObjectName(rawText: string): string | null {
    const m = rawText.match(/(?:画|绘制|加|添加)(?:一个|一只|一棵|一座|一条|一朵|一片|个|只|棵|座|条|朵|片)?(.+?)(?:[，。,.！!？?]|$)/)
    if (!m || !m[1]) return null
    const name = m[1].trim()
    return name.length <= 12 && !/^(圆形|矩形|线条|椭圆|多边形|文字)/.test(name) ? name : null
  }

  function isSketchModifier(rawText: string): boolean {
    const t = rawText.trim()
    return /^(长一点|长一些|加长|短一点|短一些|缩短|大一点|大一些|放大|小一点|小一些|缩小|往左|往右|往上|往下|颜色改|改颜色|重来|就这样|可以了|好了|算了|不画了)/.test(t)
  }

  function isDrawingIntent(rawText: string): boolean {
    return /^(画|绘制|加|添加)/.test(rawText.trim())
  }

  function moveAllShapes(dx: number, dy: number) {
    const sketch = activeSketchRef.current
    if (!sketch) return
    sketch.shapeIds.forEach((id) => {
      const shape = state.shapes.find((s) => s.id === id)
      if (!shape) return
      const patch: ShapePatch = {}
      if ('x' in shape && typeof shape.x === 'number') patch.x = shape.x + dx
      if ('y' in shape && typeof shape.y === 'number') patch.y = shape.y + dy
      if ('x1' in shape && typeof shape.x1 === 'number') patch.x1 = shape.x1 + dx
      if ('x2' in shape && typeof shape.x2 === 'number') patch.x2 = shape.x2 + dx
      if ('y1' in shape && typeof shape.y1 === 'number') patch.y1 = shape.y1 + dy
      if ('y2' in shape && typeof shape.y2 === 'number') patch.y2 = shape.y2 + dy
      dispatch({
        type: 'update_shape',
        shapeId: id,
        patch,
        rawText: 'sketch-move',
        parseSource: 'local',
        createdAt: createTimestamp(),
      })
    })
  }

  function handleSketchModifier(rawText: string) {
    const sketch = activeSketchRef.current
    if (!sketch) return

    const t = rawText.trim()
    const mainShapeId = sketch.shapeIds[0]
    const feedback = getSketchModifierFeedback(rawText) ?? '好的'

    const done = () => {
      if (!speech.isManuallyPausedRef.current) speech.resumeListening()
    }

    // Exit commands
    if (/^(就这样|可以了|好了|算了|不画了)/.test(t)) {
      setActiveSketch(null)
      activeSketchRef.current = null
      setFeedbackMessage(feedback)
      speechFeedback.speak(feedback, { onEnd: done })
      return
    }

    // Reset
    if (/^重来/.test(t)) {
      const initialMain = sketch.initialShapes[0]
      if (initialMain.type === 'rect') {
        const patchUpdate: ShapePatch = {
          x: initialMain.x, y: initialMain.y,
          width: initialMain.width, height: initialMain.height,
          fill: initialMain.fill,
        }
        dispatch({
          type: 'update_shape', shapeId: mainShapeId, patch: patchUpdate,
          rawText, parseSource: 'local', createdAt: createTimestamp(),
        })
      }
      const updated = { ...sketch, round: 0 }
      activeSketchRef.current = updated
      setActiveSketch(updated)
      setFeedbackMessage(feedback)
      speechFeedback.speak(feedback, { onEnd: done })
      return
    }

    // Color change
    if (/颜色改|改颜色/.test(t)) {
      const colorMatch = t.match(/颜色改成?|改颜色[为成]?\s*(\S+)/)
      if (colorMatch) {
        const hex = COLOR_MAP[colorMatch[1]]
        if (hex) {
          sketch.shapeIds.forEach((id) => {
            dispatch({ type: 'update_shape', shapeId: id, patch: { fill: hex }, rawText, parseSource: 'local', createdAt: createTimestamp() })
          })
          const updated = { ...sketch, round: sketch.round + 1 }
          activeSketchRef.current = updated
          setActiveSketch(updated)
          setFeedbackMessage(feedback)
          speechFeedback.speak(feedback, { onEnd: done })
          return
        }
      }
      setFeedbackMessage('支持的颜色：红色、蓝色、绿色、黄色、黑色、白色')
      speechFeedback.speak('支持的颜色：红色、蓝色、绿色、黄色、黑色、白色', { onEnd: done })
      return
    }

    // Size/position modifiers
    let patch: ShapePatch = {}

    if (/^长一点|长一些|加长/.test(t)) {
      const cur = state.shapes.find((s) => s.id === mainShapeId)
      patch = { width: cur && 'width' in cur ? Math.round((cur as Record<string, unknown>).width as number * 1.3) : 260 }
    } else if (/^短一点|短一些|缩短/.test(t)) {
      const cur = state.shapes.find((s) => s.id === mainShapeId)
      patch = { width: cur && 'width' in cur ? Math.round((cur as Record<string, unknown>).width as number * 0.7) : 140 }
    } else if (/^大一点|大一些|放大/.test(t)) {
      patch = { scale: 1.2 }
    } else if (/^小一点|小一些|缩小/.test(t)) {
      patch = { scale: 0.8 }
    } else if (/^往左/.test(t)) {
      moveAllShapes(-30, 0)
      const updated = { ...sketch, round: sketch.round + 1 }
      activeSketchRef.current = updated
      setActiveSketch(updated)
      setFeedbackMessage(feedback)
      speechFeedback.speak(feedback, { onEnd: done })
      return
    } else if (/^往右/.test(t)) {
      moveAllShapes(30, 0)
      const updated = { ...sketch, round: sketch.round + 1 }
      activeSketchRef.current = updated
      setActiveSketch(updated)
      setFeedbackMessage(feedback)
      speechFeedback.speak(feedback, { onEnd: done })
      return
    } else if (/^往上/.test(t)) {
      moveAllShapes(0, -30)
      const updated = { ...sketch, round: sketch.round + 1 }
      activeSketchRef.current = updated
      setActiveSketch(updated)
      setFeedbackMessage(feedback)
      speechFeedback.speak(feedback, { onEnd: done })
      return
    } else if (/^往下/.test(t)) {
      moveAllShapes(0, 30)
      const updated = { ...sketch, round: sketch.round + 1 }
      activeSketchRef.current = updated
      setActiveSketch(updated)
      setFeedbackMessage(feedback)
      speechFeedback.speak(feedback, { onEnd: done })
      return
    }

    // Apply patch
    if (mainShapeId) {
      if (patch.scale) {
        sketch.shapeIds.forEach((id) => {
          dispatch({ type: 'update_shape', shapeId: id, patch: { scale: patch.scale }, rawText, parseSource: 'local', createdAt: createTimestamp() })
        })
      } else {
        dispatch({ type: 'update_shape', shapeId: mainShapeId, patch, rawText, parseSource: 'local', createdAt: createTimestamp() })
      }
    }

    const updated = { ...sketch, round: sketch.round + 1 }
    activeSketchRef.current = updated
    setActiveSketch(updated)
    setFeedbackMessage(feedback)
    speechFeedback.speak(feedback, { onEnd: done })
  }

  function enterSketchMode(objectName: string) {
    const ts = createTimestamp()
    const rectId = `sketch-rect-${ts}`
    const textId = `sketch-text-${ts}`

    const rectShape: Shape = {
      id: rectId, type: 'rect',
      x: 300, y: 170, width: 200, height: 120,
      fill: '#e5e7eb', stroke: '#9ca3af', lineWidth: 3,
    }
    const textShape: Shape = {
      id: textId, type: 'text',
      x: 400, y: 320, text: `${objectName}(待修改)`,
      fontSize: 28, fill: '#6b7280', align: 'center',
    }

    const sketch: ActiveSketch = {
      objectName, shapeIds: [rectId, textId],
      initialShapes: [rectShape, textShape], round: 0,
    }
    activeSketchRef.current = sketch
    setActiveSketch(sketch)

    dispatch({ type: 'add_shape', shape: rectShape, rawText: `画${objectName}`, parseSource: 'local', createdAt: ts })
    dispatch({ type: 'add_shape', shape: textShape, rawText: `画${objectName}`, parseSource: 'local', createdAt: ts })

    const message = getSketchEnterFeedback(objectName)
    setFeedbackMessage(message)
    speechFeedback.speak(message, {
      onEnd: () => {
        if (!speech.isManuallyPausedRef.current) speech.resumeListening()
      },
    })
  }

  // --- Speech Recognition ---

  const speech = useSpeechRecognition({
    shouldIgnoreResult: () => speechFeedback.isSpeaking,
    onFinalTranscript: (transcript) => {
      speech.pauseListening()

      // Check sketch mode modifier first
      if (activeSketchRef.current && isSketchModifier(transcript)) {
        handleSketchModifier(transcript)
        return
      }

      // If in sketch mode and user starts a new drawing, exit sketch mode
      if (activeSketchRef.current && isDrawingIntent(transcript)) {
        setActiveSketch(null)
        activeSketchRef.current = null
      }

      setFeedbackMessage('思考中...')

      routeCommands(transcript).then((actions) => {
        // Fallback sketch: all actions are parse_error but user had drawing intent
        const allErrors = actions.length > 0 && actions.every((a) => a.type === 'parse_error')
        if (allErrors && isDrawingIntent(transcript)) {
          const objectName = extractObjectName(transcript)
          if (objectName) {
            enterSketchMode(objectName)
            return
          }
        }

        if (actions.length > 1) {
          actions.forEach((action) => dispatch(action))
          const message = getBatchFeedback(actions, transcript)
          setFeedbackMessage(message)
          speechFeedback.speak(message, {
            onEnd: () => {
              if (!speech.isManuallyPausedRef.current) {
                speech.resumeListening()
              }
            },
          })
          return
        }

        executeBatch(actions, 0)
      })

      function executeBatch(actions: DrawingAction[], index: number) {
        if (index >= actions.length) {
          if (!speech.isManuallyPausedRef.current) {
            speech.resumeListening()
          }
          return
        }

        const action = actions[index]
        const message = getActionFeedback(action)
        dispatch(action)
        setFeedbackMessage(message)
        speechFeedback.speak(message, {
          onEnd: () => {
            executeBatch(actions, index + 1)
          },
        })
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
    setFeedbackMessage('已清空画布')
  }

  function handleUndo() {
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
          onPauseListening={speech.pauseListening}
          onResumeListening={speech.resumeListening}
          feedbackMessage={feedbackMessage}
          isFeedbackSpeaking={speechFeedback.isSpeaking}
          isFeedbackVoiceSupported={speechFeedback.isSupported}
          llmStatus={llmStatus}
          activeSketch={activeSketch}
        />

        <section className="canvas-area" aria-label="Canvas board">
          <div className="canvas-stage">
            <CanvasBoard shapes={state.shapes} />
            <DevControls
              shapes={state.shapes}
              canUndo={state.past.length > 0}
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
