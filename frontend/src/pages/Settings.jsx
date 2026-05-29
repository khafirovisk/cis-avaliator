import React, { useState, useEffect } from 'react'
import { Settings, Cpu, Key, Server, CheckCircle2, XCircle, Loader2, Save, Info } from 'lucide-react'
import * as api from '../api/client.js'

const PROVIDERS = [
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'LLM local — sem custo, sem envio de dados para a internet',
    icon: '🦙',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'API cloud do Google — requer chave de API',
    icon: '✨',
  },
]

const OLLAMA_MODELS = [
  'llama3.1:8b', 'llama3.1:70b', 'llama3:8b', 'llama3:70b',
  'mistral:7b', 'mixtral:8x7b', 'gemma2:9b', 'qwen2:7b',
  'deepseek-r1:7b', 'phi3:mini',
]

const GEMINI_MODELS = [
  'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp',
]

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getConfig().then(cfg => {
      setConfig(cfg)
      setForm({
        ai_provider: cfg.ai_provider || 'ollama',
        ollama_base_url: cfg.ollama_base_url || 'http://host.docker.internal:11434',
        ollama_model: cfg.ollama_model || 'llama3.1:8b',
        gemini_api_key: '',
        gemini_model: cfg.gemini_model || 'gemini-1.5-flash',
      })
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = { ...form }
      if (!payload.gemini_api_key) delete payload.gemini_api_key
      await api.updateConfig(payload)
      setSaved(true)
      setTestResult(null)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const payload = {
        provider: form.ai_provider,
        ollama_base_url: form.ollama_base_url,
        ollama_model: form.ollama_model,
        gemini_model: form.gemini_model,
      }
      if (form.gemini_api_key) payload.gemini_api_key = form.gemini_api_key
      const result = await api.testConnection(payload)
      setTestResult(result)
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.detail || e.message })
    } finally {
      setTesting(false)
    }
  }

  if (!config) return <div className="flex justify-center pt-20"><span className="spinner w-8 h-8" /></div>

  return (
    <div className="max-w-2xl mx-auto fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Configurações</h1>
        <p className="text-gray-400 text-sm">Configure o provedor de IA para avaliação de maturidade</p>
      </div>

      {/* Provider selection */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4" />Provedor de IA
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setForm(f => ({ ...f, ai_provider: p.id }))}
              className={`p-4 rounded-xl border text-left transition-all ${
                form.ai_provider === p.id
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
              }`}
            >
              <div className="text-2xl mb-2">{p.icon}</div>
              <p className="font-semibold text-sm text-white">{p.label}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Ollama settings */}
      {form.ai_provider === 'ollama' && (
        <div className="card mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
            <Server className="w-4 h-4" />Configurações do Ollama
          </h2>

          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300 leading-relaxed">
              Para acessar o Ollama rodando no host a partir do Docker, use{' '}
              <code className="font-mono bg-blue-900/50 px-1 rounded">http://host.docker.internal:11434</code>.
              No Linux pode ser necessário usar o IP da interface Docker (ex.: <code className="font-mono bg-blue-900/50 px-1 rounded">http://172.17.0.1:11434</code>).
            </p>
          </div>

          <Field label="Ollama Base URL" hint="URL base da API do Ollama">
            <input
              className="input"
              value={form.ollama_base_url}
              onChange={e => setForm(f => ({ ...f, ollama_base_url: e.target.value }))}
              placeholder="http://host.docker.internal:11434"
            />
          </Field>

          <Field label="Modelo" hint="Recomendado: llama3.1:8b ou mistral:7b para avaliações CIS">
            <select
              className="input"
              value={OLLAMA_MODELS.includes(form.ollama_model) ? form.ollama_model : '__custom__'}
              onChange={e => {
                if (e.target.value !== '__custom__') setForm(f => ({ ...f, ollama_model: e.target.value }))
              }}
            >
              {OLLAMA_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__custom__">Outro modelo...</option>
            </select>
            {!OLLAMA_MODELS.includes(form.ollama_model) && (
              <input
                className="input mt-2"
                value={form.ollama_model}
                onChange={e => setForm(f => ({ ...f, ollama_model: e.target.value }))}
                placeholder="modelo:tag  (ex: phi3:mini)"
              />
            )}
          </Field>
        </div>
      )}

      {/* Gemini settings */}
      {form.ai_provider === 'gemini' && (
        <div className="card mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
            <Key className="w-4 h-4" />Configurações do Gemini
          </h2>

          <Field
            label="API Key"
            hint="Obtenha sua chave em https://aistudio.google.com/apikey"
          >
            <input
              className="input font-mono"
              type="password"
              value={form.gemini_api_key}
              onChange={e => setForm(f => ({ ...f, gemini_api_key: e.target.value }))}
              placeholder={config.gemini_api_key_masked || 'Insira sua API Key do Gemini'}
            />
            {config.gemini_api_key_masked && !form.gemini_api_key && (
              <p className="text-xs text-gray-500 mt-1">
                Chave atual: <code className="font-mono">{config.gemini_api_key_masked}</code>
                {' '}— deixe em branco para manter
              </p>
            )}
          </Field>

          <Field label="Modelo" hint="gemini-1.5-flash é mais rápido; gemini-1.5-pro tem melhor qualidade">
            <select
              className="input"
              value={form.gemini_model}
              onChange={e => setForm(f => ({ ...f, gemini_model: e.target.value }))}
            >
              {GEMINI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
      )}

      {/* Maturity scale reference */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
          Escala de Maturidade (Referência)
        </h2>
        <div className="space-y-2">
          {[
            { level: 0, pct: '0%',   color: 'bg-red-500',    label: 'Não Implementado',        desc: 'Controle inexistente.' },
            { level: 1, pct: '25%',  color: 'bg-orange-500', label: 'Parcialmente Implementado', desc: 'Ad hoc, manual, sem documentação.' },
            { level: 2, pct: '50%',  color: 'bg-yellow-500', label: 'Implementado em alguns casos', desc: 'Contínuo em parte do ambiente, documentação parcial.' },
            { level: 3, pct: '75%',  color: 'bg-blue-500',   label: 'Implementado na maioria',  desc: 'Grande parte do ambiente, documentado, com indicadores.' },
            { level: 4, pct: '100%', color: 'bg-green-500',  label: 'Implementado totalmente',  desc: 'Automatizado em todo o ambiente, formalizado, indicadores de negócio.' },
          ].map(m => (
            <div key={m.level} className="flex items-start gap-3 py-1.5">
              <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${m.color}`} />
              <div>
                <span className="text-sm font-medium text-gray-200">Nível {m.level} ({m.pct}) — {m.label}</span>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`mb-4 p-4 rounded-xl border flex items-start gap-3 ${
          testResult.success
            ? 'bg-green-900/20 border-green-800 text-green-300'
            : 'bg-red-900/20 border-red-800 text-red-300'
        }`}>
          {testResult.success
            ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          }
          <p className="text-sm">{testResult.message}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          {testing
            ? <><Loader2 className="w-4 h-4 animate-spin" />Testando...</>
            : 'Testar Conexão'
          }
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
            : saved
            ? <><CheckCircle2 className="w-4 h-4" />Salvo!</>
            : <><Save className="w-4 h-4" />Salvar Configurações</>
          }
        </button>
      </div>
    </div>
  )
}
