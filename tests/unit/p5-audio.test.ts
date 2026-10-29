import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeAudioTurn} from '../../packages/lesson-engine/src/audio.js';
import {mediaStore} from '../../infra/config/media.js';
import {toneWav} from '../support/p5-audio-fixtures.js';
test('P5 speaker timing uses media clock, preserves boundaries and gaps under slow playback',()=>{
 const turns=[{start_ms:0,end_ms:4000},{start_ms:4500,end_ms:8000}];
 assert.equal(activeAudioTurn(turns,0),0);assert.equal(activeAudioTurn(turns,3.999),0);assert.equal(activeAudioTurn(turns,4),null);assert.equal(activeAudioTurn(turns,4.5),1);assert.equal(activeAudioTurn(turns,8),null);assert.equal(activeAudioTurn(turns,Number.NaN),null);
});
test('P5 unavailable media default and explicit local-only storage cannot leak into production',async()=>{
 await assert.rejects(mediaStore({LINGVESSA_ENV:'production'}).inspect('unused'),{code:'SERVICE_UNAVAILABLE'});
 assert.throws(()=>mediaStore({LINGVESSA_ENV:'production',MEDIA_STORAGE_MODE:'local_fixture',MEDIA_LOCAL_ROOT:'/tmp/fixture'}));
 assert.throws(()=>mediaStore({LINGVESSA_ENV:'production',MEDIA_STORAGE_MODE:'s3'}));
 const bytes=toneWav(1000);assert.equal(bytes.readUInt32LE(24),8000);assert.equal(bytes.readUInt32LE(40),16000);assert.equal(bytes.length,16044);
});
