/**
 * Asks the person to sign in or create an account, from anywhere, at the moment
 * an action needs one. Nobody is asked when they open the app: reading,
 * listening and the Somali voice all work without an account.
 */
export interface AccountPrompt {
  /** One sentence on why, shown in place of the tagline. */
  reason?: string
  /** They signed in or created an account. */
  onDone?: () => void
  /** They closed it without one. */
  onCancel?: () => void
}

export const ACCOUNT_PROMPT_EVENT = 'account-prompt'

export function askToSignIn(prompt: AccountPrompt = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AccountPrompt>(ACCOUNT_PROMPT_EVENT, { detail: prompt }))
}
