import { useReducer, useRef } from 'react'
import { CanvasBoard } from './components/CanvasBoard'
import { CommandHistory } from './components/CommandHistory'
import { DevControls } from './components/DevControls'
import { VoicePanel } from './components/VoicePanel'
import {
  drawingReducer,
  initialDrawingState,
} from './domain/reducer'
import type { Shape } from './domain/shapes'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { routeCommand } from './parser/commandRouter'
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
  const nextShapeIndexRef = useRef(0)
  const speech = useSpeechRecognition({
    onFinalTranscript: (transcript) => {
      dispatch(routeCommand(transcript))
    },
  })

  function createTimestamp() {
    return new Date().toISOString()
  }

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
  }

  function handleClearCanvas() {
    dispatch({
      type: 'clear_canvas',
      rawText: 'DEV clear canvas',
      parseSource: 'dev',
      createdAt: createTimestamp(),
    })
  }

  function handleUndo() {
    dispatch({
      type: 'undo',
      rawText: 'DEV undo',
      parseSource: 'dev',
      createdAt: createTimestamp(),
    })
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
