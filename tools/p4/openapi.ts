import {z} from 'zod';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {reviewStartSchema,reviewSkipSchema,collectionCreateSchema,collectionUpdateSchema,collectionEntrySchema,resetSchema} from '../../packages/activity-schemas/src/review.js';
export function p4RuntimeSchemas(){return Object.fromEntries(Object.entries({ReviewStart:reviewStartSchema,ReviewSkip:reviewSkipSchema,CollectionCreate:collectionCreateSchema,CollectionUpdate:collectionUpdateSchema,CollectionEntry:collectionEntrySchema,LearningReset:resetSchema}).map(([name,schema])=>{const json=z.toJSONSchema(schema,{target:'draft-2020-12'});delete json.$schema;return[name,json];}));}
const route=(method:string,id:string,request?:string)=>({[method]:{operationId:id,security:[{sessionCookie:[]}],...(request?{requestBody:{required:true,content:{'application/json':{schema:{$ref:`#/components/schemas/${request}`}}}}}:{}),responses:{[method==='post'&&!['skipReview','cancelReview','curatedHint'].includes(id)?'201':'200']:{description:'Owned language-scoped result'},'400':{description:'Invalid contract'},'401':{description:'Authentication required'},'403':{description:'CSRF or permission denied'},'404':{description:'Owned resource not found'},'409':{description:'Version/position conflict'}}}});
export function p4Openapi(){return {openapi:'3.1.2',info:{title:'Lingvessa P4 mastery/Review/collections',version:'1.0.0'},servers:[{url:'/api/v1'}],paths:{
 '/mastery/summary':route('get','masterySummary'),'/lesson-runs/{id}/summary':route('get','lessonMasterySummary'),'/mistakes':route('get','listMistakes'),'/review-sessions':route('post','startReview','ReviewStart'),
 '/review-sessions/{id}':route('get','getReview'),'/review-sessions/{id}/skip':route('post','skipReview','ReviewSkip'),'/review-sessions/{id}/cancel':route('post','cancelReview'),
 '/collections':{...route('post','createCollection','CollectionCreate'),...route('get','listCollections')},'/collections/{id}':{...route('get','getCollection'),...route('patch','updateCollection','CollectionUpdate'),...route('delete','deleteCollection')},
 '/collections/{id}/entries':route('post','addEntry','CollectionEntry'),'/collections/{id}/entries/{entry}':{...route('put','updateEntry','CollectionEntry'),...route('delete','deleteEntry')},
 '/learning-resets':route('post','resetLearning','LearningReset'),'/lesson-runs/{id}/hint':route('post','curatedHint')},
 components:{securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'__Host-lingvessa_session'}},schemas:p4RuntimeSchemas()}};}
export function documentedP4Openapi(){const api=p4Openapi();for(const [path,methods] of Object.entries(api.paths))for(const [method,value]of Object.entries(methods)){
 const operation=value as typeof value&{parameters:unknown[]};operation.parameters=[...path.matchAll(/\{(\w+)\}/gu)].map(m=>({name:m[1],in:'path',required:true,schema:{type:'string',format:'uuid'}}));
 if(method==='get'&&['/mastery/summary','/mistakes','/collections'].includes(path))operation.parameters.push({name:'language_profile_id',in:'query',required:true,schema:{type:'string',format:'uuid'}});
 if(method!=='get')operation.parameters.push({name:'X-CSRF-Token',in:'header',required:true,schema:{type:'string'}});
 }return api;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)writeFileSync('infra/contracts/p4.openapi.json',JSON.stringify(documentedP4Openapi(),null,2)+'\n');
