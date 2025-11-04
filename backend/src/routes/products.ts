import { Router, type Request, type Response } from 'express';
import { query } from '../db.js';
import axios from 'axios';
import { z } from 'zod';
import { generatePdfFromHtml } from '../pdf.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category: z.string().optional(),
  companyId: z.string().uuid().optional(),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { name, sku, category, companyId } = parsed.data;
  const auth = (req as any).user as { user_id?: string; company_id?: string } | undefined;
  const result = await query<{ id: string }>(
    `INSERT INTO products (name, sku, category, company_id, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, sku ?? null, category ?? null, (auth?.company_id ?? companyId) ?? null, auth?.user_id ?? null]
  );
  res.json({ id: result.rows[0].id });
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const product = await query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (!product.rows[0]) return res.status(404).json({ error: 'Not found' });
  const questions = await query(`SELECT * FROM questions WHERE product_id = $1 ORDER BY order_index ASC, created_at ASC`, [id]);
  const answers = await query(`SELECT * FROM answers WHERE product_id = $1 ORDER BY answered_at ASC`, [id]);
  res.json({ product: product.rows[0], questions: questions.rows, answers: answers.rows });
});

router.post('/:id/questions', async (req: Request, res: Response) => {
  const id = req.params.id;
  const { question_text, question_type, metadata, order_index, parent_question_id } = req.body || {};
  if (!question_text || !question_type) return res.status(400).json({ error: 'question_text and question_type required' });
  const q = await query<{ id: string }>(
    `INSERT INTO questions (product_id, question_text, question_type, metadata, order_index, parent_question_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [id, question_text, question_type, metadata ?? null, order_index ?? 0, parent_question_id ?? null]
  );
  res.json({ id: q.rows[0].id });
});

router.post('/:id/answers', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  for (const a of answers) {
    const qid = isUUID(a.questionId) ? a.questionId : null;
    await query(
      `INSERT INTO answers (product_id, question_id, answer_text, answer_json) VALUES ($1,$2,$3,$4)`,
      [id, qid, a.answerText ?? null, a.answerJson ?? null]
    );
  }
  res.json({ success: true });
});

router.post('/:id/generate-report', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  const product = await query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (!product.rows[0]) return res.status(404).json({ error: 'Not found' });
  const answers = await query(
    `SELECT a.*, q.question_text FROM answers a
     LEFT JOIN questions q ON q.id = a.question_id
     WHERE a.product_id = $1
     ORDER BY a.answered_at ASC`,
    [id]
  );

  // optional: call AI for score
  let transparency_score: number | null = null;
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    const scoreResp = await axios.post(`${aiUrl}/transparency-score`, {
      product: product.rows[0],
      answers: answers.rows,
    });
    transparency_score = scoreResp.data?.score ?? null;
  } catch (e) {
    // ignore for demo
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report</title>
  <style>body{font-family: Arial, sans-serif;padding:24px} h1{margin-bottom:4px} .item{margin:8px 0}</style>
  </head><body>
  <h1>Product Transparency Report</h1>
  <div class="item"><strong>Name:</strong> ${product.rows[0].name}</div>
  <div class="item"><strong>SKU:</strong> ${product.rows[0].sku ?? ''}</div>
  <div class="item"><strong>Category:</strong> ${product.rows[0].category ?? ''}</div>
  <div class="item"><strong>Transparency Score:</strong> ${transparency_score ?? 'N/A'}</div>
  <h2>Answers</h2>
  <ul>
    ${answers.rows
      .map((a: any) => {
        const label = (a.question_text ?? a.question_id ?? '').toString();
        const val = (a.answer_text ?? (a.answer_json ? JSON.stringify(a.answer_json) : '') ?? '').toString();
        return `<li><strong>${label}</strong>: ${val}</li>`;
      })
      .join('')}
  </ul>
  </body></html>`;

  const pdf = await generatePdfFromHtml(html);
  // For demo, return base64. In prod, upload to storage and store URL.
  const report = await query<{ id: string }>(
    `INSERT INTO reports (product_id, company_id, report_json, transparency_score, pdf_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [id, product.rows[0].company_id ?? null, { generatedAt: new Date().toISOString() } as any, transparency_score, null]
  );
  res.json({
    success: true,
    report: { id: report.rows[0].id, pdf_base64: pdf.toString('base64') }
  });
});

export default router;
