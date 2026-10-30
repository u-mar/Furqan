/**
 * GET /.well-known/assetlinks.json — how Android checks that qurannaba.com
 * trusts the Play Store app to open its links (the intent filter in
 * android/app/src/main/AndroidManifest.xml). One fingerprint per key the app
 * is signed with; a link only opens in a copy signed by one of them.
 */

const SIGNING_KEYS_SHA256 = [
  // The debug key on the build PC, for the test APKs.
  '5B:E7:FC:C6:F8:4B:FA:20:10:F2:F3:1D:7F:5B:12:12:F9:33:27:48:4A:8D:B9:85:0D:09:90:80:F1:69:70:C5',
  // Still to add: the upload key, and Google's app signing key (Play Console → App integrity).
]

export const dynamic = 'force-static'

export function GET() {
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'com.qurannaba.app', sha256_cert_fingerprints: SIGNING_KEYS_SHA256 },
    },
  ])
}
