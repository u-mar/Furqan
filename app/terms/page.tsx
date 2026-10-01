import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { APP_NAME, SUPPORT_EMAIL, TERMS_UPDATED } from '@/lib/app-brand'

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
}

const SECTIONS = [
  { id: 'agreement', label: '1. Agreement to these terms' },
  { id: 'eligibility', label: '2. Who may use ' + APP_NAME },
  { id: 'accounts', label: '3. Your account' },
  { id: 'quran-content', label: '4. Quran text, translations and recitations' },
  { id: 'halaqas', label: '5. Halaqas' },
  { id: 'qari-content', label: '6. Your content in Qari' },
  { id: 'conduct', label: '7. Acceptable use' },
  { id: 'moderation', label: '8. Reports and moderation' },
  { id: 'ownership', label: '9. Intellectual property' },
  { id: 'third-party', label: '10. Third-party services' },
  { id: 'availability', label: '11. Changes to the Service' },
  { id: 'disclaimer', label: '12. Disclaimer' },
  { id: 'liability', label: '13. Limitation of liability' },
  { id: 'indemnity', label: '14. Responsibility for your content' },
  { id: 'termination', label: '15. Suspension and termination' },
  { id: 'changes', label: '16. Changes to these terms' },
  { id: 'law', label: '17. Governing law and disputes' },
  { id: 'general', label: '18. General' },
  { id: 'contact', label: '19. Contact us' },
]

