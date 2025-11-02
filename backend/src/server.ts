import express, { type Request, type Response, type NextFunction } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import productsRouter from './routes/products.js';
import aiRouter from './routes/ai.js';
import cors from 'cors';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/ai', aiRouter);

// Basic error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API up on http://localhost:${port}`));
