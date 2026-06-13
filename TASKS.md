# Say2Draw Task Board

## 1. Project Info

Project Name: Say2Draw

Full Name: Say2Draw｜以声绘色

Tagline: 纯语音控制的 AI 绘图工具

Challenge Topic: AI 语音绘图工具

Core Workflow:

```text
Voice Input → Speech Recognition → Command Parsing → DrawingAction → Canvas Rendering → Voice Feedback
```

Development Principle:

```text
Stable MVP first. Small PRs. Continuous commits. Main branch always runnable.
```

---

## 2. Development Window

本批次开发时间：

* Start: 2026-06-12 00:00
* End: 2026-06-14 23:59

Important Rule:

所有 commit 时间戳必须落在本批次开发周期内。
禁止最后一天一次性导入所有代码。
每个 PR 必须有明确标题、描述、测试方式和合理 commit。

---

## 3. Current Priority

当前最高优先级：

1. 先完成项目治理文档。
2. 再完成基础页面。
3. 再打通 Canvas 绘图。
4. 再接语音识别。
5. 再打通"语音 → 指令 → 绘图 → 反馈"闭环。
6. 最后补充 LLM 复杂指令解析、Demo 文档和视频。

MVP 判断标准：

```text
用户可以不用鼠标和键盘，通过语音完成绘图、撤销、清空和基础反馈。
```

---

## 4. PR Progress

| PR    | Status | Branch                       | Title                                            | Key Commit | Completed At | Notes                                |
| ----- | ------ | ---------------------------- | ------------------------------------------------ | ---------- | ------------ | ------------------------------------ |
| PR 0  | Done   | main                         | chore: initialize project baseline               | b72e3c2    | 2026-06-12   | PRD / PLAN / SYSTEM / AGENTS / TASKS / Vite baseline |
| PR 1  | Done   | app-scaffold                 | feat: initialize app scaffold                    | d835ab2    | 2026-06-12   | 基础页面布局，不做业务功能                        |
| PR 2  | Done   | canvas-engine                | feat: add canvas drawing engine                  | -          | 2026-06-12   | Canvas 渲染基础图形                        |
| PR 3  | Done   | drawing-reducer              | feat: add drawing reducer and history            | -          | 2026-06-12   | useReducer / undo / history          |
| PR 4  | Done   | speech-recognition           | feat: add automatic speech recognition           | -          | 2026-06-12   | 自动持续监听，不是点击开始                        |
| PR 5  | Done   | local-parser                 | feat: add local command parser                   | -          | 2026-06-12   | 本地规则解析中文指令                           |
| PR 6  | Done   | voice-to-canvas              | feat: connect voice commands to canvas actions   | -          | 2026-06-12   | 打通语音到绘图闭环                            |
| PR 7  | Done   | speech-feedback              | feat: add speech feedback                        | -          | 2026-06-12   | 语音反馈与回声保护                            |
| PR 8  | Done   | fix/speech-feedback-sync     | fix: resolve speech feedback sync issues         | -          | 2026-06-12   | 修复状态同步和并发问题                            |
| PR 9  | Done   | feat/llm-parser              | feat: add llm structured command parser          | -          | 2026-06-12   | OpenAI-compatible LLM 兜底            |
| PR 10 | In Progress | feat/batch-actions        | feat: support batch actions and clarification    | -          | -            | 复杂指令拆解与澄清                            |
| PR 11 | Todo   | docs/finalize-submission     | docs: finalize readme design doc and demo script | -          | -            | README / DESIGN / Demo 视频            |
| PR 14 | Done   | feat/expressiveness-upgrade | feat: improve drawing expressiveness             | 9dd512b    | 2026-06-12   | 新增 ellipse/polygon、prompt 构图增强、坐标 jitter |
| PR 15 | Done   | feat/self-decomposition-primitives | feat: add self-decomposition drawing primitives  | a455529    | 2026-06-13   | 新增 polyline / arc，canvas 渲染 + server prompt 拆解规则 |
| PR 16 | Merged | feat/fallback-sketch-mode | fix: force LLM actions array, fix feedback sync, remove json_object mode | 935459c    | 2026-06-13   | 强制 actions 数组、反馈同步、JSON 解析修复 |
| PR 17 | In Progress | feat/sketch-stroke-mode | feat: add unified sketch stroke rendering pipeline | dd78d36    | 2026-06-13   | SketchAgent 笔触草图管线，统一画法，Mimo 多模态 |
| PR 18 | In Progress | feat/canvas-spatial-precision | feat: add canvas zones and spatial command placement | - | - | 9 区空间模型、空间语音指令、防重叠、多对象分发 |

