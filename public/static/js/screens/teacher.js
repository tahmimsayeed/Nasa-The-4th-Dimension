/**
 * Teacher view.
 *
 * Deliberately simple: a class code + a PIN, no accounts to manage. The first
 * teacher to sign in for a class claims it with their PIN.
 *
 * Features: see every submission (including ones waiting for approval), approve
 * / hide / delete, turn "approve before it goes live" on or off, and export the
 * whole gallery as a printable PDF via the browser's print dialog.
 */

import { state, saveState, setTeacherPin } from '../state.js'
import { api } from '../api.js'
import { h, esc, el, els, toast, modal, closeModal, timeAgo, qrImage } from '../ui.js'
import { postcardHtml, reportHtml } from './share.js'
import { tradingCardHtml } from './reward.js'

let teacherData = { exhibits: [], loaded: false, requireApproval: false }

export function renderTeacher() {
  // --- sign in ---
  if (!state.teacherPin) {
    return `
      <div class="card" style="max-width:470px;margin:0 auto">
        <h1>🧑‍🏫 Teacher View</h1>
        <p class="lead">Sign in with your class code and a PIN.</p>

        <label class="field">
          <span class="lbl">Class code</span>
          <input type="text" id="t-code" maxlength="20" placeholder="e.g. MOON-42"
                 value="${esc(state.classCode)}" style="text-transform:uppercase">
        </label>

        <label class="field">
          <span class="lbl">Teacher PIN</span>
          <input type="text" id="t-pin" maxlength="8" inputmode="numeric"
                 placeholder="4-8 numbers" autocomplete="off">
          <span class="hint">
            First time with this class? Pick any 4-8 digit PIN and it becomes the
            class PIN. Write it down - you will need it again.
          </span>
        </label>

        <div id="t-error" aria-live="assertive"></div>
        <button class="btn btn-primary btn-block btn-lg" id="t-login">Sign in</button>
        <p class="muted center" style="margin:14px 0 0">
          Demo class <b>MOON-42</b> uses PIN <b>1234</b>.
        </p>
        <button class="btn btn-ghost btn-block" style="margin-top:10px" data-goto="welcome">← Back</button>
      </div>`
  }

  // --- dashboard ---
  const pending = teacherData.exhibits.filter((e) => e.status === 'pending')
  const live = teacherData.exhibits.filter((e) => e.status === 'live')
  const hidden = teacherData.exhibits.filter((e) => e.status === 'hidden')

  return `
    <div class="wall-head">
      <div style="flex:1;min-width:200px">
        <h1 style="margin-bottom:2px">🧑‍🏫 Teacher View</h1>
        <p class="muted" style="margin:0">Class <b>${esc(state.classCode)}</b></p>
      </div>
      <button class="btn btn-ghost" id="t-logout">Sign out</button>
    </div>

    <div class="panel">
      <h2>⚙️ Class settings</h2>
      <div class="row">
        <label class="row" style="gap:10px;cursor:pointer;flex:1;min-width:260px">
          <input type="checkbox" id="t-approval" ${teacherData.requireApproval ? 'checked' : ''}
                 style="width:26px;height:26px;min-height:26px;flex:0 0 auto">
          <span>
            <b>Check work before it goes on the wall</b><br>
            <span class="muted">
              When this is on, new exhibits wait here until you approve them.
            </span>
          </span>
        </label>
      </div>

      <div class="row" style="margin-top:16px;gap:10px">
        <div class="panel" style="flex:1;min-width:120px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:var(--star)">${live.length}</div>
          <div class="muted">on the wall</div>
        </div>
        <div class="panel" style="flex:1;min-width:120px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:${pending.length ? 'var(--rocket)' : 'var(--ink-dim)'}">${pending.length}</div>
          <div class="muted">waiting for you</div>
        </div>
        <div class="panel" style="flex:1;min-width:120px;padding:12px;text-align:center">
          <div style="font-size:1.8rem;font-weight:900;color:var(--ink-dim)">${hidden.length}</div>
          <div class="muted">hidden</div>
        </div>
      </div>

      <div class="btn-row" style="margin-top:16px">
        <button class="btn btn-secondary" id="t-refresh">
          <span aria-hidden="true">🔄</span> Refresh
        </button>
        <button class="btn btn-primary" id="t-export">
          <span aria-hidden="true">🖨️</span> Export gallery as PDF
        </button>
        <button class="btn btn-ghost" data-action="wall">
          <span aria-hidden="true">🖼️</span> See the public wall
        </button>
      </div>
    </div>

    ${pending.length ? `
      <div class="panel" style="border-color:var(--rocket)">
        <h2>⏳ Waiting for approval (${pending.length})</h2>
        <div class="exhibit-grid" id="t-pending">
          ${pending.map((ex) => teacherCard(ex)).join('')}
        </div>
      </div>` : ''}

    <div class="panel">
      <h2>🖼️ All submissions (${teacherData.exhibits.length})</h2>
      ${teacherData.exhibits.length
        ? `<div class="exhibit-grid" id="t-all">
             ${teacherData.exhibits.map((ex) => teacherCard(ex)).join('')}
           </div>`
        : `<div class="empty-state">
             <span class="es-em" aria-hidden="true">🏛️</span>
             <p class="lead">No submissions yet.</p>
             <p>Share the class code <b>${esc(state.classCode)}</b> with your students to get started.</p>
           </div>`}
    </div>

    <div class="panel">
      <h2>📋 Share with your class</h2>
      <div class="qr-wrap">
        <div class="qr-box">${qrImage(location.origin, 130)}</div>
        <div style="flex:1;min-width:220px">
          <p>Students open <b>${esc(location.host)}</b> and enter the class code:</p>
          <p style="font-size:2rem;font-weight:900;color:var(--star);margin:4px 0">${esc(state.classCode)}</p>
          <p class="muted">Project this on the board, or print the QR code for your wall.</p>
        </div>
      </div>
    </div>
  `
}

