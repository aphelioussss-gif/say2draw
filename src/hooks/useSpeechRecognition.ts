import { useEffect, useRef, useState } from 'react'

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
  onFinalTranscript?: (transcript: string) => void
}

type SpeechRecognitionResult = {
  status: VoiceStatus
  interimTranscript: string
  finalTranscript: string
  errorMessage: string
  isSupported: boolean
  pauseListening: () => void
  resumeListening: () => void
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

export function useSpeechRecognition({
  lang = 'zh-CN',
  onFinalTranscript,
}: SpeechRecognitionHookOptions = {}): SpeechRecognitionResult {
  const isSupported =
    typeof window !== 'undefined' && getSpeechRecognitionConstructor() !== null
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(true)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const [status, setStatus] = useState<VoiceStatus>(() =>
    isSupported ? 'booting' : 'unsupported',
  )
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState(() =>
    isSupported ? '' : '当前浏览器不支持 Web Speech API，建议使用 Chrome。',
  )

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  function pauseListening() {
    shouldListenRef.current = false
    setInterimTranscript('')
    setStatus('paused')
    recognitionRef.current?.stop()
  }

  function resumeListening() {
    if (!isSupported) {
      return
    }

    shouldListenRef.current = true
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
      let interimText = ''
      let finalText = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript.trim()

        if (!transcript) {
          continue
        }

        if (result.isFinal) {
          finalText += transcript
        } else {
          interimText += transcript
        }
      }

      setInterimTranscript(interimText)

      if (finalText) {
        setStatus('processing')
        setFinalTranscript(finalText)
        onFinalTranscriptRef.current?.(finalText)
        window.setTimeout(() => {
          if (shouldListenRef.current) {
            setStatus('listening')
          }
        }, 250)
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
    errorMessage,
    isSupported,
    pauseListening,
    resumeListening,
  }
}
