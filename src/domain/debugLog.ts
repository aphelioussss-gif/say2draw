/**
 * Debug logging types and utilities for Say2Draw roadshow stability.
 *
 * Provides a typed logging structure that captures each operation stage,
 * enabling failure explanation during live demonstrations.
 */

export type DebugLogStage =
  | 'transcript'
  | 'plan'
  | 'plan-revise'
  | 'sketch'
  | 'local-adjustment'
  | 'flowchart-edit'
  | 'render'
  | 'undo'

export type DebugLogStatus =
  | 'success'
  | 'fallback'
  | 'error'

export type DebugFailureType =
  | 'speech_recognition'
  | 'intent_recognition'
  | 'llm_api'
  | 'invalid_format'
  | 'render_error'
  | 'local_adjustment'
  | 'no_template'
  | 'unknown'

export type DebugLogEntry = {
  id: string
  time: string
  command: string
  stage: DebugLogStage
  status: DebugLogStatus
  endpoint?: string
  failureType?: DebugFailureType
  inputSummary?: string
  outputSummary?: string
  warning?: string
  error?: string
  durationMs?: number
}

const MAX_LOG_ENTRIES = 200

let logEntries: DebugLogEntry[] = []
let logIdCounter = 0

/**
 * Callback invoked each time a log entry is created.
 * App.tsx sets this via setOnLogEntryCallback to trigger re-render of DebugLogPanel.
 */
let onLogEntry: (() => void) | null = null

export function setOnLogEntryCallback(cb: (() => void) | null): void {
  onLogEntry = cb
}

/**
 * Create a new debug log entry and append it to the in-memory store.
 */
export function createDebugLogEntry(
  params: Omit<DebugLogEntry, 'id' | 'time'>,
): DebugLogEntry {
  const entry: DebugLogEntry = {
    ...params,
    id: `log-${++logIdCounter}`,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  }
  logEntries.unshift(entry)
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries = logEntries.slice(0, MAX_LOG_ENTRIES)
  }
  onLogEntry?.()
  return entry
}

/**
 * Get all stored log entries.
 */
export function getDebugLogEntries(): DebugLogEntry[] {
  return [...logEntries]
}

/**
 * Add a render-stage log entry for capture canvas / SVG rendering events.
 */
export function logRenderError(command: string, error: string): DebugLogEntry {
  return createDebugLogEntry({
    command,
    stage: 'render',
    status: 'error',
    failureType: 'render_error',
    error,
  })
}

/**
 * Clear all stored log entries.
 */
export function clearDebugLogEntries(): void {
  logEntries = []
  logIdCounter = 0
}

/**
 * Summarise a sketch plan object into a short display string.
 */
export function summarisePlan(input: unknown): string {
  if (!input || typeof input !== 'object') return String(input ?? '')
  const plan = input as Record<string, unknown>
  const intentType = plan.intentType as string | undefined
  const elements = plan.elements as Array<Record<string, unknown>> | undefined
  const count = elements?.length ?? 0
  const names = elements?.map((e) => e.name as string).filter(Boolean).join(', ') ?? ''
  return `${intentType ?? 'plan'} (${count} 元素: ${names})`
}

/**
 * Extract a short error message from an unknown error value.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error ?? 'unknown error')
}
