import { useEffect, useRef, useState } from 'react'

type SpeakOptions = {
  onEnd?: () => void
}

type SpeechSynthesisResult = {
  isSupported: boolean
  isSpeaking: boolean
  speak: (message: string, options?: SpeakOptions) => void
  cancel: () => void
}

export function useSpeechSynthesis(): SpeechSynthesisResult {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  function cancel() {
    if (!isSupported) {
      return
    }

    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  function speak(message: string, options: SpeakOptions = {}) {
    if (!isSupported) {
      options.onEnd?.()
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      options.onEnd?.()
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
      options.onEnd?.()
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => {
      utteranceRef.current = null
      if (isSupported) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSupported])

  return {
    isSupported,
    isSpeaking,
    speak,
    cancel,
  }
}
