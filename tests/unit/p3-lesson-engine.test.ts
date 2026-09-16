import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executableLessonFixtureSchema } from '../../packages/content-tools/src/p3-fixture.js';
import type { ActivityContract } from '../../packages/activity-schemas/src/lesson.js';
import { activityContractSchema } from '../../packages/activity-schemas/src/lesson.js';
import { evaluateActivity, loadPinnedManifest, mayAutoAdvance, registeredActivities, resolveActivity, lessonPlayerReducer } from '../../packages/lesson-engine/src/index.js';
import { P3_API_PATHS, UnsentAttemptQueue } from '../../packages/api-client/src/lesson.js';
import type { QueueRecord, QueueStorage } from '../../packages/api-client/src/lesson.js';
import { verifyProviderCallback } from '../../packages/provider-adapters/src/callback.js';

const fixtures = ['en', 'cs'].map((language) => executableLessonFixtureSchema.parse(
  JSON.parse(readFileSync(`content/fixtures/p3/${language}-lesson.json`, 'utf8')),
));

test('P3 executable EN/CS fixtures share schema, registry and deterministic renderer path', () => {
  assert.equal(fixtures.length, 2);
  for (const fixture of fixtures) {
    assert.equal(fixture.activities.length, 2);
    for (const activity of fixture.activities) {
      const resolved = resolveActivity(activity);
      assert.equal(resolved.status, 'supported');
      if (resolved.status === 'supported') {
        const view = resolved.adapter.render(resolved.activity);
        assert.equal(view.prompt, activity.presentation.prompt);
        assert.equal(view.activity_id, activity.id);
        assert(!JSON.stringify(view).includes('provider'));
      }
    }
  }
  assert.deepEqual(fixtures.map((fixture) => fixture.activities.map((activity) => activity.type)), [
    ['multiple_choice','classification'], ['multiple_choice','classification'],
  ]);
});

test('P3 registry covers every locked core family for schema major 1 with EN/CS fixtures', () => {
  const entries = registeredActivities();
  assert.equal(entries.length, 31);
  assert.deepEqual(new Set(entries.map((entry) => entry.family)), new Set(['intro','selection','mapping','construction','production','receptive','dialogue','speech','grammar','assessment','result']));
  assert(entries.every((entry) => entry.schema_major === 1 && entry.fixture_languages.join(',') === 'en,cs'));
  assert(entries.filter((entry) => entry.deferred_to_phase === 'P5').every((entry) => ['listen_repeat','read_aloud'].includes(entry.type)));
  assert.equal(resolveActivity({ ...fixtures[0]!.activities[0], schema_version: '2.0' }).status, 'recoverable_error');
  assert.equal(resolveActivity({ ...fixtures[0]!.activities[0], type: 'unknown' }).status, 'recoverable_error');
});

test('P3 deterministic evaluation is server-policy based and language-aware', () => {
  const en = fixtures[0]!.activities[0]!;
  const cs = fixtures[1]!.activities[0]!;
  assert.equal(evaluateActivity(en, { kind: 'single', option_id: 'hello' }).result, 'correct');
  assert.equal(evaluateActivity(en, { kind: 'single', option_id: 'goodbye' }).result, 'incorrect');
  assert.equal(evaluateActivity(cs, { kind: 'single', option_id: 'dobry_den' }).result, 'correct');
  const text = structuredClone(cs) as ActivityContract;
  text.type = 'full_typing'; text.response.kind = 'text'; text.response.answer_policy.mode = 'text';
  delete text.response.answer_policy.accepted_option_ids;
  text.response.answer_policy.accepted_text = ['Dobrý den'];
  assert.equal(activityContractSchema.parse(text).language, 'cs');
  assert.equal(evaluateActivity(text, { kind: 'text', text: 'Dobrý den.' }).result, 'correct');
  assert.equal(evaluateActivity(text, { kind: 'text', text: 'Dobry den' }).result, 'incorrect');
  const aiOptional = { ...en, runtime: { ...en.runtime, optional_ai: { capability: 'explain', deterministic_fallback: 'Use stored feedback.' } } };
  assert.equal(resolveActivity(aiOptional).status, 'supported');
  assert.equal(evaluateActivity(activityContractSchema.parse(aiOptional), { kind: 'single', option_id: 'hello' }).result, 'correct');
});

test('P3 authored ambiguity and incompatible family policy are recoverable before attempt creation', () => {
  const activity = structuredClone(fixtures[0]!.activities[0]!);
  activity.presentation.options![1]!.label = activity.presentation.options![0]!.label;
  assert.equal(resolveActivity(activity).status, 'recoverable_error');
  const wrongFamily = structuredClone(fixtures[0]!.activities[0]!); wrongFamily.type = 'matching';
  assert.equal(resolveActivity(wrongFamily).status, 'recoverable_error');
});

