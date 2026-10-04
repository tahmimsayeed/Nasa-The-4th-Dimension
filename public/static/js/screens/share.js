/**
 * Screen 5 - Share.
 *
 * Shows the finished piece as a styled postcard or mission decision report,
 * lets the kid download/print it, then publishes it to the Class Museum Wall.
 */

import { state, saveState } from '../state.js'
import { api } from '../api.js'
import { esc, el, toast, speakBtn, download, safeFileName } from '../ui.js'

/* ---------------- postcard markup (also reused by the wall) ---------------- */

export function postcardHtml(opts) {
  const { hw, petName, nickname, petConfig, text, drawingData, size = 150, gradId = 'pc' } = opts
  return `
    <div class="postcard">
      <div class="pc-left">
        <div class="pc-pet">
          ${window.RoboPet.svg(petConfig, { size, animate: false, showGround: true, gradId })}
        </div>
        <div class="pc-petname">${esc(petName)}</div>
        <div class="pc-from">${esc(hw.name)}</div>
      </div>
      <div class="pc-right">
        <div class="pc-head">
          <div class="pc-title">Greetings from<br>${esc(hw.location_detail)}</div>
          <div class="stamp">
            <span class="st-em" aria-hidden="true">${hw.emoji}</span>
            ${esc(hw.place)}<br>SPACE MAIL
          </div>
        </div>
        <div class="pc-msg">${esc(text || '(see the picture!)')}</div>
        ${drawingData ? `<div class="pc-drawing"><img src="${drawingData}" alt="A drawing made by ${esc(nickname)}"></div>` : ''}
        <div class="pc-lines">
          To: Earth 🌍 &nbsp;·&nbsp; From: ${esc(petName)}, built by ${esc(nickname)}
        </div>
      </div>
    </div>`
}

/* ---------------- report markup (also reused by the wall) ---------------- */

export function reportHtml(opts) {
  const { hw, petName, nickname, petConfig, decision, reasons, risk, size = 120, gradId = 'rp' } = opts
  const decisions = window.__robo.data.prompts.decisions || []
  const dec =
    decisions.find((d) => d.id === decision) || { label: decision, emoji: '📋', stamp: 'DECIDED' }

  return `
    <div class="report">
      <div class="report-head">
        <div style="flex:0 0 auto">
          ${window.RoboPet.svg(petConfig, { size, animate: false, showGround: true, gradId })}
        </div>
        <div class="rh-text">
          <h2 style="margin:0 0 3px">Mission Decision Report</h2>
          <p style="margin:0;font-weight:700">${esc(petName)} · ${esc(hw.name)}</p>
          <p style="margin:0;font-size:.88rem;color:#5d6478">Mission boss: ${esc(nickname)}</p>
        </div>
        <div class="decision-stamp">
          <span class="ds-em" aria-hidden="true">${dec.emoji}</span>
          <span class="ds-word">${esc(dec.stamp)}</span>
        </div>
      </div>

      <h3>📋 The decision</h3>
      <p style="font-size:1.08rem;font-weight:800;margin-bottom:14px">${esc(dec.label)}</p>

      <h3>💭 Why?</h3>
      <ol>${(reasons || []).filter((r) => (r || '').trim()).map((r) => `<li>${esc(r)}</li>`).join('')}</ol>

      <h3>⚠️ A risk we thought about</h3>
      <div class="risk-box">${esc(risk)}</div>
    </div>`
}

/* ---------------- screen ---------------- */

