import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronRight, Sparkles, Save, CheckCircle2,
  AlertCircle, BarChart2, Clock, ChevronLeft, Loader2, RefreshCw, Camera
} from 'lucide-react'
import * as api from '../api/client.js'

const LEVEL_INFO = [
  { label: 'Nível 0 – Não Implementado', color: 'text-red-400', bg: 'bg-red-900/30 border-red-800', dot: 'bg-red-500' },
  { label: 'Nível 1 – Parcialmente Implementado', color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-800', dot: 'bg-orange-500' },
  { label: 'Nível 2 – Implementado em alguns casos', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800', dot: 'bg-yellow-500' },
  { label: 'Nível 3 – Implementado na maioria', color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-800', dot: 'bg-blue-500' },
  { label: 'Nível 4 – Implementado em todos os casos', color: 'text-green-400', bg: 'bg-green-900/30 border-green-800', dot: 'bg-green-500' },
]

const IG_BADGE = { 1: 'bg-green-900/50 text-green-400', 2: 'bg-yellow-900/50 text-yellow-400', 3: 'bg-red-900/50 text-red-400' }

function MaturityResult({ answer }) {
  if (answer.ai_level === null || answer.ai_level === undefined) return null
  const info = LEVEL_INFO[answer.ai_level]
  const strengths = answer.ai_strengths ? JSON.parse(answer.ai_strengths) : []
  const improvements = answer.ai_improvements ? JSON.parse(answer.ai_improvements) : []
  return (
    <div className={`mt-4 rounded-xl border p-4 ${info.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${info.dot}`} />
        <span className={`font-semibold text-sm ${info.color}`}>{info.label} ({answer.ai_score}%)</span>
      </div>
      {answer.ai_reasoning && (
        <p className="text-sm text-gray-300 mb-3">{answer.ai_reasoning}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {strengths.length > 0 && (
          <div>
            <p className="text-xs font-medium text-green-400 mb-1">✓ Pontos positivos</p>
            <ul className="space-y-0.5">
              {strengths.map((s, i) => <li key={i} className="text-xs text-gray-400">• {s}</li>)}
            </ul>
          </div>
        )}
        {improvements.length > 0 && (
          <div>
            <p className="text-xs font-medium text-orange-400 mb-1">↑ Melhorias sugeridas</p>
            <ul className="space-y-0.5">
              {improvements.map((s, i) => <li key={i} className="text-xs text-gray-400">• {s}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function SafeguardCard({ safeguard, answer, onSave, onEvaluate, evaluatingId }) {
  const [open, setOpen] = useState(false)
  const [q1, setQ1] = useState(answer?.answer_q1 || '')
  const [q2, setQ2] = useState(answer?.answer_q2 || '')
  const [q3, setQ3] = useState(answer?.answer_q3 || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef(null)

  const hasAnswer = q1.trim() || q2.trim() || q3.trim()
  const isEvaluating = evaluatingId === safeguard.id
  const evaluated = answer?.ai_level !== null && answer?.ai_level !== undefined

  // Auto-save with debounce
  const autoSave = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      if (!q1.trim() && !q2.trim() && !q3.trim()) return
      setSaving(true)
      try {
        await onSave(safeguard.id, q1, q2, q3)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } finally {
        setSaving(false)
      }
    }, 1200)
  }, [q1, q2, q3, safeguard.id, onSave])

  useEffect(() => { autoSave() }, [q1, q2, q3])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Sync with incoming answer
  useEffect(() => {
    setQ1(answer?.answer_q1 || '')
    setQ2(answer?.answer_q2 || '')
    setQ3(answer?.answer_q3 || '')
  }, [answer?.answer_q1, answer?.answer_q2, answer?.answer_q3])

  return (
    <div className={`border rounded-xl transition-colors ${open ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 hover:border-gray-700'}`}>
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-gray-500 shrink-0 w-8">{safeguard.id}</span>
          <span className={`badge shrink-0 ${IG_BADGE[safeguard.ig]}`}>IG{safeguard.ig}</span>
          <span className="text-sm font-medium text-gray-200 truncate">{safeguard.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {evaluated && (
            <div className={`w-2 h-2 rounded-full ${LEVEL_INFO[answer.ai_level].dot}`} title={`Nível ${answer.ai_level}`} />
          )}
          {hasAnswer && !evaluated && (
            <div className="w-2 h-2 rounded-full bg-blue-500" title="Respondido, aguardando avaliação" />
          )}
          {saved && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          {saving && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {[
            { label: 'Pergunta 1 – Abrangência', q: safeguard.questions.q1, val: q1, set: setQ1 },
            { label: 'Pergunta 2 – Execução e Automação', q: safeguard.questions.q2, val: q2, set: setQ2 },
            { label: 'Pergunta 3 – Governança e Métricas', q: safeguard.questions.q3, val: q3, set: setQ3 },
          ].map(({ label, q, val, set }, i) => (
            <div key={i}>
              <label className="block text-xs font-semibold text-blue-400 mb-1">{label}</label>
              <p className="text-xs text-gray-500 mb-2 leading-relaxed">{q}</p>
              <textarea
                className="textarea h-24 text-sm"
                placeholder="Descreva como este aspecto está implementado no seu ambiente..."
                value={val}
                onChange={e => set(e.target.value)}
              />
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <button
              className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3"
              onClick={() => onEvaluate(safeguard.id)}
              disabled={!hasAnswer || isEvaluating}
            >
              {isEvaluating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Avaliando...</>
                : <><Sparkles className="w-3.5 h-3.5" />{evaluated ? 'Reavaliar' : 'Avaliar com IA'}</>
              }
            </button>
            {saving && <span className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Salvando...</span>}
            {saved && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Salvo</span>}
          </div>

          {answer && <MaturityResult answer={answer} />}
        </div>
      )}
    </div>
  )
}

export default function Assessment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState(null)
  const [controls, setControls] = useState([])
  const [answers, setAnswers] = useState({})
  const [activeControl, setActiveControl] = useState(1)
  const [evaluatingId, setEvaluatingId] = useState(null)
  const [bulkEvaluating, setBulkEvaluating] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, ctrl, ans] = await Promise.all([
        api.getAssessment(id),
        api.getControls(),
        api.getAnswers(id),
      ])
      setAssessment(a)
      setControls(ctrl.controls)
      const ansMap = {}
      ans.forEach(a => { ansMap[a.safeguard_id] = a })
      setAnswers(ansMap)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSave = useCallback(async (sgId, q1, q2, q3) => {
    const saved = await api.saveAnswer(id, { safeguard_id: sgId, answer_q1: q1, answer_q2: q2, answer_q3: q3 })
    setAnswers(prev => ({ ...prev, [sgId]: saved }))
    setAssessment(prev => prev ? { ...prev, answered_count: Object.values({ ...prev, [sgId]: saved }).filter(a => a.answer_q1 || a.answer_q2 || a.answer_q3).length } : prev)
  }, [id])

  const handleEvaluate = useCallback(async (sgId) => {
    setEvaluatingId(sgId)
    try {
      const result = await api.evaluateSafeguard(id, sgId)
      setAnswers(prev => ({ ...prev, [sgId]: result }))
    } catch (e) {
      alert(`Erro ao avaliar: ${e.response?.data?.detail || e.message}`)
    } finally {
      setEvaluatingId(null)
    }
  }, [id])

  const handleEvaluateAll = async () => {
    setBulkEvaluating(true)
    try {
      const result = await api.evaluateAll(id)
      await load()
      alert(`Avaliação concluída!\n✅ Avaliados: ${result.evaluated}\n⏭ Ignorados: ${result.skipped}\n❌ Erros: ${result.errors.length}`)
    } catch (e) {
      alert(`Erro: ${e.message}`)
    } finally {
      setBulkEvaluating(false)
    }
  }

  const handleSnapshot = async () => {
    setSnapshotting(true)
    try {
      const label = `Snapshot ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      await api.createSnapshot(id, label)
      alert(`Snapshot "${label}" salvo com sucesso!`)
    } finally {
      setSnapshotting(false)
    }
  }

  const handleFinalize = async () => {
    await api.updateAssessment(id, { status: 'completed' })
    await handleSnapshot()
    navigate(`/assessment/${id}/report`)
  }

  if (loading) return <div className="flex justify-center pt-20"><span className="spinner w-8 h-8" /></div>
  if (error) return <div className="card text-red-400 flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>

  const currentControl = controls.find(c => c.id === activeControl)
  const totalAnswered = Object.values(answers).filter(a => a.answer_q1 || a.answer_q2 || a.answer_q3).length
  const totalEvaluated = Object.values(answers).filter(a => a.ai_level !== null && a.ai_level !== undefined).length
  const overallPct = Math.round((totalAnswered / 153) * 100)

  return (
    <div className="max-w-7xl mx-auto fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-sm">
            <ChevronLeft className="w-4 h-4" />Voltar
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{assessment?.name}</h1>
            {assessment?.organization && <p className="text-sm text-gray-400">{assessment.organization}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleEvaluateAll} disabled={bulkEvaluating || totalAnswered === 0}
            className="btn-secondary flex items-center gap-2 text-sm">
            {bulkEvaluating ? <><Loader2 className="w-4 h-4 animate-spin" />Avaliando...</> : <><Sparkles className="w-4 h-4" />Avaliar Tudo com IA</>}
          </button>
          <button onClick={handleSnapshot} disabled={snapshotting}
            className="btn-secondary flex items-center gap-2 text-sm">
            {snapshotting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Snapshot
          </button>
          {totalEvaluated > 0 && (
            <button onClick={() => navigate(`/assessment/${id}/report`)} className="btn-secondary flex items-center gap-2 text-sm">
              <BarChart2 className="w-4 h-4" />Ver Relatório
            </button>
          )}
          <button onClick={handleFinalize} className="btn-primary flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4" />Finalizar
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="card mb-6 py-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">Progresso Geral</span>
          <span className="text-white font-medium">{totalAnswered}/153 respondidos · {totalEvaluated}/153 avaliados</span>
        </div>
        <div className="flex gap-1 h-2">
          <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${(totalEvaluated / 153) * 100}%` }} />
          <div className="bg-blue-500 transition-all" style={{ width: `${((totalAnswered - totalEvaluated) / 153) * 100}%` }} />
          <div className="bg-gray-800 flex-1 rounded-r-full" />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />Avaliados por IA</span>
          <span><span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1" />Respondidos</span>
          <span><span className="inline-block w-2 h-2 bg-gray-700 rounded-full mr-1" />Pendentes</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar – controls list */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <div className="card p-3 sticky top-6">
            <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">CIS Controls</p>
            <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
              {controls.map(ctrl => {
                const sgIds = ctrl.safeguards.map(s => s.id)
                const answered = sgIds.filter(sid => {
                  const a = answers[sid]
                  return a && (a.answer_q1 || a.answer_q2 || a.answer_q3)
                }).length
                const evaluated = sgIds.filter(sid => {
                  const a = answers[sid]
                  return a && a.ai_level !== null && a.ai_level !== undefined
                }).length
                const pct = Math.round((answered / ctrl.safeguards.length) * 100)
                const isActive = activeControl === ctrl.id

                return (
                  <button
                    key={ctrl.id}
                    onClick={() => setActiveControl(ctrl.id)}
                    className={`w-full text-left px-2 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">CIS {ctrl.id}</span>
                      <span className="text-xs opacity-70">{answered}/{ctrl.safeguards.length}</span>
                    </div>
                    <p className="text-xs leading-tight opacity-80 mb-1.5 line-clamp-2">{ctrl.name}</p>
                    <div className={`h-1 rounded-full ${isActive ? 'bg-blue-400/30' : 'bg-gray-800'}`}>
                      <div className={`h-1 rounded-full transition-all ${isActive ? 'bg-white' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {currentControl && (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-blue-900/50 text-blue-400 border border-blue-800">CIS Control {currentControl.id}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{currentControl.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{currentControl.safeguards.length} safeguards</p>
              </div>

              {/* Mobile: control selector */}
              <div className="lg:hidden mb-4">
                <select
                  className="input"
                  value={activeControl}
                  onChange={e => setActiveControl(Number(e.target.value))}
                >
                  {controls.map(c => <option key={c.id} value={c.id}>CIS {c.id}: {c.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                {currentControl.safeguards.map(sg => (
                  <SafeguardCard
                    key={sg.id}
                    safeguard={sg}
                    answer={answers[sg.id] || null}
                    onSave={handleSave}
                    onEvaluate={handleEvaluate}
                    evaluatingId={evaluatingId}
                  />
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                {activeControl > 1 && (
                  <button className="btn-secondary flex items-center gap-2" onClick={() => setActiveControl(a => a - 1)}>
                    <ChevronLeft className="w-4 h-4" />Controle anterior
                  </button>
                )}
                {activeControl < 18 && (
                  <button className="btn-primary flex items-center gap-2 ml-auto" onClick={() => setActiveControl(a => a + 1)}>
                    Próximo controle<ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
