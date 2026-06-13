type PlanElement = {
  name: string
}

type PendingPlan = {
  previewText: string
  elements: PlanElement[]
  drawingOrder?: string[]
}

type PlanConfirmOverlayProps = {
  plan: PendingPlan | null
  voiceStatus: string
}

export function PlanConfirmOverlay({ plan, voiceStatus }: PlanConfirmOverlayProps) {
  if (!plan) return null

  const order = plan.drawingOrder?.length
    ? plan.drawingOrder
    : plan.elements.map((element) => element.name)
  const isPaused = voiceStatus === 'paused'

  return (
    <div className="plan-confirm-overlay" aria-label="等待确认绘图计划">
      <div className="plan-confirm-panel">
        <p className="plan-confirm-kicker">等待语音确认</p>
        <h3>{plan.previewText}</h3>
        {order.length > 0 && (
          <p className="plan-confirm-order">{order.slice(0, 5).join(' -> ')}</p>
        )}
        <div className="plan-confirm-phrases" aria-label="可说的确认指令">
          <span>说“确认”开始画</span>
          <span>说“取消”重来</span>
          <span>直接说修改意见</span>
        </div>
        {isPaused && (
          <p className="plan-confirm-warning">当前已暂停，请先说“恢复”或点恢复后再确认。</p>
        )}
      </div>
    </div>
  )
}
