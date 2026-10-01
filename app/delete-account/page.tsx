import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { APP_NAME, PRIVACY_UPDATED, SUPPORT_EMAIL } from '@/lib/app-brand'

export const metadata: Metadata = {
  title: `Delete your account — ${APP_NAME}`,
}

const SECTIONS = [
  { id: 'in-app', label: 'Delete it in the app' },
  { id: 'by-email', label: 'Ask us to delete it' },
  { id: 'what', label: 'What is deleted' },
  { id: 'kept', label: 'What is not affected' },
]

/**
 * The page app stores ask for: how to delete an account and its data, both
 * from inside the app and without it. Kept in step with the deletion route
 * (app/api/auth/account) and the Privacy Policy.
 */
export default function DeleteAccountPage() {
  return (
    <LegalPage
      title="Delete your account"
      updated={PRIVACY_UPDATED}
      sections={SECTIONS}
      crossLink={{ href: '/privacy', label: 'Privacy Policy' }}
      summary={
        <ul>
          <li>You can delete your {APP_NAME} account yourself, at any time, in Settings.</li>
          <li>It removes your account and everything you posted, permanently.</li>
          <li>Can&rsquo;t open the app? Email us and we will delete it for you.</li>
        </ul>
      }
    >
      <h2 id="in-app">Delete it in the app</h2>
      <ol>
        <li>Open {APP_NAME} and go to <strong>Settings</strong>.</li>
        <li>Tap <strong>Delete account</strong>.</li>
        <li>Enter your PIN to confirm.</li>
      </ol>
      <p>Your account is deleted straight away.</p>

      <h2 id="by-email">Ask us to delete it</h2>
      <p>
        If you can&rsquo;t open the app or have forgotten your PIN, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my account')}`}>{SUPPORT_EMAIL}</a>{' '}
        with the subject &ldquo;Delete my account&rdquo; and your username. We may ask you to confirm
        the account is yours, and will delete it within 30 days.
      </p>

      <h2 id="what">What is deleted</h2>
      <ul>
        <li>Your account: username, display name and PIN</li>
        <li>Every recitation and ayah card you posted, with its audio or picture</li>
        <li>Your profile picture</li>
        <li>Your likes, the people you follow and who follows you, the people you blocked, and your notifications</li>
        <li>Reports you made, and reports about your posts</li>
      </ul>
      <p>
        Deleted information is removed from our live systems straight away, and from backups within a
        short period after that. It cannot be recovered.
      </p>

      <h2 id="kept">What is not affected</h2>
      <ul>
        <li>
          Bookmarks, reading progress, settings and downloads are kept only on your phone, never on our
          servers. Clearing the app&rsquo;s data or uninstalling it removes them.
        </li>
        <li>
          Halaqas are separate from your account. Leave a halaqa from inside it to remove your name and
          reading days from it.
        </li>
        <li>Copies of your posts that other people already shared outside the app.</li>
      </ul>
    </LegalPage>
  )
}
