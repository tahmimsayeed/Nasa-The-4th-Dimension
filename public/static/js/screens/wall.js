/**
 * Class Museum Wall + single-exhibit page.
 *
 * Each pet is an exhibit with a museum plaque. Tapping one opens the full
 * postcard or mission report, plays the audio if there is one, and offers a QR
 * code. Kids can react with three preset stickers - there is deliberately NO
 * free-text comment anywhere in the app.
 */

import { state, saveState } from '../state.js'
import { api } from '../api.js'
import { h, esc, el, els, toast, modal, closeModal, qrImage, timeAgo, speakBtn } from '../ui.js'
import { postcardHtml, reportHtml } from './share.js'

const STICKERS = [
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
]

// Remember which stickers this device already gave, so the UI reflects it.
function reactedKey(id, sticker) {
  return `robopet.react.${id}.${sticker}`
}
function hasReacted(id, sticker) {
  try {
    return localStorage.getItem(reactedKey(id, sticker)) === '1'
  } catch (e) {
    return false
  }
}
function markReacted(id, sticker) {
  try {
    localStorage.setItem(reactedKey(id, sticker), '1')
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ *
 * Wall
 * ------------------------------------------------------------------ */

let wallFilters = { hardware: '', task: '', sort: 'newest' }

export function exhibitCardHtml(ex, opts = {}) {
  const hw = window.__robo.data.byId[ex.hardwareId] || { name: ex.hardwareId, emoji: '🛰️' }
  const taskTag = ex.taskType === 'postcard' ? '💌 Postcard' : '⚖️ Mission Plan'
  const reactionTotal = ex.reactions.star + ex.reactions.rocket + ex.reactions.heart

  return h('button', {
    class: 'exhibit',
    type: 'button',
    'data-exhibit': ex.id,
    'aria-label': `Exhibit: ${ex.petName} by ${ex.nickname}, based on ${hw.name}. Tap to see it.`,
  },
    (ex.status !== 'live' ? `<span class="status-flag ${esc(ex.status)}">${ex.status === 'pending' ? 'WAITING' : 'HIDDEN'}</span>` : '') +
    `<div class="ex-art">
       ${window.RoboPet.svg(ex.petConfig, { size: 150, animate: false, showGround: true, gradId: 'ex' + ex.id })}
     </div>` +
    `<div class="plaque">
       <div class="pl-name">${esc(ex.petName)}</div>
       <div class="pl-by">by ${esc(ex.nickname)}</div>
       <div class="pl-base">${hw.emoji} ${esc(hw.name)}</div>
     </div>` +
    `<div class="ex-tags">
       <span class="ex-tag">${taskTag}</span>
       ${ex.hasAudio ? '<span class="ex-tag">🎤 Audio</span>' : ''}
       ${ex.hasDrawing ? '<span class="ex-tag">🎨 Drawing</span>' : ''}
     </div>` +
    (reactionTotal
      ? `<div class="ex-reactions">
           ${ex.reactions.star ? `<span>⭐ ${ex.reactions.star}</span>` : ''}
           ${ex.reactions.rocket ? `<span>🚀 ${ex.reactions.rocket}</span>` : ''}
           ${ex.reactions.heart ? `<span>❤️ ${ex.reactions.heart}</span>` : ''}
         </div>`
      : '')
  )
}

export function renderWall() {
  const data = window.__robo.data
  const code = state.classCode

  if (!code) {
    return `
      <div class="card center" style="max-width:480px;margin:0 auto">
        <h1>🖼️ Class Museum Wall</h1>
        <p class="lead">Type your class code to see your class's exhibits.</p>
        <label class="field">
          <span class="lbl">Class code</span>
          <input type="text" id="wall-code" placeholder="e.g. MOON-42" maxlength="20"
                 style="text-transform:uppercase">
        </label>
        <button class="btn btn-primary btn-block" id="wall-go">Open the wall</button>
        <p class="muted" style="margin-top:14px">Just looking? Try <b>MOON-42</b>.</p>
        <button class="btn btn-ghost" style="margin-top:10px" data-goto="welcome">← Back</button>
      </div>`
  }

  const hardwareOptions = data.hardware
    .map((hw) => `<option value="${esc(hw.id)}" ${wallFilters.hardware === hw.id ? 'selected' : ''}>${esc(hw.name)}</option>`)
    .join('')

  return `
    <div class="wall-head">
      <div style="flex:1;min-width:220px">
        <h1 style="margin-bottom:2px">🖼️ Class Museum Wall</h1>
        <p class="muted" style="margin:0">Class <b>${esc(code)}</b></p>
      </div>
      ${state.nickname ? `<button class="btn btn-primary" data-goto="build">
        <span aria-hidden="true">🔧</span> Build a pet
      </button>` : `<button class="btn btn-primary" data-goto="welcome">
        <span aria-hidden="true">🚀</span> Join in
      </button>`}
    </div>

    <div class="filters" role="group" aria-label="Filter the exhibits">
      <label class="sr-only" for="f-hardware">Filter by hardware</label>
      <select id="f-hardware">
        <option value="">🛰️ All hardware</option>
        ${hardwareOptions}
      </select>

      <label class="sr-only" for="f-task">Filter by task</label>
      <select id="f-task">
        <option value="" ${wallFilters.task === '' ? 'selected' : ''}>📋 All tasks</option>
        <option value="postcard" ${wallFilters.task === 'postcard' ? 'selected' : ''}>💌 Postcards</option>
        <option value="decision" ${wallFilters.task === 'decision' ? 'selected' : ''}>⚖️ Mission Plans</option>
      </select>

      <label class="sr-only" for="f-sort">Sort</label>
      <select id="f-sort">
        <option value="newest" ${wallFilters.sort === 'newest' ? 'selected' : ''}>🆕 Newest first</option>
        <option value="popular" ${wallFilters.sort === 'popular' ? 'selected' : ''}>⭐ Most loved</option>
      </select>
    </div>

    <div id="wall-grid">
      <div class="loading"><div class="spinner"></div><p>Opening the museum…</p></div>
    </div>

    <div class="center" style="margin-top:24px">
      <button class="btn btn-ghost" data-action="teacher">
        <span aria-hidden="true">🧑‍🏫</span> Teacher view
      </button>
    </div>
  `
}

renderWall.afterRender = function () {
  // class-code entry version
  const goBtn = el('#wall-go')
  if (goBtn) {
    const input = el('#wall-code')
    const open = () => {
      const code = (input.value || '').trim().toUpperCase()
      if (!code) {
        toast('Please type a class code.', 'error')
        return
      }
      state.classCode = code
      saveState()
      window.__robo.render()
    }
    goBtn.addEventListener('click', open)
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') open()
    })
    return
  }

  // filters
  const bind = (id, key) => {
    el(id)?.addEventListener('change', (ev) => {
      wallFilters[key] = ev.target.value
      loadWall()
    })
  }
  bind('#f-hardware', 'hardware')
  bind('#f-task', 'task')
  bind('#f-sort', 'sort')

  loadWall()
}

