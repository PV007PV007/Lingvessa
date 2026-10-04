import {createHash} from 'node:crypto';
import type pg from 'pg';
import {assertUuid} from '../../packages/domain/src/identity.js';

/** Operational P5 cost windows, distinct from login and deterministic attempts.
 * One new job consumes one slot; replay/internal retry never consumes another.
 * These are abuse limits, not language scoring thresholds or paid AI budgets. */
export const P5_QUOTAS={speech_processing:30,speech_transport:120,media_generation:60} as const;
export type P5Quota=keyof typeof P5_QUOTAS;
export const p5QuotaKey=(kind:P5Quota,actorId:string)=>createHash('sha256').update(`p5:${kind}:${actorId}`).digest();
export async function takeP5Quota(db:pg.Pool|pg.PoolClient,kind:P5Quota,actorId:string):Promise<boolean>{
 assertUuid(actorId);const limit=P5_QUOTAS[kind];
 const row=(await db.query(`INSERT INTO auth_rate_windows(key_hash,attempts,expires_at) VALUES($1,1,clock_timestamp()+interval '1 minute')
  ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_rate_windows.expires_at<=clock_timestamp() THEN 1 ELSE least(auth_rate_windows.attempts+1,$2+1) END,
   expires_at=CASE WHEN auth_rate_windows.expires_at<=clock_timestamp() THEN clock_timestamp()+interval '1 minute' ELSE auth_rate_windows.expires_at END RETURNING attempts`,[p5QuotaKey(kind,actorId),limit])).rows[0];
 return Number(row.attempts)<=limit;
}
