/**
 * Accessibility helpers.
 *
 *  - Read-aloud using the browser's built-in SpeechSynthesis (no network, no
 *    API key, works offline). Every block of text in the app has a 🔊 button.
 *  - Glossary pop-ups: any word listed in missions.json gets a dotted underline
 *    and explains itself on tap.
 *
 * Note on speech: Chrome on Chromebooks sometimes reports an empty voice list
 * until the voices load, so we re-read the list lazily and prefer a clear
 * English voice at a slightly slower rate for younger readers.
 */

import { esc } from './ui.js'

let voices = []
let speaking = false
let currentBtn = null

export function initA11y() {
  if (!('speechSynthesis' in window)) return
  const load = () => {
    voices = window.speechSynthesis.getVoices() || []
  }
  load()
  window.speechSynthesis.onvoiceschanged = load
  // Stop any speech if the kid navigates away or closes the tab.
  window.addEventListener('pagehide', stopSpeaking)
}

function pickVoice() {
  if (!voices.length) voices = window.speechSynthesis?.getVoices() || []
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang) || /english/i.test(v.name))
  // Prefer a natural-sounding local voice when one exists.
  const preferred = ['Google US English', 'Samantha', 'Microsoft Aria', 'Microsoft Zira', 'Daniel']
  for (const name of preferred) {
    const found = en.find((v) => v.name.includes(name))
    if (found) return found
  }
  return en[0] || voices[0] || null
}

/** Read text aloud. Tapping the same button again stops it (toggle). */
export function speak(text, btn) {
  if (!('speechSynthesis' in window)) {
    import('./ui.js').then(({ toast }) =>
      toast('Sorry, this device cannot read text out loud.', 'error')
    )
    return
  }

  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[🔊🤖⭐🚀❤️💡📡🌙🏛️🚩🔧]/g, '')
    .trim()
  if (!clean) return

  // Second tap on the same button = stop.
  if (speaking && currentBtn === btn) {
    stopSpeaking()
    return
  }

  stopSpeaking()

  const u = new SpeechSynthesisUtterance(clean)
  const v = pickVoice()
  if (v) u.voice = v
  u.lang = v?.lang || 'en-US'
  u.rate = 0.92 // a touch slower for ages 7-12
  u.pitch = 1.05

  u.onstart = () => {
    speaking = true
    currentBtn = btn
    if (btn) {
      btn.textContent = '⏹'
      btn.setAttribute('aria-label', 'Stop reading')
      btn.classList.add('is-on')
    }
  }
  const done = () => {
    speaking = false
    if (currentBtn) {
      currentBtn.textContent = '🔊'
      currentBtn.setAttribute('aria-label', 'Read this out loud')
      currentBtn.classList.remove('is-on')
    }
    currentBtn = null
  }
  u.onend = done
  u.onerror = done

  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
  } catch (e) { /* ignore */ }
  speaking = false
  if (currentBtn) {
    currentBtn.textContent = '🔊'
    currentBtn.setAttribute('aria-label', 'Read this out loud')
    currentBtn.classList.remove('is-on')
  }
  currentBtn = null
}

/* ------------------------------------------------------------------ *
 * Glossary
 * ------------------------------------------------------------------ */

let glossaryWired = false
let glossaryList = []

/**
 * Wrap glossary words inside elements marked with [data-gloss] so kids can tap
 * them. We only touch text nodes, so existing markup and event handlers are
 * never damaged.
 */
export function attachGlossary(root, glossary) {
  glossaryList = glossary || glossaryList

  if (!glossaryWired) {
    // One delegated listener handles every glossary word in the app.
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.gloss')
      if (!btn) return
      ev.preventDefault()
      const word = btn.getAttribute('data-word')
      const entry = glossaryList.find((g) => g.word.toLowerCase() === String(word).toLowerCase())
      if (!entry) return
      import('./ui.js').then(({ modal, speakBtn }) => {
        modal({
          title: `📖 ${esc(entry.word)}`,
          body: `<p class="lead" data-speak-text="${esc(entry.word)}. ${esc(entry.kid_definition)}">
                   ${esc(entry.kid_definition)}
                 </p>
                 <div class="btn-row" style="margin-top:12px">${speakBtn(
                   entry.word + '. ' + entry.kid_definition
                 )}</div>`,
        })
      })
    })
    glossaryWired = true
  }

  const targets = root.querySelectorAll('[data-gloss]')
  if (!targets.length || !glossaryList.length) return

  // Longest words first so "interstellar space" wins over "space".
  const words = glossaryList
    .map((g) => g.word)
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`\\b(${words.join('|')})\\b`, 'gi')

  for (const target of targets) {
    if (target.dataset.glossDone === '1') continue
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        // Never rewrite inside a button, an existing glossary word, or a heading.
        if (node.parentElement.closest('.gloss,button,a,h1,h2,h3,script,style')) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)

    const seen = new Set()
    for (const node of nodes) {
      const text = node.nodeValue
      re.lastIndex = 0
      if (!re.test(text)) continue
      re.lastIndex = 0
      const frag = document.createDocumentFragment()
      let last = 0
      let m
      while ((m = re.exec(text))) {
        const key = m[1].toLowerCase()
        // Only link the FIRST time each word appears, to avoid a sea of dots.
        if (seen.has(key)) continue
        seen.add(key)
        frag.appendChild(document.createTextNode(text.slice(last, m.index)))
        const btn = document.createElement('button')
        btn.className = 'gloss'
        btn.type = 'button'
        btn.setAttribute('data-word', m[1])
        btn.setAttribute('aria-label', `What does ${m[1]} mean?`)
        btn.textContent = m[1]
        frag.appendChild(btn)
        last = m.index + m[1].length
      }
      if (last === 0) continue
      frag.appendChild(document.createTextNode(text.slice(last)))
      node.parentNode.replaceChild(frag, node)
    }
    target.dataset.glossDone = '1'
  }
}
