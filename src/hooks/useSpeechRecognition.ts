import { useEffect, useRef, useState, type MutableRefObject } from 'react'

export type VoiceStatus =
  | 'booting'
  | 'permission_required'
  | 'listening'
  | 'processing'
  | 'paused'
  | 'error'
  | 'unsupported'

type SpeechRecognitionHookOptions = {
  lang?: string
  onFinalTranscript?: (transcript: string, metadata?: { confidence?: number }) => void
  shouldIgnoreResult?: () => boolean
}

type SpeechRecognitionResult = {
  status: VoiceStatus
  interimTranscript: string
  finalTranscript: string
  finalConfidence?: number
  errorMessage: string
  isSupported: boolean
  pauseListening: (options?: { manual?: boolean }) => void
  resumeListening: () => void
  isManuallyPaused: boolean
  /** Ref for accessing latest isManuallyPaused in async callbacks */
  isManuallyPausedRef: MutableRefObject<boolean>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: ((event: Event) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: SpeechRecognitionResultList
}

type SpeechRecognitionErrorEventLike = Event & {
  error: string
  message?: string
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

function getErrorMessage(error: string, fallback?: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return '浏览器需要麦克风权限，允许后会自动尝试监听。'
  }

  if (error === 'no-speech') {
    return '暂时没有听到语音，请继续说话。'
  }

  if (error === 'audio-capture') {
    return '没有检测到可用麦克风。'
  }

  return fallback || `语音识别异常：${error}`
}

const SILENCE_TIMEOUT_MS = 1500

export function useSpeechRecognition({
  lang = 'zh-CN',
  onFinalTranscript,
  shouldIgnoreResult,
}: SpeechRecognitionHookOptions = {}): SpeechRecognitionResult {
  const isSupported =
    typeof window !== 'undefined' && getSpeechRecognitionConstructor() !== null
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(true)
  const isManuallyPausedRef = useRef(false)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const shouldIgnoreResultRef = useRef(shouldIgnoreResult)
  const speechBufferRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<VoiceStatus>(() =>
    isSupported ? 'booting' : 'unsupported',
  )
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [finalConfidence, setFinalConfidence] = useState<number | undefined>()
  const [errorMessage, setErrorMessage] = useState(() =>
    isSupported ? '' : '当前浏览器不支持 Web Speech API，建议使用 Chrome。',
  )
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  useEffect(() => {
    shouldIgnoreResultRef.current = shouldIgnoreResult
  }, [shouldIgnoreResult])

  function pauseListening(options: { manual?: boolean } = {}) {
    const manual = options.manual !== false
    shouldListenRef.current = false
    isManuallyPausedRef.current = manual
    setIsManuallyPaused(manual)
    setInterimTranscript('')
    speechBufferRef.current = ''
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    setStatus('paused')
    recognitionRef.current?.stop()
  }

  function resumeListening() {
    if (!isSupported) {
      return
    }

    shouldListenRef.current = true
    isManuallyPausedRef.current = false
    setIsManuallyPaused(false)
    setErrorMessage('')

    try {
      recognitionRef.current?.start()
    } catch {
      window.setTimeout(() => {
        setStatus('permission_required')
        setErrorMessage('请允许浏览器麦克风权限后刷新页面。')
      }, 0)
    }
  }

  useEffect(() => {
    if (!isSupported) {
      return
    }

    const Recognition = getSpeechRecognitionConstructor()

    if (!Recognition) {
      return
    }

    const recognition = new Recognition()
    recognitionRef.current = recognition
    shouldListenRef.current = true
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onstart = () => {
      setStatus('listening')
      setErrorMessage('')
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (shouldIgnoreResultRef.current?.()) {
        setInterimTranscript('')
        speechBufferRef.current = ''
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
        return
      }

      let interimText = ''
      let finalText = ''
      let finalConfidenceValues: number[] = []

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const alternative = result[0]
        const transcript = alternative?.transcript.trim()

        if (!transcript) {
          continue
        }

        if (result.isFinal) {
          finalText += transcript
          if (typeof alternative.confidence === 'number') {
            finalConfidenceValues = [...finalConfidenceValues, alternative.confidence]
          }
        } else {
          interimText += transcript
        }
      }

      setInterimTranscript(interimText)

      if (finalText) {
        // Accumulate and wait for silence before processing
        speechBufferRef.current += finalText
        setFinalTranscript(speechBufferRef.current)
        const confidence = finalConfidenceValues.length > 0
          ? Math.min(...finalConfidenceValues)
          : undefined
        setFinalConfidence(confidence)
        setStatus('processing')

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }

        silenceTimerRef.current = setTimeout(() => {
          const completeText = speechBufferRef.current
          const completeConfidence = confidence
          speechBufferRef.current = ''
          onFinalTranscriptRef.current?.(completeText, { confidence: completeConfidence })
          window.setTimeout(() => {
            if (shouldListenRef.current) {
              setStatus('listening')
            }
          }, 250)
        }, SILENCE_TIMEOUT_MS)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const permissionError =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'

      setStatus(permissionError ? 'permission_required' : 'error')
      setErrorMessage(getErrorMessage(event.error, event.message))
    }

    recognition.onend = () => {
      if (!shouldListenRef.current) {
        setStatus('paused')
        return
      }

      try {
        recognition.start()
      } catch {
        setStatus((currentStatus) =>
          currentStatus === 'permission_required' ? currentStatus : 'listening',
        )
      }
    }

    try {
      recognition.start()
    } catch {
      window.setTimeout(() => {
        setStatus('permission_required')
        setErrorMessage('请允许浏览器麦克风权限后刷新页面。')
      }, 0)
    }

    return () => {
      shouldListenRef.current = false
      isManuallyPausedRef.current = false
      speechBufferRef.current = ''
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      recognition.onstart = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.stop()
    }
  }, [isSupported, lang])

  return {
    status,
    interimTranscript,
    finalTranscript,
    finalConfidence,
    errorMessage,
    isSupported,
    pauseListening,
    resumeListening,
    isManuallyPaused,
    isManuallyPausedRef,
  }
}
