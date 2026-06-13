/**
 * Determines if a text input expresses a drawing intent
 * that should be routed through the unified sketch stroke pipeline.
 *
 * All visual-output commands go through /api/sketch.
 * Non-visual control commands (clear, undo) still go through localParser.
 */
export function isDrawingIntent(text: string): boolean {
  const clean = text.replace(/\s+/g, '').trim()

  // Direct drawing commands (画/绘制/加/添加/帮我画...)
  if (/^(画|绘制|加|添加|帮我画)/.test(clean)) return true

  // Polite/indirect forms: "请...画..."  "给我画..."  "来一个..."
  if (/^(请|给|帮|来)(你|我|我们)?(画|绘制|加|添加)/.test(clean)) return true

  // "画" appears as the main action after a subject/prefix
  // Matches: "请你给我画...", "帮我画...", "能不能画...", etc.
  if (/^(请|给|帮|能|可以|麻烦|帮忙).*(画|绘制|加|添加)/.test(clean)) return true

  return false
}
