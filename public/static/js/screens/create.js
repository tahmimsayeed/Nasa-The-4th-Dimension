/**
 * Screen 4 - Creative Mission.
 *
 * The kid picks ONE of two tasks:
 *   A) "Message Home"    - a postcard written, drawn or spoken by the pet
 *   B) "Rescue or Retire" - a one-page mission plan with a decision
 *
 * Accessibility goal: typing, drawing and recording are equally easy, so a kid
 * who struggles to write can still take part fully.
 */

import { state, saveState } from '../state.js'
import { api } from '../api.js'
import { h, esc, el, els, toast, speakBtn, announce } from '../ui.js'

/* ================================================================== *
 * Task chooser
 * ================================================================== */

function taskChooser() {
  return `
    <h1>✏️ Choose Your Mission</h1>
    <p class="lead">
      Pick ONE creative mission. Both are fun - there is no wrong choice!
      ${speakBtn('Pick one creative mission. Mission A is Message Home, where you write a postcard from your robot. Mission B is Rescue or Retire, where you decide what should happen to your robot.')}
    </p>

    <div class="task-grid">
      <button class="task-card t-postcard" type="button" data-task="postcard">
        <span class="tc-emoji" aria-hidden="true">💌</span>
        <h3>Mission A: Message Home</h3>
        <p>
          Write, draw or record a postcard from your robo pet. Tell Earth where you are,
          what you saw, and how it feels to be left behind.
        </p>
      </button>

      <button class="task-card t-decision" type="button" data-task="decision">
        <span class="tc-emoji" aria-hidden="true">⚖️</span>
        <h3>Mission B: Rescue or Retire</h3>
        <p>
          You are in charge! Decide if your robot comes home to a museum, stays as a
          historic site, or gets a brand new job. Then explain why.
        </p>
      </button>
    </div>

    <div class="btn-row" style="margin-top:22px">
      <button class="btn btn-ghost" data-goto="learn"><span aria-hidden="true">←</span> Back to the story</button>
    </div>
  `
}

/* ================================================================== *
 * Mission A - postcard
 * ================================================================== */

function factMeter(hw) {
  const used = state.draft.usedFacts.length
  const needed = 1
  const done = used >= needed
  return `
    <div class="fact-meter ${done ? 'done' : ''}" id="fact-meter" aria-live="polite">
      <span class="fm-icon" aria-hidden="true">${done ? '✅' : '🔎'}</span>
      <span>
        ${done
          ? `Great! You used <b>${used}</b> real fact${used === 1 ? '' : 's'} from the mission file.`
          : 'Add at least <b>1 real fact</b> from the mission file. Tap a fact below to drop it in!'}
      </span>
    </div>`
}

function postcardTask(hw) {
  const d = state.draft
  const prompts = window.__robo.data.prompts.postcard || []

  return `
    <h1>💌 Mission A: Message Home</h1>
    <p class="lead">
      You are <b>${esc(state.petName)}</b>, writing home to Earth.
      ${speakBtn(`You are ${state.petName}, writing home to Earth. Tell them where you are, what you saw, what you helped scientists learn, and how you feel being left behind. You can type, draw, or record your voice.`)}
    </p>

    <div class="mode-tabs" role="tablist" aria-label="How do you want to make your postcard?">
      ${[
        { id: 'type', em: '⌨️', label: 'Type it' },
        { id: 'draw', em: '🎨', label: 'Draw it' },
        { id: 'voice', em: '🎤', label: 'Say it' },
      ]
        .map((m) => h('button', {
          class: 'mode-tab',
          type: 'button',
          role: 'tab',
          'data-mode': m.id,
          'aria-selected': String(d.inputMode === m.id),
        }, `<span class="mt-em" aria-hidden="true">${m.em}</span><span>${m.label}</span>`))
        .join('')}
    </div>

    <div class="panel">
      <h3>🤔 Things to tell Earth</h3>
      <div class="chip-wrap">
        ${prompts
          .map((p) => h('button', {
            class: 'chip chip-starter',
            type: 'button',
            'data-prompt': p.id,
          }, esc(p.question)))
          .join('')}
      </div>
      <p class="hint">Tap a question to add a sentence starter you can finish.</p>
    </div>

    <div id="mode-panel"></div>

    ${factMeter(hw)}

    <div class="panel">
      <h3>⭐ Real facts you can use</h3>
      <p class="hint" style="margin-top:-4px">
        Tap a fact to add it to your postcard. These are all true facts about ${esc(hw.name)}.
      </p>
      <div class="chip-wrap">
        ${hw.facts
          .map((f, i) => h('button', {
            class: `chip ${state.draft.usedFacts.includes(i) ? 'used' : ''}`,
            type: 'button',
            'data-fact': String(i),
          }, esc(f.length > 78 ? f.slice(0, 75) + '…' : f)))
          .join('')}
      </div>
    </div>

    <div id="create-error" aria-live="assertive"></div>

    <div class="btn-row between" style="margin-top:20px">
      <button class="btn btn-ghost" id="change-task"><span aria-hidden="true">←</span> Pick a different mission</button>
      <button class="btn btn-primary btn-lg" id="create-next">
        See my postcard <span aria-hidden="true">→</span>
      </button>
    </div>
  `
}

