import type { DrawingAction } from './actions'

function extractDrawingTarget(rawText: string): string | null {
  const normalized = rawText.replace(/\s+/g, '')
  const match = normalized.match(/(?:给我|帮我|请)?(?:画|绘制)(.+?)(?:[，。,.！!？?]|$)/)
  const target = match?.[1]
    .replace(/^(一个|一只|一棵|一座|一条|一朵|一片|个|只|棵|座|条|朵|片)/, '')
    .trim()

  if (!target || target.length > 12) {
    return null
  }

  return target
}

export function getActionFeedback(action: DrawingAction): string {
  if (action.type === 'add_shape') {
    if (action.shape.type === 'circle') {
      return '已为你画了一个圆形'
    }

    if (action.shape.type === 'ellipse') {
      return '已为你画了一个椭圆'
    }

    if (action.shape.type === 'rect') {
      return '已为你画了一个矩形'
    }

    if (action.shape.type === 'line') {
      return '已为你画了一条线'
    }

    if (action.shape.type === 'polygon') {
      return '已为你画了一个多边形'
    }

    return '已写上文字'
  }

  if (action.type === 'clear_canvas') {
    return '已清空画布'
  }

  if (action.type === 'undo') {
    return '已撤销上一步'
  }

  return '我还没有听懂这条指令，请换一种说法'
}

export function getBatchFeedback(actions: DrawingAction[], rawText: string): string {
  const actionableCount = actions.filter((action) => action.type !== 'parse_error').length

  if (actionableCount > 1) {
    const target = extractDrawingTarget(rawText)
    if (target) {
      return `已为你画了${target}`
    }

    return '已按你的描述完成绘图'
  }

  return getActionFeedback(actions[0])
}

export function getSketchEnterFeedback(objectName: string): string {
  return `我先画了一个大概的${objectName}，你可以说长一点、往右移、改颜色或就这样。`
}

export function getSketchModifierFeedback(rawText: string): string | null {
  const t = rawText.trim()
  if (/长一点|长一些|加长/.test(t)) return '好的，拉长了一点'
  if (/短一点|短一些|缩短/.test(t)) return '好的，缩短了一点'
  if (/大一点|大一些|放大/.test(t)) return '好的，放大了一点'
  if (/小一点|小一些|缩小/.test(t)) return '好的，缩小了一点'
  if (/往左/.test(t)) return '好的，往左移了'
  if (/往右/.test(t)) return '好的，往右移了'
  if (/往上/.test(t)) return '好的，往上移了'
  if (/往下/.test(t)) return '好的，往下移了'
  if (/颜色改/.test(t)) return '好的，颜色已更新'
  if (/重来/.test(t)) return '好的，恢复到初始草图'
  if (/就这样|可以了|好了/.test(t)) return '好的，草图已锁定'
  if (/算了|不画了/.test(t)) return '好的，已保留当前草图'
  return null
}
