# Data safety form: answers

Based on what the app stores (`prisma/schema.prisma`) and the Privacy Policy
(`app/privacy/page.tsx`). Update this if either changes.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: in Settings → Delete account, and at `/delete-account` |

"Shared" in Play's sense means passed to a third party. Nadir doesn't share
user data. Hosting providers working on our behalf (MongoDB Atlas) count as
service providers, not sharing. Posts that other users can see are not
"sharing" either.

## Data types collected

For each, Play asks: collected? shared? processed ephemerally? required or
optional? why?

### Personal info
| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| Name (display name) | Yes | No | Optional (only with an account) | App functionality, Account management |
| User IDs (username) | Yes | No | Optional | App functionality, Account management |

### Photos and videos
| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| Photos (profile picture, ayah cards posted to Qari) | Yes | No | Optional | App functionality |

### Audio
| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| Voice or sound recordings (Qari recitations) | Yes | No | Optional | App functionality |

### App activity
| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| App interactions (screens opened, how often, last used) | Yes | No | Required | Analytics, App functionality |
| Other user-generated content (titles, notes, hashtags, likes, follows, blocks, reports, halaqa name) | Yes | No | Optional | App functionality |
| Other actions (feedback messages) | Yes | No | Optional | Developer communications |

### Device or other IDs
| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| Device or other IDs (push notification address and keys; a random ID for usage counts and halaqas) | Yes | No | Optional (notifications) / Required (random usage ID) | App functionality, Analytics |

## Not collected

Answer **No** for these:

- **Location.** Prayer times and the qibla are calculated on the phone; the
  location never reaches our servers.
- **Email, phone number, address.** Not asked for.
- **Financial info, health, contacts, calendar, messages, files, web browsing.**
  Not collected.
- **Voice search speech.** Handled by the phone's own speech recognition
  (Google/Apple), not sent to us. Only the recognised words are used, on the
  phone. If the form asks about it specifically, answer that audio is not
  collected by the app.

## Security practices

- Data is encrypted in transit: **Yes**
- Users can request data deletion: **Yes**
- Committed to the Play Families Policy: **No** (target audience 13+)
- Independent security review: **No**