function modePanelHtml() {
  const d = state.draft
  if (d.inputMode === 'draw') {
    return `
      <div class="panel">
        <h3>🎨 Draw your message</h3>
        <p class="hint" style="margin-top:-4px">
          Draw what your robot sees! Use your finger, a stylus or the mouse.
        </p>
        <div class="draw-wrap">
          <canvas id="draw-canvas" width="800" height="600"
                  aria-label="Drawing area for your postcard picture"></canvas>
          <div class="draw-tools" role="group" aria-label="Drawing tools">
            ${['#1b2238', '#e05c3f', '#ffd166', '#4fc97a', '#3f9ce0', '#9a62d8', '#ff7eb6', '#8a6b4f', '#ffffff']
              .map((c, i) => h('button', {
                class: 'pen',
                type: 'button',
                style: `background:${c}${c === '#ffffff' ? ';border-color:#999' : ''}`,
                'data-pen': c,
                'aria-pressed': String(i === 0),
                'aria-label': c === '#ffffff' ? 'Eraser (white)' : `Colour ${c}`,
              }, ''))
              .join('')}
            <span style="width:10px"></span>
            ${[4, 10, 22]
              .map((s, i) => h('button', {
                class: 'size-btn',
                type: 'button',
                'data-size': String(s),
                'aria-pressed': String(i === 1),
                'aria-label': `Brush size ${s}`,
              }, `<span class="dot" style="width:${Math.min(s, 18)}px;height:${Math.min(s, 18)}px"></span>`))
              .join('')}
            <span class="spacer"></span>
            <button class="btn btn-secondary" id="draw-undo" type="button">
              <span aria-hidden="true">↩️</span> Undo
            </button>
            <button class="btn btn-secondary" id="draw-clear" type="button">
              <span aria-hidden="true">🗑️</span> Clear
            </button>
          </div>
        </div>
        <label class="field" style="margin-top:16px">
          <span class="lbl">Add a few words too? <span class="muted">(you don't have to)</span></span>
          <textarea id="postcard-text" maxlength="1200" style="min-height:90px"
                    placeholder="A short note from your robot...">${esc(state.draft.postcardText)}</textarea>
        </label>
      </div>`
  }

  if (d.inputMode === 'voice') {
    return `
      <div class="panel">
        <h3>🎤 Record your voice</h3>
        <p class="hint" style="margin-top:-4px">
          Press the big button and speak as your robot. You get 20 seconds.
        </p>
        <div class="rec-wrap">
          <button class="rec-btn" id="rec-btn" type="button" aria-label="Start recording">
            <span class="rb-em" aria-hidden="true">🎙️</span>
            <span id="rec-label">Record</span>
          </button>
          <div class="rec-timer" id="rec-timer" aria-live="off">0:00 / 0:20</div>
          <div class="rec-bar"><i id="rec-bar-fill"></i></div>
          <div id="rec-playback" style="margin-top:14px">
            ${d.audioData ? `<audio controls src="${d.audioData}"></audio>
              <div class="ok-msg">✅ Your voice clip is saved! You can record again to replace it.</div>` : ''}
          </div>
        </div>
        <label class="field" style="margin-top:16px">
          <span class="lbl">Add a few words too? <span class="muted">(you don't have to)</span></span>
          <textarea id="postcard-text" maxlength="1200" style="min-height:90px"
                    placeholder="A short note from your robot...">${esc(state.draft.postcardText)}</textarea>
        </label>
      </div>`
  }

  // default: type
  return `
    <div class="panel">
      <h3>⌨️ Write your postcard</h3>
      <label class="field">
        <span class="sr-only">Your postcard message</span>
        <textarea id="postcard-text" maxlength="1200"
          placeholder="Hello from Mars! I am sitting in a big crater and...">${esc(state.draft.postcardText)}</textarea>
        <span class="hint"><span id="char-count">${state.draft.postcardText.length}</span> / 1200 letters</span>
      </label>
    </div>`
}

