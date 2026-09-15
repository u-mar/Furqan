import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { APP_NAME, PRIVACY_UPDATED, SUPPORT_EMAIL } from '@/lib/app-brand'

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
}

/**
 * Written from what the app actually does, not from a template: every item
 * below corresponds to something stored in prisma/schema.prisma, kept in the
 * browser, or fetched from a named service. If the app starts collecting
 * something new, this page is out of date until it says so.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label="Back"
          className="ed-focus flex h-11 w-11 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>

        <p className="ed-label mt-8">{APP_NAME}</p>
        <h1 className="home-serif mt-2 text-[2.25rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[var(--home-muted)]">Last updated {PRIVACY_UPDATED}</p>

        <div className="privacy-prose mt-8">
          <p>
            {APP_NAME} is built to help you read, listen to and share the Quran. You can use
            almost all of it without an account, and nothing is collected to sell or to show you
            advertising. This page explains exactly what is stored, where, and how to remove it.
          </p>

          <h2>Using the app without an account</h2>
          <p>
            Your bookmarks, reading position and settings are stored{' '}
            <strong>only on your device</strong>. They are never sent to us, and they are removed
            if you clear the app&rsquo;s data or uninstall it.
          </p>

          <h2>If you create an account</h2>
          <p>We store:</p>
          <ul>
            <li>
              <strong>Your username and name.</strong> Your username is your public profile address
              and is shown alongside anything you publish.
            </li>
            <li>
              <strong>Your PIN, in protected form only.</strong> It is salted and hashed, so it
              cannot be read back — not even by us. Repeated wrong attempts temporarily lock the
              account to protect it.
            </li>
          </ul>

          <h2>Recitations you publish in Qari</h2>
          <p>If you record and publish a recitation, we store:</p>
          <ul>
            <li>The audio recording, and its length and size</li>
            <li>The title, note and hashtags you add, and the sound setting you choose</li>
            <li>Whether you made it public or private</li>
            <li>How many times it has been played and favourited</li>
          </ul>
          <p>
            <strong>Public</strong> recitations can be heard, favourited and shared by anyone using
            the app, and anyone you share one with can pass it on. <strong>Private</strong>{' '}
            recitations are visible only to you. Your own plays are not counted.
          </p>
          <p>
            Recording uses your microphone, and only while you are recording. Nothing is uploaded
            until you choose to publish.
          </p>

          <h2>Halaqas</h2>
          <p>If you start or join a halaqa, we store:</p>
          <ul>
            <li>
              <strong>The name you enter,</strong> which everyone in that halaqa can see.
            </li>
            <li>
              <strong>The days you read.</strong> A day is marked when you tap &ldquo;Yes, I
              read&rdquo;, or when you read in the app while you are in a halaqa. The halaqa sees
              which days you read &mdash; never how much, or what.
            </li>
            <li>
              <strong>The juz you take</strong> in a shared khatmah, and when you finish it.
            </li>
            <li>The halaqa&rsquo;s name, how long it runs, and its invite link.</li>
          </ul>
          <p>
            No account is needed. Your phone keeps a random key that identifies you in your
            halaqas, and we store only a protected (hashed) copy of it. If you clear the
            app&rsquo;s data, the key is gone and you will need to join again.
          </p>
          <p>
            Anyone with a halaqa&rsquo;s invite link can see its name, how many people are in it
            and how many have read today, and can join it. The person who made the halaqa can
            make a new link at any time, remove people, or delete the halaqa for everyone.
          </p>
          <p>
            Leaving a halaqa removes you from it and gives back any juz you have not finished.
            Once you are not in any halaqa, the days you read are deleted.
          </p>

          <h2>Your profile picture</h2>
          <p>
            If you add one, it is resized on your device and then stored so that others can see it
            on your profile and recitations.
          </p>

          <h2>Favourites and reports</h2>
          <p>
            We record which recitations you favourite, so they appear in your Favourites. If you
            report a recitation, we store the report so it can be reviewed.
          </p>

          <h2>Feedback</h2>
          <p>
            If you send feedback, we store your message, and any contact details you choose to
            include, so we can read and reply to it.
          </p>

          <h2>Usage information</h2>
          <p>
            To understand how the app is used and keep it working, we record which parts of the
            app are visited, how often, and when the app was last opened. This is linked to your
            account if you have one, or to a random identifier if you don&rsquo;t. It is not used
            for advertising and is not shared.
          </p>

          <h2>Services the app connects to</h2>
          <p>
            To show Quran text, translations, fonts and recitations, the app fetches them from
            public Quran services, including api.quran.com, api.alquran.cloud, everyayah.com and
            mp3quran.net. Like any website, those services receive your device&rsquo;s IP address
            when the app requests something from them. Your account, recitations and halaqas are
            stored with our database provider, MongoDB Atlas.
          </p>
          <p>We do not sell your information, and we do not use advertising or tracking networks.</p>

          <h2>Deleting your account</h2>
          <p>
            You can delete your account at any time in <strong>Settings → Delete account</strong>.
            This permanently removes your account, every recitation you published along with its
            audio, your profile picture, your favourites, and reports you made or that were made
            about your recitations. It cannot be undone.
          </p>

          <h2>Children</h2>
          <p>
            {APP_NAME} can be used by people of any age to read and listen to the Quran. Publishing
            recitations makes them visible to others, so younger users should do so with a
            parent or guardian.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about your data, or a request to delete it, can be sent to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </div>
    </main>
  )
}
