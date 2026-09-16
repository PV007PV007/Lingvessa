import type pg from 'pg';
import { transaction } from './database.js';

export type OutboxEnvelope = {
  id: string;
  event_key: string;
  event_type: string;
  event_version: number;
  aggregate_id: string;
  correlation_id: string;
  causation_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

export class OutboxRepository {
  constructor(private readonly pool: pg.Pool) {}

  async claim(consumer: string, limit = 20, now = new Date()): Promise<OutboxEnvelope[]> {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(consumer) || !Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new TypeError('Invalid outbox consumer/limit');
    return transaction(this.pool, async (db) => {
      await db.query(`INSERT INTO outbox_deliveries(event_id,consumer)
        SELECT id,$1 FROM outbox_events ON CONFLICT DO NOTHING`, [consumer]);
      await db.query(`UPDATE outbox_deliveries SET status='terminal_failure',completed_at=$2,lease_expires_at=NULL,last_error_code='LEASE_RETRIES_EXHAUSTED'
        WHERE consumer=$1 AND status IN ('pending','processing') AND attempt_count>=8 AND (lease_expires_at IS NULL OR lease_expires_at<=$2)`, [consumer,now]);
      const due = (await db.query(`SELECT d.event_id FROM outbox_deliveries d
        WHERE d.consumer=$1 AND d.status IN ('pending','processing') AND d.next_attempt_at<=$2 AND d.attempt_count<8
          AND (d.lease_expires_at IS NULL OR d.lease_expires_at<=$2)
        ORDER BY d.next_attempt_at,d.event_id FOR UPDATE SKIP LOCKED LIMIT $3`, [consumer,now,limit])).rows;
      if (!due.length) return [];
      const ids = due.map((row) => row.event_id as string);
      await db.query(`UPDATE outbox_deliveries SET status='processing',attempt_count=attempt_count+1,
        lease_expires_at=$3::timestamptz + interval '30 seconds'
        WHERE consumer=$1 AND event_id=ANY($2::uuid[])`, [consumer,ids,now]);
      return (await db.query(`SELECT e.id,e.event_key,e.event_type,e.event_version,e.aggregate_id,e.correlation_id,e.causation_id,e.payload,d.attempt_count
        FROM outbox_events e JOIN outbox_deliveries d ON d.event_id=e.id
        WHERE d.consumer=$1 AND e.id=ANY($2::uuid[]) ORDER BY e.created_at,e.id`, [consumer,ids])).rows as OutboxEnvelope[];
    });
  }

  async succeed(consumer: string, eventId: string, leaseAttempt: number): Promise<boolean> {
    const settled=await this.pool.query(`UPDATE outbox_deliveries SET status='succeeded',completed_at=COALESCE(completed_at,now()),lease_expires_at=NULL,last_error_code=NULL
      WHERE consumer=$1 AND event_id=$2 AND status='processing' AND attempt_count=$3`, [consumer,eventId,leaseAttempt]);
    return settled.rowCount===1;
  }

  async fail(consumer: string, eventId: string, errorCode: string, retryable: boolean, leaseAttempt: number, now = new Date()): Promise<'retry' | 'terminal' | 'stale'> {
    if (!/^[A-Z0-9_]{1,64}$/u.test(errorCode)) throw new TypeError('Safe bounded error code required');
    return transaction(this.pool, async (db) => {
      const row = (await db.query(`SELECT attempt_count,status FROM outbox_deliveries WHERE consumer=$1 AND event_id=$2 FOR UPDATE`, [consumer,eventId])).rows[0];
      if (!row) throw new TypeError('Unknown outbox delivery');
      if(row.status!=='processing'||Number(row.attempt_count)!==leaseAttempt)return 'stale';
      const terminal = !retryable || Number(row.attempt_count) >= 8;
      if (terminal) {
        await db.query(`UPDATE outbox_deliveries SET status='terminal_failure',completed_at=$3,lease_expires_at=NULL,last_error_code=$4 WHERE consumer=$1 AND event_id=$2`, [consumer,eventId,now,errorCode]);
        return 'terminal';
      }
      const attempt = Number(row.attempt_count);
      const jitterMs = (Number.parseInt(eventId.replaceAll('-', '').slice(0, 6), 16) + attempt * 977) % 1000;
      const delayMs = Math.min(60_000, 250 * 2 ** Math.max(0, attempt - 1)) + jitterMs;
      await db.query(`UPDATE outbox_deliveries SET status='pending',next_attempt_at=$3::timestamptz + ($4::text || ' milliseconds')::interval,
        lease_expires_at=NULL,last_error_code=$5 WHERE consumer=$1 AND event_id=$2`, [consumer,eventId,now,delayMs,errorCode]);
      return 'retry';
    });
  }

  async metrics(): Promise<Array<{ consumer: string; status: string; count: number; max_attempts: number; oldest_seconds: number }>> {
    return (await this.pool.query(`SELECT d.consumer,d.status,count(*)::int AS count,max(d.attempt_count)::int AS max_attempts,
      floor(extract(epoch FROM now()-min(e.created_at)))::int AS oldest_seconds
      FROM outbox_deliveries d JOIN outbox_events e ON e.id=d.event_id
      GROUP BY d.consumer,d.status ORDER BY d.consumer,d.status`)).rows;
  }
}

export function startOutboxLoop(repository: OutboxRepository, consumer: string, handle: (event: OutboxEnvelope) => Promise<void>, intervalMs = 1000): () => void {
  let stopped = false; let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      for (const event of await repository.claim(consumer)) {
        try { await handle(event); await repository.succeed(consumer, event.id,event.attempt_count); }
        catch { await repository.fail(consumer, event.id, 'CONSUMER_FAILURE', true,event.attempt_count); }
      }
    } catch { /* Durable delivery stays retryable; readiness separately reports database loss. */ }
    finally { running = false; }
  };
  const timer = setInterval(() => void tick(), intervalMs); timer.unref(); void tick();
  return () => { stopped = true; clearInterval(timer); };
}