/* ================================================================== *
 * Mission B - rescue or retire
 * ================================================================== */

function decisionTask(hw) {
  const d = state.draft
  const decisions = window.__robo.data.prompts.decisions || []
  const riskStarters = window.__robo.data.prompts.risk_starters || []
  const chosen = decisions.find((x) => x.id === d.decision)

  return `
    <h1>⚖️ Mission B: Rescue or Retire</h1>
    <p class="lead">
      You are the mission boss! What should happen to <b>${esc(state.petName)}</b>?
      ${speakBtn(`You are the mission boss. What should happen to ${state.petName}? Choose one: bring it home to a museum, leave it where it is as a historic site, or give it a new job. Then give two or three reasons, and name one risk you thought about.`)}
    </p>

    <div class="panel">
      <h3>1️⃣ Your decision</h3>
      <div class="decision-grid" role="group" aria-label="Choose what happens to your robot">
        ${decisions
          .map((dec) => h('button', {
            class: 'decision-card',
            type: 'button',
            'data-decision': dec.id,
            'aria-pressed': String(dec.id === d.decision),
          },
            `<span class="dc-emoji" aria-hidden="true">${dec.emoji}</span>` +
            `<span class="dc-label">${esc(dec.label)}</span>`
          ))
          .join('')}
      </div>
    </div>

    <div class="panel">
      <h3>2️⃣ Your reasons <span class="muted" style="font-size:.85rem">(at least 2)</span></h3>
      ${chosen ? `
        <p class="hint" style="margin-top:-4px">Stuck? Tap an example to use it, then change the words to make it yours.</p>
        <div class="chip-wrap">
          ${chosen.example_reasons
            .map((r, i) => h('button', { class: 'chip', type: 'button', 'data-example': String(i) },
              esc(r.length > 70 ? r.slice(0, 67) + '…' : r)))
            .join('')}
        </div>
      ` : '<p class="hint">Pick a decision above to see example reasons.</p>'}

      ${[0, 1, 2]
        .map((i) => `
          <label class="field">
            <span class="lbl">Reason ${i + 1}${i === 2 ? ' <span class="muted">(optional)</span>' : ''}</span>
            <input type="text" class="reason-input" data-reason="${i}" maxlength="300"
                   placeholder="${i === 0 ? 'Because...' : i === 1 ? 'Also, because...' : 'And one more reason...'}"
                   value="${esc(d.reasons[i] || '')}">
          </label>`)
        .join('')}
    </div>

    <div class="panel">
      <h3>3️⃣ One risk or challenge you thought about</h3>
      <div class="chip-wrap">
        ${riskStarters
          .map((s, i) => h('button', { class: 'chip chip-starter', type: 'button', 'data-risk-starter': String(i) }, esc(s)))
          .join('')}
      </div>
      <label class="field" style="margin-top:8px">
        <span class="sr-only">Describe one risk or challenge</span>
        <textarea id="risk-text" maxlength="400" style="min-height:90px"
          placeholder="One problem could be...">${esc(d.risk)}</textarea>
      </label>
    </div>

    <div id="create-error" aria-live="assertive"></div>

    <div class="btn-row between" style="margin-top:20px">
      <button class="btn btn-ghost" id="change-task"><span aria-hidden="true">←</span> Pick a different mission</button>
      <button class="btn btn-primary btn-lg" id="create-next">
        See my report <span aria-hidden="true">→</span>
      </button>
    </div>
  `
}

