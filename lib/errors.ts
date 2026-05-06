export type ErrorKind = 'mic' | 'network' | 'empty' | 'generic'

export interface AppError {
  kind: ErrorKind
  title: string
  message: string
}

export function classifyTranscriptionError(message: string): AppError {
  const lower = message.toLowerCase()

  if (
    lower.includes('microphone') ||
    lower.includes('permission') ||
    lower.includes('notallowed') ||
    lower.includes('denied')
  ) {
    return {
      kind: 'mic',
      title: 'Microphone access needed',
      message:
        'Allow access in your browser settings, then tap Try again.',
    }
  }

  if (
    lower.includes('no speech') ||
    lower.includes('nothing was detected') ||
    lower.includes("didn't catch") ||
    lower.includes('empty')
  ) {
    return {
      kind: 'empty',
      title: "We didn't catch any audio",
      message: 'Speak clearly and check your mic volume.',
    }
  }

  if (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection') ||
    lower.includes('503') ||
    lower.includes('429')
  ) {
    return {
      kind: 'network',
      title: "Couldn't reach the service",
      message: 'Check your connection and try again.',
    }
  }

  return {
    kind: 'generic',
    title: 'Something went wrong',
    message,
  }
}
