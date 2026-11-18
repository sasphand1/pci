import pg from 'pg';
import { config } from './config.js';
const { Pool } = pg;
export const pool = new Pool({connectionString: config.DATABASE_URL, max: 12, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000});
export const query = <T extends pg.QueryResultRow = any>(sql: string, values: unknown[] = []) => pool.query<T>(sql, values);
export async function transaction<T>(f: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const c=await pool.connect();
  try { await c.query('BEGIN'); const value=await f(c); await c.query('COMMIT'); return value; }
  catch(e) { await c.query('ROLLBACK'); throw e; } finally {c.release();}
}
