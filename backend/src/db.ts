import pg, { type QueryResultRow } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const useSSL = /sslmode=require/i.test(connectionString || '') || process.env.DATABASE_SSL === 'true' || !!process.env.RENDER;

export const pool = new pg.Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<{ rows: T[] }>{
  const res = await pool.query<T>(text, params as any);
  return { rows: res.rows as T[] };
}
