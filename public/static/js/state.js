/**
 * App state + localStorage persistence.
 *
 * Only non-personal data is ever stored: a nickname the kid invented, a class
 * code, their robot's look, and their own creative work in progress. There is
 * no user id, no tracking, and nothing is written to the server until the kid
 * presses "Share".
 */

const KEY = 'robopet.v1'

export const state = {
  screen: 'welcome',
  params: {},

  // identity (nickname only - never a real name)
  nickname: '',
  classCode: '',
  requireApproval: false,

  // the robot
  hardwareId: '',
  pet: {
    base: 'rover6',
    body: 'boxy',
    mover: 'wheels6',
    color: '#e05c3f',
    antenna: 'dish',
    tool: 'camera',
    eyes: 'happy',
  },
  petName: '',

  // creative mission in progress
  taskType: '', // 'postcard' | 'decision'
  draft: {
    inputMode: 'type', // 'type' | 'draw' | 'voice'
    postcardText: '',
    drawingData: null,
    audioData: null,
    usedFacts: [], // indexes of mission facts the kid inserted
    decision: '',
    reasons: ['', ''],
    risk: '',
  },

  // after submitting
  submittedId: '',
  cardUnlocked: false,

  // accessibility preferences
  a11y: {
    bigText: false,
    highContrast: false,
  },

  // teacher session (pin kept in memory + session storage only)
  teacherPin: '',

  // anonymous key used only to stop one device spamming sticker reactions
  voterKey: '',
}

/** Fields that are safe and useful to persist between page loads. */
const PERSIST = [
  'screen', 'nickname', 'classCode', 'requireApproval', 'hardwareId', 'pet',
  'petName', 'taskType', 'draft', 'submittedId', 'cardUnlocked', 'a11y', 'voterKey',
]

export function saveState() {
  try {
    const out = {}
    for (const k of PERSIST) out[k] = state[k]
    localStorage.setItem(KEY, JSON.stringify(out))
  } catch (e) {
    // Private browsing or a full quota - the app still works, just without resume.
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      for (const k of PERSIST) {
        if (saved[k] !== undefined && saved[k] !== null) {
          if (typeof state[k] === 'object' && !Array.isArray(state[k])) {
            Object.assign(state[k], saved[k])
          } else {
            state[k] = saved[k]
          }
        }
      }
    }
  } catch (e) {
    /* ignore corrupt storage */
  }

  if (!state.voterKey) {
    state.voterKey = 'v' + Math.random().toString(36).slice(2, 12)
    saveState()
  }
  // Teacher pin lives in sessionStorage so it disappears when the tab closes.
  try {
    state.teacherPin = sessionStorage.getItem('robopet.pin') || ''
  } catch (e) { /* ignore */ }
}

export function setTeacherPin(pin) {
  state.teacherPin = pin
  try {
    sessionStorage.setItem('robopet.pin', pin)
  } catch (e) { /* ignore */ }
}

/** Clear the current creation but keep identity + preferences. */
export function resetProgress() {
  state.hardwareId = ''
  state.petName = ''
  state.taskType = ''
  state.submittedId = ''
  state.cardUnlocked = false
  state.pet = {
    base: 'rover6', body: 'boxy', mover: 'wheels6', color: '#e05c3f',
    antenna: 'dish', tool: 'camera', eyes: 'happy',
  }
  state.draft = {
    inputMode: 'type', postcardText: '', drawingData: null, audioData: null,
    usedFacts: [], decision: '', reasons: ['', ''], risk: '',
  }
  saveState()
}
