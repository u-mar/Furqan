import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { APP_NAME, PRIVACY_UPDATED, SUPPORT_EMAIL } from '@/lib/app-brand'

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
}

const SECTIONS = [
  { id: 'without-account', label: 'Using the app without an account' },
  { id: 'account', label: 'If you create an account' },
  { id: 'qari', label: 'Recitations you publish in Qari' },
  { id: 'halaqas', label: 'Halaqas' },
  { id: 'profile-picture', label: 'Your profile picture' },
  { id: 'favourites-reports', label: 'Favourites and reports' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'usage', label: 'Usage information' },
  { id: 'third-parties', label: 'Services the app connects to' },
  { id: 'security', label: 'Security' },
  { id: 'retention', label: 'How long we keep things' },
  { id: 'rights', label: 'Your rights, and deleting your account' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact' },
]

/**
 * Written from what the app actually does, not from a template: every item
 * below corresponds to something stored in prisma/schema.prisma, kept in the
 * browser, or fetched from a named service. If the app starts collecting
 * something new, this page is out of date until it says so.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={PRIVACY_UPDATED}
      sections={SECTIONS}
      crossLink={{ href: '/terms', label: 'Terms of Service' }}
      summary={
        <ul>
          <li>You can use almost all of {APP_NAME} without ever creating an account.</li>
          <li>We don&rsquo;t sell your information, and there is no advertising or tracking network.</li>
          <li>Your reading progress, bookmarks and settings normally stay on your device — not on our servers.</li>
          <li>You can delete your account and everything in it, permanently, any time.</li>
        </ul>
      }
    >
      <p>
        {APP_NAME}{' '}
        is built to help you read, listen to and share the Quran. This page explains exactly what
        is stored, where, and how to remove it — section by section, matching what the app
        actually does rather than a generic template.
      </p>

      <h2 id="without-account">Using the app without an account</h2>
      <p>
        Your bookmarks, reading position and settings are stored <strong>only on your device</strong>.
        They are never sent to us, and they are removed if you clear the app&rsquo;s data or
        uninstall it.
      </p>

      <h2 id="account">If you create an account</h2>
      <p>We store:</p>
      <ul>
        <li>
          <strong>Your username and name.</strong> Your username is your public profile address and
          is shown alongside anything you publish.
        </li>
        <li>
          <strong>Your PIN, in protected form only.</strong> It is salted and hashed, so it cannot be
          read back — not even by us. Repeated wrong attempts temporarily lock the account to
          protect it.
        </li>
      </ul>

      <h2 id="qari">Recitations you publish in Qari</h2>
      <p>If you record and publish a recitation, we store:</p>
      <ul>
        <li>The audio recording, and its length and size</li>
        <li>The title, note and hashtags you add, and the sound setting you choose</li>
        <li>Whether you made it public or private</li>
        <li>How many times it has been played and favourited</li>
      </ul>
      <p>
        <strong>Public</strong> recitations can be heard, favourited and shared by anyone using the
        app, and anyone you share one with can pass it on. <strong>Private</strong> recitations are
        visible only to you. Your own plays are not counted.
      </p>
      <p>
        Recording uses your microphone, and only while you are recording. Nothing is uploaded until
        you choose to publish. See our{' '}
        <a href="/terms#qari-content">Terms of Service</a> for what publishing a recitation means for
        the rights to it.
      </p>

      <h2 id="halaqas">Halaqas</h2>
      <p>If you start or join a halaqa, we store:</p>
      <ul>
        <li>
          <strong>The name you enter,</strong> which everyone in that halaqa can see.
        </li>
        <li>
          <strong>The days you read.</strong> A day is marked when you tap &ldquo;Yes, I read&rdquo;,
          or when you read in the app while you are in a halaqa. The halaqa sees which days you
          read &mdash; never how much, or what.
        </li>
        <li>
          <strong>The juz you take</strong> in a shared khatmah, and when you finish it.
        </li>
        <li>The halaqa&rsquo;s name, how long it runs, and its invite link.</li>
      </ul>
      <p>
        No account is needed. Your phone keeps a random key that identifies you in your halaqas, and
        we store only a protected (hashed) copy of it. If you clear the app&rsquo;s data, the key is
        gone and you will need to join again.
      </p>
      <p>
        Anyone with a halaqa&rsquo;s invite link can see its name, how many people are in it and how
        many have read today, and can join it. The person who made the halaqa can make a new link at
        any time, remove people, or delete the halaqa for everyone.
      </p>
      <p>
        Leaving a halaqa removes you from it and gives back any juz you have not finished. Once you
        are not in any halaqa, the days you read are deleted.
      </p>

      <h2 id="profile-picture">Your profile picture</h2>
      <p>
        If you add one, it is resized on your device and then stored so that others can see it on
        your profile and recitations.
      </p>

      <h2 id="favourites-reports">Favourites and reports</h2>
      <p>
        We record which recitations you favourite, so they appear in your Favourites. If you report
        a recitation, we store the report — who made it, which recitation it is about, and why — so
        it can be reviewed and acted on.
      </p>

      <h2 id="feedback">Feedback</h2>
      <p>
        If you send feedback, we store your message, and any contact details you choose to include,
        so we can read and reply to it.
      </p>

      <h2 id="usage">Usage information</h2>
      <p>
        To understand how the app is used and keep it working, we record which parts of the app are
        visited, how often, and when the app was last opened. This is linked to your account if you
        have one, or to a random identifier if you don&rsquo;t. It is not used for advertising and is
        not shared.
      </p>

      <h2 id="third-parties">Services the app connects to</h2>
      <p>
        To show Quran text, translations, fonts and recitations, the app fetches them from public
        Quran services, including api.quran.com, api.alquran.cloud, everyayah.com and mp3quran.net.
        Like any website, those services receive your device&rsquo;s IP address when the app requests
        something from them. Your account, recitations and halaqas are stored with our database
        provider, MongoDB Atlas.
      </p>
      <p>We do not sell your information, and we do not use advertising or tracking networks.</p>

      <h2 id="security">Security</h2>
      <p>
        Your PIN is never stored in a form that can be read back, connections to the app are
        encrypted, and a halaqa&rsquo;s join key is stored only as a protected hash — the same
        treatment as a PIN. No method of storing or transmitting information is completely secure,
        so while we work to protect what you share with us, we cannot guarantee it will never be
        compromised.
      </p>

      <h2 id="retention">How long we keep things</h2>
      <p>
        We keep account, recitation and halaqa information for as long as the account, recitation or
        halaqa exists. Deleting a recitation, leaving a halaqa, or deleting your account (see below)
        removes the corresponding information — usually immediately, and always within a short time
        for anything that lingers in backups.
      </p>

      <h2 id="rights">Your rights, and deleting your account</h2>
      <p>
        You can ask us at any time what we hold about you, ask us to correct anything that is wrong,
        or ask us to delete it — using the contact details below, or directly in the app:
      </p>
      <ul>
        <li>
          <strong>Delete your account yourself</strong> in Settings → Delete account. This
          permanently removes your account, every recitation you published along with its audio,
          your profile picture, your favourites, and reports you made or that were made about your
          recitations. It cannot be undone.
        </li>
        <li>
          <strong>Leave a halaqa</strong> from within it, which removes your reading days from that
          halaqa once you are no longer in any halaqa.
        </li>
      </ul>

      <h2 id="children">Children</h2>
      <p>
        {APP_NAME}{' '}
        can be used by people of any age to read and listen to the Quran. Publishing recitations
        makes them visible to others, so younger users should do so with a parent or guardian.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        If this policy changes in a meaningful way — for example, if the app starts collecting
        something new — we will update this page and change the date at the top. Continuing to use{' '}
        {APP_NAME} after a change means you accept the updated policy.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about your data, or a request to see, correct or delete it, can be sent to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
