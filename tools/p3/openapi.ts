import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { startLessonRunSchema, attemptCommandSchema, exitLessonRunSchema } from '../../packages/application/src/lesson.js';
import { learnerRunSchema, attemptResultSchema, problemSchema } from '../../packages/activity-schemas/src/learner.js';

export function p3RuntimeSchemas() {
  return Object.fromEntries(Object.entries({ StartLessonRun:startLessonRunSchema,AttemptCommand:attemptCommandSchema,ExitLessonRun:exitLessonRunSchema,
    LearnerRun:learnerRunSchema,AttemptResult:attemptResultSchema,Problem:problemSchema }).map(([name,schema])=>{
    const result=z.toJSONSchema(schema,{target:'draft-2020-12'});delete result.$schema;return [name,result];
  }));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path='infra/contracts/p3.openapi.json';const api=JSON.parse(readFileSync(path,'utf8'));
  Object.assign(api.components.schemas,p3RuntimeSchemas());
  const response=(name:string)=>({description:name,content:{'application/json':{schema:{$ref:`#/components/schemas/${name}`}}}});
  api.paths['/lesson-runs'].post.responses['201']=response('LearnerRun');
  api.paths['/lesson-runs'].get.responses['200']={description:'Owned lesson runs',content:{'application/json':{schema:{type:'array',items:{$ref:'#/components/schemas/LearnerRun'}}}}};
  api.paths['/lesson-runs/{id}'].get.responses['200']=response('LearnerRun');
  api.paths['/lesson-runs/{id}/attempts'].post.responses['200']=response('AttemptResult');
  api.paths['/lesson-runs/{id}/exit'].post.responses['200']=response('LearnerRun');
  api.paths['/auth/csrf']={post:{operationId:'refreshSessionCsrf',description:'Authenticated same-origin custom-header request refreshes CSRF after reload; CORS disabled. Token stays in browser memory.',
    security:[{sessionCookie:[]}],parameters:[{name:'X-Lingvessa-Client',in:'header',required:true,schema:{type:'string',const:'web'}}],
    responses:{'200':{description:'New session-bound CSRF token',content:{'application/json':{schema:{type:'object',required:['csrf_token'],properties:{csrf_token:{type:'string'}},additionalProperties:false}}}},'401':{$ref:'#/components/responses/Problem'},'403':{$ref:'#/components/responses/Problem'}}}};
  writeFileSync(path,JSON.stringify(api,null,2)+'\n');
}
