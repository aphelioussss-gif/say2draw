import type { VoiceStatus } from '../hooks/useSpeechRecognition'
import type { LLMStatus } from '../hooks/useLLMStatus'
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
  llmStatus: LLMStatus
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

const LLM_STATUS_LABEL: Record<LLMStatus, string> = {
  checking: 'LLM: 检测中...',
  configured: 'LLM: 已就绪',
  not_configured: 'LLM: 未配置',
  error: 'LLM: 连接失败',
}

function getLLMStatusDotClass(status: LLMStatus) {
  if (status === 'configured') return 'listening'
  if (status === 'checking') return 'processing'
  return 'error'
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
  llmStatus,
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

      <section className="voice-card feedback-card" aria-label="LLM status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className={`status-dot ${getLLMStatusDotClass(llmStatus)}`}
            aria-hidden="true"
          />
          <p className="label" style={{ margin: 0 }}>
            {LLM_STATUS_LABEL[llmStatus]}
          </p>
        </div>
        <p className="feedback-meta">
          {llmStatus === 'configured'
            ? '复杂指令将调用 AI 解析'
            : llmStatus === 'not_configured'
              ? '复杂指令将提示澄清，不影响本地指令'
              : llmStatus === 'checking'
                ? '正在检测 AI 服务...'
                : 'AI 服务不可用，本地指令不受影响'}
        </p>
      </section>

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