Status 可选值：

```text
Todo / In Progress / Review / Done / Skipped
```

---

## 5. PR Detail Checklist

### PR 0：项目规划文档

Branch:

```text
main
```

Title:

```text
docs: add project planning documents
```

目标：

* 创建项目治理文档。
* 明确产品范围。
* 明确技术架构。
* 明确 PR 拆分。
* 明确纯语音约束。
* 明确提交检查清单。

涉及文件：

* `docs/PRD.md`
* `docs/PLAN.md`
* `docs/SYSTEM.md`
* `AGENTS.md`
* `TASKS.md`
* `README.md`
* `DESIGN.md`

验收标准：

* [ ] PRD 已定义用户故事和 MVP 范围。
* [ ] PLAN 已定义 72 小时开发计划。
* [ ] SYSTEM 已定义技术栈和架构。
* [ ] AGENTS 已定义 AI 协作规则。
* [ ] TASKS 已建立进度表。
* [ ] 明确写入"不把点击开始监听作为核心路径"。
* [ ] 明确写入"页面加载后自动持续监听"。
* [ ] 明确写入 OpenAI-compatible structured output API 作为 LLM 兜底方案。

不包含：

* 不写业务代码。
* 不实现 Canvas。
* 不实现语音识别。
* 不接入 LLM。

建议 commit:

```text
docs: add project planning documents
```

---

### PR 1：初始化 App 基础页面

Branch:

```text
app-scaffold
```

Title:

```text
feat: initialize app scaffold
```

目标：

* 初始化 Vite + React + TypeScript 项目。
* 搭建基础页面结构。
* 展示项目标题、语音状态区、画布占位区、指令历史占位区。
* 保证项目可以运行。

涉及文件：

* `package.json`
* `src/App.tsx`
* `src/App.css`
* `src/main.tsx`
* `README.md`
* `TASKS.md`

验收标准：

* [ ] `npm install` 成功。
* [ ] `npm run dev` 成功。
* [ ] 页面能正常打开。
* [ ] 页面包含项目标题。
* [ ] 页面包含 Canvas 占位区域。
* [ ] 页面包含语音状态占位区域。
* [ ] 页面包含指令历史占位区域。
* [ ] 无控制台报错。
* [ ] README 有基础运行说明。
* [ ] TASKS.md 更新 PR 1 状态。

不包含：

* 不实现真实 Canvas 绘图。
* 不实现语音识别。
* 不实现指令解析。
* 不实现 LLM。
* 不实现撤销和历史逻辑。

建议 commit:

```text
feat: initialize app scaffold
```

---

### PR 2：Canvas 绘图引擎

Branch:

```text
canvas-engine
```

Title:

```text
feat: add canvas drawing engine
```

目标：

* 定义 Shape 类型。
* 实现 CanvasBoard 组件。
* 支持渲染圆形、矩形、线条、文字。
* 暂时可以使用 dev-only 测试数据验证绘制效果。

涉及文件：

* `src/domain/shapes.ts`
* `src/components/CanvasBoard.tsx`
* `src/components/DevControls.tsx`
* `src/App.tsx`
* `src/App.css`
* `docs/SYSTEM.md`
* `TASKS.md`

验收标准：

