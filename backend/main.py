import json
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import database as db
from ai_service import evaluate_maturity, test_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CIS Assessment Tool", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    db.init_db()
    logger.info("Database initialized")


# ── Load CIS data ─────────────────────────────────────────────────────────────
DATA_FILE = Path(__file__).parent / "cis_controls.json"
with open(DATA_FILE, encoding="utf-8") as f:
    CIS_DATA = json.load(f)

# Build lookup maps
SAFEGUARD_MAP = {}
CONTROL_MAP = {}
for ctrl in CIS_DATA["controls"]:
    CONTROL_MAP[ctrl["id"]] = ctrl
    for sg in ctrl["safeguards"]:
        SAFEGUARD_MAP[sg["id"]] = {**sg, "control_id": ctrl["id"], "control_name": ctrl["name"]}


# ── Pydantic models ───────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    name: str
    organization: str = ""
    description: str = ""


class AssessmentUpdate(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class AnswerSave(BaseModel):
    safeguard_id: str
    answer_q1: str = ""
    answer_q2: str = ""
    answer_q3: str = ""


class ConfigUpdate(BaseModel):
    ai_provider: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None


class TestConnectionReq(BaseModel):
    provider: str
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None


# ── CIS Controls ──────────────────────────────────────────────────────────────

@app.get("/api/controls")
async def get_controls():
    return CIS_DATA


@app.get("/api/controls/{control_id}")
async def get_control(control_id: int):
    ctrl = CONTROL_MAP.get(control_id)
    if not ctrl:
        raise HTTPException(404, "Control not found")
    return ctrl


# ── Assessments ───────────────────────────────────────────────────────────────

@app.get("/api/assessments")
async def list_assessments():
    assessments = db.list_assessments()
    # Enrich with progress stats
    for a in assessments:
        answers = db.get_all_answers(a["id"])
        answered = sum(1 for ans in answers if any([ans["answer_q1"], ans["answer_q2"], ans["answer_q3"]]))
        evaluated = sum(1 for ans in answers if ans["ai_level"] is not None)
        a["answered_count"] = answered
        a["evaluated_count"] = evaluated
        a["total_safeguards"] = 153
    return assessments


@app.post("/api/assessments", status_code=201)
async def create_assessment(body: AssessmentCreate):
    aid = db.create_assessment(body.name, body.organization, body.description)
    return db.get_assessment(aid)


@app.get("/api/assessments/{assessment_id}")
async def get_assessment(assessment_id: int):
    a = db.get_assessment(assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    answers = db.get_all_answers(assessment_id)
    answered = sum(1 for ans in answers if any([ans["answer_q1"], ans["answer_q2"], ans["answer_q3"]]))
    evaluated = sum(1 for ans in answers if ans["ai_level"] is not None)
    a["answered_count"] = answered
    a["evaluated_count"] = evaluated
    a["total_safeguards"] = 153
    return a


@app.put("/api/assessments/{assessment_id}")
async def update_assessment(assessment_id: int, body: AssessmentUpdate):
    a = db.get_assessment(assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        db.update_assessment(assessment_id, **updates)
    return db.get_assessment(assessment_id)


@app.delete("/api/assessments/{assessment_id}")
async def delete_assessment(assessment_id: int):
    a = db.get_assessment(assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")
    db.delete_assessment(assessment_id)
    return {"message": "Deleted"}


# ── Answers ───────────────────────────────────────────────────────────────────

@app.get("/api/assessments/{assessment_id}/answers")
async def get_answers(assessment_id: int):
    if not db.get_assessment(assessment_id):
        raise HTTPException(404, "Assessment not found")
    return db.get_all_answers(assessment_id)


@app.post("/api/assessments/{assessment_id}/answers")
async def save_answer(assessment_id: int, body: AnswerSave):
    if not db.get_assessment(assessment_id):
        raise HTTPException(404, "Assessment not found")
    if body.safeguard_id not in SAFEGUARD_MAP:
        raise HTTPException(400, f"Unknown safeguard: {body.safeguard_id}")
    db.upsert_answer(assessment_id, body.safeguard_id,
                     body.answer_q1, body.answer_q2, body.answer_q3)
    return db.get_answer(assessment_id, body.safeguard_id)


# ── AI Evaluation ─────────────────────────────────────────────────────────────

@app.post("/api/assessments/{assessment_id}/evaluate/{safeguard_id}")
async def evaluate_safeguard(assessment_id: int, safeguard_id: str):
    if not db.get_assessment(assessment_id):
        raise HTTPException(404, "Assessment not found")
    if safeguard_id not in SAFEGUARD_MAP:
        raise HTTPException(400, f"Unknown safeguard: {safeguard_id}")

    answer = db.get_answer(assessment_id, safeguard_id)
    if not answer:
        answer = {"answer_q1": "", "answer_q2": "", "answer_q3": ""}

    sg = SAFEGUARD_MAP[safeguard_id]
    try:
        result = await evaluate_maturity(
            safeguard_id, sg["name"],
            answer["answer_q1"], answer["answer_q2"], answer["answer_q3"]
        )
    except Exception as e:
        raise HTTPException(502, f"AI evaluation failed: {str(e)}")

    db.save_ai_evaluation(
        assessment_id, safeguard_id,
        result["level"], result["score"],
        result["reasoning"], result["strengths"], result["improvements"]
    )
    return {**db.get_answer(assessment_id, safeguard_id), **result}


@app.post("/api/assessments/{assessment_id}/evaluate-all")
async def evaluate_all(assessment_id: int):
    """Evaluate all answered safeguards that haven't been evaluated yet."""
    if not db.get_assessment(assessment_id):
        raise HTTPException(404, "Assessment not found")

    answers = db.get_all_answers(assessment_id)
    to_eval = [
        a for a in answers
        if any([a["answer_q1"], a["answer_q2"], a["answer_q3"]])
        and a["ai_level"] is None
    ]

    results = {"evaluated": 0, "skipped": 0, "errors": []}
    for ans in to_eval:
        sg_id = ans["safeguard_id"]
        sg = SAFEGUARD_MAP.get(sg_id)
        if not sg:
            continue
        try:
            result = await evaluate_maturity(
                sg_id, sg["name"],
                ans["answer_q1"], ans["answer_q2"], ans["answer_q3"]
            )
            db.save_ai_evaluation(
                assessment_id, sg_id,
                result["level"], result["score"],
                result["reasoning"], result["strengths"], result["improvements"]
            )
            results["evaluated"] += 1
        except Exception as e:
            results["errors"].append({"safeguard_id": sg_id, "error": str(e)})

    return results


# ── Report ────────────────────────────────────────────────────────────────────

@app.get("/api/assessments/{assessment_id}/report")
async def get_report(assessment_id: int):
    a = db.get_assessment(assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")

    answers = db.get_all_answers(assessment_id)
    answer_map = {ans["safeguard_id"]: ans for ans in answers}

    controls_report = []
    all_scores = []

    for ctrl in CIS_DATA["controls"]:
        safeguards_detail = []
        ctrl_scores = []

        for sg in ctrl["safeguards"]:
            ans = answer_map.get(sg["id"])
            has_answer = ans and any([ans["answer_q1"], ans["answer_q2"], ans["answer_q3"]])
            evaluated = ans and ans["ai_level"] is not None

            sg_entry = {
                "id": sg["id"],
                "name": sg["name"],
                "ig": sg["ig"],
                "has_answer": bool(has_answer),
                "evaluated": bool(evaluated),
                "level": ans["ai_level"] if evaluated else None,
                "score": ans["ai_score"] if evaluated else None,
                "reasoning": ans["ai_reasoning"] if evaluated else None,
                "strengths": json.loads(ans["ai_strengths"]) if (evaluated and ans["ai_strengths"]) else [],
                "improvements": json.loads(ans["ai_improvements"]) if (evaluated and ans["ai_improvements"]) else [],
                "evaluated_at": ans["evaluated_at"] if evaluated else None,
            }
            safeguards_detail.append(sg_entry)

            if evaluated:
                ctrl_scores.append(ans["ai_score"])
                all_scores.append(ans["ai_score"])

        avg_score = round(sum(ctrl_scores) / len(ctrl_scores), 1) if ctrl_scores else None
        avg_level = round(sum(ctrl_scores) / len(ctrl_scores) / 25, 1) if ctrl_scores else None

        controls_report.append({
            "id": ctrl["id"],
            "name": ctrl["name"],
            "safeguards": safeguards_detail,
            "evaluated_count": len(ctrl_scores),
            "total_count": len(ctrl["safeguards"]),
            "avg_score": avg_score,
            "avg_level": avg_level,
        })

    overall_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None
    overall_level = round(overall_score / 25, 1) if overall_score is not None else None

    # Top risks & highlights
    all_sg = [sg for ctrl in controls_report for sg in ctrl["safeguards"] if sg["evaluated"]]
    all_sg_sorted = sorted(all_sg, key=lambda x: x["score"])
    top_risks = all_sg_sorted[:5]
    top_highlights = all_sg_sorted[-5:][::-1]

    return {
        "assessment": a,
        "overall_score": overall_score,
        "overall_level": overall_level,
        "evaluated_count": len(all_scores),
        "total_safeguards": 153,
        "controls": controls_report,
        "top_risks": top_risks,
        "top_highlights": top_highlights,
    }


# ── Snapshots / Timeline ──────────────────────────────────────────────────────

@app.post("/api/assessments/{assessment_id}/snapshot")
async def create_snapshot(assessment_id: int, label: Optional[str] = None):
    a = db.get_assessment(assessment_id)
    if not a:
        raise HTTPException(404, "Assessment not found")

    report = await get_report(assessment_id)
    snapshot_label = label or datetime.utcnow().strftime("%d/%m/%Y %H:%M")
    db.create_snapshot(assessment_id, snapshot_label, report)
    return {"message": "Snapshot created", "label": snapshot_label}


@app.get("/api/assessments/{assessment_id}/timeline")
async def get_timeline(assessment_id: int):
    if not db.get_assessment(assessment_id):
        raise HTTPException(404, "Assessment not found")
    snapshots = db.list_snapshots(assessment_id)
    return snapshots


# ── Config ────────────────────────────────────────────────────────────────────

@app.get("/api/config")
async def get_config():
    cfg = db.get_config()
    # Mask API key
    if cfg.get("gemini_api_key"):
        key = cfg["gemini_api_key"]
        cfg["gemini_api_key_masked"] = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    return cfg


@app.put("/api/config")
async def update_config(body: ConfigUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    for k, v in updates.items():
        db.set_config(k, v)
    cfg = db.get_config()
    if cfg.get("gemini_api_key"):
        key = cfg["gemini_api_key"]
        cfg["gemini_api_key_masked"] = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    return cfg


@app.post("/api/config/test")
async def test_ai_connection(body: TestConnectionReq):
    config = db.get_config()
    # Override with provided values
    if body.ollama_base_url:
        config["ollama_base_url"] = body.ollama_base_url
    if body.ollama_model:
        config["ollama_model"] = body.ollama_model
    if body.gemini_api_key:
        config["gemini_api_key"] = body.gemini_api_key
    if body.gemini_model:
        config["gemini_model"] = body.gemini_model
    result = await test_connection(body.provider, config)
    return result


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Serve React frontend ──────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = STATIC_DIR / "index.html"
        return FileResponse(str(index))