function teacherCard(ex) {
  const hw = window.__robo.data.byId[ex.hardwareId] || { name: ex.hardwareId, emoji: '🛰️' }
  return `
    <div class="exhibit" style="cursor:default">
      ${ex.status !== 'live' ? `<span class="status-flag ${esc(ex.status)}">${ex.status === 'pending' ? 'WAITING' : 'HIDDEN'}</span>` : ''}
      <div class="ex-art">
        ${window.RoboPet.svg(ex.petConfig, { size: 120, animate: false, showGround: true, gradId: 't' + ex.id })}
      </div>
      <div class="plaque">
        <div class="pl-name">${esc(ex.petName)}</div>
        <div class="pl-by">by ${esc(ex.nickname)}</div>
        <div class="pl-base">${hw.emoji} ${esc(hw.name)}</div>
      </div>
      <div class="ex-tags">
        <span class="ex-tag">${ex.taskType === 'postcard' ? '💌 Postcard' : '⚖️ Plan'}</span>
        ${ex.hasAudio ? '<span class="ex-tag">🎤</span>' : ''}
        ${ex.hasDrawing ? '<span class="ex-tag">🎨</span>' : ''}
        <span class="ex-tag">${esc(timeAgo(ex.createdAt))}</span>
      </div>
      <div class="btn-row" style="margin-top:10px;gap:6px;justify-content:center">
        <button class="btn btn-secondary" style="min-height:40px;padding:8px 14px;font-size:.88rem"
                data-t-view="${esc(ex.id)}">👁️ View</button>
        ${ex.status === 'pending'
          ? `<button class="btn btn-success" style="min-height:40px;padding:8px 14px;font-size:.88rem"
                     data-t-status="live" data-t-id="${esc(ex.id)}">✅ Approve</button>`
          : ex.status === 'live'
            ? `<button class="btn btn-secondary" style="min-height:40px;padding:8px 14px;font-size:.88rem"
                       data-t-status="hidden" data-t-id="${esc(ex.id)}">🙈 Hide</button>`
            : `<button class="btn btn-success" style="min-height:40px;padding:8px 14px;font-size:.88rem"
                       data-t-status="live" data-t-id="${esc(ex.id)}">↩️ Restore</button>`}
        <button class="btn btn-danger" style="min-height:40px;padding:8px 12px;font-size:.88rem"
                data-t-delete="${esc(ex.id)}" aria-label="Delete ${esc(ex.petName)}">🗑️</button>
      </div>
    </div>`
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

renderTeacher.afterRender = function () {
  // --- sign in form ---
  const loginBtn = el('#t-login')
  if (loginBtn) {
    const codeInput = el('#t-code')
    const pinInput = el('#t-pin')
    const errBox = el('#t-error')

    const doLogin = async () => {
      const code = (codeInput.value || '').trim().toUpperCase()
      const pin = (pinInput.value || '').trim()
      errBox.innerHTML = ''
      if (!code) {
        errBox.innerHTML = '<div class="error-msg">Please enter the class code.</div>'
        return
      }
      if (!/^\d{4,8}$/.test(pin)) {
        errBox.innerHTML = '<div class="error-msg">The PIN must be 4 to 8 numbers.</div>'
        return
      }
      loginBtn.disabled = true
      loginBtn.textContent = 'Signing in…'
      try {
        const res = await api.teacherLogin(code, pin)
        state.classCode = res.classCode
        setTeacherPin(pin)
        saveState()
        teacherData.requireApproval = res.requireApproval
        if (res.claimed) {
          toast(`Class ${res.classCode} is yours. Keep the PIN safe!`, 'success')
        }
        await loadTeacherData()
        window.__robo.render()
      } catch (e) {
        errBox.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
        loginBtn.disabled = false
        loginBtn.textContent = 'Sign in'
      }
    }

    loginBtn.addEventListener('click', doLogin)
    for (const i of [codeInput, pinInput]) {
      i.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') doLogin()
      })
    }
    return
  }

  // --- dashboard ---
  if (!teacherData.loaded) {
    loadTeacherData().then(() => window.__robo.render())
  }

  el('#t-logout')?.addEventListener('click', () => {
    setTeacherPin('')
    teacherData = { exhibits: [], loaded: false, requireApproval: false }
    window.__robo.render()
  })

  el('#t-refresh')?.addEventListener('click', async () => {
    const btn = el('#t-refresh')
    btn.disabled = true
    btn.innerHTML = '<span aria-hidden="true">⏳</span> Refreshing…'
    await loadTeacherData()
    window.__robo.render()
    toast('Up to date!', 'success')
  })

  el('#t-approval')?.addEventListener('change', async (ev) => {
    const on = ev.target.checked
    try {
      await api.teacherSettings(state.classCode, state.teacherPin, on)
      teacherData.requireApproval = on
      toast(
        on ? 'New work will now wait for your approval.' : 'New work goes straight to the wall.',
        'success'
      )
    } catch (e) {
      ev.target.checked = !on
      toast(e.message, 'error')
    }
  })

  // status buttons (approve / hide / restore)
  els('[data-t-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-t-id')
      const status = btn.getAttribute('data-t-status')
      btn.disabled = true
      try {
        await api.setExhibitStatus(id, state.teacherPin, status)
        const ex = teacherData.exhibits.find((e) => e.id === id)
        if (ex) ex.status = status
        window.__robo.render()
        toast(status === 'live' ? 'Now on the wall ✅' : 'Hidden from the wall 🙈', 'success')
      } catch (e) {
        toast(e.message, 'error')
        btn.disabled = false
      }
    })
  })

  // delete
  els('[data-t-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-t-delete')
      const ex = teacherData.exhibits.find((e) => e.id === id)
      if (!confirm(`Delete "${ex?.petName}" by ${ex?.nickname}? This cannot be undone.`)) return
      btn.disabled = true
      try {
        await api.deleteExhibit(id, state.teacherPin)
        teacherData.exhibits = teacherData.exhibits.filter((e) => e.id !== id)
        window.__robo.render()
        toast('Exhibit deleted.', 'success')
      } catch (e) {
        toast(e.message, 'error')
        btn.disabled = false
      }
    })
  })

  // view full submission
  els('[data-t-view]').forEach((btn) => {
    btn.addEventListener('click', () => openTeacherDetail(btn.getAttribute('data-t-view')))
  })

  // PDF export
  el('#t-export')?.addEventListener('click', exportPdf)
}

