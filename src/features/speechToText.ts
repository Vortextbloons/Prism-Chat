type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEvent = {
  resultIndex: number
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type SpeechCallbacks = {
  onResult: (text: string, isFinal: boolean) => void
  onError?: (message: string) => void
  onEnd?: () => void
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition)
}

export function startSpeechRecognition(callbacks: SpeechCallbacks): () => void {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError?.('Speech recognition is not supported in this browser')
    return () => {}
  }

  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition!
  const recognition = new SpeechRecognitionCtor()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = navigator.language || 'en-US'

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let transcript = ''
    let isFinal = false
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript
      if (event.results[i].isFinal) isFinal = true
    }
    callbacks.onResult(transcript.trim(), isFinal)
  }

  recognition.onerror = () => {
    callbacks.onError?.('Could not capture speech')
  }

  recognition.onend = () => {
    callbacks.onEnd?.()
  }

  recognition.start()
  return () => recognition.stop()
}