* [ ] Canvas 区域可见。
* [ ] 能绘制 circle。
* [ ] 能绘制 rect。
* [ ] 能绘制 line。
* [ ] 能绘制 text。
* [ ] CanvasBoard 只负责渲染，不处理语音和 parser。
* [ ] dev-only 测试入口明确标记。
* [ ] 主分支运行正常。
* [ ] TASKS.md 更新 PR 2 状态。

不包含：

* 不接语音。
* 不实现 reducer。
* 不实现撤销。
* 不实现 LLM。
* 不实现复杂指令。

建议 commit:

```text
feat: add canvas drawing engine
```

---

### PR 3：useReducer 状态管理与历史记录

Branch:

```text
drawing-reducer
```

Title:

```text
feat: add drawing reducer and history
```

目标：

* 定义 DrawingAction。
* 定义 DrawingState。
* 使用 useReducer 管理 shapes。
* 支持 add_shape、clear_canvas、undo。
* 增加基础 command history。

涉及文件：

* `src/domain/actions.ts`
* `src/domain/reducer.ts`
* `src/domain/shapes.ts`
* `src/components/CommandHistory.tsx`
* `src/App.tsx`
* `TASKS.md`

验收标准：

* [ ] add_shape 正常添加图形。
* [ ] clear_canvas 正常清空画布。
* [ ] undo 正常撤销上一步。
* [ ] 没有可撤销操作时不报错。
* [ ] history 可展示操作记录。
* [ ] reducer 不直接处理语音识别。
* [ ] Canvas 根据 state.shapes 渲染。
* [ ] TASKS.md 更新 PR 3 状态。

不包含：

* 不实现语音识别。
* 不实现 parser。
* 不实现 LLM。
* 不实现语音反馈。

建议 commit:

```text
feat: add drawing reducer and history
```

---

### PR 4：自动语音监听

Branch:

```text
speech-recognition
```

Title:

```text
feat: add automatic speech recognition
```

目标：

* 封装 `useSpeechRecognition`。
* 页面加载后自动尝试进入语音监听。
* 不把"点击开始监听"作为核心交互路径。
* 支持 interimResults 和 continuous。
* 显示语音状态。

涉及文件：

* `src/hooks/useSpeechRecognition.ts`
* `src/components/VoicePanel.tsx`
* `src/App.tsx`
* `README.md`
* `DESIGN.md`
* `TASKS.md`

语音状态：

```text
booting / permission_required / listening / processing / speaking / error / unsupported
```

验收标准：

* [ ] 页面加载后自动尝试进入监听流程。
* [ ] 用户不需要通过鼠标或键盘触发绘图指令。
* [ ] 支持 interim recognition text 展示。
* [ ] 支持 final recognition result 回调。
* [ ] 浏览器不支持时显示 unsupported。
* [ ] 麦克风权限异常时显示 permission_required 或 error。
* [ ] README 说明推荐 Chrome。
* [ ] DESIGN 记录自动持续监听取舍。
* [ ] TASKS.md 更新 PR 4 状态。

不包含：

* 不实现 Canvas 执行。
* 不实现本地 parser。
* 不接 LLM。
* 不引入 VAD。
* 不实现唤醒词。

建议 commit:

```text
feat: add automatic speech recognition
```

---

### PR 5：本地规则指令解析器

Branch:

```text
local-parser
```

Title:

```text
feat: add local command parser
```

目标：

* 实现中文本地规则解析器。
* 将简单语音文本转为 DrawingAction。
* 简单指令不调用 LLM。
* 无法解析时返回 unknown 或 ask_clarification。

涉及文件：

* `src/parser/parserTypes.ts`
* `src/parser/localParser.ts`
* typed parser examples in `src/parser/localParser.ts`
* `src/domain/actions.ts`
* `src/domain/shapes.ts`
* `README.md`
* `TASKS.md`

必须支持：

* "画一个红色圆形"
* "画一个蓝色矩形"
* "画一条黑色线"
* "写上你好"
* "清空画布"
* "撤销"

验收标准：

