# Say2Draw｜以声绘色

A voice-first AI drawing tool that turns spoken commands into structured Canvas actions.

## 项目简介

Say2Draw 是一款纯语音控制的 AI 绘图工具，用户只需说出绘图意图，系统即可将语音指令解析为结构化绘图操作，并在 Canvas 上实时执行。

> 以声绘色，让想法被听见，也被画出来

## 与现有方案的区别

| 维度 | AI 文生图 (Midjourney/DALL-E) | Say2Draw |
|------|-------------------------------|----------|
| 执行单位 | 整张图 | 单个图形 |
| 可编辑性 | 黑箱，无法修改局部 | 结构化，可逐个操作 |
| 响应方式 | 等待生成 (数秒~数十秒) | 实时执行 |
| 迭代成本 | 重新生成整张图 | 撤销/修改单个元素 |
| 累积性 | 每次独立生成 | 图形持续累积在画布上 |

Say2Draw 的核心价值：**可控、可累积、可中断的语音绘图体验**。

## 当前进度

当前处于 PR 4：自动语音监听阶段。

已完成：

- 项目治理文档与 Vite 工程基线
- Say2Draw 基础三栏页面骨架
- Canvas 真实绘图引擎
- useReducer 绘图状态与历史记录
- Web Speech API 自动语音监听

暂未完成：

- 指令解析与 LLM 兜底
- 语音指令驱动 Canvas 执行
- 语音反馈与回声保护

## 核心特性

- 🎤 纯语音控制：所有操作通过语音完成
- 🎨 AI 辅助绘图：自然语言描述自动生成图形
- ⚡ 实时响应：低延迟的语音识别和绘图
- 🔄 撤销/重做：语音控制历史操作

## 快速开始

### 环境要求

- Node.js >= 18
- 现代浏览器（Chrome 推荐）

### 安装

```bash
npm install
```

### 开发

```bash
npm run dev
```

打开本地地址后，应用会自动尝试启动浏览器语音识别。推荐使用 Chrome，并允许浏览器麦克风权限。

### 构建

```bash
npm run build
```

## 语音指令

MVP 计划支持以下语音指令：

```text
画一个红色圆形
写上你好
撤销上一步
清空画布
画一个太阳、两朵云和一棵树
```

## 技术栈

- React + TypeScript
- Vite
- Web Speech API
- OpenAI API
- HTML5 Canvas

## 项目结构

```
say2draw-ai/
├── docs/           # 项目文档
├── src/            # 源代码
├── public/         # 静态资源
└── ...
```

## 文档

- [PRD - 产品需求文档](docs/PRD.md)
- [PLAN - 开发计划](docs/PLAN.md)
- [SYSTEM - 系统设计](docs/SYSTEM.md)
- [DEMO_SCRIPT - 演示脚本](docs/DEMO_SCRIPT.md)

## 许可证

MIT

---

*72小时 AI 实训营项目*
