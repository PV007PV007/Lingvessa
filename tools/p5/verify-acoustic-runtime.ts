import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {LocalAcousticEvaluator} from '../../packages/provider-adapters/speech/local-acoustic.js';
import {speechRuntime} from '../../infra/config/speech.js';
import {speechResultSchema} from '../../packages/activity-schemas/src/speech.js';
const python=process.env.SPEECH_ACOUSTIC_PYTHON??'',modelRoot=process.env.SPEECH_ACOUSTIC_MODEL_ROOT??'';
if(!python.startsWith('/')||!modelRoot.startsWith('/'))throw new Error('Explicit acoustic environment required');
const evaluator=new LocalAcousticEvaluator({python,modelRoot,engine:resolve('tools/p5/acoustic-engine.py')}),gates:string[]=[],start=performance.now();
try{
 assert.equal(speechRuntime({}).evaluator.available,false);assert.throws(()=>speechRuntime({LINGVESSA_ENV:'production',SPEECH_EVALUATOR_MODE:'local_acoustic_candidate',SPEECH_ACOUSTIC_PYTHON:python,SPEECH_ACOUSTIC_MODEL_ROOT:modelRoot}));
 assert.equal(evaluator.testOnly,true);assert.deepEqual(evaluator.supportedFacets,['pronunciation_target']);await evaluator.warm();gates.push('verified_offline_model_handshake');
 const body=await readFile('assets/media/m01/cs/AUD_CZE_M01_DIALOGUES_L01_REPAIR_TURN_03.wav'),input={audio:body,mime:'audio/wav',language:'cs' as const,variety:'cs-CZ',target_feature:'cs_long_a',signal:new AbortController().signal};
 const first=evaluator.evaluate(input);await assert.rejects(evaluator.evaluate(input),/BUSY/);const result=speechResultSchema.parse(await first);assert(result.processing_ms<15000);gates.push('real_acoustic_contract_and_serial_execution');
 const unsupported=await evaluator.evaluate({...input,language:'en',variety:'en-US',target_feature:'en_th_unvoiced'});assert.equal(unsupported.usable,false);gates.push('unsupported_variety_neutral');
 const malformed=await evaluator.evaluate({...input,audio:Buffer.from('bad wave')});assert.equal(malformed.usable,false);gates.push('malformed_audio_neutral');
 const abort=new AbortController();abort.abort();await assert.rejects(evaluator.evaluate({...input,signal:abort.signal}),/CANCELLED/);gates.push('cancelled_work_rejected');
 evaluator.close();await assert.rejects(evaluator.warm(),/CLOSED/);gates.push('child_disposed');
 await mkdir('artifacts/p5',{recursive:true});const report={status:'PASS',scope:'REAL_LOCAL_ACOUSTIC_ADAPTER_RUNTIME',gates,provider:evaluator.code,model_version:evaluator.modelVersion,test_only:true,production_calibration_approved:false,raw_audio_or_transcripts_retained:false,duration_ms:Math.round(performance.now()-start)};await writeFile('artifacts/p5/acoustic-runtime-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{evaluator.close();}
