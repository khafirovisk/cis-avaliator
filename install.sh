#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  CIS Controls Assessment Tool — Instalador (com suporte a WSL)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BOLD="\033[1m"
BLUE="\033[34m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_DIR/.env"
IS_WSL=false
grep -qiE "(microsoft|wsl)" /proc/version 2>/dev/null && IS_WSL=true

banner() {
  echo -e "${CYAN}"
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║        🛡️  CIS Controls Assessment Tool              ║"
  echo "  ║            Instalador — v1.0.0                       ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERRO]${RESET}  $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}▸ $*${RESET}"; }

# ── WSL: corrigir DNS se necessário ───────────────────────────────────────────
fix_wsl_dns() {
  if [ "$IS_WSL" = false ]; then return; fi

  step "Ambiente WSL detectado — verificando conectividade"
  info "WSL2 identificado. Testando acesso ao Docker Hub..."

  # Testa se já consegue resolver registry-1.docker.io
  if curl -sf --max-time 8 https://registry-1.docker.io/v2/ &>/dev/null; then
    ok "Conectividade com Docker Hub OK"
    return
  fi

  warn "Timeout ao acessar Docker Hub. Corrigindo DNS do WSL..."

  # Backup e substituição do resolv.conf
  sudo cp /etc/resolv.conf /etc/resolv.conf.bak 2>/dev/null || true
  printf "nameserver 8.8.8.8\nnameserver 8.8.4.4\n" | sudo tee /etc/resolv.conf > /dev/null

  # Impede o WSL de sobrescrever o resolv.conf automaticamente
  if ! grep -q "generateResolvConf" /etc/wsl.conf 2>/dev/null; then
    sudo bash -c 'cat >> /etc/wsl.conf << "WSLEOF"
[network]
generateResolvConf = false
WSLEOF'
  fi

  sleep 2
  if curl -sf --max-time 8 https://registry-1.docker.io/v2/ &>/dev/null; then
    ok "DNS corrigido (8.8.8.8). Docker Hub acessível."
  else
    warn "DNS ainda com problema. Tente uma das opções abaixo antes de continuar:"
    echo ""
    echo -e "  ${BOLD}Opção 1 — Docker Desktop (recomendado para Windows):${RESET}"
    echo -e "    Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo -e "    Ative: Settings → Resources → WSL Integration → habilite sua distro"
    echo ""
    echo -e "  ${BOLD}Opção 2 — Corrigir DNS manualmente:${RESET}"
    echo -e "    sudo bash -c 'echo \"nameserver 8.8.8.8\" > /etc/resolv.conf'"
    echo ""
    echo -e "  ${BOLD}Opção 3 — Usar VPN/proxy corporativo:${RESET}"
    echo -e "    Configure o proxy no Docker: https://docs.docker.com/config/daemon/proxy/"
    echo ""
    read -rp "Continuar mesmo assim? (s/N): " CONFIRM
    [[ "${CONFIRM,,}" == "s" ]] || exit 1
  fi

  # Se Ollama roda no Windows, o host.docker.internal no WSL pode ser diferente
  echo ""
  info "No WSL, se o Ollama estiver rodando no Windows:"
  info "Use o IP do gateway WSL como URL do Ollama, geralmente: http://172.17.0.1:11434"
  info "Ou habilite: Ollama → Settings → OLLAMA_HOST=0.0.0.0"
}

# ── Pré-requisitos ─────────────────────────────────────────────────────────────
check_requirements() {
  step "Verificando pré-requisitos"

  if ! command -v docker &>/dev/null; then
    error "Docker não encontrado. Instale em https://docs.docker.com/get-docker/"
  fi
  ok "Docker: $(docker --version | head -1)"

  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    error "Docker Compose não encontrado. Instale o plugin: https://docs.docker.com/compose/install/"
  fi
  ok "Docker Compose: $($COMPOSE_CMD version 2>/dev/null | head -1)"

  if ! docker info &>/dev/null; then
    error "Docker daemon não está rodando. Inicie o Docker e tente novamente."
  fi
  ok "Docker daemon: rodando"
}

