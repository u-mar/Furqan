import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'
import { APP_NAME, PRIVACY_UPDATED, SUPPORT_EMAIL } from '@/lib/app-brand'

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
}

const SECTIONS = [
  { id: 'about', label: '1. About this policy' },
  { id: 'on-device', label: '2. Information kept on your device' },
  { id: 'collect', label: '3. Information we collect' },
  { id: 'permissions', label: '4. Device permissions' },
  { id: 'use', label: '5. How we use information' },
  { id: 'sharing', label: '6. Who can see what you publish' },
  { id: 'providers', label: '7. Services we rely on' },
  { id: 'transfers', label: '8. Where information is processed' },
  { id: 'retention', label: '9. How long we keep information' },
  { id: 'security', label: '10. Security' },
  { id: 'rights', label: '11. Your rights and choices' },
  { id: 'children', label: '12. Children' },
  { id: 'changes', label: '13. Changes to this policy' },
  { id: 'contact', label: '14. Contact us' },
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
          <li>Almost all of {APP_NAME} works without an account, and without telling us who you are.</li>
          <li>Your reading progress, bookmarks, settings and location stay on your device.</li>
          <li>We do not sell personal information, show advertising, or use tracking networks.</li>
          <li>What you publish in Qari is visible to others unless you make it private.</li>
          <li>You can delete your account, and everything it published, at any time from Settings.</li>
        </ul>
      }
    >
      <h2 id="about">1. About this policy</h2>
      <p>
        This Privacy Policy explains how {APP_NAME} (&ldquo;{APP_NAME}&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;) handles information when you use the {APP_NAME} app and website (together,
        the &ldquo;Service&rdquo;) to read, listen to, memorise and share the Quran, take part in a
        halaqa, or publish in Qari. It describes what we collect, why, who it is shared with, how long
        it is kept, and the choices you have. It should be read together with our{' '}
        <a href="/terms">Terms of Service</a>.
      </p>

      <h2 id="on-device">2. Information kept on your device</h2>
      <p>
        Much of what makes the Service yours never leaves your device. The following is stored only in
        your browser or app storage, is not sent to us, and is removed if you clear the app&rsquo;s data
        or uninstall it:
      </p>
      <ul>
        <li>Your settings, bookmarks, reading position and khatmah progress</li>
        <li>Surahs, recitations and translations you download for offline use</li>
        <li>The location you choose for prayer times, and the times calculated from it</li>
        <li>A Qari recording you have made but not yet posted (a draft)</li>
        <li>The voice-search model, once downloaded (see section 4)</li>
      </ul>

      <h2 id="collect">3. Information we collect</h2>
      <p>We collect only what is needed for the features you choose to use.</p>

      <h3>3.1 Your account</h3>
      <p>
        An account is optional. If you create one, we store your <strong>username</strong> (your public
        profile address), your <strong>display name</strong>, and your <strong>PIN in protected form
        only</strong> &mdash; salted and hashed so that it cannot be read back, even by us. We also record
        failed sign-in attempts so that an account can be locked temporarily against guessing. We do
        not ask for an email address or phone number.
      </p>

      <h3>3.2 What you publish in Qari</h3>
      <p>If you post a <strong>recitation</strong>, we store:</p>
      <ul>
        <li>The audio recording, with its length and size</li>
        <li>The title, note and hashtags you add</li>
        <li>The room sound and background you choose, and the sheikh you imitate, if any</li>
        <li>The outline of the recording used to draw its waveform</li>
        <li>The ayat you marked while reading from the Mushaf, if you marked any, and when</li>
      </ul>
      <p>
        If you post an <strong>ayah card</strong> from the Read screen, we store the picture of the card,
        the ayah it shows, and any note you add.
      </p>
      <p>
        For every post we also store whether it is public or private, when it was posted, and how many
        times it has been played and liked.
      </p>

      <h3>3.3 Your activity in Qari</h3>
      <ul>
        <li>The posts you like, so they appear in your Favourites</li>
        <li>The people you follow, and who follows you</li>
        <li>Notifications about your posts and followers (for example, a new like or follower)</li>
        <li>
          Reports you make about a post: who made the report, which post it concerns, and the reason
          given, so that it can be reviewed
        </li>
      </ul>

      <h3>3.4 Your profile picture</h3>
      <p>
        If you add a profile picture, it is resized on your device and then stored so that others can
        see it on your profile and your posts.
      </p>

      <h3>3.5 Halaqas</h3>
      <p>If you start or join a halaqa, we store:</p>
      <ul>
        <li>The name you enter, which everyone in that halaqa can see</li>
        <li>
          The days you read &mdash; marked when you confirm you read, or when you read in the app while
          in a halaqa. Members see which days you read, never how much or what.
        </li>
        <li>The juz you take in a shared khatmah, and when you finish it</li>
        <li>The halaqa&rsquo;s name, its schedule and its invite link</li>
      </ul>
      <p>
        A halaqa needs no account. Your device keeps a random key that identifies you in your halaqas,
        and we store only a protected (hashed) copy of it.
      </p>

      <h3>3.6 Notifications</h3>
      <p>
        If you allow notifications, your browser gives us a delivery address for your device and the
        keys that encrypt what is sent to it, together with a description of the browser. We use these
        only to send the notifications you turned on, and delete them when they stop working or you
        turn notifications off.
      </p>

      <h3>3.7 Feedback</h3>
      <p>
        If you send us feedback, we store your message, your name or username, and any contact details
        you choose to include, so that we can read and respond to it.
      </p>

      <h3>3.8 Usage information</h3>
      <p>
        To keep the Service working and understand which parts are used, we record which screens are
        opened and how often, the last screen visited, and when the app was last used or last used
        offline. This is linked to your account if you have one, or otherwise to a random identifier.
        It is not used for advertising and is not shared with anyone.
      </p>

      <h2 id="permissions">4. Device permissions</h2>
      <ul>
        <li>
          <strong>Microphone.</strong> Used only while you are recording in Qari or using voice search.
          Recordings are uploaded only when you choose to post them. Voice search runs entirely on your
          device: the model is downloaded once, and what you say is never sent to us or anyone else.
        </li>
        <li>
          <strong>Location.</strong> Used only to calculate prayer times and the qibla direction, on your
          device. Your location is not sent to us. You can enter a city instead.
        </li>
        <li>
          <strong>Notifications.</strong> Used only for the notifications you turn on, such as the adhan,
          halaqa reminders, and activity on your Qari posts.
        </li>
      </ul>
      <p>You can withdraw any of these permissions at any time in your device or browser settings.</p>

      <h2 id="use">5. How we use information</h2>
      <p>We use the information described above to:</p>
      <ul>
        <li>Provide the features you use, such as your account, Qari, halaqas and notifications</li>
        <li>Show your posts to others in line with the visibility you choose</li>
        <li>Keep the Service secure, prevent abuse, and review reports</li>
        <li>Respond to feedback and requests</li>
        <li>Understand, maintain and improve the Service</li>
      </ul>
      <p>
        We do not sell or rent personal information, we do not use it for advertising, and we do not
        build profiles of you for any purpose beyond running the Service.
      </p>

      <h2 id="sharing">6. Who can see what you publish</h2>
      <p>
        <strong>Public</strong> posts, your username, display name and profile picture can be seen by
        anyone using the Service, and public posts can be liked, shared and saved by others &mdash; including
        as audio, video or picture files that can then be passed on outside the Service. A
        recitation that imitates a sheikh also appears on that sheikh&rsquo;s page.{' '}
        <strong>Private</strong> posts are visible only to you. Your followers and the people you follow
        are visible on profiles.
      </p>
      <p>
        Anyone with a halaqa&rsquo;s invite link can see its name, how many people are in it and how many
        have read today, and can join it. The person who started a halaqa can renew its link, remove
        members, or delete it for everyone.
      </p>

      <h2 id="providers">7. Services we rely on</h2>
      <p>
        We use a small number of service providers to run the Service. Like any website, each of them
        receives your device&rsquo;s IP address and basic request information when the app contacts it.
      </p>
      <ul>
        <li>
          <strong>MongoDB Atlas</strong> &mdash; hosts our database and the files you post (recordings,
          ayah cards and profile pictures).
        </li>
        <li>
          <strong>Quran content providers</strong> &mdash; Quran.com and the Quran Foundation, AlQuran
          Cloud, EveryAyah, MP3Quran, QuranicAudio and Tarteel provide Quran text, fonts, translations,
          recitations and recitation timings.
        </li>
        <li>
          <strong>Cloudinary</strong> &mdash; serves the moving backgrounds used in Qari and in shared
          videos.
        </li>
        <li>
          <strong>Cloudflare</strong> &mdash; serves the voice-search model when it is first downloaded.
        </li>
        <li>
          <strong>Hugging Face</strong> &mdash; when you share part of an ayah, the ayah&rsquo;s reference, its
          Arabic words and its published translation may be sent to an AI model hosted through Hugging
          Face to find the matching part of the translation. Nothing about you is included.
        </li>
        <li>
          <strong>Push services</strong> run by your browser&rsquo;s maker (for example Google, Apple or
          Mozilla) &mdash; deliver the notifications you turn on.
        </li>
      </ul>
      <p>
        We may also disclose information where required by law, or where necessary to protect the
        rights, safety or property of our users, the public or the Service.
      </p>

      <h2 id="transfers">8. Where information is processed</h2>
      <p>
        Our service providers may store or process information in countries other than your own. Where
        they do, we rely on providers that apply recognised safeguards to protect it.
      </p>

      <h2 id="retention">9. How long we keep information</h2>
      <ul>
        <li>Account information, for as long as the account exists</li>
        <li>A post, its likes and its reports, until the post or the account is deleted</li>
        <li>
          Halaqa information, while the halaqa exists; your reading days are deleted once you are no
          longer in any halaqa
        </li>
        <li>Notification delivery details, until they stop working or notifications are turned off</li>
        <li>Feedback, for as long as needed to deal with it</li>
      </ul>
      <p>
        Deleted information is removed from our live systems straight away, and from backups within a
        short period after that.
      </p>

      <h2 id="security">10. Security</h2>
      <p>
        Connections to the Service are encrypted. PINs and halaqa keys are stored only as salted hashes,
        and repeated failed sign-ins lock an account temporarily. No method of transmission or storage
        is completely secure, so while we work to protect your information, we cannot guarantee its
        absolute security.
      </p>

      <h2 id="rights">11. Your rights and choices</h2>
      <p>
        Depending on where you live, you may have the right to access the personal information we hold
        about you, to correct it, to have it deleted, to object to or restrict how it is used, and to
        receive a copy of it. To exercise any of these rights, contact us at the address below. You can
        also act directly in the app:
      </p>
      <ul>
        <li>
          <strong>Delete your account</strong> in Settings &rarr; Delete account. This permanently removes
          your account, every post you published with its audio or picture, your profile picture, your
          likes, follows and notifications, and reports you made or that concern your posts. It cannot
          be undone.
        </li>
        <li>
          <strong>Delete or hide a post</strong> from its menu, by deleting it or making it private.
        </li>
        <li>
          <strong>Leave a halaqa</strong> from within it.
        </li>
        <li>
          <strong>Turn off notifications</strong> in the app or in your device settings.
        </li>
      </ul>
      <p>You also have the right to complain to the data-protection authority where you live.</p>

      <h2 id="children">12. Children</h2>
      <p>
        {APP_NAME} can be used by people of any age to read and listen to the Quran without an account.
        Creating an account and publishing in Qari makes a username and what is published visible to
        others, so children should do so only with the knowledge and permission of a parent or guardian.
        If you believe a child has given us personal information without that permission, please
        contact us and we will remove it.
      </p>

      <h2 id="changes">13. Changes to this policy</h2>
      <p>
        We will update this policy if the Service changes how it handles information &mdash; for example,
        if it begins to collect something new &mdash; and change the date at the top of this page. Where
        a change is significant, we will also make it known in the app. Continuing to use the Service
        after a change takes effect means you accept the updated policy.
      </p>

      <h2 id="contact">14. Contact us</h2>
      <p>
        For questions about this policy, or to make a request about your information, contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