/**
 * Written the same way as our Privacy Policy: from what the app actually
 * does — Qari posts, Halaqa groups, offline downloads, third-party Quran
 * sources — not from a boilerplate template.
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
          <li>{APP_NAME} is free to use, with no advertising and no in-app purchases.</li>
          <li>You keep ownership of what you post. Posting publicly lets others hear, see and share it.</li>
          <li>Post only your own recitations and content you have the right to share, and keep it respectful.</li>
          <li>Translations and AI-assisted features are aids, not religious rulings.</li>
          <li>We may remove content that breaks these terms. You can delete your account at any time.</li>
        </ul>
      }
    >
      <h2 id="agreement">1. Agreement to these terms</h2>
      <p>
        These Terms of Service (the &ldquo;Terms&rdquo;) govern your use of the {APP_NAME} app and website
        (together, the &ldquo;Service&rdquo;), provided by {APP_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By
        accessing or using the Service, or by creating an account, you agree to these Terms and to our{' '}
        <a href="/privacy">Privacy Policy</a>, which explains how we handle information. If you do not
        agree, please do not use the Service.
      </p>

      <h2 id="eligibility">2. Who may use {APP_NAME}</h2>
      <p>
        Anyone may use the Service to read and listen to the Quran, with or without an account. Creating
        an account and publishing in Qari make a username and what is published visible to others; if
        you are under the age of majority where you live, you may do so only with the knowledge and
        permission of a parent or guardian, who accepts these Terms on your behalf.
      </p>

      <h2 id="accounts">3. Your account</h2>
      <p>
        An account consists of a username, a display name and a PIN; no email address or phone number is
        required. You agree to choose a username that does not impersonate anyone or mislead others, to
        keep your PIN confidential, and to accept responsibility for activity on your account. If you
        believe someone else has access to your account, contact us promptly.
      </p>

      <h2 id="quran-content">4. Quran text, translations and recitations</h2>
      <p>
        The Quran text, fonts, translations and recitations in the Service come from established,
        publicly available sources (listed in our <a href="/privacy#providers">Privacy Policy</a>) and
        remain the work of their respective publishers, translators and reciters. We take care to present
        them accurately, but errors can occur.
      </p>
      <p>
        A translation conveys a translator&rsquo;s understanding of the meaning; it is not the Quran itself.
        When you share part of an ayah, the translation shown is the part of a published translation that
        corresponds to the words you chose, which may be found with the help of an AI model and may be
        imperfect. Prayer times are calculated from the location and method you choose. The Service is a
        tool for reading and learning; it is not a substitute for a qualified scholar or teacher, and
        should not be relied on for a religious ruling.
      </p>

      <h2 id="halaqas">5. Halaqas</h2>
      <p>
        A halaqa is a reading group joined through an invite link. Its creator can see which days members
        read, renew the invite link, remove members and delete the halaqa. Share a halaqa&rsquo;s link only
        with people you intend to read with, and do not use a halaqa to harass or pressure others.
      </p>

      <h2 id="qari-content">6. Your content in Qari</h2>
      <p>
        Qari lets you post your own recitations and ayah cards made on the Read screen (&ldquo;Your
        Content&rdquo;). You retain ownership of Your Content. By posting it, you grant us a worldwide,
        non-exclusive, royalty-free licence to store, reproduce, process, display and distribute it within
        the Service &mdash; including making the audio, video and picture files the Service offers for
        sharing &mdash; for as long as it remains posted, solely to operate and provide the Service.
      </p>
      <p>
        Public posts may be heard, viewed, liked and shared by other users, including outside the Service
        through the share features. Content already shared outside the Service by others may remain there
        after you delete it. Private posts are visible only to you.
      </p>
      <p>By posting, you confirm that:</p>
      <ul>
        <li>a recitation is your own voice, and an ayah card was made by you in the Service;</li>
        <li>you have the right to share it, and it does not include anyone else&rsquo;s recording or other
          copyrighted material without permission; and</li>
        <li>it complies with these Terms and with applicable law.</li>
      </ul>
      <p>You can delete any of Your Content at any time from your profile.</p>

      <h2 id="conduct">7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>post anything that is not a sincere recitation of, or reflection on, the Quran, or that mocks
          or distorts it;</li>
        <li>post content that is abusive, harassing, hateful, violent, sexually explicit or otherwise
          offensive;</li>
        <li>impersonate another person, reciter or scholar, or misrepresent your affiliation with anyone;</li>
        <li>post another person&rsquo;s recording or other copyrighted material as your own;</li>
        <li>use the Service for advertising, spam or fundraising without our permission;</li>
        <li>collect information about other users, or access the Service by automated means; or</li>
        <li>interfere with, disrupt or attempt to gain unauthorised access to the Service or its systems.</li>
      </ul>

      <h2 id="moderation">8. Reports and moderation</h2>
      <p>
        Any post can be reported from its menu. We do not review posts before they appear, but we review
        reports and may remove content, restrict features or suspend accounts that we reasonably believe
        break these Terms. If you believe content was removed in error, contact us and we will look at it
        again.
      </p>

      <h2 id="ownership">9. Intellectual property</h2>
      <p>
        The Service, including its name, design, software and original content, belongs to us and is
        protected by intellectual-property laws. Quran texts, fonts, translations and recitations belong
        to their respective owners. Background photographs and video clips are used under the licences
        of their providers. Except for Your Content, you may not copy, modify or distribute any part of
        the Service other than through the features it provides.
      </p>

      <h2 id="third-party">10. Third-party services</h2>
      <p>
        The Service relies on third-party providers for Quran content, media and infrastructure. We are
        not responsible for their availability or content, and their own terms may apply when you use
        them through the Service.
      </p>

      <h2 id="availability">11. Changes to the Service</h2>
      <p>
        We may add, change, suspend or remove features at any time, and we do not guarantee that the
        Service, or any source it depends on, will always be available, uninterrupted or unchanged.
      </p>

      <h2 id="disclaimer">12. Disclaimer</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any
        kind, whether express or implied, including warranties of accuracy, fitness for a particular
        purpose and non-infringement, to the fullest extent permitted by law.
      </p>

      <h2 id="liability">13. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we will not be liable for any indirect, incidental,
        special or consequential loss, or for loss of data, arising from your use of, or inability to use,
        the Service, or from content posted by other users. Nothing in these Terms limits liability that
        cannot be limited by law.
      </p>

      <h2 id="indemnity">14. Responsibility for your content</h2>
      <p>
        You are responsible for Your Content and for your use of the Service. You agree to compensate us
        for claims, losses and reasonable costs arising from content you post in breach of these Terms or
        of anyone else&rsquo;s rights.
      </p>

      <h2 id="termination">15. Suspension and termination</h2>
      <p>
        We may suspend or close an account that breaks these Terms or puts other users or the Service at
        risk. You may stop using the Service at any time, and may delete your account in Settings &rarr;
        Delete account, which permanently removes it and what it published &mdash; see our{' '}
        <a href="/privacy#rights">Privacy Policy</a> for details. Sections 6, 9 and 12 to 18 continue to
        apply after an account is closed.
      </p>

      <h2 id="changes">16. Changes to these terms</h2>
      <p>
        We may update these Terms from time to time. We will change the date at the top of this page and,
        where a change is significant, make it known in the app. Continuing to use the Service after a
        change takes effect means you accept the updated Terms.
      </p>

      <h2 id="law">17. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of Kenya. Before bringing any formal claim, please contact
        us so that we can try to resolve the matter informally. Any dispute that cannot be resolved this
        way will be subject to the courts of Kenya, without prejudice to any mandatory consumer-protection
        rights you have where you live.
      </p>

      <h2 id="general">18. General</h2>
      <p>
        If any part of these Terms is found to be unenforceable, the rest remains in effect. Our not
        enforcing a provision is not a waiver of it. These Terms, together with our Privacy Policy, are
        the entire agreement between you and us about the Service.
      </p>

      <h2 id="contact">19. Contact us</h2>
      <p>
        Questions about these Terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
