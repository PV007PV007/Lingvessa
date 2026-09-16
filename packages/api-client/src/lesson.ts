import { z } from 'zod';
import { learnerRunSchema, attemptResultSchema, problemSchema } from '../../activity-schemas/src/learner.js';
import type { LearnerRun } from '../../activity-schemas/src/learner.js';
import type { ActivityResponse, AuthoritativeOutcome } from '../../lesson-engine/src/index.js';

export const P3_API_PATHS = Object.freeze({
  lessonRuns: '/api/v1/lesson-runs',
  lessonRun: '/api/v1/lesson-runs/{id}',
  attempts: '/api/v1/lesson-runs/{id}/attempts',
  exit: '/api/v1/lesson-runs/{id}/exit',
});

export type AttemptCommand = {
  attempt_id: string;
  content_version_id: string;
  item_id: string;
  client_sequence: number;
  intent: 'submit' | 'reveal' | 'continue';
  response: ActivityResponse;
  presentation: { seed: string; order: string[] };
  assistance: { hint_count: number; reveal: boolean };
};

export type AttemptResult = {
  attempt_id: string;
  outcome: AuthoritativeOutcome;
  feedback: string;
  evaluator_version: string;
  answer_policy_version: string;
  run: { id: string; state: 'active' | 'remediation' | 'completed'; position: number; revision: number; current_activity_id: string | null; unresolved_count: number };
  replayed: boolean;
};

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail_safe: string;
  correlation_id: string;
  field_errors?: Array<{ path: string; code: string }> | undefined;
};

export class ApiProblem extends Error {
  constructor(public readonly problem: ProblemDetails) { super(problem.detail_safe); this.name = 'ApiProblem'; }
}

export class LessonApiClient {
  constructor(private readonly baseUrl: string, private readonly csrfToken: () => string) {}

  async startRun(input: { language_profile_id: string; publication_id: string; lesson_id: string }): Promise<LearnerRun> {
    return learnerRunSchema.parse(await this.request(P3_API_PATHS.lessonRuns, 'POST', input));
  }

  async getRun(runId: string): Promise<LearnerRun> { return learnerRunSchema.parse(await this.request(`${P3_API_PATHS.lessonRuns}/${runId}`, 'GET')); }

  async listRuns(languageProfileId: string): Promise<LearnerRun[]> {
    return z.array(learnerRunSchema).parse(await this.request(`${P3_API_PATHS.lessonRuns}?language_profile_id=${encodeURIComponent(languageProfileId)}`, 'GET'));
  }

  async submitAttempt(runId: string, command: AttemptCommand): Promise<AttemptResult> {
    return attemptResultSchema.parse(await this.request(`${P3_API_PATHS.lessonRuns}/${runId}/attempts`, 'POST', command));
  }

  async exitRun(runId: string, expectedRevision: number, acknowledgeUnresolved: boolean): Promise<LearnerRun> {
    return learnerRunSchema.parse(await this.request(`${P3_API_PATHS.lessonRuns}/${runId}/exit`, 'POST', { expected_revision: expectedRevision, acknowledge_unresolved: acknowledgeUnresolved }));
  }

  private async request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(method === 'POST' ? { 'x-csrf-token': this.csrfToken() } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json() as unknown;
    if (!response.ok) throw new ApiProblem(problemSchema.parse(result));
    return result;
  }
}

export type QueueRecord = { command: AttemptCommand; run_id: string; queued_at: string };
export interface QueueStorage {
  read(): Promise<QueueRecord[]>;
  write(records: QueueRecord[]): Promise<void>;
}

const sensitiveKey = /(?:raw[_-]?audio|password|secret|authorization|cookie|provider[_-]?key|access[_-]?token|refresh[_-]?token)/iu;

function assertNonSensitive(value: unknown, path = ''): void {
  if (Array.isArray(value)) { value.forEach((entry, index) => assertNonSensitive(entry, `${path}[${index}]`)); return; }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (sensitiveKey.test(key)) throw new TypeError(`Sensitive field is forbidden in offline queue: ${path}${key}`);
      assertNonSensitive(nested, `${path}${key}.`);
    }
  }
}

/** IndexedDB adapters implement QueueStorage in the browser; this policy layer is deterministic and testable. */
export class UnsentAttemptQueue {
  constructor(private readonly storage: QueueStorage, private readonly cap = 50, private readonly retentionMs = 24 * 60 * 60 * 1000) {
    if (!Number.isInteger(cap) || cap < 1 || retentionMs < 1) throw new TypeError('Queue limits must be positive');
  }

  async enqueue(record: QueueRecord, now = Date.now()): Promise<void> {
    assertNonSensitive(record);
    const records = await this.retained(now);
    const duplicate = records.find((saved) => saved.command.attempt_id === record.command.attempt_id);
    if (duplicate) {
      if (JSON.stringify(duplicate) !== JSON.stringify(record)) throw new TypeError('Attempt ID reused with a different queued payload');
      return;
    }
    if (records.length >= this.cap) throw new RangeError('Offline attempt queue retention cap reached');
    records.push(structuredClone(record));
    records.sort((left, right) => left.command.client_sequence - right.command.client_sequence || left.queued_at.localeCompare(right.queued_at));
    await this.storage.write(records);
  }

  async pending(now = Date.now()): Promise<QueueRecord[]> { return this.retained(now); }

  async acknowledge(attemptId: string, now = Date.now()): Promise<void> {
    await this.storage.write((await this.retained(now)).filter((record) => record.command.attempt_id !== attemptId));
  }

  private async retained(now: number): Promise<QueueRecord[]> {
    const stored = await this.storage.read();
    const records = stored.filter((record) => {
      const timestamp = Date.parse(record.queued_at);
      return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= this.retentionMs;
    });
    if (records.length > this.cap) throw new RangeError('Stored offline queue exceeds its configured cap');
    if (records.length !== stored.length) await this.storage.write(records);
    return records;
  }
}
