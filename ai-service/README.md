# AI Service (FastAPI)

Minimal AI microservice to support dynamic question generation and transparency scoring.

## Endpoints
- POST /generate-questions
- POST /transparency-score
- GET /health

## Run locally

```bash
# In a terminal from ai-service/
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Configure backend .env to point to this service if needed:
```
AI_SERVICE_URL=http://127.0.0.1:8000
```
