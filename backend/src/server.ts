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
// Normalize allowed origins and enable robust CORS including preflight
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // non-browser or same-origin
    const cleaned = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(cleaned)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