async function loadWall() {
  const grid = el('#wall-grid')
  if (!grid) return
  grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Opening the museum…</p></div>'

  try {
    const res = await api.listExhibits({
      classCode: state.classCode,
      hardware: wallFilters.hardware,
      task: wallFilters.task,
      sort: wallFilters.sort,
    })

    if (!res.exhibits.length) {
      const filtered = wallFilters.hardware || wallFilters.task
      grid.innerHTML = `
        <div class="empty-state">
          <span class="es-em" aria-hidden="true">${filtered ? '🔍' : '🏛️'}</span>
          <p class="lead">${filtered
            ? 'No exhibits match those filters yet.'
            : 'This wall is empty… for now!'}</p>
          <p>${filtered
            ? 'Try choosing "All hardware" or "All tasks".'
            : 'Be the first to build a robo pet and add it to the wall.'}</p>
          ${!filtered ? '<button class="btn btn-primary" data-goto="build">🔧 Build the first pet</button>' : ''}
        </div>`
      return
    }

    grid.innerHTML =
      `<p class="muted" style="margin-bottom:12px">${res.exhibits.length} exhibit${res.exhibits.length === 1 ? '' : 's'} on display</p>` +
      '<div class="exhibit-grid">' +
      res.exhibits.map((ex) => exhibitCardHtml(ex)).join('') +
      '</div>'

    els('[data-exhibit]', grid).forEach((card) => {
      card.addEventListener('click', () => openExhibit(card.getAttribute('data-exhibit')))
    })
  } catch (e) {
    grid.innerHTML = `<div class="error-msg">${esc(e.message)}</div>
      <button class="btn btn-secondary" onclick="location.reload()">Try again</button>`
  }
}

/* ------------------------------------------------------------------ *
 * Exhibit detail (modal on the wall, full page via QR link)
 * ------------------------------------------------------------------ */