# ── Configuração ───────────────────────────────────────────────────────────────
configure() {
  step "Configuração inicial"

  if [ -f "$ENV_FILE" ]; then
    warn "Arquivo .env já existe. Pulando configuração."
    return
  fi

  cp "$REPO_DIR/.env.example" "$ENV_FILE"

  echo -e "\n${BOLD}Porta de acesso (padrão: 8080):${RESET}"
  read -rp "  Porta [8080]: " PORT_INPUT
  PORT_INPUT="${PORT_INPUT:-8080}"
  sed -i "s/^PORT=.*/PORT=${PORT_INPUT}/" "$ENV_FILE"

  echo -e "\n${BOLD}Provedor de IA:${RESET}"
  echo "  1) Ollama (local, recomendado)"
  echo "  2) Google Gemini (cloud, requer API key)"
  read -rp "  Escolha [1]: " PROVIDER_CHOICE
  PROVIDER_CHOICE="${PROVIDER_CHOICE:-1}"

  if [ "$PROVIDER_CHOICE" = "2" ]; then
    sed -i "s/^AI_PROVIDER=.*/AI_PROVIDER=gemini/" "$ENV_FILE"
    read -rp "  Google Gemini API Key: " GEMINI_KEY
    sed -i "s/^GEMINI_API_KEY=.*/GEMINI_API_KEY=${GEMINI_KEY}/" "$ENV_FILE"
    ok "Gemini configurado"
  else
    echo -e "\n${BOLD}Ollama URL:${RESET}"
    if [ "$IS_WSL" = true ]; then
      # Tenta detectar o gateway WSL automaticamente
      WSL_GW=$(ip route show default 2>/dev/null | awk '/default/ {print $3}' | head -1)
      WSL_GW="${WSL_GW:-172.17.0.1}"
      echo -e "  ${YELLOW}No WSL, use o IP do gateway (detectado: ${WSL_GW}):${RESET}"
      echo -e "  Exemplos: http://${WSL_GW}:11434  ou  http://host.docker.internal:11434"
      DEFAULT_URL="http://${WSL_GW}:11434"
    else
      DEFAULT_URL="http://host.docker.internal:11434"
    fi
    read -rp "  URL [${DEFAULT_URL}]: " OLLAMA_URL
    OLLAMA_URL="${OLLAMA_URL:-${DEFAULT_URL}}"
    sed -i "s|^OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=${OLLAMA_URL}|" "$ENV_FILE"

    echo -e "\n${BOLD}Modelo Ollama (padrão: llama3.1:8b):${RESET}"
    read -rp "  Modelo [llama3.1:8b]: " OLLAMA_MODEL
    OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
    sed -i "s/^OLLAMA_MODEL=.*/OLLAMA_MODEL=${OLLAMA_MODEL}/" "$ENV_FILE"
    ok "Ollama configurado: $OLLAMA_URL / $OLLAMA_MODEL"
  fi

  ok "Arquivo .env criado"
}

# ── Build e Start ──────────────────────────────────────────────────────────────
build_and_start() {
  step "Construindo e iniciando containers"

  cd "$REPO_DIR"

  info "Build da imagem Docker (pode demorar na primeira vez)..."
  $COMPOSE_CMD build --no-cache

  info "Iniciando serviço..."
  $COMPOSE_CMD up -d

  ok "Container iniciado"
}

# ── Aguardar saúde ─────────────────────────────────────────────────────────────
wait_healthy() {
  step "Aguardando serviço ficar disponível"

  PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d= -f2 || echo 8080)
  PORT="${PORT:-8080}"
  MAX_WAIT=60
  WAITED=0

  while ! curl -sf "http://localhost:${PORT}/api/health" &>/dev/null; do
    if [ $WAITED -ge $MAX_WAIT ]; then
      warn "Timeout aguardando o serviço. Verifique: $COMPOSE_CMD logs cis-assessment"
      return
    fi
    printf "."
    sleep 2
    WAITED=$((WAITED + 2))
  done
  echo ""
  ok "Serviço disponível!"
}

# ── Sumário ────────────────────────────────────────────────────────────────────
summary() {
  PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d= -f2 || echo 8080)
  PORT="${PORT:-8080}"
  AI_PROVIDER=$(grep "^AI_PROVIDER=" "$ENV_FILE" | cut -d= -f2 || echo ollama)

  echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
  echo -e "${GREEN}${BOLD}║   ✅  Instalação concluída com sucesso!              ║${RESET}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}\n"
  echo -e "  ${BOLD}🌐 URL:${RESET}           http://localhost:${PORT}"
  echo -e "  ${BOLD}🤖 IA:${RESET}            ${AI_PROVIDER}"
  echo -e "  ${BOLD}⚙️  Config:${RESET}        http://localhost:${PORT}/settings"
  echo -e "  ${BOLD}📊 Dashboard:${RESET}     http://localhost:${PORT}"
  echo ""
  echo -e "  ${BOLD}Comandos úteis:${RESET}"
  echo -e "    Parar:    ${CYAN}$COMPOSE_CMD stop${RESET}"
  echo -e "    Iniciar:  ${CYAN}$COMPOSE_CMD start${RESET}"
  echo -e "    Logs:     ${CYAN}$COMPOSE_CMD logs -f cis-assessment${RESET}"
  echo -e "    Remover:  ${CYAN}$COMPOSE_CMD down -v${RESET}  (${RED}apaga dados!${RESET})"
  echo ""
  echo -e "  ${YELLOW}💡 Dados persistidos em volume Docker: cis_data${RESET}"
  if [ "$IS_WSL" = true ]; then
    echo -e "  ${YELLOW}💡 WSL: acesse pelo browser do Windows em http://localhost:${PORT}${RESET}"
    echo -e "  ${YELLOW}💡 Ollama no Windows: certifique-se que OLLAMA_HOST=0.0.0.0 está definido${RESET}"
  fi
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  banner
  check_requirements
  fix_wsl_dns
  configure
  build_and_start
  wait_healthy
  summary
}

main "$@"
