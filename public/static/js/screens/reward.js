/**
 * Screen 6 - Reward.
 *
 * Unlocks a collectible Pet Trading Card with the pet's picture and the REAL
 * mission facts, plus the class poll result for Mission B. This is the payoff
 * moment, so it gets the confetti and the card-shine animation.
 */

import { state, saveState, resetProgress } from '../state.js'
import { api } from '../api.js'
import { esc, el, toast, confetti, speakBtn, download, safeFileName, qrImage } from '../ui.js'

/* ---------------- trading card markup (reused by the teacher PDF) ---------------- */

export function tradingCardHtml(opts) {
  const { hw, petName, nickname, petConfig, exhibitId, size = 190, gradId = 'tc' } = opts
  // Rarity is a bit of fun: the rarer statuses are the more unusual machines.
  const rarity =
    hw.status === 'travelling' ? 'LEGENDARY' : hw.status === 'grounded' ? 'EPIC' : hw.status === 'retired' ? 'RARE' : 'CLASSIC'

  return `
    <div class="trading-card" id="trading-card">
      <div class="tc-top">
        <span class="tc-rarity">${rarity}</span>
        <span class="tc-num">#${esc(String(exhibitId || '----').slice(0, 6).toUpperCase())}</span>
      </div>

      <div class="tc-art">
        ${window.RoboPet.svg(petConfig, { size, animate: true, showGround: true, gradId })}
      </div>

      <div class="tc-name">${esc(petName)}</div>
      <div class="tc-based">
        <span aria-hidden="true">${hw.emoji}</span> based on ${esc(hw.name)}
      </div>

      <div class="tc-stats">
        <div class="tc-stat"><span class="k">Home</span><span class="v">${esc(hw.place)}</span></div>
        <div class="tc-stat"><span class="k">Launched</span><span class="v">${esc(String(hw.launched).split('(')[0].trim())}</span></div>
        <div class="tc-stat"><span class="k">Status</span><span class="v">${esc(hw.status_label)}</span></div>
        <div class="tc-stat"><span class="k">Nickname</span><span class="v">${esc(hw.nickname)}</span></div>
      </div>

      <p class="tc-fact">"${esc(hw.one_liner)}"</p>

      <div class="tc-footer">
        <span>Built by ${esc(nickname)}</span>
        <span>ROBO PET STATION</span>
      </div>
    </div>`
}

/* ---------------- poll ---------------- */

function pollHtml(counts, total, mine) {
  const decisions = window.__robo.data.prompts.decisions || []
  if (!total) return ''

  const rows = decisions
    .map((d) => {
      const n = counts[d.id] || 0
      const pct = total ? Math.round((n / total) * 100) : 0
      const isMine = d.id === mine
      return `
        <div class="poll-row ${isMine ? 'mine' : ''}">
          <div class="poll-top">
            <span>${d.emoji} ${esc(d.label)}${isMine ? ' <b>(you)</b>' : ''}</span>
            <span>${n} ${n === 1 ? 'classmate' : 'classmates'}</span>
          </div>
          <div class="poll-bar"><i data-pct="${pct}"></i></div>
        </div>`
    })
    .join('')

  const mineCount = counts[mine] || 0
  const others = Math.max(0, mineCount - 1)
  const mineLabel = decisions.find((d) => d.id === mine)?.label || ''

  return `
    <div class="panel" style="margin-top:18px">
      <h2>📊 What did your class decide?</h2>
      <p class="lead">
        ${others > 0
          ? `<b>${others}</b> other ${others === 1 ? 'classmate' : 'classmates'} also chose to
             <b>${esc(String(mineLabel).toLowerCase())}</b>.`
          : 'You are the first in your class to make this choice!'}
      </p>
      ${rows}
      <p class="muted" style="margin:12px 0 0">
        ${total} mission plan${total === 1 ? '' : 's'} so far. There is no single right answer -
        real scientists argue about this too!
      </p>
    </div>`
}

/* ---------------- screen ---------------- */

