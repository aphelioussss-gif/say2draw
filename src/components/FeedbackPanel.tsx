type FeedbackPanelProps = {
  message: string
  isSpeaking: boolean
  isVoiceSupported: boolean
}

export function FeedbackPanel({
  message,
  isSpeaking,
  isVoiceSupported,
}: FeedbackPanelProps) {
  return (
    <section className="voice-card feedback-card" aria-label="System feedback">
      <p className="label">系统反馈</p>
      <p className={`content ${message ? '' : 'placeholder'}`}>
        {message || '等待执行结果'}
      </p>
      <p className="feedback-meta">
        {isVoiceSupported ? '语音反馈已开启' : '仅显示文字反馈'}
        {isSpeaking ? ' / 正在播报' : ''}
      </p>
    </section>
  )
}
