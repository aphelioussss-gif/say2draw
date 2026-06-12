# Say2Draw 前端设计规范

---

## 1. 整体风格

**AI Control Room + Creative Canvas**

不引入 Tailwind、组件库、暗黑模式切换。用纯 CSS 变量实现，写一次到处用。

---

## 2. CSS 变量（直接复制进 App.css）

```css
:root {
  --bg-app:         #0d1117;
  --bg-panel:       #161b22;
  --bg-canvas:      #ffffff;
  --border:         #30363d;
  --accent:         #3b82f6;   /* Speaking 状态 */
  --accent-green:   #22c55e;   /* Listening 状态 */
  --accent-yellow:  #eab308;   /* Processing 状态 */
  --accent-red:     #ef4444;   /* 错误 / Unsupported */
  --text-primary:   #e6edf3;
  --text-secondary: #8b949e;
  --text-muted:     #484f58;   /* Idle 状态 */
}

body {
  background: var(--bg-app);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
}
```

---

## 3. 布局

三栏固定布局，不随窗口缩放：

```
┌──────────────────────────────────────────────────┐
│  VoiceCanvas                    ● Listening...    │  ← StatusBar
├─────────────────┬───────────────────┬────────────┤
│  Voice Panel    │   Canvas Board    │  History   │
│  240px          │   flex: 1         │  280px     │
│                 │   800×500 固定    │            │
└─────────────────┴───────────────────┴────────────┘
```

```css
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.voice-panel    { width: 240px; flex-shrink: 0; }
.canvas-area    { flex: 1; overflow: auto; }
.history-panel  { width: 280px; flex-shrink: 0; }
```

Canvas 尺寸写入 constants.ts，不要写 magic number：

```ts
export const CANVAS_WIDTH  = 800;
export const CANVAS_HEIGHT = 500;
```

---

## 4. StatusBar

```
Say2Draw    [● 状态灯]  [状态文字]
```

状态灯是 8px 圆点，Listening 时有 pulse 动效（纯 CSS，不用 JS）：

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.listening  { background: var(--accent-green);  animation: pulse 1.5s ease-in-out infinite; }
.status-dot.processing { background: var(--accent-yellow); }
.status-dot.speaking   { background: var(--accent); }
.status-dot.error      { background: var(--accent-red); }
.status-dot.idle       { background: var(--text-muted); }
```

---

## 5. 左侧 VoicePanel

三个区块从上到下：

**① 当前状态**
```
● Listening
```

**② 识别文本卡片**
```
┌───────────────────────┐
│ 你说：                 │
│ "画一个红色圆形"       │
└───────────────────────┘
```

**③ 系统反馈卡片**
```
┌───────────────────────┐
│ 系统：                 │
│ 已为你画了一个红色圆形 │
└───────────────────────┘
```

**④ Demo 指令提示区（底部，纯文字）**
```
试着说：
画一个红色圆形  /  写上你好
撤销  /  清空画布
画一个太阳、两朵云和一棵树
```

卡片样式：
```css
.voice-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.voice-card .label {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 4px;
}

.voice-card .content {
  color: var(--text-primary);
  font-size: 14px;
}
```

---

## 6. 中间 CanvasBoard

```css
.canvas-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
}

canvas {
  border: 1px solid var(--border);
  background: var(--bg-canvas);
  display: block;
}
```

空状态提示渲染在 Canvas 上（不是 HTML）：

```ts
if (shapes.length === 0) {
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Say: "画一个红色圆形"', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
}
```

---

## 7. 右侧 CommandHistory

等宽字体，体现工程链路感。

每条记录格式：
```
[local] 画一个红色圆形
        → add_shape ✓

[llm]   画一个太阳和两朵云
        → batch_actions ✓

[?]     嗯嗯嗯
        → clarification
```

标签颜色：
```ts
const SOURCE_COLOR = {
  local:   'var(--accent-green)',
  llm:     'var(--accent)',
  unknown: 'var(--accent-yellow)',
  error:   'var(--accent-red)',
};
```

样式：
```css
.history-panel {
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 13px;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
}
```

自动滚动到最新记录（在 useEffect 里处理）：
```ts
useEffect(() => {
  if (historyRef.current) {
    historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }
}, [history]);
```

---

## 8. 面板通用样式

```css
.panel {
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
```

---

## 9. 什么不做

- 不用 Tailwind
- 不用任何 UI 组件库
- 不做暗黑模式切换
- 不做移动端适配
- 不做复杂过渡动画（除 pulse 外）
- 不做渐变背景、毛玻璃等视觉特效
