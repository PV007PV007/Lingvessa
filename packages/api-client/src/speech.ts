import {speechJobViewSchema} from '../../activity-schemas/src/speech.js';
import type {CreateSpeechJob,SpeechJobView} from '../../activity-schemas/src/speech.js';
import {learnerRunSchema,problemSchema} from '../../activity-schemas/src/learner.js';
import {ApiProblem} from './lesson.js';
export class SpeechApiClient {
 constructor(private readonly origin:string,private readonly csrf:()=>string){}
 private async request(path:string,method='GET',body?:unknown,extra:Record<string,string>={}):Promise<unknown>{
  const response=await fetch(new URL(path,this.origin),{method,credentials:'include',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',...(method==='GET'?{}:{'x-csrf-token':this.csrf()}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json() as unknown;if(!response.ok)throw new ApiProblem(problemSchema.parse(value));return value;
 }
 async create(input:CreateSpeechJob,key:string){return speechJobViewSchema.parse(await this.request('/api/v1/speech/jobs','POST',input,{'idempotency-key':key}));}
 async get(id:string){return speechJobViewSchema.parse(await this.request(`/api/v1/speech/jobs/${id}`));}
 async latest(runId:string,itemId:string):Promise<SpeechJobView|null>{const value=await this.request(`/api/v1/speech/jobs?lesson_run_id=${encodeURIComponent(runId)}&item_id=${encodeURIComponent(itemId)}`) as {job:unknown};return value.job===null?null:speechJobViewSchema.parse(value.job);}
 async upload(job:SpeechJobView,blob:Blob){
  if(!job.upload_url?.startsWith(`/api/v1/speech/jobs/${job.job_id}/audio?`))throw new TypeError('Invalid scoped upload URL');
  const response=await fetch(new URL(job.upload_url,this.origin),{method:'PUT',credentials:'include',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'content-type':blob.type,'x-csrf-token':this.csrf()},body:blob});
  const value=await response.json() as unknown;if(!response.ok)throw new ApiProblem(problemSchema.parse(value));return speechJobViewSchema.parse(value);
 }
 async submit(id:string,reason?:'mic_denied'|'mic_absent'|'unsupported_audio'){return speechJobViewSchema.parse(await this.request(`/api/v1/speech/jobs/${id}/submit`,'POST',reason?{client_unavailable_reason:reason}:{}));}
 async cancel(id:string){return speechJobViewSchema.parse(await this.request(`/api/v1/speech/jobs/${id}/cancel`,'POST',{}));}
 async next(runId:string,id:string){return learnerRunSchema.parse(await this.request(`/api/v1/lesson-runs/${runId}/next`,'POST',{job_id:id}));}
}
