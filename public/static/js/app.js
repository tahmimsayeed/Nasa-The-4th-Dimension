/**
 * Robo Pet Station - main app.
 *
 * Plain ES modules, no build step and no framework: a single ~60KB JS file
 * loads instantly on a school Chromebook and works offline-ish once cached.
 * Screens are rendered by swapping innerHTML on #app-root; state lives in one
 * object and is mirrored into localStorage so a kid who closes the tab (or
 * whose Chromebook sleeps) does not lose their robot.
 */

import { state, saveState, resetProgress, loadState } from './state.js'
import { api } from './api.js'
import { el, h, esc, toast, confetti, announce } from './ui.js'
import { speak, stopSpeaking, initA11y, attachGlossary } from './a11y.js'
import { renderWelcome } from './screens/welcome.js'
import { renderBuild } from './screens/build.js'
import { renderLearn } from './screens/learn.js'
import { renderCreate } from './screens/create.js'
import { renderShare } from './screens/share.js'
import { renderReward } from './screens/reward.js'
import { renderWall, renderExhibitPage } from './screens/wall.js'
import { renderTeacher } from './screens/teacher.js'

/* ------------------------------------------------------------------ *
 * Mission data (loaded once, cached)
 * ------------------------------------------------------------------ */

export const data = {
  hardware: [],
  glossary: [],
  builderOptions: null,
  prompts: null,
  byId: {},
}

