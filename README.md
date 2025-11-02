# Product Transparency Platform

A full‑stack web app to collect detailed product data using dynamic, intelligent follow‑up questions and generate a structured Product Transparency Report.


- Frontend: React + TypeScript + Vite + TailwindCSS
- Backend: Node.js (Express) + PostgreSQL (SQL schema + migrations)
- AI Service: FastAPI microservice with Gemini LLM integration (fallback heuristic)
- PDF: HTML → PDF via backend endpoint

## Folder structure

- /frontend
- /backend
- /ai-service
- /db
- /design (optional, for style guide / Figma links)

---

## Setup instructions

Prereqs:
- Node.js 18+ (dev used 22)
- Python 3.10+
- PostgreSQL 14+ (or Docker)

### 1) Database

Option A: Docker
- docker run --name pg-altibbe -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=altibbe -p 5432:5432 -d postgres:16

Option B: Local Postgres
- Create database: altibbe

Apply schema:
- psql -h 127.0.0.1 -U user -d altibbe -f db/migrations/001_init.sql

### 2) Backend (Express)

Env: backend/.env
```
DATABASE_URL=postgres://user:password@127.0.0.1:5432/altibbe
AI_SERVICE_URL=http://127.0.0.1:8000
JWT_SECRET=replace_me
PORT=4000
```
Install & run:
```
cd backend
npm i
npm run dev
```
Server: http://localhost:4000

### 3) AI Service (FastAPI)

Env: ai-service/.env
```
GEMINI_API_KEY=YOUR_KEY
GEMINI_MODEL=gemini-1.5-flash
```
Run:
```
cd ai-service
pip install -r requirements.txt  # if present, else: pip install fastapi uvicorn
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Health: http://127.0.0.1:8000/health

### 4) Frontend (React + Vite)

Env (optional): frontend/.env
```
VITE_API_BASE=http://localhost:4000
```
Install & run:
```
cd frontend
npm i
npm run dev
```
App: http://localhost:5173

---

## Feature list

- Auth-first UX (signup/login with JWT; logout)
- Create Product (name, SKU, category)
- Dynamic Q&A
  - Generate initial questions
  - Save answers to generate AI follow-ups
  - Deduplication per product to avoid repeats
- PDF Report
  - Generate and preview/download
- Dark, responsive UI (TailwindCSS)

Nice-to-have implemented:
- Gemini LLM integration with fallback heuristic
- Anti-repetition filters (no documentation prompts, no nested clarifications)
- Info message when no new follow-ups are added

---

## AI service documentation

Base URL: http://127.0.0.1:8000

- POST /generate-questions
  - Request
    ```json
    {
      "productId": "<id>",
      "answeredQuestions": [
        { "questionText": "...", "answerText": "..." }
      ],
      "contextText": "optional contextual hint"
    }
    ```
  - Response (array of items; backend wraps to persist + return IDs)
    ```json
    [
      { "question_text": "...", "question_type": "text|boolean|select", "metadata": {"options": ["…"]} }
    ]
    ```
  - Notes
    - If GEMINI_API_KEY is set, uses Gemini via REST.
    - Filters out documentation/attachment requests and nested duplicates.

- POST /transparency-score (optional heuristic)
  - Request: `{ product: {...}, answers: [...] }`
  - Response: `{ score: number }`

---

## Backend API (selected)

- POST /api/auth/signup → { token }
- POST /api/auth/login → { token }
- POST /api/products → create product → { id }
- GET /api/products/:id → { product, questions, answers }
- POST /api/products/:id/answers → save answers
- POST /api/ai/generate-questions → persist unique AI questions → { questions: [..], dedupedAll?: bool }
- POST /api/products/:id/generate-report → { report: { id, pdf_base64 } }

Auth: Bearer token required for mutations.

---

## Sample product entry + example report

Example product:
- Name: HydroPure Insulated Bottle 750ml
- SKU: HPB-750-SS-2025
- Category: Kitchen & Dining
- Context: "Focus on sustainability (materials, recycling, certifications) and safety (BPA-free, food-grade)."

Typical initial questions:
- Provide a short product description.
- List key materials or ingredients.
- Does the product comply with relevant safety/compliance regulations?
- Is the product certified by any sustainability standards?

Example follow-ups:
- Please provide more specific details about: Does the product comply with relevant safety/compliance regulations?
- Please provide more specific details about: Is the product certified by any sustainability standards?

Report:
- Use the "Generate PDF Report" button. The report downloads and can be previewed inline.

---

## Reflection (~200 words)

I used AI tools in two ways. First, I built an AI microservice to generate dynamic, context‑aware questions from prior Q&A, replacing brittle hardcoded logic. I integrated Gemini as the primary provider via REST with environment‑based configuration and added a heuristic fallback to preserve reliability during outages. Second, AI‑assisted coding (for example, inline completions and refactors) helped me move faster on routine tasks while I kept control over architecture and safety decisions.

Architecturally, I separated concerns: React UI (auth‑first, responsive, accessible) → Express API (auth, persistence, PDF) → FastAPI AI service (question generation). This boundary lets me evolve the AI independently and enforce deduplication and validation at the backend before persisting any questions. I added defensive filters to avoid low‑value prompts (documentation requests, nested clarifications) and a clear signal to the UI when no new follow‑ups are produced.

For product transparency, I emphasized clarity and trust: simple language, consistent inputs, and a PDF report that mirrors the captured data. I bias toward concise, high‑signal follow‑ups and avoid noisy or burdensome requests. I enforce security and data integrity with JWT auth, per‑product dedupe, and explicit schemas. My goal was to deliver a practical foundation that can be extended with richer scoring, audits, and branded report templates.
