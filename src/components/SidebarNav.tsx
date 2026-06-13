import { type AppPage, type DrawingMode, MODE_PRESETS, CONFIG_MODE } from './ModePresets'
import type { VoiceStatus } from '../hooks/useSpeechRecognition'
import type { LLMStatus } from '../hooks/useLLMStatus'

type SidebarNavProps = {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  voiceStatus: VoiceStatus
  llmStatus: LLMStatus
}

const DRAWING_MODES: DrawingMode[] = ['story_scene', 'free_draw', 'teaching_diagram', 'whiteboard_flow']

function getVoiceStatusLabel(status: VoiceStatus): string {
  switch (status) {
    case 'listening': return '聆听中'
    case 'processing': return '处理中'
    case 'paused': return '已暂停'
    case 'booting': return '初始化'
    case 'permission_required': return '等待权限'
    case 'error': return '异常'
    case 'unsupported': return '不支持'
    default: return status
  }
}

function getLLMStatusLabel(status: LLMStatus): string {
  switch (status) {
    case 'configured': return 'AI 已就绪'
    case 'not_configured': return '未配置 Key'
    case 'server_offline': return '服务离线'
    case 'checking': return '检测中...'
    case 'error': return 'AI 异常'
    default: return status
  }
}

export function SidebarNav({ activePage, onNavigate, voiceStatus, llmStatus }: SidebarNavProps) {
  return (
    <aside className="sidebar-nav">
      <div className="sidebar-top">
        <button
          className={`sidebar-brand ${activePage === CONFIG_MODE ? 'active' : ''}`}
          onClick={() => onNavigate(CONFIG_MODE)}
        >
          <span className="sidebar-logo">🎙️</span>
          <div>
            <span className="sidebar-title">Say2Draw</span>
            <span className="sidebar-subtitle">配置</span>
          </div>
        </button>

        <nav className="sidebar-modes" aria-label="Drawing modes">
          <p className="sidebar-section-label">绘画模式</p>
          {DRAWING_MODES.map((mode) => {
            const preset = MODE_PRESETS[mode]
            const isActive = activePage === mode
            return (
              <button
                key={mode}
                className={`sidebar-mode-btn ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(mode)}
              >
                <span className="sidebar-mode-icon">{preset.icon}</span>
                <span className="sidebar-mode-label">{preset.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <div className="sidebar-status-row">
            <span className={`sidebar-status-dot ${voiceStatus === 'listening' ? 'listening' : voiceStatus === 'paused' ? 'paused' : 'idle'}`} />
            <span className="sidebar-status-text">{getVoiceStatusLabel(voiceStatus)}</span>
          </div>
          <div className="sidebar-status-row">
            <span className={`sidebar-status-dot ${llmStatus === 'configured' ? 'configured' : llmStatus === 'checking' ? 'checking' : 'error'}`} />
            <span className="sidebar-status-text">{getLLMStatusLabel(llmStatus)}</span>
          </div>
        </div>
        <p className="sidebar-version">v0.5 · PR20</p>
      </div>
    </aside>
  )
}
