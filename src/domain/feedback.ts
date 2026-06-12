import type { DrawingAction } from './actions'

export function getActionFeedback(action: DrawingAction): string {
  if (action.type === 'add_shape') {
    if (action.shape.type === 'circle') {
      return '已为你画了一个圆形'
    }

    if (action.shape.type === 'rect') {
      return '已为你画了一个矩形'
    }

    if (action.shape.type === 'line') {
      return '已为你画了一条线'
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
