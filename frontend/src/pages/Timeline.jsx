import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { ArrowLeft, Camera, Clock, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import * as api from '../api/client.js'

const CONTROL_COLORS = [
  '#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#6366f1','#a78bfa','#34d399','#fbbf24','#fb923c',
  '#e879f9','#67e8f9','#a3e635',
]

const SCORE_COLOR = (s) => {
  if (s === null || s === undefined) return '#4b5563'
  if (s === 0)  return '#ef4444'
  if (s <= 25)  return '#f97316'
  if (s <= 50)  return '#eab308'
  if (s <= 75)  return '#3b82f6'
  return '#22c55e'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs max-w-xs shadow-xl">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload
        .filter(p => p.value !== null && p.value !== undefined)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map((p, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-gray-400 flex-1 truncate">{p.name}</span>
            <span className="font-bold" style={{ color: p.color }}>{p.value?.toFixed(0)}%</span>
          </div>
        ))}
    </div>
  )
}

function DeltaBadge({ current, previous }) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null
  const delta = current - previous
  if (Math.abs(delta) < 0.5) return <span className="text-gray-500 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>
  if (delta > 0) return <span className="text-green-400 text-xs flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{delta.toFixed(0)}%</span>
  return <span className="text-red-400 text-xs flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{delta.toFixed(0)}%</span>
}

