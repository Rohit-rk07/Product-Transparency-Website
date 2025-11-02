const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export type Product = { id: string; name: string; sku?: string | null; category?: string | null };
export type Question = { id: string; question_text: string; question_type: string; metadata?: any; order_index: number };
export type AnswerInput = { questionId?: string; answerText?: string | null; answerJson?: any };

let token: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || null;
export function setToken(t: string | null){
  token = t;
  if (typeof localStorage !== 'undefined'){
    if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
  }
}
function authHeaders(){
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function signup(payload: { email: string; password: string; companyName?: string }){
  const r = await fetch(`${API_BASE}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Signup failed');
  const data = await r.json() as { token: string };
  setToken(data.token);
  return data;
}

export async function login(payload: { email: string; password: string }){
  const r = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Login failed');
  const data = await r.json() as { token: string };
  setToken(data.token);
  return data;
}

export async function createProduct(payload: { name: string; sku?: string; category?: string; companyId?: string }){
  const r = await fetch(`${API_BASE}/api/products`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

export async function fetchProduct(productId: string){
  const r = await fetch(`${API_BASE}/api/products/${productId}`);
  if (!r.ok) throw new Error('Not found');
  return r.json() as Promise<{ product: Product; questions: Question[]; answers: any[] }>;
}

export async function addAnswers(productId: string, answers: AnswerInput[]){
  const r = await fetch(`${API_BASE}/api/products/${productId}/answers`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ answers }) });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

export async function generateQuestions(productId: string, answeredQuestions: any[], contextText?: string){
  const r = await fetch(`${API_BASE}/api/ai/generate-questions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ productId, answeredQuestions, contextText }) });
  if (!r.ok) throw new Error('AI failed');
  return r.json() as Promise<{ questions: Question[]; dedupedAll?: boolean }>;
}

export async function generateReport(productId: string){
  const r = await fetch(`${API_BASE}/api/products/${productId}/generate-report`, { method: 'POST', headers: authHeaders() });
  if (!r.ok) throw new Error('Report failed');
  return r.json() as Promise<{ report: { id: string; pdf_base64: string } }>;
}