/* ================================================================== *
 * Render
 * ================================================================== */

export function renderCreate() {
  const hw = window.__robo.data.byId[state.hardwareId]
  if (!hw) {
    return `<div class="card center"><h2>Build your pet first</h2>
      <button class="btn btn-primary" data-goto="build">Go to Build</button></div>`
  }
  if (!state.taskType) return taskChooser()
  return state.taskType === 'postcard' ? postcardTask(hw) : decisionTask(hw)
}

/* ================================================================== *
 * Wiring
 * ================================================================== */

let drawing = null // canvas controller, see setupCanvas()
let recorder = null // voice controller, see setupRecorder()

renderCreate.afterRender = function () {
  const hw = window.__robo.data.byId[state.hardwareId]

  // --- task chooser ---
  els('[data-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.taskType = btn.getAttribute('data-task')
      saveState()
      window.__robo.render()
    })
  })

  const changeTask = el('#change-task')
  if (changeTask) {
    changeTask.addEventListener('click', () => {
      state.taskType = ''
      saveState()
      window.__robo.render()
    })
  }

  if (!state.taskType) return

  if (state.taskType === 'postcard') wirePostcard(hw)
  else wireDecision(hw)
}

/* ---------------- Mission A wiring ---------------- */

function wirePostcard(hw) {
  // mount the chosen input mode
  const panel = el('#mode-panel')
  if (panel) panel.innerHTML = modePanelHtml()

  els('[data-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode')
      if (mode === state.draft.inputMode) return
      // Save whatever is typed before switching panels.
      syncTextarea()
      state.draft.inputMode = mode
      saveState()
      window.__robo.render()
      announce(
        mode === 'draw' ? 'Drawing mode' : mode === 'voice' ? 'Voice recording mode' : 'Typing mode'
      )
    })
  })

  wireTextarea()
  if (state.draft.inputMode === 'draw') setupCanvas()
  if (state.draft.inputMode === 'voice') setupRecorder()

  // --- fact chips: insert a real fact into the text ---
  els('[data-fact]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const i = Number(chip.getAttribute('data-fact'))
      const fact = hw.facts[i]
      insertIntoText(fact)
      if (!state.draft.usedFacts.includes(i)) state.draft.usedFacts.push(i)
      chip.classList.add('used')
      saveState()
      updateFactMeter()
      toast('Real fact added! ⭐', 'success')
    })
  })

  // --- prompt chips: insert a sentence starter ---
  els('[data-prompt]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.getAttribute('data-prompt')
      const p = (window.__robo.data.prompts.postcard || []).find((x) => x.id === id)
      if (!p) return
      const starter = p.starters[(Math.random() * p.starters.length) | 0]
      insertIntoText(starter)
    })
  })

  // --- next ---
  const next = el('#create-next')
  next?.addEventListener('click', async () => {
    syncTextarea()
    const errBox = el('#create-error')
    errBox.innerHTML = ''
    const d = state.draft
    const hasMedia = !!d.drawingData || !!d.audioData
    const text = (d.postcardText || '').trim()

    if (!text && !hasMedia) {
      errBox.innerHTML =
        '<div class="error-msg">Please write, draw or record your message first!</div>'
      return
    }
    if (!hasMedia && text.length < 15) {
      errBox.innerHTML =
        '<div class="error-msg">Please write a little more so Earth can understand you!</div>'
      return
    }
    if (d.usedFacts.length === 0) {
      errBox.innerHTML =
        '<div class="error-msg">⭐ Almost! Tap one of the real facts below to add it to your postcard.</div>'
      el('#fact-meter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // Server-side safety check before we show the finished postcard.
    if (text) {
      next.disabled = true
      next.innerHTML = '<span aria-hidden="true">⏳</span> Checking…'
      try {
        const res = await api.checkText(text, 1200)
        if (!res.ok || res.ok === false) throw new Error(res.message || 'Please try different words.')
        if (res.message) {
          errBox.innerHTML = `<div class="error-msg">${esc(res.message)}</div>`
          next.disabled = false
          next.innerHTML = 'See my postcard <span aria-hidden="true">→</span>'
          return
        }
      } catch (e) {
        errBox.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
        next.disabled = false
        next.innerHTML = 'See my postcard <span aria-hidden="true">→</span>'
        return
      }
    }

    stopRecorderIfRunning()
    saveState()
    window.__robo.go('share')
  })
}

function wireTextarea() {
  const ta = el('#postcard-text')
  if (!ta) return
  ta.addEventListener('input', () => {
    state.draft.postcardText = ta.value
    const count = el('#char-count')
    if (count) count.textContent = String(ta.value.length)
    saveState()
  })
}

function syncTextarea() {
  const ta = el('#postcard-text')
  if (ta) state.draft.postcardText = ta.value
}

/** Append text to the postcard, switching to typing mode if needed. */
function insertIntoText(snippet) {
  // In draw/voice mode there is still a small optional textarea.
  let ta = el('#postcard-text')
  if (!ta) {
    state.draft.inputMode = 'type'
    saveState()
    window.__robo.render()
    ta = el('#postcard-text')
    if (!ta) return
  }
  const current = ta.value.trimEnd()
  const needsSpace = current.length > 0
  const sep = needsSpace ? (/[.!?]$/.test(current) ? ' ' : '. ') : ''
  ta.value = current + sep + snippet + ' '
  state.draft.postcardText = ta.value
  const count = el('#char-count')
  if (count) count.textContent = String(ta.value.length)
  saveState()
  ta.focus()
  ta.setSelectionRange(ta.value.length, ta.value.length)
  ta.scrollTop = ta.scrollHeight
}

function updateFactMeter() {
  const hw = window.__robo.data.byId[state.hardwareId]
  const box = el('#fact-meter')
  if (!box) return
  const used = state.draft.usedFacts.length
  const done = used >= 1
  box.classList.toggle('done', done)
  box.innerHTML = `
    <span class="fm-icon" aria-hidden="true">${done ? '✅' : '🔎'}</span>
    <span>${done
      ? `Great! You used <b>${used}</b> real fact${used === 1 ? '' : 's'} from the mission file.`
      : 'Add at least <b>1 real fact</b> from the mission file. Tap a fact below to drop it in!'}</span>`
}

/* ---------------- drawing canvas ---------------- */

function setupCanvas() {
  const canvas = el('#draw-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // White background so the saved PNG is never transparent.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Restore a drawing the kid made earlier.
  if (state.draft.drawingData) {
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    img.src = state.draft.drawingData
  }

  let pen = '#1b2238'
  let size = 10
  let isDown = false
  let last = null
  const undoStack = []

  const snapshot = () => {
    try {
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      if (undoStack.length > 12) undoStack.shift()
    } catch (e) { /* ignore */ }
  }

  /** Map a pointer event to canvas pixel coordinates (handles CSS scaling). */
  const pos = (ev) => {
    const r = canvas.getBoundingClientRect()
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX
    const cy = ev.touches ? ev.touches[0].clientY : ev.clientY
    return {
      x: ((cx - r.left) / r.width) * canvas.width,
      y: ((cy - r.top) / r.height) * canvas.height,
    }
  }

  const start = (ev) => {
    ev.preventDefault()
    snapshot()
    isDown = true
    last = pos(ev)
    // A single tap should leave a dot.
    ctx.beginPath()
    ctx.fillStyle = pen
    ctx.arc(last.x, last.y, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const move = (ev) => {
    if (!isDown) return
    ev.preventDefault()
    const p = pos(ev)
    ctx.strokeStyle = pen
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last = p
  }

  const end = () => {
    if (!isDown) return
    isDown = false
    save()
  }

  const save = () => {
    try {
      // JPEG-free PNG keeps lines crisp; 0.8 scale keeps the payload small.
      state.draft.drawingData = canvas.toDataURL('image/png')
      saveState()
    } catch (e) { /* ignore */ }
  }

  canvas.addEventListener('pointerdown', start)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointerleave', end)
  canvas.addEventListener('pointercancel', end)
  // Touch fallback for older Chromebooks without pointer events.
  canvas.addEventListener('touchstart', start, { passive: false })
  canvas.addEventListener('touchmove', move, { passive: false })
  canvas.addEventListener('touchend', end)

  els('[data-pen]').forEach((b) => {
    b.addEventListener('click', () => {
      pen = b.getAttribute('data-pen')
      els('[data-pen]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    })
  })
  els('[data-size]').forEach((b) => {
    b.addEventListener('click', () => {
      size = Number(b.getAttribute('data-size'))
      els('[data-size]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    })
  })

  el('#draw-undo')?.addEventListener('click', () => {
    const prev = undoStack.pop()
    if (prev) {
      ctx.putImageData(prev, 0, 0)
      save()
      announce('Undid the last stroke')
    } else {
      toast('Nothing left to undo')
    }
  })

  el('#draw-clear')?.addEventListener('click', () => {
    snapshot()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    state.draft.drawingData = null
    saveState()
    announce('Drawing cleared')
  })

  drawing = { canvas, ctx }
}

/* ---------------- voice recorder ---------------- */

const MAX_SECONDS = 20

function setupRecorder() {
  const btn = el('#rec-btn')
  if (!btn) return

  let media = null
  let chunks = []
  let timer = null
  let startedAt = 0
  let isRecording = false

  const timerBox = el('#rec-timer')
  const fill = el('#rec-bar-fill')
  const label = el('#rec-label')
  const playback = el('#rec-playback')

  const paint = (secs) => {
    const s = Math.min(secs, MAX_SECONDS)
    if (timerBox) {
      timerBox.textContent = `0:${String(Math.floor(s)).padStart(2, '0')} / 0:${MAX_SECONDS}`
    }
    if (fill) fill.style.width = `${(s / MAX_SECONDS) * 100}%`
  }

  const stop = () => {
    if (!isRecording) return
    isRecording = false
    clearInterval(timer)
    try {
      media?.stop()
    } catch (e) { /* ignore */ }
    btn.classList.remove('recording')
    btn.setAttribute('aria-label', 'Start recording')
    if (label) label.textContent = 'Record'
  }

  const begin = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('This device cannot record audio. You can type or draw instead!', 'error')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      toast('We need permission to use the microphone. You can type or draw instead!', 'error')
      return
    }

    chunks = []
    // Pick a container the browser actually supports (Safari prefers mp4).
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t)) || ''
    try {
      media = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined)
    } catch (e) {
      media = new MediaRecorder(stream)
    }

    media.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data)
    }
    media.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: media.mimeType || 'audio/webm' })
      const reader = new FileReader()
      reader.onload = () => {
        state.draft.audioData = String(reader.result)
        saveState()
        if (playback) {
          playback.innerHTML =
            `<audio controls src="${state.draft.audioData}"></audio>` +
            '<div class="ok-msg">✅ Your voice clip is saved! You can record again to replace it.</div>'
        }
        toast('Voice clip saved! 🎤', 'success')
      }
      reader.readAsDataURL(blob)
    }

    media.start()
    isRecording = true
    startedAt = Date.now()
    btn.classList.add('recording')
    btn.setAttribute('aria-label', 'Stop recording')
    if (label) label.textContent = 'Stop'
    announce('Recording started. You have 20 seconds.')

    timer = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000
      paint(secs)
      if (secs >= MAX_SECONDS) {
        stop()
        announce('Recording finished.')
      }
    }, 100)
  }

  btn.addEventListener('click', () => (isRecording ? stop() : begin()))
  recorder = { stop: () => stop() }
  paint(0)
}

