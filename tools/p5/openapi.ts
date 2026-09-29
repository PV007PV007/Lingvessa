import {z} from 'zod';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createSpeechJobSchema,submitSpeechJobSchema,speechJobViewSchema,speechCallbackSchema} from '../../packages/activity-schemas/src/speech.js';
import {learnerRunSchema,problemSchema} from '../../packages/activity-schemas/src/learner.js';
export function p5SpeechSchemas(){return Object.fromEntries(Object.entries({CreateSpeechJob:createSpeechJobSchema,SubmitSpeechJob:submitSpeechJobSchema,SpeechJob:speechJobViewSchema,SpeechCallback:speechCallbackSchema,LearnerRun:learnerRunSchema,Problem:problemSchema}).map(([name,schema])=>{const json=z.toJSONSchema(schema,{target:'draft-2020-12'});delete json.$schema;return [name,json];}));}
export function p5SpeechOpenApi(){
 const response=(name:string)=>({description:name,content:{'application/json':{schema:{$ref:`#/components/schemas/${name}`}}}});
 const parameter=(name:string,location:string='path')=>({name,in:location,required:true,schema:{type:'string',format:'uuid'}});
 const mutation=(operationId:string,schema?:string)=>({operationId,parameters:[{name:'X-CSRF-Token',in:'header',required:true,schema:{type:'string'}}],...(schema?{requestBody:{required:true,content:{'application/json':{schema:{$ref:`#/components/schemas/${schema}`}}}}}:{}),responses:{'200':response('SpeechJob'),'400':response('Problem'),'401':response('Problem'),'403':response('Problem'),'409':response('Problem')}});
 return {openapi:'3.1.2',info:{title:'Lingvessa P5 asynchronous speech',version:'p5-speech-1.0.0'},servers:[{url:'/api/v1'}],security:[{sessionCookie:[]}],paths:{
  '/speech/jobs':{post:{...mutation('createSpeechJob','CreateSpeechJob'),parameters:[parameter('Idempotency-Key','header'),...mutation('').parameters],responses:{'201':response('SpeechJob'),'409':response('Problem')}},get:{operationId:'latestSpeechJob',parameters:[parameter('lesson_run_id','query'),parameter('item_id','query')],responses:{'200':{description:'Latest owned job or null'}}}},
  '/speech/jobs/{id}':{parameters:[parameter('id')],get:{operationId:'pollSpeechJob',responses:{'200':response('SpeechJob'),'404':response('Problem')}}},
  '/speech/jobs/{id}/audio':{parameters:[parameter('id')],put:{...mutation('uploadSpeechAudio'),parameters:[{name:'token',in:'query',required:true,schema:{type:'string'}},...mutation('').parameters],requestBody:{required:true,content:Object.fromEntries(['audio/webm','audio/ogg','audio/mp4','audio/wav'].map(m=>[m,{schema:{type:'string',format:'binary',maxLength:5242880}}]))}}},
  '/speech/jobs/{id}/submit':{parameters:[parameter('id')],post:mutation('submitSpeechJob','SubmitSpeechJob')},
  '/speech/jobs/{id}/cancel':{parameters:[parameter('id')],post:mutation('cancelSpeechJob')},
  '/lesson-runs/{id}/next':{parameters:[parameter('id')],post:{...mutation('continueSettledSpeech'),requestBody:{required:true,content:{'application/json':{schema:{type:'object',additionalProperties:false,required:['job_id'],properties:{job_id:{type:'string',format:'uuid'}}}}}},responses:{'200':response('LearnerRun'),'409':response('Problem')}}},
  '/internal/speech/callback':{post:{operationId:'receiveSignedSpeechCallback',security:[],description:'Disabled by default. HMAC-SHA256 over exact origin, timestamp, raw body. Five-minute window; immutable event-ID receipt; exact owner/profile/provider/model/policy/execution binding.',parameters:['X-Speech-Origin','X-Speech-Timestamp','X-Speech-Signature'].map(name=>({name,in:'header',required:true,schema:{type:'string'}})),requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/SpeechCallback'}}}},responses:{'200':{description:'Settled, duplicate, late or stale execution'},'403':response('Problem')}}},
 },components:{securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'__Host-lingvessa_session'}},schemas:p5SpeechSchemas()}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)writeFileSync('infra/contracts/p5-speech.openapi.json',JSON.stringify(p5SpeechOpenApi(),null,2)+'\n');
