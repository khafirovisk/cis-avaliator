import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine, CartesianGrid
} from 'recharts'
import { BarChart2, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  ArrowLeft, Camera, Clock, Shield } from 'lucide-react'
import * as api from '../api/client.js'

const SCORE_COLOR = (s) => {
  if (s === null || s === undefined) return '#4b5563'
  if (s === 0)  return '#ef4444'
  if (s <= 25)  return '#f97316'
  if (s <= 50)  return '#eab308'
  if (s <= 75)  return '#3b82f6'
  return '#22c55e'
}

const LEVEL_LABEL = ['Não Implementado', 'Parcialmente', 'Em alguns casos', 'Na maioria', 'Em todos os casos']

function ScoreGauge({ score }) {
  const pct = score ?? 0
  const color = SCORE_COLOR(pct)
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (pct / 100) * circumference
  const level = Math.round(pct / 25)

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="#1f2937" strokeWidth="12" />
        <circle
          cx="70" cy="70" r="54" fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">{pct}%</text>
        <text x="70" y="85" textAnchor="middle" fill="#9ca3af" fontSize="11">Maturidade</text>
      </svg>
      <p className="text-sm font-medium mt-1" style={{ color }}>{LEVEL_LABEL[Math.min(level, 4)]}</p>
    </div>
  )
}

function ControlCard({ control }) {
  const [open, setOpen] = useState(false)
  const score = control.avg_score
  const color = SCORE_COLOR(score)

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + '20', border: `1px solid ${color}40` }}>
          <span className="text-sm font-bold" style={{ color }}>{control.id}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-white truncate">{control.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{control.evaluated_count}/{control.total_count} avaliados</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {score !== null ? (
            <div className="text-right">
              <p className="font-bold text-lg" style={{ color }}>{score}%</p>
              <p className="text-xs text-gray-500">Nível {control.avg_level?.toFixed(1) ?? '-'}</p>
            </div>
          ) : (
            <span className="text-sm text-gray-600">N/A</span>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1 bg-gray-800 rounded-full">
          <div className="h-1 rounded-full transition-all" style={{ width: `${score ?? 0}%`, backgroundColor: color }} />
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 mt-2">
          <div className="space-y-1.5">
            {control.safeguards.map(sg => (
              <div key={sg.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-gray-800/40">
                <span className="text-xs font-mono text-gray-600 w-8 shrink-0">{sg.id}</span>
                <span className="text-xs text-gray-400 flex-1 truncate">{sg.name}</span>
                {sg.evaluated ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="h-1.5 w-20 bg-gray-700 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: `${sg.score}%`, backgroundColor: SCORE_COLOR(sg.score) }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right" style={{ color: SCORE_COLOR(sg.score) }}>{sg.score}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-600 shrink-0">Não avaliado</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm">
      <p className="font-medium text-white mb-1">CIS {label}</p>
      <p style={{ color: SCORE_COLOR(payload[0].value) }}>{payload[0].value?.toFixed(0) ?? 'N/A'}%</p>
    </div>
  )
}

export default function Report() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [snapshotting, setSnapshotting] = useState(false)

  useEffect(() => {
    api.getReport(id)
      .then(setReport)
      .finally(() => setLoading(false))
  }, [id])

  const handleSnapshot = async () => {
    setSnapshotting(true)
    const label = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    await api.createSnapshot(id, label)
    setSnapshotting(false)
    alert(`Snapshot "${label}" salvo!`)
  }

  if (loading) return <div className="flex justify-center pt-20"><span className="spinner w-8 h-8" /></div>
  if (!report) return null

  const radarData = report.controls.map(c => ({
    subject: `CIS ${c.id}`, fullMark: 100,
    score: c.avg_score ?? 0,
  }))

  const barData = report.controls.map(c => ({
    name: `${c.id}`,
    score: c.avg_score ?? null,
    label: c.name
  }))

  return (
    <div className="max-w-6xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/assessment/${id}`)} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" />Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Relatório de Maturidade</h1>
            <p className="text-gray-400 text-sm">{report.assessment.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSnapshot} disabled={snapshotting}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Camera className="w-4 h-4" />{snapshotting ? 'Salvando...' : 'Salvar Snapshot'}
          </button>
          <button onClick={() => navigate(`/assessment/${id}/timeline`)}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />Timeline
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card flex flex-col items-center justify-center py-6">
          <ScoreGauge score={report.overall_score} />
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400">Nível médio geral</p>
            <p className="text-3xl font-bold text-white mt-1">{report.overall_level?.toFixed(1) ?? '-'}<span className="text-gray-500 text-base">/4.0</span></p>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-300 mb-4 text-sm uppercase tracking-wide">Distribuição por Controle</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={SCORE_COLOR(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar + Stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="font-semibold text-gray-300 mb-4 text-sm uppercase tracking-wide">Radar de Maturidade</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Radar name="Maturidade" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wide">Resumo Executivo</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Safeguards avaliados', value: report.evaluated_count, total: report.total_safeguards, color: 'text-blue-400' },
              { label: 'Cobertura', value: `${Math.round((report.evaluated_count / report.total_safeguards) * 100)}%`, color: 'text-green-400' },
              { label: 'Maturidade geral', value: `${report.overall_score?.toFixed(0) ?? '-'}%`, color: 'text-purple-400' },
              { label: 'Nível médio', value: `${report.overall_level?.toFixed(1) ?? '-'}/4.0`, color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800/50 rounded-lg p-3">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                {s.total && <p className="text-xs text-gray-500">de {s.total}</p>}
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Top Risks */}
          {report.top_risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />Top Riscos (menor maturidade)
              </p>
              {report.top_risks.slice(0, 3).map(sg => (
                <div key={sg.id} className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-xs font-mono text-gray-600 w-8">{sg.id}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate">{sg.name}</span>
                  <span className="text-xs font-bold" style={{ color: SCORE_COLOR(sg.score) }}>{sg.score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls detail */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Detalhe por Controle</h2>
        <div className="space-y-3">
          {report.controls.map(ctrl => (
            <ControlCard key={ctrl.id} control={ctrl} />
          ))}
        </div>
      </div>
    </div>
  )
}