* [ ] 能识别基础颜色。
* [ ] 能识别基础图形。
* [ ] 能识别文字添加。
* [ ] 能识别清空。
* [ ] 能识别撤销。
* [ ] 无法解析时不崩溃。
* [ ] 简单指令不调用 LLM。
* [ ] 有基础测试样例。
* [ ] TASKS.md 更新 PR 5 状态。

不包含：

* 不接语音。
* 不接 Canvas 执行。
* 不调用 LLM。
* 不做复杂指令拆解。

建议 commit:

```text
feat: add local command parser
```

---

### PR 6：打通语音到绘图闭环

Branch:

```text
voice-to-canvas
```

Title:

```text
feat: connect voice commands to canvas actions
```

目标：

* 将语音识别 final text 传入 localParser。
* localParser 输出 DrawingAction。
* reducer 执行 action。
* Canvas 更新。
* history 展示原始语音、解析结果和执行状态。
* 提供暂停监听 / 恢复监听安全控制，不作为绘图入口。

涉及文件：

* `src/App.tsx`
* `src/parser/commandRouter.ts`
* `src/components/VoicePanel.tsx`
* `src/components/CommandHistory.tsx`
* `src/domain/reducer.ts`
* `DESIGN.md`
* `TASKS.md`

验收标准：

* [ ] 说"画一个红色圆形"后 Canvas 出现红色圆形。
* [ ] 说"画一个蓝色矩形"后 Canvas 出现蓝色矩形。
* [ ] 说"写上你好"后 Canvas 出现文字。
* [ ] 说"清空画布"后 Canvas 清空。
* [ ] 说"撤销"后画布回退。
* [ ] 无法解析时展示失败或澄清提示。
* [ ] history 能看到 rawText、source、actionType、status。
* [ ] 可以紧急暂停和恢复语音监听。
* [ ] TASKS.md 更新 PR 6 状态。

不包含：

* 不接 LLM。
* 不做复杂 batch_actions。
* 不做语音反馈。
* 不做 VAD。

建议 commit:

```text
feat: connect voice commands to canvas actions
```

---

### PR 7：语音反馈与回声保护

Branch:

```text
feat/speech-feedback
```

Title:

```text
feat: add speech feedback
```

目标：

* 封装 `useSpeechSynthesis`。
* 操作成功后播报反馈。
* 操作失败后播报提示。
* 增加 isSpeakingRef，避免系统播报被再次识别为用户指令。
* 播报结束后恢复监听。

涉及文件：

* `src/hooks/useSpeechSynthesis.ts`
* `src/components/FeedbackPanel.tsx`
* `src/hooks/useSpeechRecognition.ts`
* `src/App.tsx`
* `docs/SYSTEM.md`
* `DESIGN.md`
* `TASKS.md`

验收标准：

* [ ] 成功绘图后有语音反馈。
* [ ] 清空、撤销后有语音反馈。
* [ ] 无法解析时有语音或文字反馈。
* [ ] 系统播报期间不处理识别结果。
* [ ] 播报结束后继续监听。
* [ ] 浏览器不支持 SpeechSynthesis 时降级为文字反馈。
* [ ] TASKS.md 更新 PR 7 状态。

不包含：

* 不实现 LLM。
* 不实现复杂指令拆解。
* 不引入 VAD。

建议 commit:

```text
feat: add speech feedback
```

---

### PR 8：修复语音反馈同步问题

Branch:

```text
fix/speech-feedback-sync
```

Title:

```text
fix: resolve speech feedback sync issues
```

目标：

* 修复 PR 7 代码审查中发现的状态同步问题。
* 修复并发场景下的回调丢失问题。
* 确保语音反馈系统在边界情况下行为正确。

涉及文件：

* `src/hooks/useSpeechRecognition.ts`
* `src/hooks/useSpeechSynthesis.ts`
* `src/App.tsx`

问题描述：

