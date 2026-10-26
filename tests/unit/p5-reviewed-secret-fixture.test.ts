import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {secretRuleIds} from '../../tools/p1/secret-rules.js';
import {reviewedNonSecretFixture} from '../../tools/p1/reviewed-secret-fixtures.js';

const path='tests/unit/p5-private-transfer.test.py',body=readFileSync(path);
const blob=createHash('sha1').update('blob '+body.length+'\0').update(body).digest('hex').slice(0,12);
test('only the exact reviewed artificial credential fixture is classified, including its historical blob',()=>{
 assert.deepEqual(secretRuleIds(body.toString()),['credential-url']);
 assert.deepEqual(reviewedNonSecretFixture(path,body),['credential-url']);
 assert.deepEqual(reviewedNonSecretFixture('history:'+blob+':'+path,body),['credential-url']);
});
test('changed content, a different path or a newly added credential cannot inherit fixture triage',()=>{
 for(const [location,bytes]of [
  ['other.test.py',body],
  [path,Buffer.concat([body,Buffer.from('\n# changed')])],
  ['history:'+blob+':'+path,Buffer.concat([body,Buffer.from('\n# changed')])],
  [path,Buffer.concat([body,Buffer.from('\n'+['github','pat','A'.repeat(48)].join('_'))])],
 ] as const){
  assert.deepEqual(reviewedNonSecretFixture(location,bytes),[]);
  assert(secretRuleIds(bytes.toString()).includes('credential-url'));
 }
});