test('P3 LessonPlayer reducer has one primary state, correct-or-reveal and no dead end', () => {
  let state = lessonPlayerReducer({ kind: 'loading' }, { type: 'LOADED', activity_id: 'a', position: 0, revision: 1 });
  state = lessonPlayerReducer(state, { type: 'SUBMIT', attempt_id: 'attempt-1' });
  state = lessonPlayerReducer(state, { type: 'AUTHORITATIVE_RESULT', outcome: 'incorrect', attempt_id: 'attempt-1', feedback: 'Try again', revision: 2 });
  assert.equal(state.kind, 'incorrect');
  assert.throws(() => lessonPlayerReducer(state, { type: 'NEXT', revision: 2 }));
  state = lessonPlayerReducer(state, { type: 'RETRY' });
  state = lessonPlayerReducer(state, { type: 'SUBMIT', attempt_id: 'attempt-2' });
  state = lessonPlayerReducer(state, { type: 'AUTHORITATIVE_RESULT', outcome: 'assisted', attempt_id: 'attempt-2', feedback: 'Revealed', revision: 3 });
  assert.equal(state.kind, 'assisted'); assert.equal(mayAutoAdvance(state, true), true);
  state = lessonPlayerReducer(state, { type: 'NEXT', activity_id: 'a', position: 0, revision: 3, remediation_count: 1 });
  assert.equal(state.kind, 'remediation');
  const unavailable = lessonPlayerReducer({ kind: 'active', activity_id: 'a', position: 0, revision: 1 }, { type: 'AI_UNAVAILABLE', reason: 'disabled' });
  assert.equal(unavailable.kind, 'active');
  assert.throws(() => lessonPlayerReducer(unavailable, { type: 'NEXT', revision: 1 }));
});

class MemoryQueueStorage implements QueueStorage {
  records: QueueRecord[] = [];
  async read() { return structuredClone(this.records); }
  async write(records: QueueRecord[]) { this.records = structuredClone(records); }
}

const queued = (sequence: number, attemptId = randomUUID()): QueueRecord => ({
  run_id: randomUUID(), queued_at: new Date(1_700_000_000_000 + sequence).toISOString(),
  command: { attempt_id: attemptId, content_version_id: randomUUID(), item_id: randomUUID(), client_sequence: sequence, intent: 'submit',
    response: { kind: 'single', option_id: 'hello' }, presentation: { seed: 's', order: ['hello'] }, assistance: { hint_count: 0, reveal: false } },
});

test('P3 offline queue preserves IDs/order, deduplicates, caps retention and rejects sensitive fields', async () => {
  const storage = new MemoryQueueStorage(); const queue = new UnsentAttemptQueue(storage, 2, 100_000);
  const later = queued(2); const earlier = queued(1);
  await queue.enqueue(later, 1_700_000_000_010); await queue.enqueue(earlier, 1_700_000_000_010); await queue.enqueue(earlier, 1_700_000_000_010);
  assert.deepEqual((await queue.pending(1_700_000_000_010)).map((entry) => entry.command.client_sequence), [1,2]);
  await assert.rejects(queue.enqueue(queued(3), 1_700_000_000_010), /cap/u);
  const bad = queued(3) as QueueRecord & { raw_audio?: string }; bad.raw_audio = 'bytes';
  await assert.rejects(queue.enqueue(bad, 1_700_000_000_010), /Sensitive/u);
  await queue.acknowledge(earlier.command.attempt_id, 1_700_000_000_010);
  assert.equal((await queue.pending(1_700_000_000_010)).length, 1);
});

test('P3 OpenAPI and typed client agree on lesson paths; provider callback primitive rejects replay/stale/identity mismatch', () => {
  const api = JSON.parse(readFileSync('infra/contracts/p3.openapi.json', 'utf8')) as { openapi: string; paths: Record<string, unknown> };
  assert.equal(api.openapi, '3.1.2');
  for (const path of Object.values(P3_API_PATHS)) assert(path.replace('/api/v1','') in api.paths);
  const claims = { job_id: randomUUID(), provider_id: 'synthetic-provider', model_version: 'model-v1', timestamp: new Date(1_700_000_000_000).toISOString(), nonce: 'nonce-1' };
  const payload = [claims.job_id,claims.provider_id,claims.model_version,claims.timestamp,claims.nonce].join('\n');
  const signature = createHmac('sha256','test-secret').update(payload).digest('hex');
  assert.equal(verifyProviderCallback(claims,signature,'test-secret','synthetic-provider','model-v1',() => false,1_700_000_000_000), true);
  assert.equal(verifyProviderCallback(claims,signature,'test-secret','other','model-v1',() => false,1_700_000_000_000), false);
  assert.equal(verifyProviderCallback(claims,signature,'test-secret','synthetic-provider','model-v1',() => true,1_700_000_000_000), false);
  assert.equal(verifyProviderCallback(claims,signature,'test-secret','synthetic-provider','model-v1',() => false,1_700_999_000_000), false);
});

test('P3 manifest loader pins exact publication/content/language and rejects missing pin', () => {
  const fixture = fixtures[0]!;
  const manifest = { schema_version: '1.7', publication_id: randomUUID(), publication_checksum: 'a'.repeat(64), lesson_id: fixture.lesson_id,
    content_version_id: fixture.content_version_id, language_id: fixture.language_id, language: fixture.language, variety: 'en-GB', activities: fixture.activities };
  assert.equal(loadPinnedManifest(manifest).status, 'ready');
  assert.equal(loadPinnedManifest({ ...manifest, content_version_id: randomUUID() }).status, 'recoverable_error');
});
