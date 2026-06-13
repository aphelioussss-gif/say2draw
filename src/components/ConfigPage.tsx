import { useState } from 'react'
import type { LLMStatus } from '../hooks/useLLMStatus'

type ConfigPageProps = {
  llmStatus: LLMStatus
}

const PROVIDER_PRESETS: Record<string, { baseURL: string; defaultModel: string }> = {
  mimo: { baseURL: 'https://api.xiaomimimo.com/v1', defaultModel: 'mimo-v2.5' },
  openai: { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  custom: { baseURL: '', defaultModel: '' },
}

export function ConfigPage({ llmStatus }: ConfigPageProps) {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [provider, setProvider] = useState('mimo')
  const [customBaseURL, setCustomBaseURL] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [configStatus, setConfigStatus] = useState<'idle' | 'saving' | 'verifying' | 'saved' | 'error'>('idle')
  const [configError, setConfigError] = useState('')

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return

    const preset = PROVIDER_PRESETS[provider]
    const baseURL = provider === 'custom' ? customBaseURL.trim() : preset.baseURL
    const model = modelInput.trim() || preset.defaultModel

    if (!baseURL) {
      setConfigStatus('error')
      setConfigError('请填写 Base URL')
      return
    }

    setConfigStatus('verifying')
    setConfigError('')
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim(), baseURL, model }),
      })

      const data = await res.json()

      if (data.ok) {
        setConfigStatus('saved')
        setApiKeyInput('')
        window.setTimeout(() => window.location.reload(), 2000)
      } else {
        setConfigStatus('error')
        setConfigError(data.error || '未知错误')
      }
    } catch {
      setConfigStatus('error')
      setConfigError('无法连接服务端，请确认 npm run server 已启动')
    }
  }

  return (
    <section className="config-page" aria-label="LLM configuration">
      <div className="config-card">
        <h2 className="config-title">LLM 配置</h2>
        <p className="config-desc">
          配置 AI 模型以启用智能绘图。Say2Draw 使用 LLM 理解你的语音指令并生成结构化绘画计划。
        </p>

        <div className="config-status-bar">
          <span className={`config-status-dot ${llmStatus}`} />
          <span className="config-status-text">
            {llmStatus === 'configured' && 'AI 服务已连接'}
            {llmStatus === 'not_configured' && '尚未配置 API Key'}
            {llmStatus === 'server_offline' && '后端服务未启动'}
            {llmStatus === 'checking' && '正在检测服务...'}
            {llmStatus === 'error' && 'AI 服务异常'}
          </span>
        </div>

        <div className="config-form">
          <div className="config-field">
            <label className="config-label">模型提供商</label>
            <div className="config-tabs">
              {Object.keys(PROVIDER_PRESETS).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`config-tab ${provider === key ? 'active' : ''}`}
                  onClick={() => { setProvider(key); setConfigStatus('idle') }}
                >
                  {key === 'mimo' ? 'Mimo' : key === 'openai' ? 'OpenAI' : '自定义'}
                </button>
              ))}
            </div>
          </div>

          {provider === 'custom' && (
            <div className="config-field">
              <label className="config-label" htmlFor="config-base-url">Base URL</label>
              <input
                id="config-base-url"
                type="text"
                className="config-input"
                placeholder="https://api.xxx.com/v1"
                value={customBaseURL}
                onChange={(e) => setCustomBaseURL(e.target.value)}
              />
            </div>
          )}

          <div className="config-field">
            <label className="config-label" htmlFor="config-api-key">API Key</label>
            <input
              id="config-api-key"
              type="password"
              className="config-input"
              placeholder={provider === 'mimo' ? 'sk-...' : '输入你的 API Key'}
              value={apiKeyInput}
              onChange={(e) => { setApiKeyInput(e.target.value); if (configStatus === 'error') setConfigStatus('idle') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveApiKey() }}
            />
          </div>

          <div className="config-field">
            <label className="config-label" htmlFor="config-model">模型名称（可选）</label>
            <input
              id="config-model"
              type="text"
              className="config-input"
              placeholder={`默认: ${PROVIDER_PRESETS[provider].defaultModel || '手动输入'}`}
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
            />
          </div>

          <div className="config-actions">
            <button
              type="button"
              className="config-btn primary"
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim() || configStatus === 'verifying'}
            >
              {configStatus === 'verifying' ? '验证中...' : '保存并验证'}
            </button>
            {configStatus === 'saved' && (
              <span className="config-feedback success">✓ 验证通过，即将刷新...</span>
            )}
            {configStatus === 'error' && (
              <span className="config-feedback error">{configError || '保存失败'}</span>
            )}
          </div>
        </div>

        <div className="config-tip">
          <p className="config-tip-text">
            提示：也可以复制 <code>.env.example</code> 为 <code>.env</code> 并填入 Key，重启服务端即可生效。
          </p>
        </div>
      </div>
    </section>
  )
}
