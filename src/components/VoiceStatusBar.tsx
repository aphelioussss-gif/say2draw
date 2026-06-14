import type { VoiceStatus } from '../hooks/useSpeechRecognition'

type VoiceStatusBarProps = {
  status: VoiceStatus
  interimTranscript: string
  finalTranscript: string
  transcriptReview?: {
    originalText: string
    suggestedText?: string
  } | null
  errorMessage: string
  isSupported: boolean
  onPauseListening: () => void
  onResumeListening: () => void
  feedbackMessage: string
  isFeedbackSpeaking: boolean
}

function getVoiceLabel(status: VoiceStatus): string {
  switch (status) {
    case 'booting': return '初始化语音...'
    case 'permission_required': return '请授权麦克风'
    case 'listening': return '正在聆听'
    case 'processing': return '识别中...'
    case 'paused': return '已暂停'
    case 'error': return '识别异常'
    case 'unsupported': return '浏览器不支持'
    default: return status
  }
}

export function VoiceStatusBar({
  status,
  interimTranscript,
  finalTranscript,
  transcriptReview,
  errorMessage,
  isSupported,
  onPauseListening,
  onResumeListening,
  feedbackMessage,
  isFeedbackSpeaking,
}: VoiceStatusBarProps) {
  const isPaused = status === 'paused'
  const canControlListening = isSupported && status !== 'unsupported'
  const displayText = interimTranscript || finalTranscript || '说出你的绘画指令...'

  return (
    <div className="voice-status-bar" aria-label="Voice status">
      <div className="voice-status-left">
        <span className={`voice-status-indicator ${status}`}>
          <span className="voice-status-dot" />
          {getVoiceLabel(status)}
        </span>
        <span className={`voice-status-transcript ${interimTranscript ? 'interim' : ''}`}>
          {displayText}
        </span>
        {transcriptReview && (
          <span className="voice-transcript-review">
            <span>我听到：{transcriptReview.originalText}</span>
            {transcriptReview.suggestedText && (
              <span>建议：{transcriptReview.suggestedText}</span>
            )}
          </span>
        )}
      </div>

      <div className="voice-status-right">
        {feedbackMessage && (
          <span className={`voice-feedback-tag ${isFeedbackSpeaking ? 'speaking' : ''}`}>
            {feedbackMessage.length > 40 ? feedbackMessage.slice(0, 40) + '...' : feedbackMessage}
          </span>
        )}
        {canControlListening && (
          <button
            type="button"
            className="voice-status-btn"
            onClick={isPaused ? onResumeListening : onPauseListening}
            title={isPaused ? '恢复监听' : '暂停监听'}
          >
            {isPaused ? '▶ 恢复' : '⏸ 暂停'}
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="voice-status-error">{errorMessage}</div>
      )}
    </div>
  )
}