1. **状态同步问题（严重）**：`isManuallyPaused` 在异步回调中通过闭包捕获，如果用户在语音播报期间手动暂停监听，回调读取的是旧值。
2. **并发场景问题（中等）**：快速连续调用 `speak()` 时，`cancel()` 会取消所有语音，但之前的 `onEnd` 回调不会被调用，导致状态不一致。

修复方案：

1. 在 `useSpeechRecognition` 中暴露 `isManuallyPausedRef`（ref 类型）。
2. 在 `App.tsx` 的 `onEnd` 回调中使用 `speech.isManuallyPausedRef.current` 访问最新值。
3. 在 `useSpeechSynthesis` 中添加 `onEndCallbackRef` 保存当前回调。
4. 在 `cancel()` 中先调用待处理的 `onEnd` 回调，再取消语音。

验收标准：

* [x] `npm run lint` 通过。
* [x] `npm run build` 通过。
* [x] 快速连续指令测试通过。
* [x] 播报期间手动暂停测试通过。
* [ ] PR 合并后主分支可运行。

不包含：

* 不添加新功能。
* 不改变现有 API 接口。
* 不引入新依赖。

建议 commit:

```text
fix: resolve speech feedback sync issues
```

---

### PR 9：OpenAI-compatible LLM 复杂指令解析

Branch:

```text
feat/llm-parser
```

Title:

```text
feat: add llm structured command parser
```

目标：

* 在本地解析失败后调用 OpenAI-compatible structured output API。
* 让 LLM 返回结构化 DrawingAction JSON。
* 校验返回结果。
* 不把 API key 暴露在前端。
* 增加 `.env.example`。

涉及文件：

* `src/parser/llmParser.ts`
* `src/parser/commandRouter.ts`
* `src/parser/actionSchema.ts`
* `src/parser/validateAction.ts`
* `api/parse-command.ts`
* `.env.example`
* `.gitignore`
* `README.md`
* `DESIGN.md`
* `TASKS.md`

验收标准：

* [ ] 简单指令不会调用 LLM。
* [ ] 本地解析失败后才进入 LLM。
* [ ] LLM 返回结构化 JSON。
* [ ] 返回结果必须校验。
* [ ] 非法 action 不执行。
* [ ] API key 只从服务端环境变量读取。
* [ ] `.env` 未提交。
* [ ] README 说明环境变量配置。
* [ ] DESIGN 记录成本控制策略。
* [ ] TASKS.md 更新 PR 8 状态。

不包含：

* 不实现复杂 UI。
* 不实现数据库。
* 不实现多轮聊天记忆。
* 不上传音频。

建议 commit:

```text
feat: add llm structured command parser
```

---

### PR 10：batch_actions 与模糊指令澄清

Branch:

```text
feat/batch-actions
```

Title:

```text
feat: support batch actions and clarification
```

目标：

* 支持 batch_actions。
* 支持 ask_clarification。
* 复杂指令可拆成多个绘图 action。
* 模糊指令不乱画，而是提示用户补充。

涉及文件：

* `src/domain/actions.ts`
* `src/domain/reducer.ts`
* `src/parser/commandRouter.ts`
* `src/parser/validateAction.ts`
* `src/components/CommandHistory.tsx`
* `DESIGN.md`
* `TASKS.md`

验收标准：

* [ ] 支持 batch_actions 顺序执行。
* [ ] 单次 batch_actions 有数量上限。
* [ ] "画一个太阳、两朵云和一棵树"可以拆解执行。
* [ ] "画一个东西"会触发澄清，而不是乱画。
* [ ] history 展示 batch 结果。
* [ ] DESIGN 更新复杂指令与澄清能力。
* [ ] TASKS.md 更新 PR 10 状态。

不包含：

* 不做高级图层系统。
* 不做专业图形编辑。
* 不做复杂多轮对话。

建议 commit:

```text
feat: support batch actions and clarification
```

---

### PR 11：文档、Demo 视频与最终提交整理

Branch:

```text
docs/finalize-submission
```

Title:

```text
docs: finalize readme design doc and demo script
```

