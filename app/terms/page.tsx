import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { APP_NAME, SUPPORT_EMAIL, TERMS_UPDATED } from '@/lib/app-brand'

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
}

const SECTIONS = [
  { id: 'acceptance', label: 'Accepting these terms' },
  { id: 'eligibility', label: 'Who can use ' + APP_NAME },
  { id: 'accounts', label: 'Your account' },
  { id: 'quran-content', label: 'Quran text, translations and recitations' },
  { id: 'halaqas', label: 'Halaqas' },
  { id: 'qari-content', label: 'Publishing in Qari' },
  { id: 'conduct', label: 'What you agree not to do' },
  { id: 'moderation', label: 'Reporting and removing content' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'availability', label: 'Changes to the app' },
  { id: 'disclaimer', label: 'No warranty' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'termination', label: 'Suspending or ending an account' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'law', label: 'Governing law' },
  { id: 'contact', label: 'Contact' },
]

/**
 * Written the same way as our Privacy Policy: from what the app actually
 * does — Qari publishing, Halaqa groups, offline downloads, third-party
 * Quran sources — not from a boilerplate template.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={TERMS_UPDATED}
      sections={SECTIONS}
      crossLink={{ href: '/privacy', label: 'Privacy Policy' }}
      summary={
        <ul>
          <li>{APP_NAME} is free to use, with no ads and no in-app purchases.</li>
          <li>You keep ownership of any recitation you record — publishing it just lets others hear it.</li>
          <li>Only publish recitations you have the right to share, and keep them respectful.</li>
          <li>We can remove content that breaks these terms, and you can delete your account any time.</li>
        </ul>
      }
    >
      <p>
        These terms cover using {APP_NAME} — reading and listening to the Quran, joining or running
        a Halaqa, and recording, publishing and following recitations in Qari. By using the app you
        agree to them, alongside our <a href="/privacy">Privacy Policy</a>, which explains what
        information we store.
      </p>

      <h2 id="acceptance">Accepting these terms</h2>
      <p>
        By opening and using {APP_NAME}, or by creating an account, you agree to these terms. If you
        do not agree to them, please do not use the app.
      </p>

      <h2 id="eligibility">Who can use {APP_NAME}</h2>
      <p>
        {APP_NAME}{' '}
        can be used by people of any age to read and listen to the Quran without an account.
        Creating an account and publishing recitations makes your username and what you publish
        visible to others, so if you are young, please do that with a parent or guardian&rsquo;s
        knowledge.
      </p>

      <h2 id="accounts">Your account</h2>
      <p>
        An account is a username, a display name and a PIN — no email address or phone number is
        needed. You are responsible for keeping your PIN to yourself and for anything done from your
        account. Tell us at the address below if you think someone else has access to it.
      </p>

      <h2 id="quran-content">Quran text, translations and recitations</h2>
      <p>
        The Quran text, translations, transliterations and recitations you read and hear in the app
        (outside of Qari) come from established, publicly available Quran sources, listed in our{' '}
        <a href="/privacy#third-parties">Privacy Policy</a>. We aim for these to be accurate, but{' '}
        {APP_NAME} is not a substitute for a qualified teacher — please verify anything you rely on
        for a religious ruling with one.
      </p>

      <h2 id="halaqas">Halaqas</h2>
      <p>
        A halaqa is a small reading group you create or join with an invite link and, where set, a
        join key. Whoever creates a halaqa can see who has read each day, remove members, reset the
        invite link, or delete the halaqa entirely — so only join or share a halaqa&rsquo;s link with
        people you intend to read alongside.
      </p>

      <h2 id="qari-content">Publishing in Qari</h2>
      <p>
        When you record a recitation, it is yours — publishing it in {APP_NAME} does not transfer
        ownership to us. Publishing a recitation as <strong>public</strong> gives every person using
        the app permission to listen to it, favourite it, and share it (including as a video or audio
        file the app generates) onward to other apps, for as long as it stays published.{' '}
        <strong>Private</strong> recitations are not covered by this — they stay visible only to you.
      </p>
      <p>
        By publishing a recitation you confirm it is your own recitation, that you have the right to
        share it, and that it does not use anyone else&rsquo;s copyrighted material without
        permission (for example, someone else&rsquo;s backing audio). You can delete anything you
        published at any time from your profile, which removes it and its audio for good.
      </p>

      <h2 id="conduct">What you agree not to do</h2>
      <ul>
        <li>Publish anything that is not an actual recitation of the Quran, or that mocks it</li>
        <li>Publish content that is abusive, harassing, hateful, or sexually explicit</li>
        <li>Impersonate another person, reciter, or sheikh</li>
        <li>Publish someone else&rsquo;s recording or copyrighted material as your own</li>
        <li>Use the app to spam, scrape, or interfere with how it works for others</li>
      </ul>

      <h2 id="moderation">Reporting and removing content</h2>
      <p>
        Every recitation can be reported from its menu. We review reports and can remove a
        recitation, or suspend or end the account that published it, if it breaks these terms — we
        do not review every recitation before it is published. If you believe a recitation was
        removed in error, contact us at the address below.
      </p>

      <h2 id="ownership">Ownership</h2>
      <p>
        {APP_NAME}&rsquo;s name, design and the app itself belong to us. What you record and publish
        in Qari belongs to you, subject to the permission you give other people to hear and share it
        while it is public, as described above. The Quran text, translations and recitations from
        third-party sources belong to their respective publishers and reciters.
      </p>

      <h2 id="availability">Changes to the app</h2>
      <p>
        We may add, change or remove features, and the app is offered as-is with no guarantee that
        it, or a third-party source it depends on, will always be available or unchanged.
      </p>

      <h2 id="disclaimer">No warranty</h2>
      <p>
        {APP_NAME}{' '}
        is provided &ldquo;as is&rdquo;, without warranties of any kind, to the fullest extent the
        law allows. We do not guarantee the app will be uninterrupted, error-free, or exactly as
        expected at every moment.
      </p>

      <h2 id="liability">Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, {APP_NAME} and its makers are not liable for indirect
        or consequential loss arising from your use of the app, or from content published by other
        people using it.
      </p>

      <h2 id="termination">Suspending or ending an account</h2>
      <p>
        We can suspend or end an account that breaks these terms. You can delete your own account at
        any time in Settings → Delete account, which permanently removes it and what it published —
        see our <a href="/privacy#rights">Privacy Policy</a> for exactly what that removes.
      </p>

      <h2 id="changes">Changes to these terms</h2>
      <p>
        If we change these terms in a meaningful way, we will update this page and change the date at
        the top. Continuing to use {APP_NAME} after a change means you accept the updated terms.
      </p>

      <h2 id="law">Governing law</h2>
      <p>These terms are governed by the laws that apply where {APP_NAME} is operated from.</p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these terms can be sent to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
