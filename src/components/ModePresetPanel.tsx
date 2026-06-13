import { MODE_PRESETS, type DrawingMode } from './ModePresets'

type ModePresetPanelProps = {
  mode: DrawingMode
}

export function ModePresetPanel({ mode }: ModePresetPanelProps) {
  const preset = MODE_PRESETS[mode]
  if (!preset) return null

  return (
    <section className="mode-preset-panel" aria-label={`${preset.label} mode preset`}>
      <div className="preset-header">
        <span className="preset-icon">{preset.icon}</span>
        <h3 className="preset-title">{preset.label}</h3>
      </div>

      <p className="preset-desc">{preset.description}</p>

      <div className="preset-section">
        <p className="preset-section-label">试着说</p>
        <ul className="preset-examples">
          {preset.exampleCommands.map((cmd) => (
            <li key={cmd} className="preset-example-item">{cmd}</li>
          ))}
        </ul>
      </div>

      <div className="preset-section">
        <p className="preset-section-label">计划重点</p>
        <p className="preset-plan-focus">{preset.planFocus}</p>
      </div>
    </section>
  )
}
