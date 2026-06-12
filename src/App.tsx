import './App.css'

const commandExamples = [
  '画一个红色圆形',
  '写上你好',
  '撤销上一步',
  '清空画布',
  '画一个太阳、两朵云和一棵树',
]

const historyItems = [
  {
    source: 'local',
    transcript: '画一个红色圆形',
    action: 'add_shape',
    status: 'ready',
  },
  {
    source: 'local',
    transcript: '撤销上一步',
    action: 'undo',
    status: 'ready',
  },
  {
    source: 'llm',
    transcript: '画一个太阳、两朵云和一棵树',
    action: 'batch_actions',
    status: 'planned',
  },
]

function App() {
  return (
    <main className="app-shell" aria-label="Say2Draw application scaffold">
      <header className="status-bar">
        <div>
          <p className="eyebrow">Say2Draw</p>
          <h1>以声绘色</h1>
        </div>
        <div className="status-pill" aria-label="Voice status: idle">
          <span className="status-dot idle" aria-hidden="true" />
          <span>Idle / 等待麦克风权限</span>
        </div>
      </header>

      <section className="workspace" aria-label="Voice drawing workspace">
        <aside className="voice-panel" aria-label="Voice recognition status">
          <div className="panel-heading">
            <span className="status-dot listening" aria-hidden="true" />
            <h2>Voice Panel</h2>
          </div>

          <section className="voice-card">
            <p className="label">你说</p>
            <p className="content placeholder">尚未接入语音识别</p>
          </section>

          <section className="voice-card">
            <p className="label">系统反馈</p>
            <p className="content">PR 1 只搭建基础页面，后续 PR 接入自动监听。</p>
          </section>

          <section className="demo-prompts" aria-label="Demo command examples">
            <p className="label">试着说</p>
            <ul>
              {commandExamples.map((command) => (
                <li key={command}>{command}</li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="canvas-area" aria-label="Canvas placeholder">
          <div className="canvas-board" role="img" aria-label="Canvas placeholder">
            <div className="canvas-empty-state">
              <p>Canvas Board</p>
              <span>Say: "画一个红色圆形"</span>
            </div>
          </div>
        </section>

        <aside className="history-panel" aria-label="Command history">
          <div className="panel-heading">
            <h2>Command History</h2>
          </div>

          <ol className="history-list">
            {historyItems.map((item) => (
              <li className="history-item" key={`${item.source}-${item.action}`}>
                <div className="history-source">[{item.source}]</div>
                <div>
                  <p>{item.transcript}</p>
                  <span>
                    -&gt; {item.action} {item.status}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  )
}

export default App
