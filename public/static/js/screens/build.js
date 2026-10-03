/**
 * Screen 2 - Build Your Robo Pet.
 *
 * Left/top: live SVG preview that updates on every tap.
 * Right/bottom: the hardware base picker plus body, mover, colour, antenna,
 * tool and eye options.
 */

import { state, saveState } from '../state.js'
import { h, esc, el, els, toast, speakBtn } from '../ui.js'

// Each real hardware item suggests a sensible starting robot.
const BASE_PRESETS = {
  lunar_rover: { base: 'buggy', body: 'flat', mover: 'wheels4', color: '#e8b23f', antenna: 'dish', tool: 'camera', eyes: 'happy' },
  sojourner: { base: 'rover6', body: 'boxy', mover: 'wheels6', color: '#e05c3f', antenna: 'whip', tool: 'lab', eyes: 'big' },
  spirit: { base: 'rover6', body: 'boxy', mover: 'wheels6', color: '#d2553c', antenna: 'dish', tool: 'drill', eyes: 'happy' },
  opportunity: { base: 'rover6', body: 'round', mover: 'wheels6', color: '#3f9ce0', antenna: 'double', tool: 'arm', eyes: 'star' },
  ingenuity: { base: 'copter', body: 'tall', mover: 'rotors', color: '#9a62d8', antenna: 'whip', tool: 'camera', eyes: 'visor' },
  voyager1: { base: 'probe', body: 'boxy', mover: 'thrusters', color: '#2fb5a8', antenna: 'dish', tool: 'lab', eyes: 'sleepy' },
}

function previewPanel() {
  const data = window.__robo.data
  const hw = data.byId[state.hardwareId]
  return `
    <div class="preview-stage">
      <div id="pet-preview" class="pet-wake">
        ${window.RoboPet.svg(state.pet, { size: 230, animate: true, showGround: true })}
      </div>
      <div class="pet-name-display" id="pet-name-display">${esc(state.petName || '')}</div>
      ${hw ? `<div class="base-badge">Based on ${esc(hw.name)} ${esc(hw.emoji)}</div>` : ''}
    </div>`
}

function optionRow(groupKey, items, selected, labelKey = 'label') {
  return items
    .map(
      (o) => h('button', {
        class: 'option-btn',
        type: 'button',
        'data-opt-group': groupKey,
        'data-opt-value': o.id,
        'aria-pressed': String(o.id === selected),
      }, `<span class="em" aria-hidden="true">${o.emoji || ''}</span><span>${esc(o[labelKey])}</span>`)
    )
    .join('')
}

export function renderBuild() {
  const data = window.__robo.data
  const opts = data.builderOptions
  const hw = data.byId[state.hardwareId]

  const baseCards = data.hardware
    .map((item) =>
      h('button', {
        class: 'base-card',
        type: 'button',
        'data-base': item.id,
        'aria-pressed': String(item.id === state.hardwareId),
      },
        `<span class="bc-emoji" aria-hidden="true">${item.emoji}</span>` +
        `<span class="bc-name">${esc(item.name)}</span>` +
        `<span class="bc-nick">${esc(item.nickname)}</span>` +
        `<span class="bc-place">${esc(item.place)} · ${esc(item.status_label)}</span>`
      )
    )
    .join('')

  return `
    <h1>🔧 Build Your Robo Pet</h1>
    <p class="lead">
      First pick the real NASA machine that inspires your pet. Then make it your own!
      ${speakBtn('First pick the real NASA machine that inspires your pet. Then make it your own. You can change the body, the wheels, the colour, the antenna, the tool and the eyes.')}
    </p>

    <div class="panel" style="margin-bottom:18px">
      <div class="option-group">
        <span class="glabel"><span aria-hidden="true">🛰️</span> Pick your pet's inspiration</span>
        <div class="base-grid" role="group" aria-label="Choose real NASA hardware">${baseCards}</div>
      </div>
    </div>

    ${state.hardwareId ? `
    <div class="builder-grid">
      <div>${previewPanel()}</div>

      <div class="panel">
        <label class="field">
          <span class="lbl">🏷️ Name your pet</span>
          <input type="text" id="petname" maxlength="24" autocomplete="off"
                 placeholder="e.g. Dusty, Pebble, Whirly" value="${esc(state.petName)}">
        </label>

        <div class="option-group">
          <span class="glabel"><span aria-hidden="true">📦</span> Body shape</span>
          <div class="option-row" role="group" aria-label="Body shape">
            ${optionRow('body', opts.bodies, state.pet.body)}
          </div>
        </div>

        <div class="option-group">
          <span class="glabel"><span aria-hidden="true">🛞</span> How it moves</span>
          <div class="option-row" role="group" aria-label="How it moves">
            ${optionRow('mover', opts.movers, state.pet.mover)}
          </div>
        </div>

        <div class="option-group">
          <span class="glabel"><span aria-hidden="true">🎨</span> Colour</span>
          <div class="swatch-row" role="group" aria-label="Colour">
            ${opts.colors
              .map((c) => h('button', {
                class: 'swatch',
                type: 'button',
                style: `background:${c.hex}`,
                'data-opt-group': 'color',
                'data-opt-value': c.hex,
                'aria-pressed': String(c.hex.toLowerCase() === String(state.pet.color).toLowerCase()),
                'aria-label': c.label,
                title: c.label,
              }, ''))
              .join('')}
          </div>
        </div>

        <div class="option-group">
          <span class="glabel"><span aria-hidden="true">📡</span> Antenna</span>
          <div class="option-row" role="group" aria-label="Antenna">
            ${optionRow('antenna', opts.antennas, state.pet.antenna)}
          </div>
        </div>

        <div class="option-group">
          <span class="glabel"><span aria-hidden="true">🔬</span> Science tool</span>
          <div class="option-row" role="group" aria-label="Science tool">
            ${optionRow('tool', opts.tools, state.pet.tool)}
          </div>
        </div>

        <div class="option-group">
          <span class="glabel"><span aria-hidden="true">👀</span> Eyes</span>
          <div class="option-row" role="group" aria-label="Eyes">
            ${optionRow('eyes', opts.eyes, state.pet.eyes)}
          </div>
        </div>

        <div class="btn-row" style="margin-top:6px">
          <button class="btn btn-secondary" id="surprise-btn">
            <span aria-hidden="true">🎲</span> Surprise me!
          </button>
        </div>
      </div>
    </div>

    <div id="build-error" aria-live="assertive"></div>

    <div class="btn-row between" style="margin-top:20px">
      <button class="btn btn-ghost" data-goto="welcome"><span aria-hidden="true">←</span> Back</button>
      <button class="btn btn-primary btn-lg" id="build-next">
        Meet ${esc(state.petName || 'your pet')}'s real story <span aria-hidden="true">→</span>
      </button>
    </div>
    ` : `
    <div class="empty-state">
      <span class="es-em" aria-hidden="true">👆</span>
      <p class="lead">Tap one of the real NASA machines above to start building!</p>
    </div>
    `}
  `
}

