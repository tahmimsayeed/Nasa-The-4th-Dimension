import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkText, checkNickname, sanitiseText } from './safety'

type Bindings = {
  DB: D1Database
  EXTRA_BLOCKED_WORDS?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const STICKERS = ['star', 'rocket', 'heart'] as const
const TASK_TYPES = ['postcard', 'decision'] as const
const DECISIONS = ['museum', 'historic', 'newjob'] as const
const STATUSES = ['live', 'pending', 'hidden'] as const

// Keep data URLs small so school devices and D1 stay happy.
const MAX_DRAWING_BYTES = 700_000 // ~700KB PNG
const MAX_AUDIO_BYTES = 900_000 // ~900KB for a 20s clip

function newId(): string {
  // 8 chars, URL + QR friendly, no look-alike characters.
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function normaliseClassCode(raw: string): string {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, '-').slice(0, 20)
}

function isValidClassCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)
}

/** Anonymous per-device key for reaction de-duplication. Not a tracking id. */
function voterKey(c: any): string {
  const header = c.req.header('x-voter-key')
  if (header && /^[a-z0-9-]{6,40}$/i.test(header)) return header
  // Fall back to a coarse key; worst case a kid can react twice.
  return 'anon-' + (c.req.header('cf-connecting-ip') ?? 'local')
}

function jsonError(c: any, message: string, status = 400) {
  return c.json({ ok: false, error: message }, status)
}

/** Ensure the class row exists, so exhibits always have a parent. */
async function ensureClass(db: D1Database, code: string) {
  await db
    .prepare('INSERT OR IGNORE INTO classes (code, require_approval) VALUES (?, 0)')
    .bind(code)
    .run()
}

function approxBytes(dataUrl: string | null | undefined): number {
  if (!dataUrl) return 0
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.floor(b64.length * 0.75)
}

function isSafeDataUrl(v: string, kinds: string[]): boolean {
  return kinds.some((k) => v.startsWith(`data:${k}`))
}

/** Shape a DB row into the JSON the frontend expects. */
function rowToExhibit(row: any, reactions: Record<string, number> = {}) {
  return {
    id: row.id,
    classCode: row.class_code,
    nickname: row.nickname,
    petName: row.pet_name,
    hardwareId: row.hardware_id,
    petConfig: safeParse(row.pet_config, {}),
    taskType: row.task_type,
    postcardText: row.postcard_text ?? null,
    drawingData: row.drawing_data ?? null,
    audioData: row.audio_data ?? null,
    hasDrawing: !!row.drawing_data,
    hasAudio: !!row.audio_data,
    decision: row.decision ?? null,
    reasons: safeParse(row.reasons, []),
    risk: row.risk ?? null,
    status: row.status,
    createdAt: row.created_at,
    reactions: {
      star: reactions.star ?? 0,
      rocket: reactions.rocket ?? 0,
      heart: reactions.heart ?? 0,
    },
  }
}

function safeParse(raw: any, fallback: any) {
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function reactionMap(db: D1Database, exhibitIds: string[]) {
  const map: Record<string, Record<string, number>> = {}
  if (exhibitIds.length === 0) return map
  const placeholders = exhibitIds.map(() => '?').join(',')
  const { results } = await db
    .prepare(
      `SELECT exhibit_id, sticker, COUNT(*) AS n FROM reactions
       WHERE exhibit_id IN (${placeholders}) GROUP BY exhibit_id, sticker`
    )
    .bind(...exhibitIds)
    .all()
  for (const r of (results ?? []) as any[]) {
    map[r.exhibit_id] ??= {}
    map[r.exhibit_id][r.sticker] = Number(r.n)
  }
  return map
}

/* ------------------------------------------------------------------ *
 * API: class
 * ------------------------------------------------------------------ */

/** Join (or silently create) a class. Returns class settings. */
app.post('/api/class/join', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const code = normaliseClassCode(body.classCode ?? '')
  const extra = c.env.EXTRA_BLOCKED_WORDS ?? ''

  if (!isValidClassCode(code)) {
    return jsonError(
      c,
      'That class code looks wrong. It should look like MOON-42 (letters, numbers and dashes).'
    )
  }

  const nick = checkNickname(body.nickname ?? '', extra)
  if (!nick.ok) return jsonError(c, nick.message!)

  await ensureClass(c.env.DB, code)
  const row = await c.env.DB.prepare(
    'SELECT code, require_approval FROM classes WHERE code = ?'
  )
    .bind(code)
    .first<any>()

  return c.json({
    ok: true,
    classCode: code,
    nickname: sanitiseText(body.nickname),
    requireApproval: !!row?.require_approval,
  })
})

