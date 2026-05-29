# 🛡️ CIS Controls Assessment Tool

Ferramenta web para avaliação de maturidade dos **CIS Controls v8** com análise por IA (Ollama ou Gemini).

## ✨ Funcionalidades

- **153 Safeguards** dos 18 CIS Controls v8
- **Salvar e retomar** — progresso salvo automaticamente
- **Avaliação por IA** — Ollama (local) ou Google Gemini
- **Relatório executivo** — radar chart, bar chart, top riscos
- **Timeline de evolução** — compare maturidade entre snapshots
- **Escala de maturidade** — 5 níveis (0–4) por safeguard

## 🚀 Instalação (método único)

```bash
git clone <repo-url>
cd cis-assessment
chmod +x install.sh
./install.sh
```

O instalador vai:
1. Verificar Docker e Docker Compose
2. Guiar a configuração do provedor de IA
3. Fazer o build e iniciar o container
4. Abrir a URL de acesso

## ⚙️ Configuração manual

```bash
cp .env.example .env
# Edite .env com suas configurações
docker compose up -d --build
```

Acesse: **http://localhost:8080**

## 🤖 Configuração de IA

### Ollama (recomendado)

```bash
# Instalar e rodar o modelo
ollama run llama3.1:8b
```

Na interface: **Configurações → Provedor: Ollama**  
URL: `http://host.docker.internal:11434` (Windows/Mac) ou `http://172.17.0.1:11434` (Linux)

### Google Gemini

Obtenha sua API key em [aistudio.google.com](https://aistudio.google.com/apikey) e configure em **Configurações → Provedor: Gemini**.

## 📊 Escala de Maturidade

| Nível | Score | Descrição |
|-------|-------|-----------|
| 0 | 0% | Não Implementado |
| 1 | 25% | Parcialmente — ad hoc, manual, sem documentação |
| 2 | 50% | Em alguns casos — contínuo em parte do ambiente |
| 3 | 75% | Na maioria — documentado, com indicadores |
| 4 | 100% | Total — automatizado, formalizado, KPIs de negócio |

## 🔧 Comandos

```bash
docker compose stop               # Parar
docker compose start              # Iniciar
docker compose logs -f            # Ver logs
docker compose down               # Remover containers
docker compose down -v            # Remover containers + dados
```

## 📁 Estrutura

```
cis-assessment/
├── install.sh            # Instalador
├── docker-compose.yml
├── Dockerfile            # Multi-stage build
├── backend/
│   ├── main.py           # FastAPI
│   ├── database.py       # SQLite
│   ├── ai_service.py     # Ollama/Gemini
│   └── cis_controls.json # 152 safeguards
└── frontend/             # React + Tailwind
    └── src/pages/
        ├── Dashboard.jsx
        ├── Assessment.jsx
        ├── Report.jsx
        ├── Timeline.jsx
        └── Settings.jsx
```