async function loadTeacherData() {
  try {
    const res = await api.listExhibits({
      classCode: state.classCode,
      includeAll: '1',
      pin: state.teacherPin,
    })
    teacherData.exhibits = res.exhibits
    teacherData.loaded = true
  } catch (e) {
    toast(e.message, 'error')
    // A wrong PIN means the stored session is bad - force a fresh sign-in.
    if (/pin/i.test(e.message)) setTeacherPin('')
    teacherData.loaded = true
  }
}

async function openTeacherDetail(id) {
  const backdrop = modal({
    title: '👁️ Submission',
    body: '<div class="loading"><div class="spinner"></div><p>Loading…</p></div>',
    wide: true,
  })
  try {
    const res = await api.getExhibit(id)
    const ex = res.exhibit
    const hw = window.__robo.data.byId[ex.hardwareId] || { name: ex.hardwareId, emoji: '🛰️', place: '' }
    const piece =
      ex.taskType === 'postcard'
        ? postcardHtml({
            hw, petName: ex.petName, nickname: ex.nickname, petConfig: ex.petConfig,
            text: ex.postcardText, drawingData: ex.drawingData, gradId: 'tv' + ex.id,
          })
        : reportHtml({
            hw, petName: ex.petName, nickname: ex.nickname, petConfig: ex.petConfig,
            decision: ex.decision, reasons: ex.reasons, risk: ex.risk, gradId: 'tv' + ex.id,
          })

    backdrop.querySelector('.modal-head h2').textContent = `👁️ ${ex.petName} by ${ex.nickname}`
    backdrop.querySelector('.modal-body').innerHTML = `
      <p class="muted">Submitted ${esc(timeAgo(ex.createdAt))} · status: <b>${esc(ex.status)}</b></p>
      ${piece}
      ${ex.audioData ? `<div class="panel" style="margin-top:14px">
        <h3>🎤 Voice clip</h3><audio controls src="${ex.audioData}"></audio></div>` : ''}
    `
  } catch (e) {
    backdrop.querySelector('.modal-body').innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
  }
}

