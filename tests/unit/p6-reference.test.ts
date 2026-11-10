import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {referenceProbesSchema,verifyReferenceProbes} from '../../packages/content-tools/src/reference-probes.js';
import {evaluateActivity} from '../../packages/lesson-engine/src/evaluator.js';
import {learnerActivity} from '../../packages/activity-schemas/src/learner.js';

const raw=JSON.parse(readFileSync('content/english/m01/evaluation-probes.json','utf8'));
const data=referenceProbesSchema.parse(raw);
const probe=(code:string)=>{const p=data.probes.find(p=>p.contract.stable_code==='P6_PROBE_'+code);assert(p);return p.contract;};

test('P6 authored be/article/contraction/origin/spelling/repair cases use the unchanged evaluator in both English locales',()=>{
  const report=verifyReferenceProbes(raw);
  assert.equal(report.probes,20);assert.equal(report.cases.length,176);
  assert.equal(report.lesson_execution,false);assert.equal(report.postgresql_execution,false);
  assert.equal(report.browser_execution,false);assert.equal(report.publication_ready,false);
  assert.deepEqual(new Set(report.cases.map(c=>c.variety)),new Set(['en-GB','en-US']));
});

test('P6 form objective rejects full contraction expansion while origin meaning objective accepts it',()=>{
  const contraction=probe('CONTRACT_IM'),origin=probe('ORIGIN_UK');
  assert.equal(evaluateActivity(contraction,{kind:'text',text:'I am'}).result,'incorrect');
  assert.equal(evaluateActivity(origin,{kind:'text',text:'I am from the UK.'}).result,'correct');
  assert.equal(evaluateActivity(origin,{kind:'text',text:'I’m from the UK.'}).result,'correct');
  assert.equal(evaluateActivity(origin,{kind:'text',text:'I am from UK.'}).result,'incorrect');
  // This checks target eligibility, not the still-missing meaning/form result split.
  assert(contraction.learning.evidence_map.every(m=>m.skill!=='vocabulary'||m.facet!=='meaning'));
});

test('P6 probe guard catches a mutated accepted form, cross-language variety and duplicate identity',()=>{
  const altered=structuredClone(raw);altered.probes[0].contract.response.answer_policy.accepted_text=['are'];
  assert.throws(()=>verifyReferenceProbes(altered),/Reference policy mismatch/u);
  const crossed=structuredClone(raw);crossed.probes[0].varieties=['cs-CZ'];
  assert.throws(()=>verifyReferenceProbes(crossed),/language\/variety mismatch/u);
  const duplicate=structuredClone(raw);duplicate.probes.push(duplicate.probes[0]);
  assert.throws(()=>verifyReferenceProbes(duplicate),/Duplicate reference probe/u);
});

test('P6 typed origin practice has Writing evidence and exposes no answer keys to the learner',()=>{
  for(const code of ['ORIGIN_UK','ORIGIN_UA']){
    const contract=probe(code);assert.equal(contract.type,'role_play');
    assert.deepEqual(contract.learning.evidence_map,[{skill:'writing',facet:'production',weight:1}]);
    const presented=learnerActivity(contract);
    assert(!('response' in presented));assert(!('feedback' in presented));assert(!('learning' in presented));
    assert(!JSON.stringify(presented).includes('accepted_text'));
  }
});
