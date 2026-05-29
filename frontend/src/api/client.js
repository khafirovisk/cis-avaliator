import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Assessments ───────────────────────────────────────────────────────────────
export const listAssessments = () => api.get('/assessments').then(r => r.data)
export const createAssessment = (data) => api.post('/assessments', data).then(r => r.data)
export const getAssessment = (id) => api.get(`/assessments/${id}`).then(r => r.data)
export const updateAssessment = (id, data) => api.put(`/assessments/${id}`, data).then(r => r.data)
export const deleteAssessment = (id) => api.delete(`/assessments/${id}`).then(r => r.data)

// ── Answers ───────────────────────────────────────────────────────────────────
export const getAnswers = (id) => api.get(`/assessments/${id}/answers`).then(r => r.data)
export const saveAnswer = (id, data) => api.post(`/assessments/${id}/answers`, data).then(r => r.data)

// ── AI Evaluation ─────────────────────────────────────────────────────────────
export const evaluateSafeguard = (id, sgId) =>
  api.post(`/assessments/${id}/evaluate/${sgId}`).then(r => r.data)
export const evaluateAll = (id) =>
  api.post(`/assessments/${id}/evaluate-all`).then(r => r.data)

// ── Report & Timeline ─────────────────────────────────────────────────────────
export const getReport = (id) => api.get(`/assessments/${id}/report`).then(r => r.data)
export const createSnapshot = (id, label) =>
  api.post(`/assessments/${id}/snapshot`, null, { params: { label } }).then(r => r.data)
export const getTimeline = (id) => api.get(`/assessments/${id}/timeline`).then(r => r.data)

// ── Controls ──────────────────────────────────────────────────────────────────
export const getControls = () => api.get('/controls').then(r => r.data)

// ── Config ────────────────────────────────────────────────────────────────────
export const getConfig = () => api.get('/config').then(r => r.data)
export const updateConfig = (data) => api.put('/config', data).then(r => r.data)
export const testConnection = (data) => api.post('/config/test', data).then(r => r.data)
