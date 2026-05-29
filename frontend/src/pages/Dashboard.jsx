import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Shield, Clock, CheckCircle, Trash2, BarChart2, PlayCircle, AlertCircle } from 'lucide-react'
import * as api from '../api/client.js'

const LEVEL_COLOR = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
const LEVEL_LABEL = ['Não Implementado', 'Parcial', 'Em alguns casos', 'Na maioria', 'Total']

function StatusBadge({ status }) {
  if (status === 'completed') return (
    <span className="badge bg-green-900/50 text-green-400 border border-green-800">
      <CheckCircle className="w-3 h-3 mr-1" /> Concluído
    </span>
  )
  return (
    <span className="badge bg-blue-900/50 text-blue-400 border border-blue-800">
      <Clock className="w-3 h-3 mr-1" /> Em andamento
    </span>
  )
}

function ProgressBar({ value, max, color = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const a = await api.createAssessment({ name: name.trim(), organization: org.trim(), description: desc.trim() })
      onCreate(a)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 fade-in">
        <h2 className="text-xl font-bold mb-1">Nova Avaliação</h2>
        <p className="text-sm text-gray-400 mb-6">Inicie uma nova avaliação de maturidade CIS Controls v8</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome da Avaliação *</label>
            <input
              className="input"
              placeholder="ex: Avaliação Q1 2025"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Organização</label>
            <input
              className="input"
              placeholder="ex: Leo Madeiras"
              value={org}
              onChange={e => setOrg(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Descrição</label>
            <textarea
              className="textarea h-20"
              placeholder="Descrição opcional da avaliação..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={submit} disabled={!name.trim() || loading}>
            {loading ? <span className="spinner" /> : 'Criar Avaliação'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.listAssessments()
      setAssessments(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = (assessment) => {
    setShowCreate(false)
    navigate(`/assessment/${assessment.id}`)
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir esta avaliação? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    await api.deleteAssessment(id)
    setAssessments(prev => prev.filter(a => a.id !== id))
    setDeleting(null)
  }

  const inProgress = assessments.filter(a => a.status === 'in_progress')
  const completed = assessments.filter(a => a.status === 'completed')

  return (
    <div className="max-w-5xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Avaliações de Maturidade CIS Controls v8</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Nova Avaliação
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: assessments.length, icon: Shield, color: 'text-blue-400' },
          { label: 'Em andamento', value: inProgress.length, icon: Clock, color: 'text-yellow-400' },
          { label: 'Concluídas', value: completed.length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Safeguards', value: '153', icon: BarChart2, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`${s.color}`}><s.icon className="w-8 h-8" /></div>
            <div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="spinner w-8 h-8" />
        </div>
      ) : assessments.length === 0 ? (
        <div className="card text-center py-16">
          <Shield className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">Nenhuma avaliação</h3>
          <p className="text-gray-600 text-sm mb-6">Crie sua primeira avaliação de maturidade CIS Controls</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 inline mr-2" />Começar agora
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <div key={a.id} className="card hover:border-gray-700 transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-white truncate">{a.name}</h3>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.organization && (
                    <p className="text-sm text-gray-400 mb-2">{a.organization}</p>
                  )}
                  {a.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-1">{a.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Respondidos</span>
                        <span>{a.answered_count}/{a.total_safeguards}</span>
                      </div>
                      <ProgressBar value={a.answered_count} max={a.total_safeguards} color="bg-blue-500" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Avaliados por IA</span>
                        <span>{a.evaluated_count}/{a.total_safeguards}</span>
                      </div>
                      <ProgressBar value={a.evaluated_count} max={a.total_safeguards} color="bg-green-500" />
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-3">
                    Criado em {new Date(a.created_at).toLocaleDateString('pt-BR')} · Atualizado em {new Date(a.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    className="btn-primary flex items-center gap-1.5 text-sm py-1.5"
                    onClick={() => navigate(`/assessment/${a.id}`)}
                  >
                    <PlayCircle className="w-4 h-4" />
                    {a.status === 'completed' ? 'Revisar' : 'Continuar'}
                  </button>
                  {a.evaluated_count > 0 && (
                    <button
                      className="btn-secondary flex items-center gap-1.5 text-sm py-1.5"
                      onClick={() => navigate(`/assessment/${a.id}/report`)}
                    >
                      <BarChart2 className="w-4 h-4" />
                      Relatório
                    </button>
                  )}
                  <button
                    className="btn-danger flex items-center gap-1.5 text-sm py-1.5"
                    onClick={() => handleDelete(a.id)}
                    disabled={deleting === a.id}
                  >
                    {deleting === a.id ? <span className="spinner w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  )
}
