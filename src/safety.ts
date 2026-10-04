/**
 * Content safety for a classroom app used by kids aged 7-12.
 *
 * Design notes:
 *  - The filter is deliberately conservative and runs on BOTH client and server.
 *    The client copy gives instant friendly feedback; the server copy is the one
 *    that actually protects the gallery (a kid can't bypass it from devtools).
 *  - We match on word boundaries and a small leet-speak normalisation so that
 *    "sh1t" is caught, but we avoid substring matching that would flag innocent
 *    words (the classic "Scunthorpe problem") - e.g. "assess", "class", "grass".
 *  - We never store or log the offending text. We just refuse it.
 */

// Base list kept short and focused on what actually shows up in a primary
// classroom: swearing, slurs, and sexual terms. Teachers can extend via
// EXTRA_BLOCKED in .dev.vars / Cloudflare env if their school has a policy list.
const BLOCKED_WORDS = [
  'anal', 'anus', 'arse', 'arsehole', 'ass', 'asshole', 'bastard', 'bitch',
  'blowjob', 'bollocks', 'boner', 'boob', 'boobs', 'bugger', 'bullshit',
  'clit', 'cock', 'coon', 'crap', 'cum', 'cunt', 'dick', 'dildo', 'douche',
  'dyke', 'fag', 'faggot', 'fuck', 'fucker', 'fucking', 'goddamn', 'handjob',
  'hell', 'hoe', 'homo', 'horny', 'jerkoff', 'jizz', 'kike', 'kill yourself',
  'kys', 'molest', 'motherfucker', 'nigga', 'nigger', 'nude', 'nudes',
  'orgasm', 'paki', 'penis', 'piss', 'porn', 'porno', 'prick', 'pussy',
  'queer', 'rape', 'retard', 'retarded', 'scrotum', 'semen', 'sex', 'sexy',
  'shit', 'slut', 'spic', 'suicide', 'testicle', 'tits', 'titties', 'twat',
  'vagina', 'wank', 'wanker', 'whore',
]

// Words that must never be flagged even though they contain a blocked word.
const ALLOWLIST = [
  'assess', 'assessment', 'asset', 'assign', 'assignment', 'assist', 'class',
  'classes', 'classic', 'classmate', 'classmates', 'classroom', 'compass',
  'grass', 'hello', 'mass', 'massive', 'pass', 'passage', 'password', 'past',
  'shell', 'shelter', 'sussex', 'titan', 'title',
]

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't',
}

/**
 * Normalise text so simple disguises ("f*ck", "sh1t", "fuuuck") still match.
 *
 * Important: digits are only de-leeted when they sit INSIDE a word (letters on
 * at least one side). Kids write about real numbers constantly - "45 kilometers",
 * "72 flights", "1977" - and blindly mapping 4 -> a turned "45" into "as", which
 * then tripped the filter. Standalone numbers are left completely alone.
 */
function normalise(input: string): string {
  let s = input.toLowerCase()

  // De-leet only digits/symbols that are adjacent to a letter.
  s = s.replace(/[01345789@$!|+]/g, (ch, idx: number, whole: string) => {
    const prev = whole[idx - 1]
    const next = whole[idx + 1]
    const letter = /[a-z]/
    const touchesLetter = (prev && letter.test(prev)) || (next && letter.test(next))
    return touchesLetter ? LEET_MAP[ch] ?? ch : ch
  })

  // Drop characters commonly used to break up words.
  s = s.replace(/[*._\-~^"'`()\[\]{}<>\/\\]/g, '')
  // Collapse 3+ repeats of a letter down to 2 ("fuuuuck" -> "fuuck").
  s = s.replace(/(.)\1{2,}/g, '$1$1')
  return s
}

/** Placeholder standing in for a character the writer masked out. */
const MASK = '\u0001'

/**
 * Variant of the text where symbols used to self-censor a word ("f*ck", "sh#t",
 * "b00b") become a wildcard instead of being deleted. Deleting them made "f*ck"
 * collapse to "fck", which matched nothing.
 */
function maskVariant(input: string): string {
  let s = input.toLowerCase()
  // A mask symbol only counts when it sits between/next to letters, so ordinary
  // punctuation and maths ("2 * 3", "end.") is unaffected.
  s = s.replace(/[*#%&°·•_~^+]/g, (ch, idx: number, whole: string) => {
    const prev = whole[idx - 1]
    const next = whole[idx + 1]
    const letter = /[a-z]/
    return (prev && letter.test(prev)) || (next && letter.test(next)) ? MASK : ch
  })
  s = s.replace(/(.)\1{2,}/g, '$1$1')
  return s
}

/**
 * Regex for a blocked word in which any single position may have been masked
 * out: "fuck" also matches "f\x01ck". Only used for words of 4+ letters, so
 * short entries cannot over-match.
 */
function maskedPattern(word: string): RegExp {
  const body = word
    .split('')
    .map((ch) => `(?:${escapeRegex(ch)}|${MASK})`)
    .join('')
  return new RegExp(`\\b${body}\\b`, 'i')
}

/**
 * Collapse ALL repeats so "fuuck" -> "fuck" for a second matching pass.
 *
 * This is applied to the TEXT only, never to the blocked word itself: collapsing
 * "ass" to "as" made the innocent word "as" a profanity match.
 */
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/g, '$1')
}