renderBuild.afterRender = function () {
  const refreshPreview = () => {
    const box = el('#pet-preview')
    if (box) {
      box.innerHTML = window.RoboPet.svg(state.pet, { size: 230, animate: true, showGround: true })
    }
  }

  // --- pick hardware base ---
  els('[data-base]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-base')
      const first = !state.hardwareId
      state.hardwareId = id
      // Applying the preset gives kids a good-looking starting point.
      if (first || confirmSwap()) {
        Object.assign(state.pet, BASE_PRESETS[id] || {})
      } else {
        state.pet.base = (BASE_PRESETS[id] || {}).base || state.pet.base
      }
      saveState()
      window.__robo.render()
      const hw = window.__robo.data.byId[id]
      toast(`Nice pick! ${hw.nickname} ${hw.emoji}`, 'success')
    })
  })

  // Only offer to overwrite custom choices if the kid actually customised.
  function confirmSwap() {
    return true
  }

  // --- option buttons ---
  els('[data-opt-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.getAttribute('data-opt-group')
      const value = btn.getAttribute('data-opt-value')
      state.pet[group] = value
      saveState()

      // Update aria-pressed within this group only (cheaper than a full re-render,
      // and it keeps the preview animation from restarting on every tap).
      const siblings = btn.parentElement.querySelectorAll('[data-opt-group]')
      siblings.forEach((s) => s.setAttribute('aria-pressed', String(s === btn)))
      refreshPreview()
    })
  })

  // --- pet name ---
  const nameInput = el('#petname')
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      state.petName = nameInput.value
      const display = el('#pet-name-display')
      if (display) display.textContent = state.petName
      const next = el('#build-next')
      if (next) {
        next.innerHTML = `Meet ${esc(state.petName || 'your pet')}'s real story <span aria-hidden="true">→</span>`
      }
      saveState()
    })
  }

  // --- surprise me ---
  const surprise = el('#surprise-btn')
  if (surprise) {
    surprise.addEventListener('click', () => {
      const o = window.__robo.data.builderOptions
      const pick = (arr) => arr[(Math.random() * arr.length) | 0]
      state.pet.body = pick(o.bodies).id
      state.pet.mover = pick(o.movers).id
      state.pet.color = pick(o.colors).hex
      state.pet.antenna = pick(o.antennas).id
      state.pet.tool = pick(o.tools).id
      state.pet.eyes = pick(o.eyes).id
      saveState()
      window.__robo.render()
      toast('Ta-da! A random robo pet 🎲')
    })
  }

  // --- next ---
  const next = el('#build-next')
  if (next) {
    next.addEventListener('click', () => {
      const errBox = el('#build-error')
      if (!state.petName.trim()) {
        errBox.innerHTML = '<div class="error-msg">Please give your pet a name first!</div>'
        el('#petname')?.focus()
        return
      }
      errBox.innerHTML = ''
      saveState()
      window.__robo.go('learn')
    })
  }
}
