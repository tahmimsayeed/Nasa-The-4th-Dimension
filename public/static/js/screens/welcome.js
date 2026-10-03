/**
 * Screen 1 - Welcome.
 * Nickname + class code. No login, no email, no real names.
 */

import { state, saveState } from '../state.js'
import { api } from '../api.js'
import { h, esc, el, toast, speakBtn } from '../ui.js'

const INTRO =
  'Welcome to Robo Pet Station! Build your own space robot pet, based on real NASA machines left on the Moon, on Mars, and in deep space. Then learn its true story and share it with your class.'

export function renderWelcome() {
  return `
    <div class="welcome-hero">
      <div class="mascot" aria-hidden="true">🤖</div>
      <h1 class="title-big">Robo Pet Station</h1>
      <p class="speech">Hi! I'm Bolt. Let's build a space robo pet together!</p>
      <p class="subtitle" data-speak-text="${esc(INTRO)}">
        Build a space robo pet based on real NASA hardware left on the Moon, on Mars,
        and in deep space. Learn its true story, then share it with your class.
        ${speakBtn(INTRO, 'Read the welcome message out loud')}
      </p>
    </div>

    <div class="card" style="max-width:520px;margin:0 auto">
      <h2>🚀 Ready for launch?</h2>

      <label class="field">
        <span class="lbl">Pick a nickname <span class="muted">(not your real name!)</span></span>
        <input type="text" id="nickname" maxlength="20" autocomplete="off"
               placeholder="e.g. StarPilot7" value="${esc(state.nickname)}"
               aria-describedby="nick-hint">
        <span class="hint" id="nick-hint">
          Make one up! Like RocketKid, NebulaFox or CometCat. Never use your real name.
        </span>
      </label>

      <label class="field">
        <span class="lbl">Class code</span>
        <input type="text" id="classcode" maxlength="20" autocomplete="off"
               placeholder="e.g. MOON-42" value="${esc(state.classCode)}"
               aria-describedby="code-hint" style="text-transform:uppercase">
        <span class="hint" id="code-hint">
          Your teacher will tell you the code. Trying it out at home? Use <b>MOON-42</b>.
        </span>
      </label>

      <div id="welcome-error" aria-live="assertive"></div>

      <button class="btn btn-primary btn-lg btn-block" id="start-btn">
        <span aria-hidden="true">🛠️</span> Start Building
      </button>

      <p class="muted center" style="margin:16px 0 0">
        We never ask for your real name, email or photo.
      </p>
    </div>

    <div class="center" style="margin-top:22px">
      <button class="btn btn-ghost" data-action="wall">
        <span aria-hidden="true">🖼️</span> Visit the Class Museum Wall
      </button>
      <button class="btn btn-ghost" data-action="teacher">
        <span aria-hidden="true">🧑‍🏫</span> I'm a teacher
      </button>
    </div>
  `
}

renderWelcome.afterRender = function () {
  const nick = el('#nickname')
  const code = el('#classcode')
  const btn = el('#start-btn')
  const errBox = el('#welcome-error')

  const submit = async () => {
    const nickname = nick.value.trim()
    const classCode = code.value.trim().toUpperCase()
    errBox.innerHTML = ''

    if (!nickname) {
      errBox.innerHTML = '<div class="error-msg">Please pick a nickname first!</div>'
      nick.focus()
      return
    }
    if (!classCode) {
      errBox.innerHTML = '<div class="error-msg">Please type your class code (like MOON-42).</div>'
      code.focus()
      return
    }

    btn.disabled = true
    btn.innerHTML = '<span aria-hidden="true">⏳</span> Checking…'
    try {
      const res = await api.joinClass(classCode, nickname)
      state.nickname = res.nickname
      state.classCode = res.classCode
      state.requireApproval = res.requireApproval
      saveState()
      toast(`Welcome aboard, ${res.nickname}!`, 'success')
      window.__robo.go('build')
    } catch (e) {
      errBox.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`
      btn.disabled = false
      btn.innerHTML = '<span aria-hidden="true">🛠️</span> Start Building'
    }
  }

  btn.addEventListener('click', submit)
  for (const input of [nick, code]) {
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') submit()
    })
  }
  // Uppercase the class code as the kid types, so MOON-42 and moon-42 both work.
  code.addEventListener('input', () => {
    const pos = code.selectionStart
    code.value = code.value.toUpperCase()
    code.setSelectionRange(pos, pos)
  })
}