/* ------------------------------------------------------------------ *
 * API: exhibits
 * ------------------------------------------------------------------ */

/** Create an exhibit (the kid's finished creative mission). */
app.post('/api/exhibits', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const extra = c.env.EXTRA_BLOCKED_WORDS ?? ''
  const code = normaliseClassCode(body.classCode ?? '')

  if (!isValidClassCode(code)) return jsonError(c, 'Missing or invalid class code.')

  const nick = checkNickname(body.nickname ?? '', extra)
  if (!nick.ok) return jsonError(c, nick.message!)

  const petNameCheck = checkText(body.petName ?? '', {
    extraBlocked: extra,
    maxLength: 24,
    required: true,
  })
  if (!petNameCheck.ok) return jsonError(c, petNameCheck.message!)

  const taskType = String(body.taskType ?? '')
  if (!TASK_TYPES.includes(taskType as any)) return jsonError(c, 'Unknown mission type.')

  if (typeof body.hardwareId !== 'string' || !/^[a-z0-9_]{2,32}$/.test(body.hardwareId)) {
    return jsonError(c, 'Please pick which real NASA hardware your pet is based on.')
  }

  // --- validate media ---
  const drawing = typeof body.drawingData === 'string' ? body.drawingData : null
  if (drawing) {
    if (!isSafeDataUrl(drawing, ['image/png', 'image/jpeg', 'image/webp'])) {
      return jsonError(c, 'That drawing could not be read. Please try again.')
    }
    if (approxBytes(drawing) > MAX_DRAWING_BYTES) {
      return jsonError(c, 'That drawing is too big. Try a simpler picture.')
    }
  }

  const audio = typeof body.audioData === 'string' ? body.audioData : null
  if (audio) {
    if (!isSafeDataUrl(audio, ['audio/'])) {
      return jsonError(c, 'That voice clip could not be read. Please record it again.')
    }
    if (approxBytes(audio) > MAX_AUDIO_BYTES) {
      return jsonError(c, 'That voice clip is too long. Please keep it under 20 seconds.')
    }
  }

  // --- validate per-task fields ---
  let postcardText: string | null = null
  let decision: string | null = null
  let reasons: string[] = []
  let risk: string | null = null

  if (taskType === 'postcard') {
    postcardText = sanitiseText(body.postcardText ?? '')
    const hasOtherMedia = !!drawing || !!audio
    // A kid who draws or records does not have to type as well.
    const textCheck = checkText(postcardText, {
      extraBlocked: extra,
      maxLength: 1200,
      minLength: hasOtherMedia ? 0 : 15,
      required: !hasOtherMedia,
    })
    if (!textCheck.ok) return jsonError(c, textCheck.message!)
  } else {
    decision = String(body.decision ?? '')
    if (!DECISIONS.includes(decision as any)) {
      return jsonError(c, 'Please choose what happens to your robot.')
    }
    const rawReasons = Array.isArray(body.reasons) ? body.reasons : []
    reasons = rawReasons
      .map((r: any) => sanitiseText(String(r ?? '')))
      .filter((r: string) => r.length > 0)
      .slice(0, 3)
    if (reasons.length < 2) {
      return jsonError(c, 'Please give at least 2 reasons for your choice.')
    }
    for (const r of reasons) {
      const rc = checkText(r, { extraBlocked: extra, maxLength: 300, required: true })
      if (!rc.ok) return jsonError(c, rc.message!)
    }
    risk = sanitiseText(body.risk ?? '')
    const riskCheck = checkText(risk, {
      extraBlocked: extra,
      maxLength: 400,
      minLength: 5,
      required: true,
    })
    if (!riskCheck.ok) return jsonError(c, riskCheck.message!)
  }

  const petConfig = typeof body.petConfig === 'object' && body.petConfig ? body.petConfig : {}

  await ensureClass(c.env.DB, code)
  const cls = await c.env.DB.prepare('SELECT require_approval FROM classes WHERE code = ?')
    .bind(code)
    .first<any>()
  const status = cls?.require_approval ? 'pending' : 'live'

  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO exhibits
       (id, class_code, nickname, pet_name, hardware_id, pet_config, task_type,
        postcard_text, drawing_data, audio_data, decision, reasons, risk, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      code,
      sanitiseText(body.nickname),
      sanitiseText(body.petName),
      body.hardwareId,
      JSON.stringify(petConfig),
      taskType,
      postcardText,
      drawing,
      audio,
      decision,
      JSON.stringify(reasons),
      risk,
      status
    )
    .run()

  return c.json({ ok: true, id, status, requireApproval: status === 'pending' })
})