export interface SafetyResult {
  ok: boolean
  /** Kid-friendly message explaining what to do - never echoes the bad word. */
  message?: string
  /** Machine-readable reason, for logging counts only (never the text). */
  reason?: 'profanity' | 'too_long' | 'empty' | 'contact_info' | 'shouting'
}

export interface SafetyOptions {
  maxLength?: number
  minLength?: number
  /** Extra blocked words supplied by the school, comma separated. */
  extraBlocked?: string
  /** If false, empty text is allowed (e.g. a drawing-only postcard). */
  required?: boolean
}

/**
 * Check a piece of kid-written text before it is stored or shown.
 * Returns { ok: true } or { ok: false, message } with advice for the kid.
 */
export function checkText(raw: string, opts: SafetyOptions = {}): SafetyResult {
  const {
    maxLength = 1200,
    minLength = 0,
    extraBlocked = '',
    required = false,
  } = opts

  const text = (raw ?? '').trim()

  if (!text) {
    return required
      ? { ok: false, reason: 'empty', message: 'Please write something first!' }
      : { ok: true }
  }

  if (text.length > maxLength) {
    return {
      ok: false,
      reason: 'too_long',
      message: `That is a bit too long. Please keep it under ${maxLength} letters.`,
    }
  }

  if (text.length < minLength) {
    return {
      ok: false,
      reason: 'empty',
      message: `Please write a little more - at least ${minLength} letters.`,
    }
  }

  // Block things that look like personal contact info (phone / email / @handle).
  // We collect no personal data, so this keeps kids from typing it by accident.
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)
  const hasPhone = /(?:\+?\d[\s().-]?){9,}/.test(text)
  const hasHandle = /(?:^|\s)@[a-z0-9_]{3,}/i.test(text)
  if (hasEmail || hasPhone || hasHandle) {
    return {
      ok: false,
      reason: 'contact_info',
      message:
        'Please do not put emails, phone numbers or usernames in your message. Keep it about your space robot!',
    }
  }

  const words = (extraBlocked ? extraBlocked.split(',') : [])
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .concat(BLOCKED_WORDS)

  const normalised = normalise(text)
  const collapsed = collapseRepeats(normalised)
  const masked = maskVariant(text)

  // Remove allowlisted words from every pass so they can never trigger a match.
  let safeNorm = normalised
  let safeCollapsed = collapsed
  let safeMasked = masked
  for (const good of ALLOWLIST) {
    const re = new RegExp(escapeRegex(good), 'g')
    safeNorm = safeNorm.replace(re, ' ')
    safeMasked = safeMasked.replace(re, ' ')
    safeCollapsed = safeCollapsed.replace(new RegExp(escapeRegex(collapseRepeats(good)), 'g'), ' ')
  }

  for (const word of words) {
    const w = normalise(word)
    if (!w) continue
    // \b word boundaries stop "ass" matching inside "grass".
    // The blocked word is used AS-IS against both the normalised text and the
    // repeat-collapsed text. We never collapse the blocked word itself, or
    // "ass" would shrink to "as" and flag ordinary sentences.
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, 'i')
    // Longer words also get the masked check, catching "f*ck" / "sh#t".
    const maskedHit = w.length >= 4 && maskedPattern(w).test(safeMasked)
    if (re.test(safeNorm) || re.test(safeCollapsed) || maskedHit) {
      return {
        ok: false,
        reason: 'profanity',
        message:
          'Oops! Some words in there are not allowed at school. Please try saying it a different way.',
      }
    }
  }

  // Gentle nudge against ALL-CAPS shouting (only for longer text).
  const letters = text.replace(/[^a-z]/gi, '')
  if (letters.length > 25) {
    const caps = text.replace(/[^A-Z]/g, '').length
    if (caps / letters.length > 0.8) {
      return {
        ok: false,
        reason: 'shouting',
        message: 'That is a lot of CAPITAL LETTERS! Please write it normally so it is easy to read.',
      }
    }
  }

  return { ok: true }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Nicknames: letters, numbers, spaces and a couple of safe symbols only. */
export function checkNickname(raw: string, extraBlocked = ''): SafetyResult {
  const name = (raw ?? '').trim()
  if (!name) {
    return { ok: false, reason: 'empty', message: 'Please pick a nickname!' }
  }
  if (name.length > 20) {
    return { ok: false, reason: 'too_long', message: 'Please pick a shorter nickname (20 letters max).' }
  }
  if (!/^[a-zA-Z0-9 _.-]+$/.test(name)) {
    return {
      ok: false,
      reason: 'profanity',
      message: 'Nicknames can use letters, numbers, spaces, dots and dashes only.',
    }
  }
  return checkText(name, { extraBlocked, maxLength: 20, required: true })
}

/** Strip anything that could be HTML so text is always safe to render. */
export function sanitiseText(raw: string): string {
  return (raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/\u0000/g, '')
    .trim()
}
