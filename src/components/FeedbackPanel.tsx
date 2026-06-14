import type { FeedbackState } from '../domain/feedback'

type FeedbackPanelProps = {
  feedback: FeedbackState
}

function statusLabel(status: string): string {
  switch (status) {
    case 'idle': return '空闲'
    case 'listening': return '聆听中'
    case 'thinking': return '思考中...'
    case 'success': return '成功'
    case 'error': return '失败'
    default: return ''
  }
}

type SectionVariant = 'normal' | 'muted' | 'error'

function FeedbackSection({
  label,
  content,
  variant = 'normal',
}: {
  label: string
  content?: string
  variant?: SectionVariant
}) {
  if (!content) return null
  return (
    <div className={`feedback-field feedback-field-${variant}`}>
      <span className="feedback-label">{label}</span>
      <span className="feedback-value">{content}</span>
    </div>
  )
}

export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  const { heardText, understoodAs, result, suggestion, status } = feedback
  const hasContent = !!(heardText || understoodAs || result || suggestion)

  return (
    <section className="feedback-panel" aria-label="System feedback">
      <div className="panel-heading">
        <h2>反馈</h2>
        <span className={`feedback-status-badge ${status}`}>
          {statusLabel(status)}
        </span>
      </div>

      {!hasContent && status === 'thinking' && (
        <p className="feedback-thinking">正在理解你的指令...</p>
      )}

      {!hasContent && status !== 'thinking' && (
        <p className="feedback-empty">
          说出你的绘画指令，这里会显示系统理解与执行的结果
        </p>
      )}

      <FeedbackSection label="我听到" content={heardText} />
      <FeedbackSection
        label="我理解为"
        content={understoodAs}
        variant={status === 'error' && !result ? 'muted' : 'normal'}
      />
      <FeedbackSection
        label="执行结果"
        content={result}
        variant={status === 'error' ? 'error' : 'normal'}
      />
      <FeedbackSection label="建议" content={suggestion} variant="muted" />
    </section>
  )
}
