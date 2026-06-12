import { useEffect, useState } from 'react'

export type LLMStatus = 'checking' | 'configured' | 'not_configured' | 'error'

type HealthResponse = {
  ok: boolean
  llmConfigured: boolean
  model?: string
}

export function useLLMStatus(): LLMStatus {
  const [status, setStatus] = useState<LLMStatus>('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)

        const res = await fetch('/api/health', { signal: controller.signal })
        clearTimeout(timeoutId)

        if (cancelled) return

        if (!res.ok) {
          setStatus('not_configured')
          return
        }

        const data: HealthResponse = await res.json()
        setStatus(data.llmConfigured ? 'configured' : 'not_configured')
      } catch {
        if (!cancelled) {
          setStatus('not_configured')
        }
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
