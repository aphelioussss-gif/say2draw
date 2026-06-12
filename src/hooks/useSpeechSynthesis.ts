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
  const onEndCallbackRef = useRef<(() => void) | null>(null)

  function cancel() {
    if (!isSupported) {
      return
    }

    // Call the pending onEnd callback before canceling
    const pendingOnEnd = onEndCallbackRef.current
    onEndCallbackRef.current = null
    
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    
    // Invoke the callback after state update
    pendingOnEnd?.()
  }

  function speak(message: string, options: SpeakOptions = {}) {
    if (!isSupported) {
      options.onEnd?.()
      return
    }

    // Cancel any ongoing speech and invoke its onEnd
    cancel()

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1

    // Store the onEnd callback
    onEndCallbackRef.current = options.onEnd ?? null

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      const callback = onEndCallbackRef.current
      onEndCallbackRef.current = null
      callback?.()
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
      const callback = onEndCallbackRef.current
      onEndCallbackRef.current = null
      callback?.()
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => {
      utteranceRef.current = null
      onEndCallbackRef.current = null
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