export default function Timeline() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState(null)
  const [selectedControls, setSelectedControls] = useState(new Set([1,2,3,4,5]))
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    Promise.all([api.getAssessment(id), api.getTimeline(id)])
      .then(([a, snaps]) => {
        setAssessment(a)
        setSnapshots(snaps)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center pt-20"><span className="spinner w-8 h-8" /></div>

  if (snapshots.length === 0) {
    return (
      <div className="max-w-4xl mx-auto fade-in">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(`/assessment/${id}/report`)} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" />Voltar
          </button>
          <h1 className="text-2xl font-bold text-white">Timeline de Evolução</h1>
        </div>
        <div className="card text-center py-16">
          <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">Nenhum snapshot salvo</h3>
          <p className="text-gray-600 text-sm mb-6">
            Salve snapshots periódicos da avaliação para visualizar a evolução da maturidade ao longo do tempo.
          </p>
          <button
            onClick={() => navigate(`/assessment/${id}/report`)}
            className="btn-primary"
          >
            Ir para o Relatório
          </button>
        </div>
      </div>
    )
  }

  // Build chart data: one entry per snapshot
  const chartDataOverall = snapshots.map(snap => ({
    label: snap.label,
    score: snap.snapshot_data.overall_score ?? 0,
  }))

  // Per-control chart data
  const chartDataControls = snapshots.map(snap => {
    const entry = { label: snap.label }
    snap.snapshot_data.controls?.forEach(ctrl => {
      entry[`CIS ${ctrl.id}`] = ctrl.avg_score ?? null
    })
    return entry
  })

  // Latest vs previous comparison
  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const latestControls = latest?.snapshot_data?.controls ?? []
  const previousControls = previous?.snapshot_data?.controls ?? []
  const prevMap = {}
  previousControls.forEach(c => { prevMap[c.id] = c.avg_score })

  const allControlIds = latestControls.map(c => c.id)

  const toggleControl = (cid) => {
    setSelectedControls(prev => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid)
      else next.add(cid)
      return next
    })
  }

  const activeLines = showAll
    ? allControlIds
    : allControlIds.filter(cid => selectedControls.has(cid))

  return (
    <div className="max-w-6xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/assessment/${id}/report`)} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" />Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Timeline de Evolução</h1>
            <p className="text-gray-400 text-sm">{assessment?.name} · {snapshots.length} snapshots</p>
          </div>
        </div>
      </div>

      {/* Overall evolution */}
      <div className="card mb-6">
        <h3 className="font-semibold text-white mb-1">Maturidade Geral — Evolução</h3>
        <p className="text-xs text-gray-500 mb-4">Score médio de todos os safeguards avaliados</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartDataOverall} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
              labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: '#3b82f6' }}
              formatter={(v) => [`${v?.toFixed(1)}%`, 'Maturidade']}
            />
            <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" label={{ value: '50%', fill: '#6b7280', fontSize: 10 }} />
            <ReferenceLine y={75} stroke="#374151" strokeDasharray="4 4" label={{ value: '75%', fill: '#6b7280', fontSize: 10 }} />
            <Line
              type="monotone" dataKey="score"
              stroke="#3b82f6" strokeWidth={2.5}
              dot={{ fill: '#3b82f6', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-control evolution */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-white mb-0.5">Evolução por Controle CIS</h3>
            <p className="text-xs text-gray-500">Selecione os controles para comparar</p>
          </div>
          <button
            onClick={() => { setShowAll(s => !s); setSelectedControls(new Set([1,2,3,4,5])) }}
            className="btn-secondary text-xs py-1 px-3"
          >
            {showAll ? 'Filtrar' : 'Mostrar todos'}
          </button>
        </div>

        {!showAll && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {allControlIds.map((cid, idx) => (
              <button
                key={cid}
                onClick={() => toggleControl(cid)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedControls.has(cid)
                    ? 'border-transparent text-white'
                    : 'border-gray-700 text-gray-500'
                }`}
                style={selectedControls.has(cid) ? { backgroundColor: CONTROL_COLORS[idx % CONTROL_COLORS.length] + '33', borderColor: CONTROL_COLORS[idx % CONTROL_COLORS.length] + '80', color: CONTROL_COLORS[idx % CONTROL_COLORS.length] } : {}}
              >
                CIS {cid}
              </button>
            ))}
          </div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartDataControls} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
            {activeLines.map((cid, idx) => (
              <Line
                key={cid}
                type="monotone"
                dataKey={`CIS ${cid}`}
                stroke={CONTROL_COLORS[allControlIds.indexOf(cid) % CONTROL_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Snapshot comparison table */}
      <div className="card">
        <h3 className="font-semibold text-white mb-1">Comparativo: Último vs Anterior</h3>
        {previous ? (
          <p className="text-xs text-gray-500 mb-4">
            <span className="text-blue-400">{latest.label}</span> vs <span className="text-gray-400">{previous.label}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-4">Apenas 1 snapshot disponível. Salve mais snapshots para comparar.</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 text-gray-500 font-medium">Controle</th>
                <th className="text-right py-2 text-gray-500 font-medium">Atual</th>
                {previous && <th className="text-right py-2 text-gray-500 font-medium">Anterior</th>}
                {previous && <th className="text-right py-2 text-gray-500 font-medium">Delta</th>}
                <th className="text-right py-2 text-gray-500 font-medium">Safeguards</th>
              </tr>
            </thead>
            <tbody>
              {latestControls.map(ctrl => (
                <tr key={ctrl.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono w-8">CIS {ctrl.id}</span>
                      <span className="text-gray-300 truncate max-w-xs">{ctrl.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    {ctrl.avg_score !== null ? (
                      <span className="font-bold" style={{ color: SCORE_COLOR(ctrl.avg_score) }}>
                        {ctrl.avg_score?.toFixed(0)}%
                      </span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  {previous && (
                    <td className="py-2.5 text-right text-gray-500">
                      {prevMap[ctrl.id] !== undefined ? `${prevMap[ctrl.id]?.toFixed(0)}%` : '—'}
                    </td>
                  )}
                  {previous && (
                    <td className="py-2.5 text-right">
                      <DeltaBadge current={ctrl.avg_score} previous={prevMap[ctrl.id]} />
                    </td>
                  )}
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {ctrl.evaluated_count}/{ctrl.total_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot list */}
      <div className="card mt-6">
        <h3 className="font-semibold text-white mb-4">Histórico de Snapshots</h3>
        <div className="space-y-2">
          {[...snapshots].reverse().map((snap, i) => (
            <div key={snap.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-800/40">
              <Camera className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-300 flex-1">{snap.label}</span>
              <span className="text-xs text-gray-500">{new Date(snap.created_at).toLocaleDateString('pt-BR')}</span>
              {snap.snapshot_data.overall_score !== null && (
                <span className="text-sm font-bold" style={{ color: SCORE_COLOR(snap.snapshot_data.overall_score) }}>
                  {snap.snapshot_data.overall_score?.toFixed(0)}%
                </span>
              )}
              {i === 0 && <span className="badge bg-blue-900/50 text-blue-400 border border-blue-800 text-xs">Mais recente</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
