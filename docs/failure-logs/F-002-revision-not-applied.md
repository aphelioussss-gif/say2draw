# Failure Log

## 触发指令

> 画一个学术论文的流程图

后续修订指令：

> 学术论文需要文献检索 文献阅读

## 失败阶段

plan-revise

## 失败类型

intent_recognition

## 现象

用户先创建了"学术论文的流程图"计划，然后发出修订指令希望增加"文献检索 文献阅读"节点。系统回复"已按你的意见调整"，但实际 plan 未发生任何变化，节点内容保持不变。

## 根因

后端 `reviseFallbackPlan()` 函数仅针对特定关键词做修订（星星、月亮/月牙、头发、影子等预设模板）。"文献检索 文献阅读"不匹配任何关键词，函数静默返回原始 plan 不做任何修改。前端收到 `{ok: true, plan}` 后无条件判定为成功，显示"已调整"。

## 当前兜底

LLM 未配置时走 `reviseFallbackPlan`，对任意文本做有限关键词匹配。不匹配时静默返回原计划。

## 修复

已完成两处修复：

1. **后端**（server/index.ts 第 1606 行）：比较修订前后的 `elements` 是否变化。未变化时返回 `warning: 'revision text not recognized by fallback, plan unchanged'`
2. **前端**（App.tsx `revisePendingPlan`）：新增 `plan-revise` 阶段日志，包含请求指令、输出摘要和 warning。当 warning 存在时反馈状态显示 error 而非 success

## 后续优化方向

`reviseFallbackPlan` 仅支持有限关键词。如需支持任意修订，需接入 LLM 或扩展模板匹配逻辑。

## 对路演主线的影响

部分影响。演示"修订计划"功能时需使用 fallback 可识别的关键词，或在 LLM 配置就绪后演示该功能。
