import { Router, type Request, type Response } from 'express';
import { query } from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();

function signToken(payload: any){
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, companyName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows[0]) return res.status(409).json({ error: 'email already registered' });

  let companyId: string | null = null;
  if (companyName && typeof companyName === 'string' && companyName.trim()){
    const c = await query<{ id: string }>(`INSERT INTO companies (name) VALUES ($1) RETURNING id`, [companyName.trim()]);
    companyId = c.rows[0].id;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const u = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, company_id) VALUES ($1,$2,$3) RETURNING id`,
    [email, password_hash, companyId]
  );
  const token = signToken({ user_id: u.rows[0].id, company_id: companyId });
  res.json({ token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const u = await query<{ id: string; password_hash: string | null; company_id: string | null }>(
    `SELECT id, password_hash, company_id FROM users WHERE email = $1`,
    [email]
  );
  const user = u.rows[0];
  if (!user || !user.password_hash) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = signToken({ user_id: user.id, company_id: user.company_id });
  res.json({ token });
});

export default router;