目标：

* 完成 README。
* 完成 DESIGN。
* 完成 Demo 脚本。
* 录制 Demo 视频。
* 上传 Demo 视频到可访问平台。
* 将 Demo 链接放到 README。
* 检查提交规则。

涉及文件：

* `README.md`
* `DESIGN.md`
* `docs/DEMO_SCRIPT.md`
* `TASKS.md`

验收标准：

* [ ] README 有项目简介。
* [ ] README 有技术栈。
* [ ] README 有本地运行方式。
* [ ] README 有支持指令列表。
* [ ] README 有浏览器兼容说明。
* [ ] README 有 Demo 视频链接。
* [ ] Demo 视频链接可访问、可播放。
* [ ] DESIGN 回应用户故事。
* [ ] DESIGN 回应计划支持和实际支持的指令。
* [ ] DESIGN 说明未完成部分原因。
* [ ] DESIGN 说明成本控制策略。
* [ ] DESIGN 说明自动语音监听取舍。
* [ ] 仓库没有提交 `.env`。
* [ ] 主分支可运行。
* [ ] PR 描述完整。
* [ ] commit 时间戳均在有效开发周期内。
* [ ] TASKS.md 最终状态更新。

不包含：

* 不再大改核心架构。
* 不临时堆新功能。
* 不破坏主分支可运行状态。

建议 commit:

```text
docs: finalize readme design doc and demo script
```

---

### PR 16：三层降级 Fallback Sketch Mode

Branch:

```text
feat/fallback-sketch-mode
```

Title:

```text
feat: add fallback sketch refinement mode
```

目标：

* AI 无法可靠拆解对象时生成保守草图，不返回空结果。
* 用户随后用自然语言逐轮打磨草图。
* 新增 `update_shape` action 支持局部修改已有图形。
* VoicePanel 新增草图打磨状态卡。

涉及文件：

* `src/domain/actions.ts`
* `src/domain/reducer.ts`
* `src/domain/feedback.ts`
* `src/App.tsx`
* `src/components/VoicePanel.tsx`
* `src/parser/commandRouter.ts`
* `server/index.ts`
* `docs/PRD.md`
* `docs/DESIGN.md`
* `README.md`
* `TASKS.md`

验收标准：

* [ ] 说"画空调"时系统生成矩形 + 文本草图，不返回空结果。
* [ ] 接着说"长一点"：主图形变宽。
* [ ] 接着说"往右移"：草图整体右移。
* [ ] 接着说"颜色改成白色"：草图颜色更新。
* [ ] 接着说"重来"：恢复初始草图。
* [ ] 接着说"就这样"：退出 Sketch Mode。
* [ ] 退出后说普通绘图命令，不再修改旧草图。
* [ ] undo 能撤销最近一次草图修改。
* [ ] 草图打磨卡片状态正确。
* [ ] `npm run lint` 通过。
* [ ] `npm run build` 通过。

不包含：

* 不做完整第 2 层确认流。
* 不新增对象模板词典。
* 不新增手动按钮，不改变纯语音控制约束。

建议 commit:

```text
feat: add fallback sketch refinement mode
```

---

## 6. Daily Log

### 2026-06-12

Planned:

* [ ] 创建项目仓库。
* [ ] 初始化 Vite + React + TypeScript。
* [ ] 完成 PRD / PLAN / SYSTEM / AGENTS / TASKS。
* [ ] 完成基础 App 页面。
* [ ] 完成 Canvas 基础绘图。

Actual:

* [ ] 待更新。

Notes:

```text
第一天优先保证项目结构、文档和基础绘图能力。
```

---

### 2026-06-13

Planned:

* [ ] 完成 useReducer 状态管理。
* [ ] 完成自动语音监听。
* [ ] 完成本地规则解析器。
* [ ] 打通语音到绘图闭环。
* [ ] 完成语音反馈。

Actual:

* [ ] 待更新。

Notes:

```text
第二天优先保证核心闭环稳定，不追求花哨 UI。
```