export function renderReward() {
  const hw = window.__robo.data.byId[state.hardwareId]
  if (!hw) {
    return `<div class="card center"><h2>Nothing to unlock yet</h2>
      <button class="btn btn-primary" data-goto="build">Build a robo pet</button></div>`
  }

  const exhibitUrl = `${location.origin}/exhibit/${state.submittedId}`
  const cardNarration =
    `You unlocked the ${state.petName} trading card! ${state.petName} is based on ${hw.name}. ` +
    `${hw.one_liner} It is in ${hw.place}. It launched on ${hw.launched}. ${hw.status_kid}`

  return `
    <div class="center">
      <h1>🎉 Card Unlocked!</h1>
      <p class="lead">
        Great work, ${esc(state.nickname)}! You earned the <b>${esc(state.petName)}</b> trading card.
        ${speakBtn(cardNarration, 'Read my trading card out loud')}
      </p>
    </div>

    ${tradingCardHtml({
      hw,
      petName: state.petName,
      nickname: state.nickname,
      petConfig: state.pet,
      exhibitId: state.submittedId,
    })}

    <div class="btn-row" style="margin-top:18px;justify-content:center">
      <button class="btn btn-secondary" id="card-download">
        <span aria-hidden="true">⬇️</span> Download my card
      </button>
      <button class="btn btn-secondary" data-action="print">
        <span aria-hidden="true">🖨️</span> Print my card
      </button>
    </div>

    ${state.requireApproval ? `
      <div class="ok-msg" style="margin-top:18px">
        <span aria-hidden="true">🧑‍🏫</span> Your exhibit is waiting for your teacher to say yes.
        It will appear on the wall very soon!
      </div>` : `
      <div class="ok-msg" style="margin-top:18px">
        <span aria-hidden="true">✅</span> Your exhibit is live on the Class Museum Wall!
      </div>`}

    <div class="panel" style="margin-top:18px">
      <h2>🔗 Your exhibit's own page</h2>
      <div class="qr-wrap">
        <div class="qr-box">${qrImage(exhibitUrl, 130)}</div>
        <div style="flex:1;min-width:200px">
          <p>Scan this QR code with a phone or tablet camera to open your exhibit.
             Great for a classroom display or a parents' evening!</p>
          <button class="btn btn-ghost" id="copy-link">
            <span aria-hidden="true">📋</span> Copy link
          </button>
        </div>
      </div>
    </div>

    <div id="poll-box"></div>

    <div class="btn-row" style="margin-top:22px;justify-content:center">
      <button class="btn btn-primary btn-lg" data-action="wall">
        <span aria-hidden="true">🖼️</span> See the Museum Wall
      </button>
      <button class="btn btn-secondary" data-action="start-over">
        <span aria-hidden="true">🔧</span> Build another pet
      </button>
    </div>
  `
}