export function renderShare() {
  const hw = window.__robo.data.byId[state.hardwareId]
  if (!hw || !state.taskType) {
    return `<div class="card center"><h2>Finish your mission first</h2>
      <button class="btn btn-primary" data-goto="create">Go to Create</button></div>`
  }

  const d = state.draft
  const isPostcard = state.taskType === 'postcard'

  const piece = isPostcard
    ? postcardHtml({
        hw,
        petName: state.petName,
        nickname: state.nickname,
        petConfig: state.pet,
        text: d.postcardText,
        drawingData: d.drawingData,
      })
    : reportHtml({
        hw,
        petName: state.petName,
        nickname: state.nickname,
        petConfig: state.pet,
        decision: d.decision,
        reasons: d.reasons,
        risk: d.risk,
      })

  const decLabel = (window.__robo.data.prompts.decisions || []).find((x) => x.id === d.decision)?.label
  const narration = isPostcard
    ? `Postcard from ${state.petName}. ${d.postcardText}`
    : `Mission decision report for ${state.petName}. The decision: ${decLabel}. ` +
      `Reasons: ${d.reasons.filter(Boolean).join('. ')}. A risk we thought about: ${d.risk}`

  return `
    <h1>🖼️ ${isPostcard ? 'Your Postcard' : 'Your Mission Report'}</h1>
    <p class="lead">
      Looking good! Check it over, then send it to the Class Museum Wall.
      ${speakBtn(narration, 'Read my work out loud')}
    </p>

    <div id="piece-box">${piece}</div>

    ${d.audioData ? `
      <div class="panel" style="margin-top:16px">
        <h3>🎤 Your voice message</h3>
        <audio controls src="${d.audioData}"></audio>
      </div>` : ''}

    <div class="btn-row" style="margin-top:18px">
      <button class="btn btn-secondary" id="download-btn">
        <span aria-hidden="true">⬇️</span> Download picture
      </button>
      <button class="btn btn-secondary" data-action="print">
        <span aria-hidden="true">🖨️</span> Print it
      </button>
      <button class="btn btn-ghost" data-goto="create">
        <span aria-hidden="true">✏️</span> Change something
      </button>
    </div>

    ${state.requireApproval ? `
      <div class="ok-msg" style="margin-top:18px">
        <span aria-hidden="true">🧑‍🏫</span> Your teacher checks work before it appears on the wall.
        Yours will show up once they say yes!
      </div>` : ''}

    <div id="share-error" aria-live="assertive"></div>

    <div class="btn-row between" style="margin-top:20px">
      <button class="btn btn-ghost" data-goto="create"><span aria-hidden="true">←</span> Back</button>
      <button class="btn btn-success btn-lg" id="publish-btn">
        <span aria-hidden="true">🚀</span> Send to the Museum Wall
      </button>
    </div>
  `
}

renderShare.afterRender = function () {
  el('#download-btn')?.addEventListener('click', async () => {
    const btn = el('#download-btn')
    btn.disabled = true
    btn.innerHTML = '<span aria-hidden="true">⏳</span> Making picture…'
    try {
      await downloadPiece()
    } catch (e) {
      toast('Could not make the picture. Try "Print it" instead.', 'error')
    }
    btn.disabled = false
    btn.innerHTML = '<span aria-hidden="true">⬇️</span> Download picture'
  })

  el('#publish-btn')?.addEventListener('click', async () => {
    const btn = el('#publish-btn')
    const errBox = el('#share-error')
    errBox.innerHTML = ''
    btn.disabled = true
    btn.innerHTML = '<span aria-hidden="true">🚀</span> Sending…'

    const d = state.draft
    const payload = {
      classCode: state.classCode,
      nickname: state.nickname,
      petName: state.petName,
      hardwareId: state.hardwareId,
      petConfig: state.pet,
      taskType: state.taskType,
    }
    if (state.taskType === 'postcard') {
      payload.postcardText = d.postcardText
      payload.drawingData = d.drawingData
      payload.audioData = d.audioData
    } else {
      payload.decision = d.decision
      payload.reasons = d.reasons.filter((r) => (r || '').trim())
      payload.risk = d.risk
    }

    try {
      const res = await api.createExhibit(payload)
      state.submittedId = res.id
      state.requireApproval = res.requireApproval
      saveState()
      window.__robo.go('reward')
    } catch (e) {
      errBox.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
      btn.disabled = false
      btn.innerHTML = '<span aria-hidden="true">🚀</span> Send to the Museum Wall'
    }
  })
}

/**
 * Render the postcard/report into a PNG the kid can download.
 * Drawn manually on a canvas (instead of an html2canvas-style library) to keep
 * the bundle tiny and avoid a CDN dependency on school networks.
 */
