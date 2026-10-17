import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBlobUrl, validateRelease } from '../../.github/actions/private-m01-bridge/bridge.mjs';

const capability = () => {
  const url = new URL('https://fixture.blob.core.windows.net/container/one-object');
  for (const [key, value] of Object.entries({ sr: 'b', sp: 'cw', sig: 'artificial-fixture', se: new Date(Date.now() + 60000).toISOString() })) url.searchParams.set(key, value);
  return url;
};
test('only a short-lived single-blob write capability is accepted', () => {
  const valid = capability();
  assert.equal(validateBlobUrl(valid, true), valid.href);
  for (const [key, value] of [['sr', 'c'], ['sp', 'rwdl'], ['sp', 'r'], ['se', '2000-01-01T00:00:00Z']]) {
    const url = capability(); url.searchParams.set(key, value);
    assert.throws(() => validateBlobUrl(url, true));
  }
});
test('redirect destinations, credentials and foreign hosts are rejected', () => {
  for (const mutate of [(u) => { u.protocol = 'http:'; }, (u) => { u.hostname = 'example.com'; },
    (u) => { u.username = 'fixture'; }, (u) => { u.port = '444'; }, (u) => { u.hash = 'fragment'; }]) {
    const url = capability(); mutate(url);
    assert.throws(() => validateBlobUrl(url, true));
  }
});
test('the bridge cannot publish, retarget or replace another input container', () => {
  const plan = { release_id: 7, archive: { sha256: 'fixture-digest' } };
  const release = { id: 7, draft: true, prerelease: true, tag_name: 'p5-m01-private-input-20261014',
    name: 'P5 private M01 input — DO NOT PUBLISH', body: 'P5_PRIVATE_INPUT_SHA256=fixture-digest' };
  validateRelease(release, plan);
  for (const change of [{ id: 8 }, { draft: false }, { prerelease: false }, { body: '' }, { tag_name: 'main' }]) {
    assert.throws(() => validateRelease({ ...release, ...change }, plan));
  }
});
