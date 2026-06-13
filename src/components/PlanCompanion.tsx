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
  layoutBrief?: string
  styleBrief?: string
  elements: PlanElement[]
  drawingOrder?: string[]
  detailChecklist?: string[]
  avoid?: string[]
  polishHints: string[]
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
        <p>我先按这个 brief 起稿。你可以说“确认”开始画，也可以继续说“月亮更弯一点”“加两颗星星”。</p>
      </div>

      {(plan.layoutBrief || plan.styleBrief) && (
        <div className="plan-brief">
          {plan.layoutBrief && <p>{plan.layoutBrief}</p>}
          {plan.styleBrief && <p>{plan.styleBrief}</p>}
        </div>
      )}

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

      {plan.detailChecklist && plan.detailChecklist.length > 0 && (
        <div className="plan-section">
          <p className="label">必须画出来</p>
          <ul className="plan-checklist">
            {plan.detailChecklist.slice(0, 8).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.avoid && plan.avoid.length > 0 && (
        <div className="plan-section">
          <p className="label">避坑</p>
          <ul className="plan-avoid">
            {plan.avoid.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.polishHints.length > 0 && (
        <div className="plan-section">
          <p className="label">画完可以继续说</p>
          <div className="plan-hints">
            {plan.polishHints.map((hint) => (
              <span key={hint}>{hint}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
