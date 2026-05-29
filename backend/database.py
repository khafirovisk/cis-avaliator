import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "/app/data/cis_assessment.db")


def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_connection()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            organization TEXT,
            description TEXT,
            status TEXT DEFAULT 'in_progress',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            finalized_at TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS safeguard_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL,
            safeguard_id TEXT NOT NULL,
            answer_q1 TEXT DEFAULT '',
            answer_q2 TEXT DEFAULT '',
            answer_q3 TEXT DEFAULT '',
            ai_level INTEGER,
            ai_score INTEGER,
            ai_reasoning TEXT,
            ai_strengths TEXT,
            ai_improvements TEXT,
            evaluated_at TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
            UNIQUE(assessment_id, safeguard_id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL,
            label TEXT,
            snapshot_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # Default config
    defaults = {
        "ai_provider": "ollama",
        "ollama_base_url": "http://host.docker.internal:11434",
        "ollama_model": "llama3.1:8b",
        "gemini_api_key": "",
        "gemini_model": "gemini-1.5-flash"
    }
    for k, v in defaults.items():
        c.execute(
            "INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)",
            (k, v)
        )

    conn.commit()
    conn.close()


# ── Assessments ─────────────────────────────────────────────────────────────

def list_assessments():
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM assessments ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_assessment(name: str, organization: str = "", description: str = ""):
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO assessments (name, organization, description, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (name, organization, description, "in_progress", now, now)
    )
    assessment_id = cur.lastrowid
    conn.commit()
    conn.close()
    return assessment_id


def get_assessment(assessment_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM assessments WHERE id = ?", (assessment_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_assessment(assessment_id: int, **kwargs):
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [assessment_id]
    conn = get_connection()
    conn.execute(f"UPDATE assessments SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def delete_assessment(assessment_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM assessments WHERE id = ?", (assessment_id,))
    conn.commit()
    conn.close()


# ── Answers ──────────────────────────────────────────────────────────────────

def get_all_answers(assessment_id: int):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM safeguard_answers WHERE assessment_id = ?",
        (assessment_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_answer(assessment_id: int, safeguard_id: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM safeguard_answers WHERE assessment_id = ? AND safeguard_id = ?",
        (assessment_id, safeguard_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def upsert_answer(assessment_id: int, safeguard_id: str, answer_q1: str = "",
                  answer_q2: str = "", answer_q3: str = ""):
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute("""
        INSERT INTO safeguard_answers (assessment_id, safeguard_id, answer_q1, answer_q2, answer_q3, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(assessment_id, safeguard_id) DO UPDATE SET
            answer_q1 = excluded.answer_q1,
            answer_q2 = excluded.answer_q2,
            answer_q3 = excluded.answer_q3,
            updated_at = excluded.updated_at
    """, (assessment_id, safeguard_id, answer_q1, answer_q2, answer_q3, now))
    conn.execute("UPDATE assessments SET updated_at = ? WHERE id = ?", (now, assessment_id))
    conn.commit()
    conn.close()


def save_ai_evaluation(assessment_id: int, safeguard_id: str, level: int,
                       score: int, reasoning: str, strengths: list, improvements: list):
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute("""
        UPDATE safeguard_answers
        SET ai_level=?, ai_score=?, ai_reasoning=?, ai_strengths=?, ai_improvements=?, evaluated_at=?, updated_at=?
        WHERE assessment_id=? AND safeguard_id=?
    """, (level, score, reasoning,
          json.dumps(strengths, ensure_ascii=False),
          json.dumps(improvements, ensure_ascii=False),
          now, now, assessment_id, safeguard_id))
    conn.execute("UPDATE assessments SET updated_at = ? WHERE id = ?", (now, assessment_id))
    conn.commit()
    conn.close()


# ── Snapshots ────────────────────────────────────────────────────────────────

def create_snapshot(assessment_id: int, label: str, snapshot_data: dict):
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute(
        "INSERT INTO snapshots (assessment_id, label, snapshot_data, created_at) VALUES (?,?,?,?)",
        (assessment_id, label, json.dumps(snapshot_data, ensure_ascii=False), now)
    )
    conn.commit()
    conn.close()


def list_snapshots(assessment_id: int):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM snapshots WHERE assessment_id = ? ORDER BY created_at ASC",
        (assessment_id,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["snapshot_data"] = json.loads(d["snapshot_data"])
        result.append(d)
    return result


# ── Config ───────────────────────────────────────────────────────────────────

def get_config():
    conn = get_connection()
    rows = conn.execute("SELECT key, value FROM app_config").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


def set_config(key: str, value: str):
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES (?,?)",
        (key, value)
    )
    conn.commit()
    conn.close()