---

### 2026-06-14

Planned:

* [ ] 完成 LLM 复杂指令解析。
* [ ] 完成 batch_actions。
* [ ] 完成澄清机制。
* [ ] 完成 README 和 DESIGN。
* [ ] 录制 Demo 视频。
* [ ] 上传 Demo 视频。
* [ ] 最终检查提交材料。

Actual:

* [ ] 待更新。

Notes:

```text
第三天禁止大范围重构，优先修 bug、补文档、录 Demo。
```

---

## 7. Supported Commands Tracking

### P0 Commands

| Command | Status | Parser | Notes |
| ------- | ------ | ------ | ----- |
| 画一个红色圆形 | Todo   | local  | 必须支持  |
| 画一个蓝色矩形 | Todo   | local  | 必须支持  |
| 画一条黑色线  | Todo   | local  | 必须支持  |
| 写上你好    | Todo   | local  | 必须支持  |
| 清空画布    | Todo   | local  | 必须支持  |
| 撤销      | Todo   | local  | 必须支持  |

### P1 Commands

| Command       | Status | Parser      | Notes  |
| ------------- | ------ | ----------- | ------ |
| 画一个太阳、两朵云和一棵树 | Todo   | llm         | 复杂指令拆解 |
| 画一个简单的房子      | Todo   | llm         | 可选     |
| 画一个笑脸         | Todo   | llm         | 可选     |
| 画一个东西         | Todo   | local / llm | 澄清机制   |
| 重做            | Todo   | local       | 可选     |

### P2 Commands

| Command  | Status | Notes |
| -------- | ------ | ----- |
| 把圆形变成绿色  | Todo   | 有余力再做 |
| 把它往右移动一点 | Todo   | 有余力再做 |
| 保存图片     | Todo   | 有余力再做 |
| 开启演示模式   | Todo   | 有余力再做 |

---

## 8. Risk Board

| Risk                    | Level  | Impact      | Mitigation                        | Status |
| ----------------------- | ------ | ----------- | --------------------------------- | ------ |
| Web Speech API 浏览器兼容性问题 | High   | 语音识别无法运行    | 推荐 Chrome，README 明确说明             | Open   |
| 浏览器阻止自动监听               | High   | 影响纯语音体验     | 提前授权麦克风，页面显示权限状态                  | Open   |
| 系统播报被误识别                | Medium | 重复执行指令      | isSpeakingRef 回声保护                | Open   |
| LLM 返回非法 JSON           | Medium | action 执行失败 | Structured Outputs + schema 校验    | Open   |
| 72 小时时间不足               | High   | P1 功能无法完成   | P0 优先，P2 全部可放弃                    | Open   |
| PR 过少或 commit 过集中       | High   | 作品可能无效      | 每个功能小 PR 持续提交                     | Open   |
| `.env` 泄露               | High   | 安全风险        | `.gitignore` 忽略，提交 `.env.example` | Open   |
| Demo 视频忘记上传             | Medium | 提交材料不完整     | Phase 10 明确检查                     | Open   |

---

## 9. Final Submission Checklist

### Repository

* [ ] GitHub / Gitee 仓库已创建。
* [ ] 仓库提交时间在开发周期内。
* [ ] 仓库最终为 public。
* [ ] main 分支可运行。
* [ ] 没有提交 `.env`。
* [ ] `.env.example` 已提交。
* [ ] 依赖文件完整。
* [ ] 没有无关大文件。
* [ ] 没有明显抄袭或未经说明的复用代码。

### PR & Commit

* [ ] 至少 11 个有效 PR。
* [ ] 每个 PR 只做一件事。
* [ ] 每个 PR 标题清楚。
* [ ] 每个 PR 描述完整。
* [ ] 每个 PR 有测试方式。
* [ ] commit 分布合理。
* [ ] commit 时间戳均在 2026-06-12 00:00 至 2026-06-14 23:59 之间。
* [ ] 没有最后一天一次性导入所有代码。
* [ ] PR 合并后主分支保持可运行。

