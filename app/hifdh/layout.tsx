import { redirect } from 'next/navigation'

/**
 * The Hifdh Test is switched off for now: it checked recitation with a speech
 * model the app no longer uses. Its pages stay in the code for when there is
 * one again; until then anyone landing on /hifdh goes to Home. Delete this
 * file to switch it back on.
 */
export default function HifdhLayout(): never {
  redirect('/')
}