/** List exhibits for a class (gallery). Hidden/pending are excluded for kids. */
app.get('/api/exhibits', async (c) => {
  const code = normaliseClassCode(c.req.query('classCode') ?? '')
  if (!isValidClassCode(code)) return jsonError(c, 'Missing class code.')

  const hardware = c.req.query('hardware') ?? ''
  const task = c.req.query('task') ?? ''
  const sort = c.req.query('sort') === 'popular' ? 'popular' : 'newest'
  // Teacher view passes includeAll=1 with the pin to see pending + hidden.
  const includeAll = c.req.query('includeAll') === '1'
  const pin = c.req.query('pin') ?? ''

  let isTeacher = false
  if (includeAll) {
    const cls = await c.env.DB.prepare('SELECT teacher_pin FROM classes WHERE code = ?')
      .bind(code)
      .first<any>()
    // If no pin was ever set, the first teacher to look is trusted (classroom tool).
    isTeacher = !cls?.teacher_pin || cls.teacher_pin === pin
    if (!isTeacher) return jsonError(c, 'Wrong teacher PIN.', 403)
  }

  const where: string[] = ['class_code = ?']
  const binds: any[] = [code]
  if (!isTeacher) where.push("status = 'live'")
  if (hardware && /^[a-z0-9_]{2,32}$/.test(hardware)) {
    where.push('hardware_id = ?')
    binds.push(hardware)
  }
  if (TASK_TYPES.includes(task as any)) {
    where.push('task_type = ?')
    binds.push(task)
  }

  // Omit the heavy media blobs from the list payload; the detail call fetches them.
  const { results } = await c.env.DB.prepare(
    `SELECT id, class_code, nickname, pet_name, hardware_id, pet_config, task_type,
            postcard_text, decision, reasons, risk, status, created_at,
            (drawing_data IS NOT NULL) AS has_drawing,
            (audio_data IS NOT NULL) AS has_audio
     FROM exhibits WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC LIMIT 300`
  )
    .bind(...binds)
    .all()

  const rows = (results ?? []) as any[]
  const reactions = await reactionMap(
    c.env.DB,
    rows.map((r) => r.id)
  )

  let exhibits = rows.map((r) => {
    const e = rowToExhibit(r, reactions[r.id])
    e.hasDrawing = !!r.has_drawing
    e.hasAudio = !!r.has_audio
    e.drawingData = null
    e.audioData = null
    return e
  })

  if (sort === 'popular') {
    exhibits = exhibits.sort((a, b) => {
      const sum = (x: any) => x.reactions.star + x.reactions.rocket + x.reactions.heart
      return sum(b) - sum(a)
    })
  }

  return c.json({ ok: true, classCode: code, count: exhibits.length, exhibits, isTeacher })
})

/** Single exhibit with full media - used by the detail modal and QR links. */
app.get('/api/exhibits/:id', async (c) => {
  const id = c.req.param('id')
  if (!/^[a-z0-9]{4,16}$/.test(id)) return jsonError(c, 'Unknown exhibit.', 404)

  const row = await c.env.DB.prepare('SELECT * FROM exhibits WHERE id = ?').bind(id).first<any>()
  if (!row) return jsonError(c, 'That exhibit was not found.', 404)
  if (row.status === 'hidden') {
    return jsonError(c, 'This exhibit is not on the wall right now.', 403)
  }

  const reactions = await reactionMap(c.env.DB, [id])
  return c.json({ ok: true, exhibit: rowToExhibit(row, reactions[id]) })
})

/** Class-wide poll results for Mission B, shown after submitting. */
app.get('/api/poll', async (c) => {
  const code = normaliseClassCode(c.req.query('classCode') ?? '')
  if (!isValidClassCode(code)) return jsonError(c, 'Missing class code.')

  const { results } = await c.env.DB.prepare(
    `SELECT decision, COUNT(*) AS n FROM exhibits
     WHERE class_code = ? AND task_type = 'decision' AND status != 'hidden'
       AND decision IS NOT NULL
     GROUP BY decision`
  )
    .bind(code)
    .all()

  const counts: Record<string, number> = { museum: 0, historic: 0, newjob: 0 }
  let total = 0
  for (const r of (results ?? []) as any[]) {
    counts[r.decision] = Number(r.n)
    total += Number(r.n)
  }
  return c.json({ ok: true, counts, total })
})

