/**
 * One short message along the bottom of the screen, for the whole app.
 *
 * Kept outside React so any screen can say something, and so a message still
 * shows after the screen that said it has navigated away (joined, deleted...).
 */

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

let current: ToastMessage | null = null
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function toast(message: string, tone: ToastTone = 'info'): void {
  current = { id: nextId++, message, tone }
  emit()
}

export function toastSuccess(message: string): void {
  toast(message, 'success')
}

export function toastError(message: string): void {
  toast(message, 'error')
}

/** Removes the message, but only if it is still the one that was showing. */
export function dismissToast(id: number): void {
  if (current?.id !== id) return
  current = null
  emit()
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToast(): ToastMessage | null {
  return current
}

export function getServerToast(): ToastMessage | null {
  return null
}

/** A thrown error's message, or a fallback that still reads as a sentence. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
