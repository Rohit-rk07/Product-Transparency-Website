from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Literal
import os
import json
from urllib import request as urlrequest
from urllib.error import URLError, HTTPError

def load_env_file(path: str = ".env"):
    try:
        if not os.path.isfile(path):
            return
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                # do not override if already set in environment
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        # Fail silently; service can run without .env
        pass

# Auto-load .env on import
load_env_file()

app = FastAPI(title="AI Service", version="0.1.0")


class GenerateQuestionsRequest(BaseModel):
    productId: str
    answeredQuestions: Optional[List[dict]] = None
    contextText: Optional[str] = None


class QuestionItem(BaseModel):
    question_text: str
    question_type: str
    metadata: Optional[dict] = None


class TransparencyScoreRequest(BaseModel):
    product: dict
    answers: List[dict]


class TransparencyScoreResponse(BaseModel):
    score: float


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/generate-questions", response_model=List[QuestionItem])
async def generate_questions(payload: GenerateQuestionsRequest):
    # If GEMINI_API_KEY is present, call Gemini to generate questions; otherwise fallback to heuristic
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    def heuristic_items() -> List[QuestionItem]:
        ctx = (payload.contextText or "").lower()
        out: List[QuestionItem] = []
        # Core base questions only; no documentation prompts
        out.append(QuestionItem(question_text="Provide a short product description.", question_type="text"))
        out.append(QuestionItem(question_text="List key materials or ingredients.", question_type="text"))
        out.append(QuestionItem(
            question_text="Does the product comply with relevant safety/compliance regulations?",
            question_type="boolean",
        ))
        if any(k in ctx for k in ("sustain", "eco", "green", "esg", "carbon")):
            out.append(QuestionItem(
                question_text="Is the product certified by any sustainability standards?",
                question_type="select",
                metadata={"options": ["Yes", "No", "In progress"]},
            ))
        # Add only clarifying questions (no requests for documents)
        for a in (payload.answeredQuestions or []):
            if not isinstance(a, dict):
                continue
            answer_text = str(a.get("answerText") or "").strip()
            q_text = a.get("questionText") or a.get("question_text") or "previous answer"
            if not answer_text:
                continue
            ql = (q_text or "").lower()
            # Skip if the original question is already a clarifying prompt
            if ql.startswith("please provide more specific details about"):
                continue
            is_descriptive = any(k in ql for k in ("description", "materials", "ingredients"))
            if not is_descriptive:
                out.append(QuestionItem(
                    question_text=f"Please provide more specific details about: {q_text}",
                    question_type="text",
                ))
        # De-duplicate by normalized question text
        seen = set()
        dedup: List[QuestionItem] = []
        for it in out:
            key = (it.question_text or "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                dedup.append(it)
        return dedup

    if not api_key:
        return heuristic_items()

    try:
        # Build a strict JSON-oriented prompt
        prior_qas = []
        for a in (payload.answeredQuestions or []):
            if isinstance(a, dict):
                prior_qas.append({
                    "question": a.get("questionText") or a.get("question_text"),
                    "answer": a.get("answerText") or a.get("answer_text"),
                })
        prompt = {
            "role": "user",
            "parts": [{
                "text": (
                    "You are an assistant generating follow-up questions for a product transparency form.\n"
                    "Return ONLY a JSON array of objects with keys: question_text (string), question_type (one of: text, boolean, select), metadata (object or null).\n"
                    "- Use product context and prior Q&A.\n"
                    "- Ask concise, high-signal questions (2-5).\n"
                    "- If select type, include metadata.options as an array of strings.\n"
                    "- Avoid duplicates or asking for already-provided info.\n"
                    "- STRICT: Do NOT ask for documentation/evidence/attachments/uploads/certificates. Ask only informational follow-up questions.\n"
                    "- Avoid generic prompts like 'Provide documentation...'.\n"
                    f"Context: {payload.contextText or ''}\n"
                    f"PriorQAs: {json.dumps(prior_qas, ensure_ascii=False)}\n"
                )
            }]
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = {
            "contents": [prompt],
            "generationConfig": {
                "temperature": 0.4,
                "topP": 0.9,
                "topK": 40,
                "maxOutputTokens": 512,
                "responseMimeType": "application/json"
            }
        }
        data = json.dumps(body).encode("utf-8")
        req = urlrequest.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urlrequest.urlopen(req, timeout=15) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
        # Gemini JSON output is in candidates[0].content.parts[0].text
        candidates = resp_data.get("candidates") or []
        text_payload = None
        if candidates:
            content = candidates[0].get("content") or {}
            parts = content.get("parts") or []
            if parts:
                text_payload = parts[0].get("text")
        items: List[QuestionItem] = []
        if text_payload:
            try:
                parsed = json.loads(text_payload)
                if isinstance(parsed, list):
                    for it in parsed[:8]:  # cap count
                        qt = (it.get("question_type") or "text").lower()
                        if qt not in ("text", "boolean", "select"):
                            qt = "text"
                        items.append(QuestionItem(
                            question_text=it.get("question_text") or "",
                            question_type=qt, 
                            metadata=it.get("metadata")
                        ))
            except json.JSONDecodeError:
                pass
        # Post-process LLM output: drop any documentation-style prompts entirely and prevent nested clarifications
        if items:
            ban_words = ("document", "documentation", "evidence", "proof", "upload", "certificate", "attach")
            filtered = []
            seen = set()
            for i in items:
                txt = (i.question_text or "").strip()
                low = txt.lower()
                if any(w in low for w in ban_words):
                    continue
                # prevent nested clarifications like "Please provide more specific details about: Please provide more specific details about: ..."
                if low.startswith("please provide more specific details about: please provide more specific details about"):
                    continue
                key = low
                if key in seen:
                    continue
                seen.add(key)
                filtered.append(i)
            items = filtered
        # Fallback to heuristic if model returned nothing
        if not items:
            return heuristic_items()
        return items
    except (URLError, HTTPError, TimeoutError, Exception):
        # On any error, fallback to heuristic
        return heuristic_items()


@app.post("/transparency-score", response_model=TransparencyScoreResponse)
async def transparency_score(payload: TransparencyScoreRequest):
    # Simple heuristic score: more answered fields => higher score (capped)
    num_answers = len([a for a in payload.answers if a.get("answer_text") or a.get("answer_json")])
    base = min(100.0, 20.0 + num_answers * 8.0)

    # Light adjustments based on product fields
    prod = payload.product or {}
    if prod.get("category"):
        base += 2.5
    if prod.get("sku"):
        base += 2.5

    score = max(0.0, min(100.0, base))
    return TransparencyScoreResponse(score=round(score, 1))
