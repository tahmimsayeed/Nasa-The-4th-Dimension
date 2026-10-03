/**
 * Tiny UI helpers: HTML building, toasts, modals, confetti, QR codes.
 * Kept dependency-free apart from the vendored qrcode-generator.
 */

/** Escape text for safe insertion into HTML. Used on EVERY kid-entered value. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build an HTML string for a tag. Attributes with null/undefined are dropped. */
export function h(tag, attrs = {}, children = '') {
  const parts = []
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue
    parts.push(`${k}="${esc(v)}"`)
  }
  const body = Array.isArray(children) ? children.join('') : children
  return `<${tag}${parts.length ? ' ' + parts.join(' ') : ''}>${body}</${tag}>`
}

export const el = (sel, root = document) => root.querySelector(sel)
export const els = (sel, root = document) => Array.from(root.querySelectorAll(sel))

/* ---------------- read-aloud button ---------------- */

/**
 * A speaker button that reads the given text aloud.
 * Text is stored in a data attribute so the button works even after re-render.
 */
export function speakBtn(text, label = 'Read this out loud') {
  return (
    `<span data-speak-text="${esc(text)}" style="display:inline-flex;vertical-align:middle">` +
    h('button', {
      class: 'icon-btn',
      'data-speak': 'self',
      'aria-label': label,
      title: label,
      type: 'button',
      style: 'min-width:40px;min-height:40px;font-size:1rem',
    }, '🔊') +
    '</span>'
  )
}

/* ---------------- toast ---------------- */

let toastTimer = null
export function toast(message, kind = 'info') {
  let box = document.getElementById('toast-box')
  if (!box) {
    box = document.createElement('div')
    box.id = 'toast-box'
    box.setAttribute('role', 'status')
    box.setAttribute('aria-live', 'polite')
    box.style.cssText =
      'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:300;' +
      'max-width:min(92vw,460px);pointer-events:none'
    document.body.appendChild(box)
  }
  const colors = {
    info: 'background:#1a2244;border-color:#ffd166',
    error: 'background:#5a1f1f;border-color:#ff6b6b',
    success: 'background:#15402a;border-color:#4fc97a',
  }
  box.innerHTML = `<div style="${colors[kind] || colors.info};color:#fff;border:2px solid;
    border-radius:16px;padding:13px 19px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.5);
    text-align:center;animation:fade-up .25s ease">${esc(message)}</div>`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    box.innerHTML = ''
  }, kind === 'error' ? 5200 : 3200)
}

/** Screen-reader only announcement (no visual toast). */
export function announce(message) {
  let live = document.getElementById('a11y-live')
  if (!live) {
    live = document.createElement('div')
    live.id = 'a11y-live'
    live.className = 'sr-only'
    live.setAttribute('aria-live', 'polite')
    document.body.appendChild(live)
  }
  live.textContent = ''
  setTimeout(() => {
    live.textContent = message
  }, 60)
}

/* ---------------- modal ---------------- */

let lastFocused = null

export function modal({ title, body, footer = '', wide = false, onClose }) {
  const root = document.getElementById('modal-root')
  lastFocused = document.activeElement
  root.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop role="dialog" aria-modal="true" aria-label="${esc(
      String(title).replace(/<[^>]*>/g, '')
    )}">
      <div class="modal" style="${wide ? 'max-width:900px' : ''}">
        <div class="modal-head">
          <h2>${title}</h2>
          <button class="icon-btn" data-modal-close aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="btn-row end" style="margin-top:18px">${footer}</div>` : ''}
      </div>
    </div>`

  const backdrop = root.querySelector('[data-modal-backdrop]')
  const close = () => closeModal(onClose)
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close()
  })
  root.querySelector('[data-modal-close]').addEventListener('click', close)
  document.addEventListener('keydown', escHandler)

  // Move focus into the dialog for keyboard and screen-reader users.
  const focusable = backdrop.querySelector('button,input,textarea,select,a[href]')
  if (focusable) focusable.focus()
  document.body.style.overflow = 'hidden'
  return backdrop
}

function escHandler(ev) {
  if (ev.key === 'Escape') closeModal()
}

export function closeModal(onClose) {
  const root = document.getElementById('modal-root')
  if (root) root.innerHTML = ''
  document.removeEventListener('keydown', escHandler)
  document.body.style.overflow = ''
  if (lastFocused && lastFocused.focus) lastFocused.focus()
  if (typeof onClose === 'function') onClose()
}

/* ---------------- confetti ---------------- */

export function confetti(count = 60) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const colors = ['#ffd166', '#ff6b6b', '#4fc97a', '#45a6f5', '#9a62d8', '#2fb5a8', '#ff7eb6']
  const wrap = document.createElement('div')
  wrap.className = 'confetti'
  wrap.setAttribute('aria-hidden', 'true')
  let html = ''
  for (let i = 0; i < count; i++) {
    const left = Math.random() * 100
    const delay = Math.random() * 0.5
    const dur = 1.9 + Math.random() * 1.5
    const color = colors[(Math.random() * colors.length) | 0]
    const size = 7 + Math.random() * 8
    html += `<i style="left:${left}%;background:${color};width:${size}px;height:${size}px;
      animation-duration:${dur}s;animation-delay:${delay}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '3px'}"></i>`
  }
  wrap.innerHTML = html
  document.body.appendChild(wrap)
  setTimeout(() => wrap.remove(), 3800)
}

/* ---------------- QR code ---------------- */

/**
 * Render a QR code as an <img> (GIF data URL from qrcode-generator).
 * Falls back to showing the plain URL if the library is unavailable.
 */
export function qrImage(text, size = 120) {
  try {
    /* global qrcode */
    const typeNumber = 0 // auto-detect the smallest type that fits
    const qr = qrcode(typeNumber, 'M')
    qr.addData(text)
    qr.make()
    const cellSize = Math.max(2, Math.floor(size / qr.getModuleCount()))
    return qr.createImgTag(cellSize, 8, 'QR code linking to this exhibit')
  } catch (e) {
    return `<p class="muted" style="word-break:break-all">${esc(text)}</p>`
  }
}

/* ---------------- misc ---------------- */

/** Download a data URL (PNG, audio, JSON...) with a filename. */
export function download(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Make a filename safe across Windows/macOS/ChromeOS. */
export function safeFileName(s, fallback = 'robo-pet') {
  const clean = String(s || '')
    .replace(/[^a-z0-9 _-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  return clean || fallback
}

export function timeAgo(iso) {
  if (!iso) return ''
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC.
  const d = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z'))
  const secs = (Date.now() - d.getTime()) / 1000
  if (!isFinite(secs)) return ''
  if (secs < 90) return 'just now'
  const mins = secs / 60
  if (mins < 60) return `${Math.round(mins)} min ago`
  const hrs = mins / 60
  if (hrs < 24) return `${Math.round(hrs)} hour${Math.round(hrs) === 1 ? '' : 's'} ago`
  const days = hrs / 24
  if (days < 30) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} ago`
  return d.toLocaleDateString()
}
