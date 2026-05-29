import httpx
import json
import re
import logging
from database import get_config

logger = logging.getLogger(__name__)

MATURITY_PROMPT = """Você é um consultor especialista em CIS Controls v8. Avalie a maturidade do seguinte safeguard com base nas respostas fornecidas pelo cliente.

## Safeguard
{safeguard_id}: {safeguard_name}

## Respostas do Cliente

**Pergunta 1 – Abrangência:**
{answer_q1}

**Pergunta 2 – Execução e Automação:**
{answer_q2}

**Pergunta 3 – Governança e Métricas:**
{answer_q3}

## Escala de Maturidade (use ESTRITAMENTE esta régua)
- Nível 0 (0%):  Controle inexistente.
- Nível 1 (25%): Controle realizado de modo ad hoc, pontual, manual e sem documentação.
- Nível 2 (50%): Controle realizado de modo contínuo em PARTE do ambiente, com documentação parcial.
- Nível 3 (75%): Controle realizado de modo contínuo em GRANDE PARTE do ambiente, com documentação estruturada e alguns indicadores.
- Nível 4 (100%): Controle realizado de modo contínuo e AUTOMATIZADO em TODO o ambiente, com documentação formalizada e indicadores de risco aplicados ao negócio.

## Instruções
- Analise as três respostas em conjunto para determinar o nível global do safeguard.
- Se as respostas estiverem vazias ou indicarem ausência total, atribua nível 0.
- Seja justo mas criterioso: apenas automatização comprovada, cobertura total e indicadores formais justificam nível 4.
- Responda APENAS com JSON válido, sem texto adicional, sem blocos de código markdown.

## Formato de Resposta (JSON puro)
{{
  "level": <inteiro 0-4>,
  "score": <0, 25, 50, 75 ou 100>,
  "reasoning": "<justificativa concisa em português, máximo 3 frases>",
  "strengths": ["<ponto positivo 1>", "<ponto positivo 2>"],
  "improvements": ["<sugestão de melhoria 1>", "<sugestão de melhoria 2>"]
}}"""


def parse_ai_response(raw: str) -> dict:
    """Extract JSON from AI response, handling markdown code blocks."""
    # Remove markdown code blocks if present
    cleaned = re.sub(r'```(?:json)?\s*', '', raw).strip()
    cleaned = re.sub(r'```\s*$', '', cleaned).strip()
    # Find JSON object
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON found in response: {raw[:200]}")
    data = json.loads(match.group())
    # Validate
    level = int(data.get("level", 0))
    score_map = {0: 0, 1: 25, 2: 50, 3: 75, 4: 100}
    return {
        "level": level,
        "score": score_map.get(level, 0),
        "reasoning": str(data.get("reasoning", ""))[:500],
        "strengths": data.get("strengths", [])[:3],
        "improvements": data.get("improvements", [])[:3]
    }


async def evaluate_with_ollama(prompt: str, config: dict) -> dict:
    base_url = config.get("ollama_base_url", "http://localhost:11434").rstrip("/")
    model = config.get("ollama_model", "llama3.1:8b")
    url = f"{base_url}/api/chat"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 800}
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        content = data["message"]["content"]
        return parse_ai_response(content)


async def evaluate_with_gemini(prompt: str, config: dict) -> dict:
    api_key = config.get("gemini_api_key", "")
    model = config.get("gemini_model", "gemini-1.5-flash")
    if not api_key:
        raise ValueError("Gemini API key not configured")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 800}
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return parse_ai_response(content)


async def evaluate_maturity(safeguard_id: str, safeguard_name: str,
                             answer_q1: str, answer_q2: str, answer_q3: str) -> dict:
    config = get_config()
    provider = config.get("ai_provider", "ollama")

    # If all answers are empty, return level 0
    if not any([answer_q1.strip(), answer_q2.strip(), answer_q3.strip()]):
        return {
            "level": 0, "score": 0,
            "reasoning": "Nenhuma resposta fornecida para este safeguard.",
            "strengths": [],
            "improvements": ["Iniciar a implementação deste controle", "Documentar o processo de implementação"]
        }

    prompt = MATURITY_PROMPT.format(
        safeguard_id=safeguard_id,
        safeguard_name=safeguard_name,
        answer_q1=answer_q1 or "(sem resposta)",
        answer_q2=answer_q2 or "(sem resposta)",
        answer_q3=answer_q3 or "(sem resposta)"
    )

    try:
        if provider == "gemini":
            return await evaluate_with_gemini(prompt, config)
        else:
            return await evaluate_with_ollama(prompt, config)
    except Exception as e:
        logger.error(f"AI evaluation failed for {safeguard_id}: {e}")
        raise


async def test_connection(provider: str, config: dict) -> dict:
    """Test AI provider connectivity."""
    test_prompt = 'Responda apenas com o JSON: {"status": "ok", "message": "Conexão bem-sucedida"}'
    try:
        if provider == "gemini":
            result = await evaluate_with_gemini(test_prompt, config)
        else:
            base_url = config.get("ollama_base_url", "http://localhost:11434").rstrip("/")
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{base_url}/api/tags")
                resp.raise_for_status()
                models = [m["name"] for m in resp.json().get("models", [])]
                return {"success": True, "message": f"Ollama conectado. Modelos disponíveis: {', '.join(models[:5]) or 'nenhum'}"}
        return {"success": True, "message": "Conexão bem-sucedida"}
    except Exception as e:
        return {"success": False, "message": str(e)}