/* ------------------------------------------------------------------ *
 * API: reactions (preset stickers only - never free text)
 * ------------------------------------------------------------------ */

app.post('/api/exhibits/:id/react', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const sticker = String(body.sticker ?? '')

  if (!/^[a-z0-9]{4,16}$/.test(id)) return jsonError(c, 'Unknown exhibit.', 404)
  if (!STICKERS.includes(sticker as any)) return jsonError(c, 'Unknown sticker.')

  const row = await c.env.DB.prepare('SELECT status FROM exhibits WHERE id = ?')
    .bind(id)
    .first<any>()
  if (!row || row.status === 'hidden') return jsonError(c, 'Exhibit not available.', 404)

  const key = voterKey(c)
  // UNIQUE(exhibit_id, sticker, voter_key) makes a repeat tap a no-op.
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO reactions (exhibit_id, sticker, voter_key) VALUES (?,?,?)'
  )
    .bind(id, sticker, key)
    .run()

  const reactions = await reactionMap(c.env.DB, [id])
  return c.json({
    ok: true,
    reactions: {
      star: reactions[id]?.star ?? 0,
      rocket: reactions[id]?.rocket ?? 0,
      heart: reactions[id]?.heart ?? 0,
    },
  })
})

/* ------------------------------------------------------------------ *
 * API: teacher
 * ------------------------------------------------------------------ */

async function requireTeacher(c: any, code: string, pin: string) {
  const cls = await c.env.DB.prepare('SELECT teacher_pin FROM classes WHERE code = ?')
    .bind(code)
    .first<any>()
  if (!cls) return { ok: false as const, error: 'That class does not exist yet.' }
  if (cls.teacher_pin && cls.teacher_pin !== pin) {
    return { ok: false as const, error: 'Wrong teacher PIN.' }
  }
  return { ok: true as const }
}

/** Teacher sign-in. If the class has no PIN yet, the one entered is saved. */
app.post('/api/teacher/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const code = normaliseClassCode(body.classCode ?? '')
  const pin = String(body.pin ?? '')

  if (!isValidClassCode(code)) return jsonError(c, 'Invalid class code.')
  if (!/^\d{4,8}$/.test(pin)) return jsonError(c, 'PIN must be 4-8 numbers.')

  await ensureClass(c.env.DB, code)
  const cls = await c.env.DB.prepare(
    'SELECT teacher_pin, require_approval FROM classes WHERE code = ?'
  )
    .bind(code)
    .first<any>()

  if (!cls?.teacher_pin) {
    // First teacher to sign in claims the class with this PIN.
    await c.env.DB.prepare('UPDATE classes SET teacher_pin = ? WHERE code = ?')
      .bind(pin, code)
      .run()
    return c.json({ ok: true, classCode: code, claimed: true, requireApproval: !!cls?.require_approval })
  }
  if (cls.teacher_pin !== pin) return jsonError(c, 'Wrong PIN. Please try again.', 403)

  return c.json({
    ok: true,
    classCode: code,
    claimed: false,
    requireApproval: !!cls.require_approval,
  })
})

/** Turn "approve before it goes live" on or off for a class. */
app.post('/api/teacher/settings', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const code = normaliseClassCode(body.classCode ?? '')
  const pin = String(body.pin ?? '')
  if (!isValidClassCode(code)) return jsonError(c, 'Invalid class code.')

  const auth = await requireTeacher(c, code, pin)
  if (!auth.ok) return jsonError(c, auth.error, 403)

  const requireApproval = body.requireApproval ? 1 : 0
  await c.env.DB.prepare('UPDATE classes SET require_approval = ? WHERE code = ?')
    .bind(requireApproval, code)
    .run()

  return c.json({ ok: true, requireApproval: !!requireApproval })
})

