import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { referenceFixtureSchema } from '../../packages/content-tools/src/fixture.js';
import { activityMetadataSchema, skillFacetMatrix, isSkillFacet, validateContent } from '../../packages/activity-schemas/src/content.js';
import { normalizeText, isUuid, languageIds } from '../../packages/domain/src/identity.js';
import { resolveAuthoringReferences } from '../../packages/application/src/content.js';
import { hashPassword, verifyPassword, passwordPolicy } from '../../infra/security/passwords.js';

test('P2 canonical registry: six skills, 21 facets, 33 allowed pairs; no arbitrary combinations', () => {
  assert.equal(Object.keys(skillFacetMatrix).length, 6);
  assert.equal(new Set(Object.values(skillFacetMatrix).flat()).size, 21);
  assert.equal(Object.values(skillFacetMatrix).flat().length, 33);
  assert.equal(isSkillFacet('pronunciation', 'intelligibility'), true);
  assert.equal(isSkillFacet('listening', 'pronunciation_target'), false);
  const artifact = JSON.parse(readFileSync('packages/activity-schemas/mastery-registry.json', 'utf8'));
  assert.deepEqual(artifact.skill_facet_matrix, skillFacetMatrix);
});
test('P2 EN/CS M01 reference metadata share the schema; opaque UUIDs and four lessons + recap', () => {
  for (const lang of ['en', 'cs']) {
    const fixture = referenceFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p2/${lang}-m01.json`, 'utf8')));
    assert.equal(fixture.entities.filter((e) => e.kind === 'lesson' && e.metadata.unit_kind === 'lesson').length, 4);
    assert.equal(fixture.entities.filter((e) => e.kind === 'lesson' && e.metadata.unit_kind === 'recap').length, 1);
    assert(fixture.entities.every((e) => isUuid(e.id) && isUuid(e.version_id)));
    const bad = structuredClone(fixture); bad.entities[0]!.id = 'E-A1-M01';
    assert.throws(() => referenceFixtureSchema.parse(bad));
  }
});
test('P2 resolver rejects group notation, missing versions and cross-language lookup; never substitutes codes for UUIDs', async () => {
  const entity_id = randomUUID(); const content_version_id = randomUUID();
  const lookup = { resolve: async (lang: string, code: string, version: string) => lang === languageIds.en && code === 'ENG_K_HELLO' && version === '1' ? { entity_id, content_version_id } : null };
  const ref = { stable_code: 'ENG_K_HELLO', version_code: '1', relation: 'knowledge' as const };
  assert.deepEqual(await resolveAuthoringReferences(lookup, languageIds.en, [ref]), [{ ...ref, entity_id, content_version_id }]);
  for (const stable_code of ['ENG_K_*', 'CZE_K_NUM_00..20', 'ENG_K_A / B']) await assert.rejects(resolveAuthoringReferences(lookup, languageIds.en, [{ ...ref, stable_code }]));
  await assert.rejects(resolveAuthoringReferences(lookup, languageIds.cs, [ref]));
  await assert.rejects(resolveAuthoringReferences(lookup, languageIds.en, [{ ...ref, version_code: 'latest' }]));
});
test('P2 speech maps do not accept selection/typing/exposure; exact intelligibility facet remains valid', () => {
  const activity = { id: randomUUID(), stable_code: 'E-A1-M01-A1', type: 'read_aloud', response_modality: 'speech', completion_policy: 'speech_binary_nonblocking_v1',
    knowledge_refs: [{ knowledge_item_id: randomUUID(), stable_code: 'ENG_K_PRON_H', role: 'practice' }], evidence_map: [{ skill: 'pronunciation', facet: 'intelligibility', weight: 0.6 }], media_refs: [] };
  assert.equal(activityMetadataSchema.parse(activity).evidence_map[0]?.facet, 'intelligibility');
  for (const response_modality of ['none', 'selection', 'typed']) assert.throws(() => activityMetadataSchema.parse({ ...activity, response_modality }));
  assert.throws(() => activityMetadataSchema.parse({ ...activity, evidence_map: [{ skill: 'speaking', facet: 'spelling', weight: 1 }] }));
});
test('P2 content schemas enforce locale/Unicode boundaries and optional AI has no validation dependency', () => {
  const payload = { schema_version: '1.7', entity_id: randomUUID(), content_version_id: randomUUID(), stable_code: 'CZE_K_HELLO', version_code: '1', language: 'cs', kind: 'knowledge', title: 'Dobrý den. Česky.', variety_scope: 'cs-CZ', refs: [], body: {} };
  assert.equal(validateContent(payload).title, payload.title);
  assert.equal(normalizeText('Děkuji'.normalize('NFD')), 'Děkuji');
  assert.throws(() => validateContent({ ...payload, title: 'Dobrý дen' }));
  assert.throws(() => validateContent({ ...payload, variety_scope: 'en-US' }));
  assert.throws(() => validateContent({ ...payload, schema_version: '2.0' }));
  assert.deepEqual(validateContent({ ...payload, ai_extensions: [] }).ai_extensions, []);
});
test('P2 Argon2id versioned policy: independent salts, verification, Unicode and bounded imported work factors', async () => {
  const password = 'Vyzkoušejte bezpečné heslo!';
  const one = await hashPassword(password); const two = await hashPassword(password);
  assert.notEqual(one, two); assert.match(one, /^\$argon2id\$v=19\$/u);
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword('wrong', one), false);
  assert.equal(await verifyPassword(password, one.replace('m=65536', 'm=999999999')), false);
  assert.equal(await verifyPassword(password, '$invalid'), false);
  await assert.rejects(hashPassword('short'));
  assert.equal(passwordPolicy.memory, 65536);
});
