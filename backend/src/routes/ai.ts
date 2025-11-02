import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/generate-questions', requireAuth, async (req: Request, res: Response) => {
  const { productId, answeredQuestions, contextText } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });
  try {
    // Enrich answeredQuestions with questionText for AI heuristics
    let enrichedAnswered = Array.isArray(answeredQuestions) ? answeredQuestions : [];
    const ids = enrichedAnswered
      .map((a: any) => a?.questionId)
      .filter((v: any) => typeof v === 'string');
    if (ids.length) {
      // Build a single query to fetch texts
      const params = ids.map((_, i) => `$${i + 1}`).join(',');
      const q = await query<{ id: string; question_text: string }>(
        `SELECT id, question_text FROM questions WHERE id IN (${params})`,
        ids
      );
      const map = new Map(q.rows.map((r) => [r.id, r.question_text] as const));
      enrichedAnswered = enrichedAnswered.map((a: any) => ({
        ...a,
        questionText: a.questionText ?? (a.questionId ? map.get(a.questionId) : undefined),
      }));
    }

    const aiUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    const r = await axios.post(`${aiUrl}/generate-questions`, { productId, answeredQuestions: enrichedAnswered, contextText });
    const items: any[] = Array.isArray(r.data) ? r.data : [];

    // Load existing questions for product to avoid duplicates
    const existing = await query<{ question_text: string }>(
      `SELECT question_text FROM questions WHERE product_id = $1`,
      [productId]
    );
    const seen = new Set<string>(
      existing.rows.map((q) => q.question_text.trim().toLowerCase())
    );

    const out: any[] = [];
    const attempted = items.length;
    let nextIndex = 0;
    for (const it of items) {
      const key = String(it.question_text || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue; // skip duplicates or empty
      seen.add(key);
      const ins = await query<{ id: string }>(
        `INSERT INTO questions (product_id, question_text, question_type, metadata, order_index) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [productId, it.question_text, it.question_type, it.metadata ?? null, nextIndex]
      );
      out.push({ ...it, id: ins.rows[0].id, order_index: nextIndex });
      nextIndex += 1;
    }
    const dedupedAll = attempted > 0 && out.length === 0;
    res.json({ questions: out, dedupedAll });
  } catch (e) {
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

export default router;