/** Approve / hide / restore an exhibit. */
app.post('/api/teacher/exhibits/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const pin = String(body.pin ?? '')
  const status = String(body.status ?? '')

  if (!/^[a-z0-9]{4,16}$/.test(id)) return jsonError(c, 'Unknown exhibit.', 404)
  if (!STATUSES.includes(status as any)) return jsonError(c, 'Unknown status.')

  const row = await c.env.DB.prepare('SELECT class_code FROM exhibits WHERE id = ?')
    .bind(id)
    .first<any>()
  if (!row) return jsonError(c, 'Exhibit not found.', 404)

  const auth = await requireTeacher(c, row.class_code, pin)
  if (!auth.ok) return jsonError(c, auth.error, 403)

  await c.env.DB.prepare('UPDATE exhibits SET status = ? WHERE id = ?').bind(status, id).run()
  return c.json({ ok: true, id, status })
})

/** Permanently delete an exhibit. */
app.post('/api/teacher/exhibits/:id/delete', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const pin = String(body.pin ?? '')
  if (!/^[a-z0-9]{4,16}$/.test(id)) return jsonError(c, 'Unknown exhibit.', 404)

  const row = await c.env.DB.prepare('SELECT class_code FROM exhibits WHERE id = ?')
    .bind(id)
    .first<any>()
  if (!row) return jsonError(c, 'Exhibit not found.', 404)

  const auth = await requireTeacher(c, row.class_code, pin)
  if (!auth.ok) return jsonError(c, auth.error, 403)

  await c.env.DB.prepare('DELETE FROM reactions WHERE exhibit_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM exhibits WHERE id = ?').bind(id).run()
  return c.json({ ok: true, id, deleted: true })
})

/** Everything a teacher needs for the printable PDF, in one call. */
app.get('/api/teacher/export', async (c) => {
  const code = normaliseClassCode(c.req.query('classCode') ?? '')
  const pin = c.req.query('pin') ?? ''
  if (!isValidClassCode(code)) return jsonError(c, 'Invalid class code.')

  const auth = await requireTeacher(c, code, pin)
  if (!auth.ok) return jsonError(c, auth.error, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM exhibits WHERE class_code = ? AND status = 'live'
     ORDER BY created_at ASC`
  )
    .bind(code)
    .all()

  const rows = (results ?? []) as any[]
  const reactions = await reactionMap(
    c.env.DB,
    rows.map((r) => r.id)
  )
  return c.json({
    ok: true,
    classCode: code,
    exportedAt: new Date().toISOString(),
    exhibits: rows.map((r) => rowToExhibit(r, reactions[r.id])),
  })
})

/* ------------------------------------------------------------------ *
 * API: misc
 * ------------------------------------------------------------------ */

/** Live text check so the kid gets friendly feedback while typing. */
app.post('/api/check-text', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = checkText(String(body.text ?? ''), {
    extraBlocked: c.env.EXTRA_BLOCKED_WORDS ?? '',
    maxLength: Number(body.maxLength) || 1200,
  })
  return c.json({ ok: true, ...result })
})

app.get('/api/health', (c) => c.json({ ok: true, app: 'robo-pet-station' }))

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

const shell = (bodyClass: string, inner: string, title: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0b1026">
<meta name="description" content="Build a space robo pet inspired by real NASA hardware left on the Moon, Mars and in deep space. A storytelling game for kids aged 7-12.">
<title>${title}</title>
<link rel="icon" href="/static/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/css/app.css">
</head>
<body class="${bodyClass}">
${inner}
<script src="/static/vendor/qrcode.js"></script>
<script src="/static/js/pet-renderer.js"></script>
<script src="/static/js/app.js" type="module"></script>
</body>
</html>`

// The game itself (single page app; screens are swapped client-side).
app.get('/', (c) =>
  c.html(
    shell(
      'app-body',
      `<div id="app-root" aria-live="polite"></div><div id="modal-root"></div>`,
      'Robo Pet Station - Build a NASA Space Robo Pet'
    )
  )
)

// Direct links / QR codes for one exhibit. Same SPA, routed client-side.
app.get('/exhibit/:id', (c) =>
  c.html(
    shell(
      'app-body',
      `<div id="app-root" aria-live="polite"></div><div id="modal-root"></div>`,
      'Robo Pet Exhibit - Robo Pet Station'
    )
  )
)

app.get('/wall', (c) =>
  c.html(
    shell(
      'app-body',
      `<div id="app-root" aria-live="polite"></div><div id="modal-root"></div>`,
      'Class Museum Wall - Robo Pet Station'
    )
  )
)

app.get('/teacher', (c) =>
  c.html(
    shell(
      'app-body',
      `<div id="app-root" aria-live="polite"></div><div id="modal-root"></div>`,
      'Teacher View - Robo Pet Station'
    )
  )
)

export default app