function exhibitDetailHtml(ex, { forPage = false } = {}) {
  const hw = window.__robo.data.byId[ex.hardwareId] || {
    name: ex.hardwareId, emoji: '🛰️', location_detail: 'space', place: 'Space',
  }

  const piece =
    ex.taskType === 'postcard'
      ? postcardHtml({
          hw,
          petName: ex.petName,
          nickname: ex.nickname,
          petConfig: ex.petConfig,
          text: ex.postcardText,
          drawingData: ex.drawingData,
          gradId: 'd' + ex.id,
        })
      : reportHtml({
          hw,
          petName: ex.petName,
          nickname: ex.nickname,
          petConfig: ex.petConfig,
          decision: ex.decision,
          reasons: ex.reasons,
          risk: ex.risk,
          gradId: 'd' + ex.id,
        })

  const narration =
    ex.taskType === 'postcard'
      ? `Postcard from ${ex.petName}, built by ${ex.nickname}. ${ex.postcardText || ''}`
      : `Mission plan for ${ex.petName} by ${ex.nickname}. ` +
        `${(window.__robo.data.prompts.decisions || []).find((d) => d.id === ex.decision)?.label || ''}. ` +
        `Reasons: ${(ex.reasons || []).join('. ')}. A risk: ${ex.risk || ''}`

  const url = `${location.origin}/exhibit/${ex.id}`

  return `
    <div class="plaque" style="margin-bottom:14px">
      <div class="pl-name">${esc(ex.petName)}</div>
      <div class="pl-by">created by ${esc(ex.nickname)}</div>
      <div class="pl-base">${hw.emoji} based on ${esc(hw.name)} · ${esc(hw.place)}</div>
    </div>

    <div class="row" style="margin-bottom:12px">
      <span class="muted">${esc(timeAgo(ex.createdAt))}</span>
      <span class="spacer"></span>
      ${speakBtn(narration, 'Read this exhibit out loud')}
    </div>

    ${piece}

    ${ex.audioData ? `
      <div class="panel" style="margin-top:14px">
        <h3>🎤 Listen to ${esc(ex.petName)}</h3>
        <audio controls src="${ex.audioData}"></audio>
      </div>` : ''}

    <div class="panel" style="margin-top:14px">
      <h3>Leave a sticker</h3>
      <p class="hint" style="margin-top:-4px">Pick a sticker to show you liked it.</p>
      <div class="sticker-row" id="sticker-row-${esc(ex.id)}">
        ${STICKERS.map((s) => h('button', {
          class: `sticker-btn ${hasReacted(ex.id, s.id) ? 'reacted' : ''}`,
          type: 'button',
          'data-react': s.id,
          'data-exhibit-id': ex.id,
          'aria-label': `Give a ${s.label} sticker`,
        }, `<span class="sb-em" aria-hidden="true">${s.emoji}</span><span data-count="${s.id}">${ex.reactions[s.id]}</span>`)).join('')}
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <h3>🔗 This exhibit's QR code</h3>
      <div class="qr-wrap">
        <div class="qr-box">${qrImage(url, 120)}</div>
        <p style="flex:1;min-width:190px" class="muted">
          Scan to open this exhibit on a phone or tablet. Print it next to a display!
        </p>
      </div>
    </div>

    ${forPage ? `
      <div class="btn-row" style="margin-top:20px">
        <button class="btn btn-primary" data-action="wall">
          <span aria-hidden="true">🖼️</span> See the whole wall
        </button>
        <button class="btn btn-secondary" data-goto="welcome">
          <span aria-hidden="true">🔧</span> Build my own pet
        </button>
      </div>` : ''}
  `
}

/** Wire the sticker buttons inside a detail view. */
function wireStickers(root) {
  els('[data-react]', root).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sticker = btn.getAttribute('data-react')
      const id = btn.getAttribute('data-exhibit-id')
      if (hasReacted(id, sticker)) {
        toast('You already gave that sticker 😊')
        return
      }
      btn.disabled = true
      try {
        const res = await api.react(id, sticker)
        markReacted(id, sticker)
        btn.classList.add('reacted', 'pop')
        setTimeout(() => btn.classList.remove('pop'), 500)
        // Update all three counts from the server's fresh numbers.
        for (const s of STICKERS) {
          const span = root.querySelector(`[data-count="${s.id}"]`)
          if (span) span.textContent = res.reactions[s.id]
        }
        toast('Sticker added! 🎉', 'success')
      } catch (e) {
        toast(e.message, 'error')
      }
      btn.disabled = false
    })
  })
}

async function openExhibit(id) {
  const backdrop = modal({
    title: '🖼️ Exhibit',
    body: '<div class="loading"><div class="spinner"></div><p>Opening the display case…</p></div>',
    wide: true,
  })
  try {
    const res = await api.getExhibit(id)
    const body = backdrop.querySelector('.modal-body')
    body.innerHTML = exhibitDetailHtml(res.exhibit)
    backdrop.querySelector('.modal-head h2').textContent = `🖼️ ${res.exhibit.petName}`
    wireStickers(body)
    const { attachGlossary } = await import('../a11y.js')
    attachGlossary(body, window.__robo.data.glossary)
  } catch (e) {
    backdrop.querySelector('.modal-body').innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
  }
}

/* ------------------------------------------------------------------ *
 * Full page for one exhibit (what a QR code opens)
 * ------------------------------------------------------------------ */

export function renderExhibitPage() {
  return `
    <div id="exhibit-page">
      <div class="loading"><div class="spinner"></div><p>Loading the exhibit…</p></div>
    </div>`
}

renderExhibitPage.afterRender = function () {
  const box = el('#exhibit-page')
  const id = state.params?.id
  if (!box || !id) return

  api
    .getExhibit(id)
    .then((res) => {
      const ex = res.exhibit
      box.innerHTML = `<h1>🖼️ ${esc(ex.petName)}</h1>` + exhibitDetailHtml(ex, { forPage: true })
      wireStickers(box)
      import('../a11y.js').then(({ attachGlossary }) =>
        attachGlossary(box, window.__robo.data.glossary)
      )
      document.title = `${ex.petName} - Robo Pet Station`
    })
    .catch((e) => {
      box.innerHTML = `
        <div class="empty-state">
          <span class="es-em" aria-hidden="true">🔍</span>
          <p class="lead">${esc(e.message)}</p>
          <button class="btn btn-primary" data-goto="welcome">Go to Robo Pet Station</button>
        </div>`
    })
}
