import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction){
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret) as any;
    (req as any).user = { user_id: payload.user_id, company_id: payload.company_id };
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}