### README

* [ ] README 有项目名称。
* [ ] README 有一句话介绍。
* [ ] README 有核心功能。
* [ ] README 有技术栈。
* [ ] README 有本地运行方式。
* [ ] README 有支持的语音指令。
* [ ] README 有 Demo 视频链接。
* [ ] README 有浏览器兼容性说明。
* [ ] README 有依赖说明。
* [ ] README 有原创功能说明。
* [ ] README 说明推荐使用 Chrome。
* [ ] README 说明首次使用需要麦克风授权。
* [ ] README 说明应用内绘图操作为纯语音完成。

### DESIGN.md

* [ ] DESIGN.md 有计划实现的用户故事。
* [ ] DESIGN.md 有最终实现的用户故事。
* [ ] DESIGN.md 有计划支持的指令能力。
* [ ] DESIGN.md 有最终支持的指令能力。
* [ ] DESIGN.md 有未完成部分原因说明。
* [ ] DESIGN.md 有成本控制策略。
* [ ] DESIGN.md 有系统架构说明。
* [ ] DESIGN.md 有技术难点与解决方案。
* [ ] DESIGN.md 有语音触发方案取舍。
* [ ] DESIGN.md 有后续优化方向。

### Demo Video

* [ ] Demo 视频已录制。
* [ ] Demo 视频有声音讲解。
* [ ] Demo 视频展示纯语音绘图。
* [ ] Demo 视频展示基础图形绘制。
* [ ] Demo 视频展示文字添加。
* [ ] Demo 视频展示撤销。
* [ ] Demo 视频展示清空。
* [ ] Demo 视频展示复杂指令或澄清机制。
* [ ] Demo 视频展示 README 或项目结构。
* [ ] Demo 视频链接已放入 README。
* [ ] Demo 视频链接可访问、可播放。

### Functionality

* [ ] 页面可以正常打开。
* [ ] Canvas 可以正常显示。
* [ ] 应用可以自动尝试语音监听。
* [ ] 语音识别文本可以展示。
* [ ] "画一个红色圆形"可执行。
* [ ] "画一个蓝色矩形"可执行。
* [ ] "画一条黑色线"可执行。
* [ ] "写上你好"可执行。
* [ ] "撤销"可执行。
* [ ] "清空画布"可执行。
* [ ] 系统有反馈。
* [ ] 无法理解的指令不会导致崩溃。
* [ ] 系统播报不会触发重复执行。

---

## 10. Final Decision Log

### Decision 1：不做 AI 文生图

Reason:

```text
题目要求是语音控制绘图工具，核心在于指令理解和绘图操作执行，而不是生成一张不可编辑的图片。
```

### Decision 2：采用自动持续监听

Reason:

```text
用户不能使用鼠标或键盘完成绘图创作，因此不能把"点击开始监听"作为核心路径。
```

### Decision 3：本地规则优先，LLM 兜底

Reason:

```text
简单指令本地解析更快、更稳定、零 API 成本。LLM 只用于复杂指令拆解。
```

### Decision 4：优先 Canvas 2D，不做 SVG 编辑器

Reason:

```text
Canvas 2D 足够支持基础图形绘制，工程成本低，适合 72 小时 MVP。
```

### Decision 5：P0 优先，P2 可放弃

Reason:

```text
稳定可演示比功能数量更重要。P0 完成即可形成有效作品。
```

---

## 11. Notes for Reviewers

Say2Draw is designed as a voice-first drawing tool rather than a general-purpose image generation app.

The project focuses on:

1. Voice-only interaction.
2. Structured command parsing.
3. Controllable Canvas rendering.
4. Local parser first, LLM fallback second.
5. Transparent engineering process through PRs and commits.
6. Cost-aware AI usage.
7. Clear documentation and demo-oriented delivery.

The final submission should be evaluated as a 72-hour MVP with emphasis on product reasoning, engineering clarity, and end-to-end demo stability.
