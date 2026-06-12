import { useState } from 'react'
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
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [provider, setProvider] = useState('deepseek')
  const [customBaseURL, setCustomBaseURL] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [configStatus, setConfigStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const PROVIDER_PRESETS: Record<string, { baseURL: string; defaultModel: string }> = {
    deepseek: { baseURL: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
    mimo: { baseURL: 'https://api.mimo.com/v1', defaultModel: 'mimo-chat' },
    openai: { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
    custom: { baseURL: '', defaultModel: '' },
  }

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return

    const preset = PROVIDER_PRESETS[provider]
    const baseURL = provider === 'custom' ? customBaseURL.trim() : preset.baseURL
    const model = modelInput.trim() || preset.defaultModel

    if (!baseURL) {
      setConfigStatus('error')
      return
    }

    setConfigStatus('saving')
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim(), baseURL, model }),
      })

      if (res.ok) {
        setConfigStatus('saved')
        setApiKeyInput('')
        window.setTimeout(() => window.location.reload(), 1500)
      } else {
        setConfigStatus('error')
      }
    } catch {
      setConfigStatus('error')
    }
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span
            className={`status-dot ${getLLMStatusDotClass(llmStatus)}`}
            aria-hidden="true"
          />
          <p className="label" style={{ margin: 0 }}>
            {LLM_STATUS_LABEL[llmStatus]}
          </p>
        </div>

        {llmStatus === 'not_configured' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {Object.keys(PROVIDER_PRESETS).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p)
                    setConfigStatus('idle')
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    background: provider === p ? 'var(--accent, #3b82f6)' : 'var(--surface)',
                    color: provider === p ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}
                >
                  {p === 'deepseek' ? 'DeepSeek' : p === 'mimo' ? 'Mimo' : p === 'openai' ? 'OpenAI' : '其他'}
                </button>
              ))}
            </div>
            <input
              type="password"
              placeholder="输入 API Key"
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value)
                if (configStatus === 'error') setConfigStatus('idle')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveApiKey()
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text)',
                boxSizing: 'border-box',
                marginBottom: 4,
              }}
            />
            <input
              type="text"
              placeholder={`模型 (默认: ${PROVIDER_PRESETS[provider].defaultModel || '手动输入'})`}
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text)',
                boxSizing: 'border-box',
                marginBottom: provider === 'custom' ? 4 : 6,
              }}
            />
            {provider === 'custom' && (
              <input
                type="text"
                placeholder="Base URL (如 https://api.xxx.com/v1)"
                value={customBaseURL}
                onChange={(e) => setCustomBaseURL(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  boxSizing: 'border-box',
                  marginBottom: 6,
                }}
              />
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim() || configStatus === 'saving'}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: apiKeyInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {configStatus === 'saving' ? '保存中...' : '保存'}
              </button>
              {configStatus === 'saved' && (
                <span style={{ fontSize: 12, color: '#22c55e', lineHeight: '26px' }}>
                  ✓ 已保存，刷新页面生效
                </span>
              )}
              {configStatus === 'error' && (
                <span style={{ fontSize: 12, color: '#ef4444', lineHeight: '26px' }}>
                  保存失败，请确认服务端已启动
                </span>
              )}
            </div>
          </div>
        )}

        <p className="feedback-meta">
          {llmStatus === 'configured'
            ? '复杂指令将调用 AI 解析'
            : llmStatus === 'not_configured'
              ? '复制 .env.example 为 .env 并填入 Key，或在上方直接输入'
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