function stopRecorderIfRunning() {
  try {
    recorder?.stop()
  } catch (e) { /* ignore */ }
}

/* ---------------- Mission B wiring ---------------- */

function wireDecision(hw) {
  els('[data-decision]').forEach((card) => {
    card.addEventListener('click', () => {
      state.draft.decision = card.getAttribute('data-decision')
      saveState()
      // Re-render so the example reasons update to match the new decision.
      syncDecisionInputs()
      window.__robo.render()
    })
  })

  els('.reason-input').forEach((input) => {
    input.addEventListener('input', () => {
      const i = Number(input.getAttribute('data-reason'))
      state.draft.reasons[i] = input.value
      saveState()
    })
  })

  const riskBox = el('#risk-text')
  riskBox?.addEventListener('input', () => {
    state.draft.risk = riskBox.value
    saveState()
  })

  // example reason chips -> fill the first empty reason field
  els('[data-example]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const decisions = window.__robo.data.prompts.decisions || []
      const chosen = decisions.find((x) => x.id === state.draft.decision)
      if (!chosen) return
      const text = chosen.example_reasons[Number(chip.getAttribute('data-example'))]
      const inputs = els('.reason-input')
      const target = inputs.find((i) => !i.value.trim()) || inputs[0]
      if (target) {
        target.value = text
        state.draft.reasons[Number(target.getAttribute('data-reason'))] = text
        saveState()
        target.focus()
        chip.classList.add('used')
        toast('Added! Now change the words to make it your own ✏️')
      }
    })
  })

  // risk sentence starters
  els('[data-risk-starter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const starters = window.__robo.data.prompts.risk_starters || []
      const text = starters[Number(chip.getAttribute('data-risk-starter'))]
      const box = el('#risk-text')
      if (!box) return
      box.value = box.value.trim() ? box.value.trim() + ' ' + text + ' ' : text + ' '
      state.draft.risk = box.value
      saveState()
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
    })
  })

  const next = el('#create-next')
  next?.addEventListener('click', async () => {
    syncDecisionInputs()
    const errBox = el('#create-error')
    errBox.innerHTML = ''
    const d = state.draft

    if (!d.decision) {
      errBox.innerHTML = '<div class="error-msg">Please choose what happens to your robot first!</div>'
      return
    }
    const filled = d.reasons.filter((r) => (r || '').trim().length > 2)
    if (filled.length < 2) {
      errBox.innerHTML = '<div class="error-msg">Please give at least 2 reasons for your choice.</div>'
      return
    }
    if (!(d.risk || '').trim() || d.risk.trim().length < 5) {
      errBox.innerHTML =
        '<div class="error-msg">Please name one risk or challenge you thought about.</div>'
      el('#risk-text')?.focus()
      return
    }

    next.disabled = true
    next.innerHTML = '<span aria-hidden="true">⏳</span> Checking…'
    try {
      for (const text of [...filled, d.risk]) {
        const res = await api.checkText(text, 400)
        if (res.message) {
          errBox.innerHTML = `<div class="error-msg">${esc(res.message)}</div>`
          next.disabled = false
          next.innerHTML = 'See my report <span aria-hidden="true">→</span>'
          return
        }
      }
    } catch (e) {
      errBox.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
      next.disabled = false
      next.innerHTML = 'See my report <span aria-hidden="true">→</span>'
      return
    }

    saveState()
    window.__robo.go('share')
  })
}

function syncDecisionInputs() {
  els('.reason-input').forEach((input) => {
    state.draft.reasons[Number(input.getAttribute('data-reason'))] = input.value
  })
  const riskBox = el('#risk-text')
  if (riskBox) state.draft.risk = riskBox.value
  saveState()
}
