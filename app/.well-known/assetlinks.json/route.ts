/**
 * GET /.well-known/assetlinks.json — how Android checks that qurannaba.com
 * trusts the Play Store app to open its links (the intent filter in
 * android/app/src/main/AndroidManifest.xml). One fingerprint per key the app
 * is signed with; a link only opens in a copy signed by one of them.
 */

const SIGNING_KEYS_SHA256 = [
  // The debug key on the build PC, for the test APKs.
  '5B:E7:FC:C6:F8:4B:FA:20:10:F2:F3:1D:7F:5B:12:12:F9:33:27:48:4A:8D:B9:85:0D:09:90:80:F1:69:70:C5',
  // The upload key (~/.naba-keys), for release builds installed straight from this PC.
  'FA:B0:51:8F:C0:4E:19:FD:CE:FB:16:8A:84:1F:A1:B9:6A:D2:1E:1C:2C:F5:32:84:F6:E9:45:82:69:0F:7B:04',
  // Google's app signing key: it signs the app people get from Play (Play Console → App integrity).
  '7C:1D:ED:33:96:B6:B9:62:7C:EF:1C:4E:42:97:C7:A7:9F:75:DE:EB:C8:3F:92:0A:72:1D:8F:8E:49:E3:93:F4',
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
