/**
 * Screen 3 - Meet Your Pet's Real Story.
 *
 * A kid-friendly "mission file" for the real NASA hardware. Everything here
 * comes straight from missions.json so a teacher can correct or extend it.
 */

import { state } from '../state.js'
import { esc, speakBtn, el } from '../ui.js'

function fileRow(label, value) {
  return `
    <div class="file-row">
      <div class="fr-label">${esc(label)}</div>
      <div class="fr-value">${esc(value)}</div>
    </div>`
}

/** Build one long string so the read-aloud button narrates the whole file. */
function fullNarration(hw) {
  return [
    `Mission file: ${hw.name}, also known as ${hw.nickname}.`,
    hw.one_liner,
    `Where is it? ${hw.where_am_i}`,
    `It launched on ${hw.launched}.`,
    `What did it do? ${hw.what_i_did}`,
    `What did it discover? ${hw.what_i_discovered}`,
    `Right now: ${hw.status_kid}`,
    'Fun facts.',
    ...hw.facts,
    `Did you know? ${hw.did_you_know}`,
  ].join(' ')
}

export function renderLearn() {
  const data = window.__robo.data
  const hw = data.byId[state.hardwareId]
  if (!hw) {
    return `<div class="card center"><h2>Pick your pet's inspiration first</h2>
      <button class="btn btn-primary" data-goto="build">Go to Build</button></div>`
  }

  return `
    <h1>📖 ${esc(state.petName || 'Your pet')}'s Real Story</h1>
    <p class="lead">
      Your pet is based on a real machine NASA sent into space. This is its true mission file.
      ${speakBtn(fullNarration(hw), 'Read the whole mission file out loud')}
    </p>

    <div class="row" style="margin-bottom:16px;gap:16px">
      <div style="flex:0 0 130px">
        ${window.RoboPet.svg(state.pet, { size: 130, animate: true, showGround: true, gradId: 'learn' })}
      </div>
      <div style="flex:1;min-width:180px">
        <h2 style="margin-bottom:4px">${esc(state.petName)}</h2>
        <p class="muted" style="margin:0">
          is a <b>${esc(hw.pet_personality)}</b> robo pet, inspired by
          <b>${esc(hw.name)}</b>.
        </p>
      </div>
    </div>

    <div class="mission-file" data-gloss>
      <div class="file-header">
        <span class="fh-emoji" aria-hidden="true">${hw.emoji}</span>
        <div>
          <h2 style="margin:0">${esc(hw.name)}</h2>
          <p style="margin:0;font-weight:700;color:#8a5a2a">"${esc(hw.nickname)}"</p>
        </div>
        <div class="file-stamp">${esc(hw.status)}</div>
      </div>

      <p style="font-size:1.1rem;font-weight:700;margin-bottom:14px">${esc(hw.one_liner)}</p>

      <div class="file-rows">
        ${fileRow('Where it is', hw.location_detail)}
        ${fileRow('Launched', hw.launched)}
        ${fileRow('Arrived', hw.arrived)}
        ${fileRow('Mission ended', hw.mission_ended)}
      </div>

      <div class="story-block">
        <h3><span aria-hidden="true">📍</span> Where am I?</h3>
        <p>${esc(hw.where_am_i)}</p>
      </div>

      <div class="story-block">
        <h3><span aria-hidden="true">🛠️</span> What did I do?</h3>
        <p>${esc(hw.what_i_did)}</p>
      </div>

      <div class="story-block">
        <h3><span aria-hidden="true">🔍</span> What did I discover?</h3>
        <p>${esc(hw.what_i_discovered)}</p>
      </div>

      <div class="story-block" style="background:rgba(181,66,47,.12);border-left:5px solid #b5422f">
        <h3><span aria-hidden="true">📡</span> Where am I now?</h3>
        <p>${esc(hw.status_kid)}</p>
      </div>

      <h3 style="margin-top:18px"><span aria-hidden="true">⭐</span> Fun facts</h3>
      <ul class="fact-list">
        ${hw.facts.map((f) => `<li>${esc(f)}</li>`).join('')}
      </ul>
    </div>

    <div class="dyk-card" data-gloss>
      <h3><span aria-hidden="true">💡</span> Did you know?
        ${speakBtn('Did you know? ' + hw.did_you_know, 'Read the did you know card out loud')}
      </h3>
      <p>${esc(hw.did_you_know)}</p>
    </div>

    <div class="btn-row between" style="margin-top:22px">
      <button class="btn btn-ghost" data-goto="build"><span aria-hidden="true">←</span> Back to building</button>
      <button class="btn btn-primary btn-lg" data-goto="create">
        Start my mission <span aria-hidden="true">→</span>
      </button>
    </div>
  `
}
