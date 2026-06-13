import type { DrawingAction } from './actions'

function extractDrawingTarget(rawText: string): string | null {
  const normalized = rawText.replace(/\s+/g, '')
  const match = normalized.match(/(?:请你|你)?(?:给我|帮我|请)?(?:画|绘制)(.+?)(?:吧|[，。,.！!？?]|$)/)
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

    if (action.shape.type === 'polyline') {
      return '已为你画了一条折线'
    }

    if (action.shape.type === 'polygon') {
      return '已为你画了一个多边形'
    }

    if (action.shape.type === 'arc') {
      return '已为你画了一段弧线'
    }

    return '已写上文字'
  }

  if (action.type === 'clear_canvas') {
    return '已清空画布'
  }

  if (action.type === 'undo') {
    return '已撤销上一步'
  }

  if (action.type === 'parse_error') {
    return action.message || '我还没有听懂这条指令，请换一种说法'
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
