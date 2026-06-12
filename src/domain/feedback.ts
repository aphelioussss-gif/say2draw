import type { DrawingAction } from './actions'

function getObjectLabel(rawText: string): string | null {
  if (rawText.includes('太阳')) return '一个太阳'
  if (rawText.includes('笑脸')) return '一个笑脸'
  if (rawText.includes('树')) return '一棵树'
  if (rawText.includes('房子') || rawText.includes('房屋')) return '一座房子'
  return null
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
    const objectLabel = getObjectLabel(rawText)
    if (objectLabel) {
      return `已为你画了${objectLabel}`
    }

    return `已为你完成 ${actionableCount} 个绘图步骤`
  }

  return getActionFeedback(actions[0])
}
