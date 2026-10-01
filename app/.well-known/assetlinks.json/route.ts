import { NextResponse } from 'next/server'

/**
 * Digital Asset Links: tells Android that the Play Store app and this site
 * belong together, so the app opens the site full screen with no browser bar
 * (a Trusted Web Activity). Without it the app still works but shows an
 * address bar at the top.
 *
 * Set in the hosting environment:
 *   ANDROID_PACKAGE_NAME          e.g. app.nadir.twa
 *   ANDROID_SHA256_FINGERPRINTS   the app signing key's SHA-256, from Play
 *                                 Console → Test and release → App integrity.
 *                                 Several are allowed, comma-separated (for
 *                                 example Play's key and your upload key).
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim()
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean)

  const statements =
    packageName && fingerprints.length
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : []

  return NextResponse.json(statements, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
