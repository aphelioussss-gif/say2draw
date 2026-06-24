import { useState, useCallback } from 'react'
import { getDebugLogEntries, clearDebugLogEntries, type DebugLogEntry } from '../domain/debugLog'

function entryColor(status: string): string {
  switch (status) {
    case 'error':
      return '#fecaca'
    case 'fallback':
      return '#fef08a'
    default:
      return '#dcfce7'
  }
}

function entryTextColor(status: string): string {
  switch (status) {
    case 'error':
      return '#991b1b'
    case 'fallback':
      return '#92400e'
    default:
      return '#14532d'
  }
}

function EntryRow({ entry }: { entry: DebugLogEntry }) {
  const bg = entryColor(entry.status)
  const color = entryTextColor(entry.status)
  return (
    <div
      style={{
        background: bg,
        color,
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
        fontFamily: 'monospace',
        wordBreak: 'break-all',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, minWidth: 60 }}>{entry.time}</span>
        <span
          style={{
            display: 'inline-block',
            padding: '0 6px',
            borderRadius: 4,
            background: color,
            color: bg,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {entry.stage}
        </span>
        <span
          style={{
            display: 'inline-block',
            padding: '0 6px',
            borderRadius: 4,
            background: color,
            color: bg,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {entry.status}
        </span>
        {entry.failureType && (
          <span style={{ fontSize: 11, opacity: 0.8 }}>
            [{entry.failureType}]
          </span>
        )}
        {entry.durationMs !== undefined && (
          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 'auto' }}>
            {entry.durationMs}ms
          </span>
        )}
      </div>
      <div style={{ marginTop: 2 }}>
        <span style={{ opacity: 0.7 }}>指令: </span>
        {entry.command}
      </div>
      {entry.outputSummary && (
        <div style={{ marginTop: 1 }}>
          <span style={{ opacity: 0.7 }}>结果: </span>
          {entry.outputSummary}
        </div>
      )}
      {entry.warning && (
        <div style={{ marginTop: 1 }}>
          <span style={{ opacity: 0.7 }}>warning: </span>
          {entry.warning}
        </div>
      )}
      {entry.error && (
        <div style={{ marginTop: 1 }}>
          <span style={{ opacity: 0.7 }}>error: </span>
          {entry.error}
        </div>
      )}
      {entry.endpoint && (
        <div style={{ marginTop: 1, opacity: 0.5, fontSize: 11 }}>
          {entry.endpoint}
        </div>
      )}
    </div>
  )
}

export default function DebugLogPanel() {
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)

  const entries = getDebugLogEntries().slice(0, 20)

  const handleCopy = useCallback(() => {
    const text = entries
      .map(
        (e) =>
          `[${e.time}] ${e.stage} / ${e.status}${e.failureType ? ` [${e.failureType}]` : ''} | ${e.command}${e.warning ? ` | warning: ${e.warning}` : ''}${e.error ? ` | error: ${e.error}` : ''}`,
      )
      .join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }, [entries])

  const handleClear = useCallback(() => {
    clearDebugLogEntries()
    setTick((t) => t + 1)
  }, [])

  return (
    <div
      style={{
        borderTop: '1px solid #e5e7eb',
        background: '#f9fafb',
        fontSize: 13,
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          fontWeight: 600,
          color: '#374151',
        }}
      >
        <span>
          Debug Log {entries.length > 0 && `(${entries.length})`}
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <button
              onClick={handleCopy}
              style={buttonStyle}
            >
              复制日志
            </button>
            <button
              onClick={handleClear}
              style={buttonStyle}
            >
              清空
            </button>
            <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', marginLeft: 8 }}>
              显示最近 {Math.min(entries.length, 20)} 条
            </span>
          </div>
          {entries.length === 0 ? (
            <div style={{ padding: 12, color: '#9ca3af', textAlign: 'center', fontSize: 12 }}>
              暂无日志记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  color: '#374151',
}
