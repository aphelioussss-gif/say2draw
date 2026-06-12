import type { VoiceStatus } from '../hooks/useSpeechRecognition'
import { FeedbackPanel } from './FeedbackPanel'

type VoicePanelProps = {
  status: VoiceStatus
  interimTranscript: string
  finalTranscript: string
  errorMessage: string
  isSupported: boolean
  commandExamples: string[]
  onPauseListening: () => void
  onResumeListening: () => void
  feedbackMessage: string
  isFeedbackSpeaking: boolean
  isFeedbackVoiceSupported: boolean
}

const STATUS_LABEL: Record<VoiceStatus, string> = {
  booting: 'Booting / 初始化语音识别',
  permission_required: 'Permission required / 等待麦克风权限',
  listening: 'Listening / 正在聆听',
  processing: 'Processing / 处理识别结果',
  paused: 'Paused / 已暂停监听',
  error: 'Error / 识别异常',
  unsupported: 'Unsupported / 浏览器不支持',
}

function getStatusDotClass(status: VoiceStatus) {
  if (status === 'listening') {
    return 'listening'
  }

  if (status === 'processing' || status === 'booting') {
    return 'processing'
  }

  if (status === 'error' || status === 'unsupported' || status === 'permission_required') {
    return 'error'
  }

  return 'idle'
}

export function VoicePanel({
  status,
  interimTranscript,
  finalTranscript,
  errorMessage,
  isSupported,
  commandExamples,
  onPauseListening,
  onResumeListening,
  feedbackMessage,
  isFeedbackSpeaking,
  isFeedbackVoiceSupported,
}: VoicePanelProps) {
  const isPaused = status === 'paused'
  const canControlListening = isSupported && status !== 'unsupported'

  return (
    <aside className="voice-panel" aria-label="Voice recognition status">
      <div className="panel-heading">
        <span className={`status-dot ${getStatusDotClass(status)}`} aria-hidden="true" />
        <h2>Voice Panel</h2>
      </div>

      <section className="voice-card">
        <p className="label">状态</p>
        <p className="content">{STATUS_LABEL[status]}</p>
        <div className="voice-actions">
          <button
            type="button"
            onClick={isPaused ? onResumeListening : onPauseListening}
            disabled={!canControlListening}
          >
            {isPaused ? '恢复监听' : '暂停监听'}
          </button>
        </div>
      </section>

      <section className="voice-card">
        <p className="label">正在识别</p>
        <p className={`content ${interimTranscript ? '' : 'placeholder'}`}>
          {interimTranscript || '等待你说话'}
        </p>
      </section>

      <section className="voice-card">
        <p className="label">最终识别</p>
        <p className={`content ${finalTranscript ? '' : 'placeholder'}`}>
          {finalTranscript || '尚无完整语音结果'}
        </p>
      </section>

      <section className="voice-card">
        <p className="label">系统反馈</p>
        <p className={`content ${errorMessage ? 'error-text' : ''}`}>
          {errorMessage ||
            (isSupported
              ? 'PR 6 已将语音指令接入本地解析器和画布执行。'
              : '建议使用 Chrome 打开本项目。')}
        </p>
      </section>

      <FeedbackPanel
        message={feedbackMessage}
        isSpeaking={isFeedbackSpeaking}
        isVoiceSupported={isFeedbackVoiceSupported}
      />

      <section className="demo-prompts" aria-label="Demo command examples">
        <p className="label">试着说</p>
        <ul>
          {commandExamples.map((command) => (
            <li key={command}>{command}</li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
