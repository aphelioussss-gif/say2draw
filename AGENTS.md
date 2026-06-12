# AGENTS.md - Say2Draw 项目规则

<!-- PROJECT_AGENT_CANARY: say2draw-2026 -->

## 项目概述

Say2Draw 是一个纯语音控制的 AI 绘图工具，用户通过语音指令完成所有绘图操作。

## 核心约束

1. **纯语音控制**：禁止鼠标/键盘完成绘图操作
2. **主分支可运行**：main 分支始终处于可运行状态
3. **PR 驱动开发**：所有功能通过独立 PR 合并
4. **增量交付**：禁止最后一天一次性导入代码
5. **⚠️ 禁止直接推送到 main**：所有更改必须通过 PR，包括文档更新。直接推送到 main 会导致评委看不到更改记录。

## 开发规范

### 分支命名

```
feat/voice-recognition
feat/canvas-basic
feat/llm-parsing
fix/voice-permission
docs/readme
```

### Commit 规范

```
feat: 新功能
fix: 修复
docs: 文档
chore: 构建/工具
refactor: 重构
test: 测试
```

### PR 要求

- 标题清晰描述变更
- 关联相关 Issue
- 通过基础 lint 检查
- 至少一人 review（或自我 review checklist）

## 技术栈

- **前端**：React + TypeScript
- **构建**：Vite
- **语音**：Web Speech API
- **AI**：OpenAI API（或替代方案）
- **绘图**：HTML5 Canvas

## 文件结构

```
say2draw-ai/
├── docs/           # 治理文档
├── src/            # 源代码
├── public/         # 静态资源
├── AGENTS.md       # 本文件
├── README.md       # 项目说明
├── DESIGN.md       # 设计文档
└── TASKS.md        # 任务跟踪
```

## 血的教训

### 教训 1：绝对不能直接推送到 main（2026-06-12）

**事件经过**：
- PR 8 修复了语音反馈同步问题，合并后需要更新文档（TASKS.md、README.md、SYSTEM.md、DESIGN.md、PLAN.md）
- AI 错误地直接在 main 分支上合并了文档更新，并 `git push origin main`
- 结果：这些文档更新没有 PR 记录，评委在 PR 列表里看不到

**为什么这是严重错误**：
1. 违反了“所有功能通过独立 PR 合并”的核心约束
2. 评委看不到完整的项目演进过程
3. 无法追踪这些更改的 review 记录

**正确做法**：
1. 创建一个新分支（如 `docs/post-pr8-sync`）
2. 在该分支上提交文档更新
3. 创建 PR 并合并
4. 绝对不能直接推送到 main

**以后的规则**：
- 任何更改，包括文档、注释、README，都必须通过 PR
- 推送前先问自己：“这个推送会创建 PR 吗？”
- 如果答案是否，就停下来创建分支和 PR

---

## 72小时里程碑

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| M1 | 6/12 上午 | 工程骨架 |
| M2 | 6/12 下午 | 语音识别 |
| M3 | 6/13 上午 | Canvas 绘图 |
| M4 | 6/13 下午 | LLM 解析 |
| M5 | 6/14 上午 | 集成测试 |
| M6 | 6/14 下午 | 文档视频 |