async function downloadPiece() {
  const hw = window.__robo.data.byId[state.hardwareId]
  const d = state.draft
  const isPostcard = state.taskType === 'postcard'

  const W = 1200
  const H = 800
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#fdfbf4')
  grad.addColorStop(1, '#eee7d4')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#d6cdb2'
  ctx.lineWidth = 12
  ctx.strokeRect(6, 6, W - 12, H - 12)

  const petPng = await window.RoboPet.toPng(state.pet, 420)
  if (petPng) {
    const img = await loadImage(petPng)
    ctx.drawImage(img, 56, isPostcard ? 140 : 60, 330, 330)
  }

  ctx.fillStyle = '#1f2433'
  ctx.textBaseline = 'top'

  if (isPostcard) {
    // stamp
    ctx.save()
    ctx.translate(W - 210, 50)
    ctx.fillStyle = '#1b2a56'
    roundRect(ctx, 0, 0, 150, 170, 10)
    ctx.fill()
    ctx.setLineDash([10, 7])
    ctx.strokeStyle = 'rgba(255,255,255,.65)'
    ctx.lineWidth = 5
    roundRect(ctx, 10, 10, 130, 150, 7)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 54px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(hw.emoji, 75, 32)
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.fillText(hw.place.toUpperCase(), 75, 104)
    ctx.fillText('SPACE MAIL', 75, 128)
    ctx.restore()

    ctx.textAlign = 'left'
    ctx.fillStyle = '#1f2433'
    ctx.font = 'bold 38px system-ui, sans-serif'
    wrapText(ctx, `Greetings from ${hw.location_detail}!`, 56, 52, 880, 44, 2)

    ctx.font = '27px system-ui, sans-serif'
    wrapText(ctx, d.postcardText || '(see the picture!)', 430, 145, 710, 37, 13)

    ctx.strokeStyle = '#cfc6ab'
    ctx.lineWidth = 3
    ctx.setLineDash([9, 7])
    ctx.beginPath()
    ctx.moveTo(56, H - 86)
    ctx.lineTo(W - 56, H - 86)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#5d6478'
    ctx.font = 'bold 23px system-ui, sans-serif'
    ctx.fillText(`To: Earth  ·  From: ${state.petName}, built by ${state.nickname}`, 56, H - 68)

    if (d.drawingData) {
      try {
        const dimg = await loadImage(d.drawingData)
        const dw = 300
        const dh = (dimg.height / dimg.width) * dw
        ctx.drawImage(dimg, 66, 500, dw, dh)
        ctx.strokeStyle = '#cfc6ab'
        ctx.lineWidth = 4
        ctx.strokeRect(66, 500, dw, dh)
      } catch (e) { /* ignore */ }
    }
  } else {
    const decisions = window.__robo.data.prompts.decisions || []
    const dec =
      decisions.find((x) => x.id === d.decision) || { label: d.decision, emoji: '📋', stamp: 'DECIDED' }

    ctx.font = 'bold 42px system-ui, sans-serif'
    ctx.fillText('Mission Decision Report', 420, 64)
    ctx.font = 'bold 27px system-ui, sans-serif'
    ctx.fillStyle = '#5d6478'
    ctx.fillText(`${state.petName} · ${hw.name}`, 420, 118)
    ctx.fillText(`Mission boss: ${state.nickname}`, 420, 154)

    ctx.save()
    ctx.translate(W - 190, 70)
    ctx.rotate(-0.14)
    ctx.strokeStyle = '#1a6b3f'
    ctx.lineWidth = 6
    roundRect(ctx, 0, 0, 150, 110, 10)
    ctx.stroke()
    ctx.fillStyle = '#1a6b3f'
    ctx.textAlign = 'center'
    ctx.font = '44px system-ui, sans-serif'
    ctx.fillText(dec.emoji, 75, 12)
    ctx.font = 'bold 21px system-ui, sans-serif'
    ctx.fillText(dec.stamp, 75, 70)
    ctx.restore()

    ctx.textAlign = 'left'
    ctx.fillStyle = '#1f2433'
    ctx.font = 'bold 31px system-ui, sans-serif'
    ctx.fillText('The decision', 56, 420)
    ctx.font = 'bold 29px system-ui, sans-serif'
    ctx.fillStyle = '#1a6b3f'
    let y = wrapText(ctx, dec.label, 56, 460, 1080, 37, 2)

    ctx.fillStyle = '#1f2433'
    ctx.font = 'bold 29px system-ui, sans-serif'
    ctx.fillText('Why?', 56, y + 10)
    ctx.font = '25px system-ui, sans-serif'
    y += 50
    d.reasons
      .filter((r) => (r || '').trim())
      .forEach((r, i) => {
        y = wrapText(ctx, `${i + 1}. ${r}`, 56, y, 1080, 33, 3) + 6
      })

    ctx.font = 'bold 29px system-ui, sans-serif'
    ctx.fillText('A risk we thought about', 56, y + 8)
    ctx.font = '25px system-ui, sans-serif'
    wrapText(ctx, d.risk, 56, y + 48, 1080, 33, 3)
  }

  const name = safeFileName(
    `${state.petName}-${isPostcard ? 'postcard' : 'mission-report'}`,
    'robo-pet'
  )
  download(canvas.toDataURL('image/png'), `${name}.png`)
  toast('Picture downloaded! 📥', 'success')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Word-wrap helper. Returns the y position after the last line drawn. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const words = String(text || '').split(/\s+/)
  let line = ''
  let lines = 0
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      lines++
      line = word
      if (lines >= maxLines - 1) break
    } else {
      line = test
    }
  }
  if (line && lines < maxLines) {
    let out = line
    while (ctx.measureText(out).width > maxWidth && out.length > 4) out = out.slice(0, -2)
    ctx.fillText(out + (out !== line ? '…' : ''), x, y)
    y += lineHeight
  }
  return y
}
