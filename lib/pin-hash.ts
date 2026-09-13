import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto'

/**
 * PIN storage.
 *
 * A 4-digit PIN has 10,000 possible values. Hashed with bare SHA-256 — how
 * accounts were first stored — every one of them can be recovered from a
 * database copy by simply hashing all 10,000 candidates. A per-account salt
 * stops one computation cracking every account at once, and scrypt makes
 * each guess deliberately expensive.
 *
 * None of that helps against guessing through the login form itself; that
 * is what the lockout in the auth route is for.
 */

const KEY_LENGTH = 64
const PREFIX = 'scrypt'

function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(pin, salt)
  return `${PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`
}

/**
 * `needsUpgrade` is true when the PIN matched a legacy SHA-256 hash, so the
 * caller can re-store it in the current format while it has the plain PIN.
 */
export async function verifyPin(
  pin: string,
  stored: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith(`${PREFIX}$`)) {
    const [, saltHex, keyHex] = stored.split('$')
    if (!saltHex || !keyHex) return { ok: false, needsUpgrade: false }
    const expected = Buffer.from(keyHex, 'hex')
    const actual = await derive(pin, Buffer.from(saltHex, 'hex'))
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
    return { ok, needsUpgrade: false }
  }

  const legacy = Buffer.from(createHash('sha256').update(pin).digest('hex'))
  const saved = Buffer.from(stored)
  const ok = legacy.length === saved.length && timingSafeEqual(legacy, saved)
  return { ok, needsUpgrade: ok }
}
