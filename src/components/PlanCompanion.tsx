type PlanElement = {
  name: string
  position: string
  color: string
  role: string
  details?: string[]
}

type PendingPlan = {
  sceneType?: string
  previewText: string
  elements: PlanElement[]
  drawingOrder?: string[]
}

type PlanCompanionProps = {
  plan: PendingPlan | null
}

const SCENE_LABELS: Record<string, string> = {
  quick_sketch: '快速草图',
  whiteboard: '白板图',
  story_scene: '场景画',
  teaching_diagram: '讲解图',
}

const ROLE_LABELS: Record<string, string> = {
  main: '主体',
  supporting: '陪衬',
  label: '标注',
}

export function PlanCompanion({ plan }: PlanCompanionProps) {
  if (!plan) {
    return null
  }

  const sceneLabel = plan.sceneType ? SCENE_LABELS[plan.sceneType] || plan.sceneType : '共创计划'
  const order = plan.drawingOrder?.length
    ? plan.drawingOrder
    : plan.elements.map((element) => element.name)

  return (
    <section className="plan-companion" aria-label="Drawing companion plan">
      <div className="plan-companion-header">
        <div>
          <p className="label">画画搭子</p>
          <h2>{plan.previewText}</h2>
        </div>
        <span className="plan-scene-badge">{sceneLabel}</span>
      </div>

      <div className="plan-next-step">
        <span className="status-dot processing" aria-hidden="true" />
        <p>确认开始画，也可以继续说你想怎么改。</p>
      </div>

      <div className="plan-section">
        <p className="label">画面元素</p>
        <div className="plan-elements">
          {plan.elements.map((element) => (
            <article className="plan-element" key={`${element.name}-${element.position}`}>
              <span
                className="plan-color"
                style={{ background: element.color }}
                aria-hidden="true"
              />
              <div>
                <p className="plan-element-name">{element.name}</p>
                <p className="plan-element-meta">
                  {element.position} · {ROLE_LABELS[element.role] || element.role}
                </p>
                {element.details && element.details.length > 0 && (
                  <p className="plan-element-details">{element.details.slice(0, 4).join(' / ')}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="plan-section">
        <p className="label">绘制顺序</p>
        <ol className="plan-order">
          {order.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}
