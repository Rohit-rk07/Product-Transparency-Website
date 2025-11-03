import pg, { type QueryResultRow } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<{ rows: T[] }>{
  const res = await pool.query<T>(text, params as any);
  return { rows: res.rows as T[] };
}
