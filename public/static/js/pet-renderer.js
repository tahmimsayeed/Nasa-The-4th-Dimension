/**
 * Robo Pet renderer.
 *
 * Draws a kid's robo pet as inline SVG from a plain config object:
 *   { base, body, mover, color, antenna, tool, eyes }
 *
 * Everything is vector so it scales crisply from a 90px gallery thumbnail up to
 * a printed trading card, and it costs no network requests - important on
 * school wifi. Exposed as window.RoboPet so both the game and the gallery use
 * the exact same drawing code.
 */
(function () {
  'use strict'

  const SVG_NS = 'http://www.w3.org/2000/svg'

  /** Lighten/darken a hex colour so each pet gets shading for free. */
  function shade(hex, amount) {
    const h = (hex || '#cccccc').replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const num = parseInt(full, 16)
    let r = (num >> 16) & 255
    let g = (num >> 8) & 255
    let b = num & 255
    r = Math.max(0, Math.min(255, Math.round(r + 255 * amount)))
    g = Math.max(0, Math.min(255, Math.round(g + 255 * amount)))
    b = Math.max(0, Math.min(255, Math.round(b + 255 * amount)))
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  }

  /** Pick near-black or near-white text/outline so it stays readable on any body colour. */
  function contrastInk(hex) {
    const h = (hex || '#cccccc').replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const num = parseInt(full, 16)
    const r = (num >> 16) & 255
    const g = (num >> 8) & 255
    const b = num & 255
    // Relative luminance (sRGB approximation).
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.6 ? '#1b2238' : '#ffffff'
  }

  /* ---------------- body shapes ---------------- */

  function bodyPath(body) {
    switch (body) {
      case 'round':
        return `<ellipse cx="100" cy="92" rx="48" ry="40" />`
      case 'tall':
        return `<rect x="62" y="40" width="76" height="92" rx="16" />`
      case 'flat':
        return `<rect x="46" y="76" width="108" height="46" rx="14" />`
      case 'boxy':
      default:
        return `<rect x="56" y="58" width="88" height="72" rx="12" />`
    }
  }

  /** Where the body's top edge sits - used to place antennas and tools. */
  function bodyTop(body) {
    return { round: 52, tall: 40, flat: 76, boxy: 58 }[body] ?? 58
  }

  /** Where the body's bottom edge sits - used to place wheels and legs. */
  function bodyBottom(body) {
    return { round: 132, tall: 132, flat: 122, boxy: 130 }[body] ?? 130
  }

  /* ---------------- movers (wheels / legs / rotors) ---------------- */

  function moverSvg(mover, body, color, ink) {
    const y = bodyBottom(body)
    const dark = shade(color, -0.45)
    const rim = shade(color, 0.25)

    const wheel = (cx, r) => `
      <g class="rp-wheel">
        <circle cx="${cx}" cy="${y + r - 4}" r="${r}" fill="#2a3047" stroke="${dark}" stroke-width="3"/>
        <circle cx="${cx}" cy="${y + r - 4}" r="${r * 0.42}" fill="${rim}"/>
        <circle cx="${cx}" cy="${y + r - 4}" r="${r * 0.16}" fill="${dark}"/>
      </g>`

    switch (mover) {
      case 'wheels4':
        return wheel(62, 20) + wheel(138, 20)
      case 'tracks':
        return `
          <g class="rp-tracks">
            <rect x="42" y="${y - 6}" width="116" height="30" rx="15" fill="#2a3047" stroke="${dark}" stroke-width="3"/>
            <circle cx="60" cy="${y + 9}" r="9" fill="${rim}"/>
            <circle cx="100" cy="${y + 9}" r="7" fill="${rim}"/>
            <circle cx="140" cy="${y + 9}" r="9" fill="${rim}"/>
            ${[52, 68, 84, 100, 116, 132, 148]
              .map((x) => `<rect x="${x - 2}" y="${y - 4}" width="4" height="26" rx="2" fill="${dark}" opacity="0.5"/>`)
              .join('')}
          </g>`
      case 'legs':
        return `
          <g class="rp-legs" stroke="${shade(color, -0.3)}" stroke-width="9" stroke-linecap="round" fill="none">
            <path d="M72 ${y - 4} L54 ${y + 16} L44 ${y + 34}"/>
            <path d="M100 ${y - 4} L100 ${y + 20} L100 ${y + 34}"/>
            <path d="M128 ${y - 4} L146 ${y + 16} L156 ${y + 34}"/>
          </g>
          <g fill="${shade(color, -0.5)}">
            <rect x="34" y="${y + 30}" width="22" height="8" rx="4"/>
            <rect x="89" y="${y + 30}" width="22" height="8" rx="4"/>
            <rect x="146" y="${y + 30}" width="22" height="8" rx="4"/>
          </g>`
      case 'rotors':
        return `
          <g class="rp-landing" stroke="${shade(color, -0.3)}" stroke-width="7" stroke-linecap="round" fill="none">
            <path d="M74 ${y - 6} L62 ${y + 26}"/>
            <path d="M126 ${y - 6} L138 ${y + 26}"/>
            <path d="M50 ${y + 26} L150 ${y + 26}"/>
          </g>`
      case 'thrusters':
        return `
          <g class="rp-thrusters">
            <rect x="72" y="${y - 6}" width="22" height="26" rx="6" fill="${shade(color, -0.35)}"/>
            <rect x="106" y="${y - 6}" width="22" height="26" rx="6" fill="${shade(color, -0.35)}"/>
            <g class="rp-flame">
              <path d="M83 ${y + 20} q8 16 0 30 q-8 -14 0 -30" fill="#ffb03a"/>
              <path d="M117 ${y + 20} q8 16 0 30 q-8 -14 0 -30" fill="#ffb03a"/>
              <path d="M83 ${y + 22} q4 11 0 20 q-4 -9 0 -20" fill="#fff0b3"/>
              <path d="M117 ${y + 22} q4 11 0 20 q-4 -9 0 -20" fill="#fff0b3"/>
            </g>
          </g>`
      case 'wheels6':
      default:
        return wheel(56, 16) + wheel(100, 16) + wheel(144, 16)
    }
  }

  /** Spinning rotor blades drawn ABOVE the body (so they overlap nicely). */
  function rotorTopSvg(mover, body, color) {
    if (mover !== 'rotors') return ''
    const top = bodyTop(body)
    const dark = shade(color, -0.4)
    return `
      <g class="rp-rotor-group">
        <rect x="97" y="${top - 26}" width="6" height="28" rx="3" fill="${dark}"/>
        <g class="rp-rotor" transform="translate(100 ${top - 26})">
          <ellipse cx="0" cy="0" rx="62" ry="5" fill="${shade(color, 0.3)}" opacity="0.95"/>
          <ellipse cx="0" cy="0" rx="62" ry="5" fill="${shade(color, 0.3)}" opacity="0.6" transform="rotate(90)"/>
          <circle cx="0" cy="0" r="7" fill="${dark}"/>
        </g>
      </g>`
  }

  /* ---------------- antennas ---------------- */

  function antennaSvg(antenna, body, color) {
    const top = bodyTop(body)
    const metal = shade(color, -0.25)
    const light = shade(color, 0.35)

    switch (antenna) {
      case 'dish':
        return `
          <g class="rp-antenna">
            <rect x="96" y="${top - 20}" width="8" height="22" rx="4" fill="${metal}"/>
            <g transform="translate(100 ${top - 28}) rotate(-18)">
              <ellipse cx="0" cy="0" rx="26" ry="14" fill="${light}" stroke="${metal}" stroke-width="3"/>
              <ellipse cx="0" cy="0" rx="14" ry="7" fill="${shade(color, -0.1)}" opacity="0.6"/>
              <circle cx="0" cy="0" r="4" fill="${metal}"/>
            </g>
            <g class="rp-signal" opacity="0">
              <path d="M126 ${top - 44} a18 18 0 0 1 0 24" fill="none" stroke="#7ee0ff" stroke-width="3" stroke-linecap="round"/>
              <path d="M134 ${top - 50} a26 26 0 0 1 0 36" fill="none" stroke="#7ee0ff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
            </g>
          </g>`
      case 'whip':
        return `
          <g class="rp-antenna">
            <path d="M100 ${top} q4 -26 16 -38" fill="none" stroke="${metal}" stroke-width="4" stroke-linecap="round"/>
            <circle class="rp-blink" cx="116" cy="${top - 38}" r="6" fill="#ff6b6b"/>
          </g>`
      case 'double':
        return `
          <g class="rp-antenna">
            <path d="M80 ${top} q-10 -22 -4 -34" fill="none" stroke="${metal}" stroke-width="4" stroke-linecap="round"/>
            <path d="M120 ${top} q10 -22 4 -34" fill="none" stroke="${metal}" stroke-width="4" stroke-linecap="round"/>
            <circle class="rp-blink" cx="76" cy="${top - 36}" r="6" fill="#ffd166"/>
            <circle class="rp-blink rp-blink-2" cx="124" cy="${top - 36}" r="6" fill="#ffd166"/>
          </g>`
      case 'none':
      default:
        return ''
    }
  }

  /* ---------------- tools ---------------- */

  function toolSvg(tool, body, color) {
    const top = bodyTop(body)
    const bottom = bodyBottom(body)
    const metal = shade(color, -0.3)
    const light = shade(color, 0.3)

    switch (tool) {
      case 'arm':
        return `
          <g class="rp-tool rp-arm" stroke="${metal}" stroke-width="7" stroke-linecap="round" fill="none">
            <path d="M144 ${top + 22} L172 ${top + 30} L178 ${top + 54}"/>
          </g>
          <g fill="${light}" stroke="${metal}" stroke-width="2">
            <path d="M172 ${top + 54} l12 0 l0 7 l-12 0 z"/>
            <path d="M172 ${top + 62} l12 0 l0 7 l-12 0 z"/>
          </g>`
      case 'drill':
        return `
          <g class="rp-tool">
            <rect x="150" y="${bottom - 34}" width="26" height="12" rx="4" fill="${metal}"/>
            <g class="rp-drill-bit">
              <path d="M176 ${bottom - 34} l22 6 l-22 6 z" fill="${light}" stroke="${metal}" stroke-width="2"/>
            </g>
          </g>`
      case 'camera':
        return `
          <g class="rp-tool">
            <rect x="96" y="${top - 16}" width="8" height="18" fill="${metal}"/>
            <rect x="78" y="${top - 34}" width="44" height="22" rx="7" fill="${light}" stroke="${metal}" stroke-width="3"/>
            <circle cx="90" cy="${top - 23}" r="6" fill="#1b2238"/>
            <circle cx="110" cy="${top - 23}" r="6" fill="#1b2238"/>
            <circle class="rp-lens-glint" cx="88" cy="${top - 25}" r="2" fill="#ffffff"/>
          </g>`
      case 'scoop':
        return `
          <g class="rp-tool">
            <path d="M46 ${bottom - 30} L22 ${bottom - 16}" stroke="${metal}" stroke-width="6" stroke-linecap="round"/>
            <path d="M24 ${bottom - 22} q-14 10 -2 20 q14 2 16 -12 z" fill="${light}" stroke="${metal}" stroke-width="2"/>
          </g>`
      case 'lab':
        return `
          <g class="rp-tool">
            <rect x="118" y="${top - 22}" width="20" height="24" rx="5" fill="${light}" stroke="${metal}" stroke-width="3"/>
            <rect x="122" y="${top - 12}" width="12" height="12" rx="2" fill="#7ee0ff" opacity="0.85"/>
            <g class="rp-bubbles" fill="#ffffff" opacity="0.9">
              <circle cx="126" cy="${top - 8}" r="2"/>
              <circle cx="131" cy="${top - 4}" r="1.5"/>
            </g>
          </g>`
      default:
        return ''
    }
  }

  /* ---------------- eyes ---------------- */

  function eyesSvg(eyes, body, color) {
    // Face sits in the middle of whichever body shape was chosen.
    const cy = { round: 88, tall: 74, flat: 96, boxy: 88 }[body] ?? 88
    const ink = '#1b2238'
    const white = '#ffffff'

    switch (eyes) {
      case 'big':
        return `
          <g class="rp-eyes">
            <circle cx="84" cy="${cy}" r="15" fill="${white}" stroke="${ink}" stroke-width="2"/>
            <circle cx="116" cy="${cy}" r="15" fill="${white}" stroke="${ink}" stroke-width="2"/>
            <circle class="rp-pupil" cx="84" cy="${cy}" r="7" fill="${ink}"/>
            <circle class="rp-pupil" cx="116" cy="${cy}" r="7" fill="${ink}"/>
            <circle cx="87" cy="${cy - 4}" r="2.5" fill="${white}"/>
            <circle cx="119" cy="${cy - 4}" r="2.5" fill="${white}"/>
          </g>`
      case 'sleepy':
        return `
          <g class="rp-eyes" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none">
            <path d="M72 ${cy} q12 9 24 0"/>
            <path d="M104 ${cy} q12 9 24 0"/>
          </g>
          <text x="140" y="${cy - 14}" font-size="16" fill="${white}" opacity="0.85" font-family="system-ui">z</text>`
      case 'visor':
        return `
          <g class="rp-eyes">
            <rect x="68" y="${cy - 13}" width="64" height="26" rx="13" fill="#1b2238" stroke="${shade(color, -0.3)}" stroke-width="3"/>
            <rect class="rp-visor-shine" x="74" y="${cy - 8}" width="18" height="8" rx="4" fill="#7ee0ff" opacity="0.9"/>
            <rect x="100" y="${cy - 8}" width="26" height="8" rx="4" fill="#7ee0ff" opacity="0.35"/>
          </g>`
      case 'one':
        return `
          <g class="rp-eyes">
            <circle cx="100" cy="${cy}" r="20" fill="${white}" stroke="${ink}" stroke-width="3"/>
            <circle class="rp-pupil" cx="100" cy="${cy}" r="10" fill="#2f7ae0"/>
            <circle cx="100" cy="${cy}" r="5" fill="${ink}"/>
            <circle cx="104" cy="${cy - 6}" r="3" fill="${white}"/>
          </g>`
      case 'star':
        return `
          <g class="rp-eyes rp-star-eyes" fill="#ffd166" stroke="${ink}" stroke-width="1.5">
            <path d="M84 ${cy - 13} l4 9 l10 1 l-7 7 l2 10 l-9 -5 l-9 5 l2 -10 l-7 -7 l10 -1 z"/>
            <path d="M116 ${cy - 13} l4 9 l10 1 l-7 7 l2 10 l-9 -5 l-9 5 l2 -10 l-7 -7 l10 -1 z"/>
          </g>`
      case 'happy':
      default:
        return `
          <g class="rp-eyes">
            <circle cx="85" cy="${cy - 2}" r="11" fill="${white}" stroke="${ink}" stroke-width="2"/>
            <circle cx="115" cy="${cy - 2}" r="11" fill="${white}" stroke="${ink}" stroke-width="2"/>
            <circle class="rp-pupil" cx="85" cy="${cy - 1}" r="5" fill="${ink}"/>
            <circle class="rp-pupil" cx="115" cy="${cy - 1}" r="5" fill="${ink}"/>
            <path d="M88 ${cy + 15} q12 10 24 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
          </g>`
    }
  }

  /* ---------------- solar panels (for the probe/rover look) ---------------- */

  function panelSvg(base, body, color) {
    // Voyager-style probes and rovers get little solar wings for flavour.
    if (base !== 'probe' && base !== 'rover6' && base !== 'rover4') return ''
    const cy = { round: 92, tall: 86, flat: 98, boxy: 92 }[body] ?? 92
    const edge = shade(color, -0.4)
    const panel = '#2d4a86'
    const cell = '#5b84d6'
    const w = 34
    return `
      <g class="rp-panels">
        <rect x="${56 - w - 6}" y="${cy - 14}" width="${w}" height="28" rx="4" fill="${panel}" stroke="${edge}" stroke-width="2"/>
        <rect x="${144 + 6}" y="${cy - 14}" width="${w}" height="28" rx="4" fill="${panel}" stroke="${edge}" stroke-width="2"/>
        ${[0, 1, 2]
          .map(
            (i) =>
              `<rect x="${56 - w - 2 + i * 10}" y="${cy - 10}" width="7" height="20" rx="2" fill="${cell}" opacity="0.8"/>` +
              `<rect x="${144 + 10 + i * 10}" y="${cy - 10}" width="7" height="20" rx="2" fill="${cell}" opacity="0.8"/>`
          )
          .join('')}
      </g>`
  }

  /* ---------------- main ---------------- */

  const DEFAULTS = {
    base: 'rover6',
    body: 'boxy',
    mover: 'wheels6',
    color: '#e05c3f',
    antenna: 'dish',
    tool: 'camera',
    eyes: 'happy',
  }

  /**
   * Build the SVG markup for a pet.
   * @param {object} cfg  pet config (missing keys fall back to defaults)
   * @param {object} opts { size, animate, showGround, ariaLabel }
   */
  function svg(cfg, opts) {
    const c = Object.assign({}, DEFAULTS, cfg || {})
    const o = Object.assign({ size: 200, animate: true, showGround: false, ariaLabel: '' }, opts || {})
    const color = c.color || DEFAULTS.color
    const ink = contrastInk(color)
    const body = c.body
    const bodyFill = `url(#rpg-${o.gradId || 'main'})`

    const ground = o.showGround
      ? `<ellipse cx="100" cy="186" rx="76" ry="9" fill="#000" opacity="0.22"/>`
      : ''

    const label =
      o.ariaLabel ||
      `A space robot pet with a ${body} body, ${String(c.mover).replace(/\d+/g, ' ')} and ${c.eyes} eyes.`

    return `
<svg class="robo-pet ${o.animate ? 'rp-animate' : ''}" viewBox="0 0 200 200"
     width="${o.size}" height="${o.size}" role="img" aria-label="${escapeAttr(label)}"
     xmlns="${SVG_NS}">
  <defs>
    <linearGradient id="rpg-${o.gradId || 'main'}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${shade(color, 0.22)}"/>
      <stop offset="60%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${shade(color, -0.2)}"/>
    </linearGradient>
  </defs>
  ${ground}
  ${panelSvg(c.base, body, color)}
  ${rotorTopSvg(c.mover, body, color)}
  ${antennaSvg(c.antenna, body, color)}
  ${moverSvg(c.mover, body, color, ink)}
  <g class="rp-body" fill="${bodyFill}" stroke="${shade(color, -0.45)}" stroke-width="3">
    ${bodyPath(body)}
  </g>
  ${toolSvg(c.tool, body, color)}
  ${eyesSvg(c.eyes, body, color)}
</svg>`
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  }

  /** Render into a container element. */
  function render(el, cfg, opts) {
    if (!el) return
    el.innerHTML = svg(cfg, opts)
  }

  /**
   * Rasterise a pet to a PNG data URL (used for trading cards and postcards
   * that kids download). Resolves to null if the browser blocks it.
   */
  function toPng(cfg, size) {
    return new Promise((resolve) => {
      try {
        const markup = svg(cfg, { size: size || 400, animate: false, showGround: true })
        const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = function () {
          const canvas = document.createElement('canvas')
          canvas.width = size || 400
          canvas.height = size || 400
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          try {
            resolve(canvas.toDataURL('image/png'))
          } catch (e) {
            resolve(null)
          }
        }
        img.onerror = function () {
          URL.revokeObjectURL(url)
          resolve(null)
        }
        img.src = url
      } catch (e) {
        resolve(null)
      }
    })
  }

  window.RoboPet = { svg, render, toPng, shade, contrastInk, DEFAULTS }
})()
