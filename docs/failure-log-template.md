# Say2Draw Failure Log

> 用于记录路演或开发过程中遇到的异常场景。每条失败记录独立归档，便于后续修复优先级判断。

## Failure Log Template

```markdown
# Failure Log

## 触发指令

<!-- 用户说了什么 -->

## 失败阶段

<!-- plan / sketch / local-adjustment / render / undo -->

## 失败类型

<!-- speech_recognition / intent_recognition / llm_api / invalid_format / render_error / local_adjustment / no_template / unknown -->

## 现象

<!-- 实际发生了什么 -->

## 根因

<!-- 为什么发生 -->

## 当前兜底

<!-- 系统在失败时做了什么 -->

## 修复方向

<!-- 后续如何修复 -->

## 对路演主线的影响

<!-- 是 / 否。如果否，说明原因 -->
```

---

## Failure Log Index

| 编号 | 触发指令 | 失败阶段 | 失败类型 | 根因 | 影响路演 |
|---|---|---|---|---|---|
| F-001 | 画一只小猫 | sketch | no_template | 本地模板库无猫，LLM 坐标不稳定 | 否 |
| F-002 | 学术论文需要文献检索 文献阅读（修订计划） | plan-revise | intent_recognition | reviseFallbackPlan 只识别特定关键词，任意修订内容不匹配时静默返回原计划。修复：后端比较元素变化，未变化时返回 warning | 部分影响 |
| F-003 | 画一个从语音输入到生成草图的流程图 | sketch | node_mismatch | `inferFlowchartNodes` 中 `fromTo` 分支当 `existingNames.length >= 2` 时直接返回现有元素，未补充 `to` 元素，导致 "处理中" 丢失。修复：改为 `>= 3` | 是
