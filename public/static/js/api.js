/**
 * Thin fetch wrapper around the Hono API.
 *
 * Every call returns the parsed JSON body and throws an Error whose message is
 * already kid-friendly (the server writes the messages, so the same wording
 * appears whether the check ran on the client or the server).
 */

import { state } from './state.js'

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (state.voterKey) headers['x-voter-key'] = state.voterKey

  let res
  try {
    res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  } catch (e) {
    throw new Error('We could not reach the space station. Please check the internet and try again.')
  }

  let json
  try {
    json = await res.json()
  } catch (e) {
    throw new Error('Something went wrong talking to the server. Please try again.')
  }

  if (!res.ok || json.ok === false) {
    throw new Error(json.error || 'Something went wrong. Please try again.')
  }
  return json
}

const qs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

export const api = {
  joinClass: (classCode, nickname) =>
    request('/api/class/join', { method: 'POST', body: JSON.stringify({ classCode, nickname }) }),

  createExhibit: (payload) =>
    request('/api/exhibits', { method: 'POST', body: JSON.stringify(payload) }),

  listExhibits: (params) => request('/api/exhibits?' + qs(params)),

  getExhibit: (id) => request('/api/exhibits/' + encodeURIComponent(id)),

  poll: (classCode) => request('/api/poll?' + qs({ classCode })),

  react: (id, sticker) =>
    request(`/api/exhibits/${encodeURIComponent(id)}/react`, {
      method: 'POST',
      body: JSON.stringify({ sticker }),
    }),

  checkText: (text, maxLength) =>
    request('/api/check-text', { method: 'POST', body: JSON.stringify({ text, maxLength }) }),

  teacherLogin: (classCode, pin) =>
    request('/api/teacher/login', { method: 'POST', body: JSON.stringify({ classCode, pin }) }),

  teacherSettings: (classCode, pin, requireApproval) =>
    request('/api/teacher/settings', {
      method: 'POST',
      body: JSON.stringify({ classCode, pin, requireApproval }),
    }),

  setExhibitStatus: (id, pin, status) =>
    request(`/api/teacher/exhibits/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ pin, status }),
    }),

  deleteExhibit: (id, pin) =>
    request(`/api/teacher/exhibits/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  teacherExport: (classCode, pin) => request('/api/teacher/export?' + qs({ classCode, pin })),
}