/**
 * Build a print-ready document of every live exhibit and open the browser's
 * print dialog, where the teacher can choose "Save as PDF". Using the native
 * print path keeps us free of a heavy PDF library and prints correctly on
 * Chromebooks, iPads and Windows alike.
 */
async function exportPdf() {
  const btn = el('#t-export')
  btn.disabled = true
  btn.innerHTML = '<span aria-hidden="true">⏳</span> Building…'

  try {
    const res = await api.teacherExport(state.classCode, state.teacherPin)
    const exhibits = res.exhibits
    if (!exhibits.length) {
      toast('There are no exhibits on the wall to export yet.', 'error')
      btn.disabled = false
      btn.innerHTML = '<span aria-hidden="true">🖨️</span> Export gallery as PDF'
      return
    }

    const now = new Date().toLocaleDateString()
    const pages = exhibits
      .map((ex, i) => {
        const hw = window.__robo.data.byId[ex.hardwareId] || {
          name: ex.hardwareId, emoji: '🛰️', place: '', location_detail: '', one_liner: '',
          launched: '', status_label: '', nickname: '',
        }
        const piece =
          ex.taskType === 'postcard'
            ? postcardHtml({
                hw, petName: ex.petName, nickname: ex.nickname, petConfig: ex.petConfig,
                text: ex.postcardText, drawingData: ex.drawingData, size: 130, gradId: 'p' + ex.id,
              })
            : reportHtml({
                hw, petName: ex.petName, nickname: ex.nickname, petConfig: ex.petConfig,
                decision: ex.decision, reasons: ex.reasons, risk: ex.risk, size: 110, gradId: 'p' + ex.id,
              })

        return `
          <section class="print-page">
            <div style="display:flex;justify-content:space-between;align-items:baseline;
                        border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:14px">
              <h2 style="margin:0;font-size:17pt">${esc(ex.petName)}
                <span style="font-weight:400;font-size:12pt">by ${esc(ex.nickname)}</span>
              </h2>
              <span style="font-size:10pt">Exhibit ${i + 1} of ${exhibits.length}</span>
            </div>
            ${piece}
            <div style="margin-top:12px;display:flex;gap:16px;align-items:flex-start">
              <div style="flex:1;font-size:10pt;line-height:1.5">
                <b>Real hardware:</b> ${esc(hw.name)} (${esc(hw.nickname)})<br>
                <b>Where it is:</b> ${esc(hw.location_detail)}<br>
                <b>Launched:</b> ${esc(hw.launched)}<br>
                <b>Status:</b> ${esc(hw.status_label)}<br>
                <b>Stickers:</b> ⭐ ${ex.reactions.star} &nbsp; 🚀 ${ex.reactions.rocket} &nbsp; ❤️ ${ex.reactions.heart}
                ${ex.hasAudio ? '<br><b>Note:</b> this exhibit also has a voice recording (listen online).' : ''}
              </div>
              <div style="flex:0 0 90px;text-align:center">
                ${qrImage(`${location.origin}/exhibit/${ex.id}`, 88)}
                <div style="font-size:7pt;margin-top:2px">scan to open</div>
              </div>
            </div>
          </section>`
      })
      .join('')

    // Count how many chose each fate, as a nice summary for the teacher.
    const decisions = window.__robo.data.prompts.decisions || []
    const counts = {}
    for (const ex of exhibits) if (ex.decision) counts[ex.decision] = (counts[ex.decision] || 0) + 1
    const totalDecisions = Object.values(counts).reduce((a, b) => a + b, 0)

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Class Museum Wall - ${esc(state.classCode)}</title>
<link rel="stylesheet" href="/static/css/app.css">
<style>
  body { background:#fff !important; color:#000 !important; font-family:"Trebuchet MS",system-ui,sans-serif; }
  .wrap { max-width:none; padding:0 14px; }
  .print-page { page-break-after:always; break-after:page; padding-top:8px; }
  .print-page:last-child { page-break-after:auto; break-after:auto; }
  .cover { text-align:center; padding:50px 0; page-break-after:always; break-after:page; }
  .cover h1 { font-size:30pt; margin:0 0 8px; }
  h2,h3 { color:#000 !important; }
  .postcard,.report { box-shadow:none; }
  table { width:100%; border-collapse:collapse; font-size:10pt; margin-top:14px; }
  th,td { border:1px solid #666; padding:5px 7px; text-align:left; }
  th { background:#eee; }
  @page { margin:12mm; }
</style>
</head><body><div class="wrap">
  <div class="cover">
    <div style="font-size:54pt">🤖</div>
    <h1>Class Museum Wall</h1>
    <p style="font-size:15pt;margin:0">Class <b>${esc(state.classCode)}</b></p>
    <p style="font-size:11pt;color:#444">${exhibits.length} exhibit${exhibits.length === 1 ? '' : 's'} · printed ${esc(now)}</p>
    <p style="max-width:30em;margin:22px auto;font-size:11pt;line-height:1.6">
      Every robo pet in this gallery was designed by a student and is based on real
      NASA hardware left on the Moon, on Mars, or travelling through deep space.
      Created for the 2026 NASA Space Apps Challenge, <i>Abandoned but not Forgotten</i>.
    </p>

    <table>
      <tr><th>Pet</th><th>Student</th><th>Real hardware</th><th>Task</th></tr>
      ${exhibits
        .map((ex) => {
          const hw = window.__robo.data.byId[ex.hardwareId] || { name: ex.hardwareId }
          return `<tr><td>${esc(ex.petName)}</td><td>${esc(ex.nickname)}</td>
                  <td>${esc(hw.name)}</td>
                  <td>${ex.taskType === 'postcard' ? 'Postcard' : 'Mission Plan'}</td></tr>`
        })
        .join('')}
    </table>

    ${totalDecisions ? `
      <h3 style="margin-top:26px">What did the class decide?</h3>
      <table>
        <tr><th>Decision</th><th>Students</th></tr>
        ${decisions
          .map((d) => `<tr><td>${d.emoji} ${esc(d.label)}</td><td>${counts[d.id] || 0}</td></tr>`)
          .join('')}
      </table>` : ''}
  </div>
  ${pages}
</div></body></html>`

    // Render in a hidden iframe and print that, so the teacher's dashboard
    // stays exactly where it was.
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    const doc = frame.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()

    // Give images (QR codes, drawings) a moment to decode before printing.
    await new Promise((r) => setTimeout(r, 900))
    try {
      await frame.contentWindow.document.fonts?.ready
    } catch (e) { /* ignore */ }

    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 60000)

    toast('Choose "Save as PDF" in the print window 🖨️', 'success')
  } catch (e) {
    toast(e.message, 'error')
  }

  btn.disabled = false
  btn.innerHTML = '<span aria-hidden="true">🖨️</span> Export gallery as PDF'
}
