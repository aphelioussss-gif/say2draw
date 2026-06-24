type VoiceGuidePanelProps = {
  hasPendingPlan: boolean
  hasSketch: boolean
}

const START_EXAMPLES = [
  '画一个从语音输入到生成草图的流程图',
  '画一个用户从登录到支付成功的流程图',
  '画一个三层用户增长漏斗',
]

const PLAN_REVISION_EXAMPLES = [
  '在语音输入后面添加文字识别',
  '在文字识别后面添加意思识别',
  '把意思识别放在文字识别后面',
  '把处理中改成生成草图',
  '删除处理中',
]

const SKETCH_ADJUST_EXAMPLES = [
  '整体宽松一点',
  '框太小了',
  '框压字了',
  '重新排版',
]

export function VoiceGuidePanel({ hasPendingPlan, hasSketch }: VoiceGuidePanelProps) {
  const title = hasPendingPlan ? '继续修改计划' : hasSketch ? '继续调整画面' : '试着这样说'
  const description = hasPendingPlan
    ? '计划还没开始画，可以继续增删、改名、调整顺序。'
    : hasSketch
      ? '画完后可以继续用语音调整流程图布局。'
      : '先说出你想画什么，系统会生成计划，再等你确认。'
  const examples = hasPendingPlan
    ? PLAN_REVISION_EXAMPLES
    : hasSketch
      ? SKETCH_ADJUST_EXAMPLES
      : START_EXAMPLES

  return (
    <section className="voice-guide-panel" aria-label="Voice command examples">
      <div className="voice-guide-header">
        <p className="label">语音试例</p>
        <h2>{title}</h2>
      </div>
      <p className="voice-guide-desc">{description}</p>
      <div className="voice-guide-list">
        {examples.map((example) => (
          <span className="voice-guide-chip" key={example}>“{example}”</span>
        ))}
      </div>
    </section>
  )
}