async function loadMissionData() {
  const res = await fetch('/static/data/missions.json')
  if (!res.ok) throw new Error('Could not load mission data')
  const json = await res.json()
  data.hardware = json.hardware || []
  data.glossary = json.glossary || []
  data.builderOptions = json.builder_options || {}
  data.prompts = json.prompts || {}
  data.byId = {}
  for (const hw of data.hardware) data.byId[hw.id] = hw
  return data
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

const SCREENS = {
  welcome: renderWelcome,
  build: renderBuild,
  learn: renderLearn,
  create: renderCreate,
  share: renderShare,
  reward: renderReward,
  wall: renderWall,
  teacher: renderTeacher,
  exhibit: renderExhibitPage,
}

// Which progress-bar step each screen belongs to (null = outside the flow).
const STEP_OF = {
  build: 0,
  learn: 1,
  create: 2,
  share: 3,
  reward: 3,
}

const STEPS = [
  { key: 'build', label: 'Build', emoji: '🔧' },
  { key: 'learn', label: 'Learn', emoji: '📖' },
  { key: 'create', label: 'Create', emoji: '✏️' },
  { key: 'share', label: 'Share', emoji: '🖼️' },
]

export function go(screen, opts = {}) {
  stopSpeaking()
  state.screen = screen
  if (opts.params) state.params = opts.params
  saveState()

  // Keep the URL meaningful so a teacher can bookmark /wall or /teacher.
  const path =
    screen === 'wall' ? '/wall' : screen === 'teacher' ? '/teacher' : screen === 'exhibit' ? `/exhibit/${state.params?.id ?? ''}` : '/'
  if (location.pathname !== path && !opts.noPush) {
    history.pushState({ screen }, '', path)
  }
  render()
  window.scrollTo({ top: 0, behavior: opts.instant ? 'auto' : 'smooth' })
}

/** Top progress bar: Build > Learn > Create > Share */
function progressBar() {
  const current = STEP_OF[state.screen]
  if (current === undefined) return ''
  return h('nav', { class: 'progress', 'aria-label': 'Your progress' },
    STEPS.map((s, i) => {
      const cls = i === current ? 'active' : i < current ? 'done' : ''
      const canJump =
        i < current && (i !== 0 || true) // allow going back to any finished step
      return (
        (i > 0 ? '<span class="progress-sep" aria-hidden="true">▸</span>' : '') +
        h(canJump ? 'button' : 'div', {
          class: `progress-step ${cls}`,
          ...(canJump ? { 'data-goto': s.key, type: 'button', style: 'border:0;font-family:inherit;cursor:pointer' } : {}),
          'aria-current': i === current ? 'step' : null,
        },
          `<span class="num" aria-hidden="true">${i < current ? '✓' : i + 1}</span>` +
          `<span class="label">${s.label}</span>`
        )
      )
    }).join('')
  )
}

function topBar() {
  return h('header', { class: 'topbar' },
    h('button', { class: 'brand', 'data-action': 'home', 'aria-label': 'Robo Pet Station home' },
      '<span class="mascot-mini" aria-hidden="true">🤖</span><span>Robo Pet Station</span>'
    ) +
    h('button', {
      class: 'icon-btn',
      'data-action': 'wall',
      'aria-label': 'Open the Class Museum Wall',
      title: 'Class Museum Wall',
    }, '🖼️') +
    h('button', {
      class: `icon-btn ${state.a11y.bigText ? 'is-on' : ''}`,
      'data-action': 'toggle-bigtext',
      'aria-label': 'Make text bigger',
      'aria-pressed': String(!!state.a11y.bigText),
      title: 'Bigger text',
    }, '🔠') +
    h('button', {
      class: `icon-btn ${state.a11y.highContrast ? 'is-on' : ''}`,
      'data-action': 'toggle-contrast',
      'aria-label': 'High contrast mode',
      'aria-pressed': String(!!state.a11y.highContrast),
      title: 'High contrast',
    }, '◐') +
    h('button', {
      class: 'icon-btn',
      'data-action': 'help',
      'aria-label': 'Help and glossary',
      title: 'Help',
    }, '❓')
  )
}

export function render() {
  const root = document.getElementById('app-root')
  const fn = SCREENS[state.screen] || renderWelcome
  const inner = fn()
  root.innerHTML =
    '<div class="starfield" aria-hidden="true"></div>' +
    '<div class="nebula" aria-hidden="true"></div>' +
    '<div class="shell">' + topBar() + progressBar() + '<main class="screen">' + inner + '</main></div>'

  // Let the screen wire up anything that needs real DOM nodes (canvas etc).
  if (fn.afterRender) fn.afterRender()
  attachGlossary(root, data.glossary)
}

/* ------------------------------------------------------------------ *
 * Global event delegation
 * ------------------------------------------------------------------ */

function onGlobalClick(ev) {
  const t = ev.target.closest('[data-action],[data-goto],[data-speak]')
  if (!t) return

  const goto = t.getAttribute('data-goto')
  if (goto) {
    go(goto)
    return
  }

  const speakSel = t.getAttribute('data-speak')
  if (speakSel) {
    ev.preventDefault()
    const target = speakSel === 'self' ? t.closest('[data-speak-text]') : document.querySelector(speakSel)
    const text = target?.getAttribute('data-speak-text') || target?.innerText || ''
    speak(text, t)
    return
  }

  const action = t.getAttribute('data-action')
  switch (action) {
    case 'home':
      if (state.pet && state.screen !== 'welcome') {
        go(state.hardwareId ? 'build' : 'welcome')
      } else {
        go('welcome')
      }
      break
    case 'wall':
      go('wall')
      break
    case 'teacher':
      go('teacher')
      break
    case 'toggle-bigtext':
      state.a11y.bigText = !state.a11y.bigText
      document.body.classList.toggle('big-text', state.a11y.bigText)
      saveState()
      render()
      announce(state.a11y.bigText ? 'Bigger text on' : 'Bigger text off')
      break
    case 'toggle-contrast':
      state.a11y.highContrast = !state.a11y.highContrast
      document.body.classList.toggle('high-contrast', state.a11y.highContrast)
      saveState()
      render()
      announce(state.a11y.highContrast ? 'High contrast on' : 'High contrast off')
      break
    case 'help':
      showHelp()
      break
    case 'start-over':
      if (confirm('Start a brand new robo pet? Your finished exhibits stay on the wall.')) {
        resetProgress()
        go('build')
      }
      break
    case 'print':
      window.print()
      break
  }
}

function showHelp() {
  const words = data.glossary
    .map(
      (g) =>
        `<div class="story-block" style="background:rgba(255,255,255,.06)">
           <h3>${esc(g.word)}</h3><p>${esc(g.kid_definition)}</p>
         </div>`
    )
    .join('')

  import('./ui.js').then(({ modal }) => {
    modal({
      title: '❓ Help & Space Words',
      body: `
        <p class="lead">Stuck? Here is what to do:</p>
        <ol class="stack-sm">
          <li><b>Build</b> your robo pet and give it a name.</li>
          <li><b>Learn</b> the true story of the real NASA hardware it is based on.</li>
          <li><b>Create</b> a postcard or a mission plan.</li>
          <li><b>Share</b> it on the Class Museum Wall!</li>
        </ol>
        <p>Tap the <b>🔊 speaker</b> button next to any text to hear it read aloud.
        Tap <b>🔠</b> for bigger text and <b>◐</b> for high contrast.</p>
        <h2 style="margin-top:18px">📖 Space Words</h2>
        ${words}
        <p class="muted" style="margin-top:14px">Are you a teacher?
          <button class="btn btn-ghost" data-action="teacher" style="min-height:40px;padding:8px 16px">Open Teacher View</button>
        </p>
      `,
    })
  })
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function boot() {
  loadState()
  initA11y()
  document.body.classList.toggle('big-text', !!state.a11y.bigText)
  document.body.classList.toggle('high-contrast', !!state.a11y.highContrast)

  document.addEventListener('click', onGlobalClick)
  window.addEventListener('popstate', () => {
    routeFromUrl()
    render()
  })

  const root = document.getElementById('app-root')
  root.innerHTML = '<div class="loading"><div class="spinner"></div><p>Powering up the robot workshop…</p></div>'

  try {
    await loadMissionData()
  } catch (e) {
    root.innerHTML =
      '<div class="shell"><div class="card center"><h2>🛠️ Could not load the mission files</h2>' +
      '<p class="lead">Please check your internet connection and reload the page.</p>' +
      '<button class="btn btn-primary" onclick="location.reload()">Try again</button></div></div>'
    return
  }

  routeFromUrl()
  render()
}

function routeFromUrl() {
  const path = location.pathname
  const m = path.match(/^\/exhibit\/([a-z0-9]{4,16})$/i)
  if (m) {
    state.screen = 'exhibit'
    state.params = { id: m[1] }
    return
  }
  if (path === '/wall') {
    state.screen = 'wall'
    return
  }
  if (path === '/teacher') {
    state.screen = 'teacher'
    return
  }
  // Root: resume where the kid left off, if they have a class + nickname.
  if (!state.nickname || !state.classCode) {
    state.screen = 'welcome'
  } else if (!['build', 'learn', 'create', 'share', 'reward', 'wall'].includes(state.screen)) {
    state.screen = 'build'
  }
}

// Expose a couple of helpers for screens that need to re-render.
window.__robo = { go, render, data, state, api, toast, confetti, speak }

boot()