renderReward.afterRender = function () {
  // Celebrate once per unlock, not on every re-render.
  if (!state.cardUnlocked) {
    state.cardUnlocked = true
    saveState()
    confetti(70)
    const card = el('#trading-card')
    if (card) {
      card.classList.add('shine')
      setTimeout(() => card.classList.remove('shine'), 1300)
    }
  }

  el('#card-download')?.addEventListener('click', async () => {
    const btn = el('#card-download')
    btn.disabled = true
    btn.innerHTML = '<span aria-hidden="true">⏳</span> Making card…'
    try {
      await downloadCard()
    } catch (e) {
      toast('Could not make the card image. Try "Print my card" instead.', 'error')
    }
    btn.disabled = false
    btn.innerHTML = '<span aria-hidden="true">⬇️</span> Download my card'
  })

  el('#copy-link')?.addEventListener('click', async () => {
    const url = `${location.origin}/exhibit/${state.submittedId}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied! 📋', 'success')
    } catch (e) {
      // Clipboard API is blocked on some school devices - show it instead.
      const { modal } = await import('../ui.js')
      modal({
        title: '🔗 Your exhibit link',
        body: `<p>Copy this link:</p><input type="text" value="${esc(url)}" readonly
                 onclick="this.select()" style="font-size:.95rem">`,
      })
    }
  })

  // Mission B: load the class poll.
  if (state.taskType === 'decision') {
    const box = el('#poll-box')
    if (box) {
      box.innerHTML = '<div class="loading"><div class="spinner"></div><p>Counting class votes…</p></div>'
      api
        .poll(state.classCode)
        .then((res) => {
          box.innerHTML = pollHtml(res.counts, res.total, state.draft.decision)
          // Animate the bars in after paint.
          requestAnimationFrame(() => {
            box.querySelectorAll('.poll-bar > i').forEach((bar) => {
              bar.style.width = bar.getAttribute('data-pct') + '%'
            })
          })
        })
        .catch(() => {
          box.innerHTML = ''
        })
    }
  }
}

/** Draw the trading card to a PNG so kids can keep or print it. */
async function downloadCard() {
  const hw = window.__robo.data.byId[state.hardwareId]
  const W = 700
  const H = 1000
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // card background
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#1b2a56')
  grad.addColorStop(0.6, '#4b2a7a')
  grad.addColorStop(1, '#6b2a5a')
  roundRect(ctx, 0, 0, W, H, 40)
  ctx.fillStyle = grad
  ctx.fill()

  // gold border
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = 14
  roundRect(ctx, 7, 7, W - 14, H - 14, 36)
  ctx.stroke()

  ctx.textBaseline = 'top'

  const rarity =
    hw.status === 'travelling' ? 'LEGENDARY' : hw.status === 'grounded' ? 'EPIC' : hw.status === 'retired' ? 'RARE' : 'CLASSIC'

  // rarity pill
  ctx.fillStyle = '#ffd166'
  roundRect(ctx, 40, 40, 190, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#2a1a05'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(rarity, 135, 51)

  ctx.fillStyle = '#9aa5cc'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('#' + String(state.submittedId || '----').slice(0, 6).toUpperCase(), W - 44, 55)

  // art window
  ctx.fillStyle = '#0a0f24'
  roundRect(ctx, 44, 104, W - 88, 380, 26)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.2)'
  ctx.lineWidth = 4
  roundRect(ctx, 44, 104, W - 88, 380, 26)
  ctx.stroke()

  const petPng = await window.RoboPet.toPng(state.pet, 420)
  if (petPng) {
    const img = await loadImage(petPng)
    ctx.drawImage(img, (W - 350) / 2, 118, 350, 350)
  }

  // name
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffd166'
  ctx.font = 'bold 50px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, state.petName, W - 110), W / 2, 500)

  ctx.fillStyle = '#c8d0ec'
  ctx.font = '24px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, `based on ${hw.name}`, W - 90), W / 2, 562)

  // stats block
  ctx.fillStyle = 'rgba(0,0,0,.32)'
  roundRect(ctx, 44, 606, W - 88, 212, 22)
  ctx.fill()

  const stats = [
    ['Home', hw.place],
    ['Launched', String(hw.launched).split('(')[0].trim()],
    ['Status', hw.status_label],
    ['Nickname', hw.nickname],
  ]
  let y = 626
  ctx.textAlign = 'left'
  for (const [k, v] of stats) {
    ctx.fillStyle = '#9aa5cc'
    ctx.font = 'bold 21px system-ui, sans-serif'
    ctx.fillText(k, 68, y)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 21px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(truncate(ctx, v, 340), W - 68, y)
    ctx.textAlign = 'left'
    y += 50
  }

  // tagline
  ctx.fillStyle = '#c8d0ec'
  ctx.font = 'italic 23px system-ui, sans-serif'
  ctx.textAlign = 'center'
  wrapText(ctx, `"${hw.one_liner}"`, W / 2, 842, W - 110, 31, 3)

  // footer
  ctx.fillStyle = '#9aa5cc'
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Built by ${state.nickname}`, 48, H - 48)
  ctx.textAlign = 'right'
  ctx.fillText('ROBO PET STATION', W - 48, H - 48)

  download(canvas.toDataURL('image/png'), `${safeFileName(state.petName + '-trading-card')}.png`)
  toast('Trading card downloaded! 🎴', 'success')
}

function truncate(ctx, text, maxWidth) {
  let out = String(text || '')
  if (ctx.measureText(out).width <= maxWidth) return out
  while (ctx.measureText(out + '…').width > maxWidth && out.length > 2) out = out.slice(0, -1)
  return out + '…'
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
    ctx.fillText(truncate(ctx, line, maxWidth), x, y)
    y += lineHeight
  }
  return y
}
