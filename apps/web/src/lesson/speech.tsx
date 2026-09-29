'use client';
import {useEffect,useRef,useState} from 'react';
import type {Dispatch} from 'react';
import type {LearnerRun} from '../../../../packages/activity-schemas/src/learner';
import type {CreateSpeechJob,SpeechJobView} from '../../../../packages/activity-schemas/src/speech';
import type {LessonPlayerEvent,LessonPlayerState} from '../../../../packages/lesson-engine/src/state';
import {terminalSpeech} from '../../../../packages/lesson-engine/src/speech';
import {SpeechApiClient} from '../../../../packages/api-client/src/speech';
import {SPEECH_LIMITS} from '../../../../packages/application/src/speech';

type Props={run:LearnerRun;csrf:()=>string;state:LessonPlayerState;dispatch:Dispatch<LessonPlayerEvent>;autoAdvance:boolean;onNext:(run:LearnerRun)=>void};
/** The parent LessonPlayer reducer owns the single primary UX state. Raw recordings exist only in memory. */
export function SpeechPanel({run,csrf,state,dispatch,autoAdvance,onNext}:Props){
 const activity=run.manifest.activities[run.position]!;
 const [job,setJob]=useState<SpeechJobView|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState('Перевіряємо запис…');
 const client=useRef<SpeechApiClient|null>(null),jobRef=useRef<SpeechJobView|null>(null),stateRef=useRef(state),alive=useRef(true),captureEpoch=useRef(0),inflight=useRef(false);
 const media=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]),recorded=useRef<Blob|null>(null),recordTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const pending=useRef<{key:string;input:CreateSpeechJob}|null>(null),neutralReason=useRef<'mic_denied'|'mic_absent'|'unsupported_audio'|undefined>(undefined);
 stateRef.current=state;
 const stage=(value:'permission_request'|'recording'|'processing')=>{if(alive.current)dispatch({type:'SPEECH_STAGE',stage:value});};
 function stopDevices(){if(recordTimer.current)clearTimeout(recordTimer.current);recordTimer.current=null;const r=recorder.current;recorder.current=null;if(r&&r.state!=='inactive')r.stop();media.current?.getTracks().forEach(t=>t.stop());media.current=null;}
 function show(value:SpeechJobView){
  jobRef.current=value;if(!alive.current)return;setJob(value);
  if(value.outcome){recorded.current=null;neutralReason.current=undefined;setMessage('');
   if(!['processing','speech_correct','speech_incorrect','speech_unavailable'].includes(stateRef.current.kind))stage('processing');
   dispatch({type:'SPEECH_RESULT',outcome:value.outcome,job_id:value.job_id,feedback:value.feedback});
  }else if(value.state!=='created'){stage('processing');setMessage('Оцінюємо вимову…');}
 }
 async function ensureJob(){
  const prior=jobRef.current;if(prior&&!terminalSpeech(prior.state))return prior;
  if(!pending.current)pending.current={key:crypto.randomUUID(),input:{attempt_id:crypto.randomUUID(),language_profile_id:run.language_profile_id,lesson_run_id:run.id,item_id:activity.id,content_version_id:run.content_version_id}};
  const value=await client.current!.create(pending.current.input,pending.current.key);pending.current=null;show(value);return value;
 }
 async function sendRecording(value:SpeechJobView){
  let current=await client.current!.get(value.job_id);
  if(current.state==='created'&&neutralReason.current)current=await client.current!.submit(current.job_id,neutralReason.current);
  else if(current.state==='created'&&recorded.current)current=await client.current!.upload(current,recorded.current);
  if(current.state==='uploaded')current=await client.current!.submit(current.job_id);
  if(current.state!=='created')recorded.current=null;show(current);
 }
 async function recover(){
  if(inflight.current)return;inflight.current=true;setBusy(true);
  try{const current=pending.current?await ensureJob():jobRef.current??await client.current!.latest(run.id,activity.id);if(current){await sendRecording(current);if(jobRef.current?.state==='created'&&!recorded.current&&!neutralReason.current){dispatch({type:'RESUME',state:{kind:'active',activity_id:activity.id,position:run.position,revision:run.revision}});setMessage('Натисніть мікрофон, щоб продовжити цю спробу.');}}else setMessage('Натисніть мікрофон, щоб почати.');}
  catch{setMessage('З’єднання недоступне. Повторіть надсилання; номер спроби залишиться тим самим.');}
  finally{inflight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{
  alive.current=true;client.current=new SpeechApiClient(window.location.origin,csrf);
  const abandon=()=>{captureEpoch.current++;stopDevices();chunks.current=[];recorded.current=null;const j=jobRef.current;if(j&&!terminalSpeech(j.state))void fetch(`/api/v1/speech/jobs/${j.job_id}/cancel`,{method:'POST',credentials:'include',keepalive:true,headers:{'content-type':'application/json','x-csrf-token':csrf()},body:'{}'}).catch(()=>undefined);};
  void client.current.latest(run.id,activity.id).then(j=>{if(!alive.current)return;if(j){show(j);if(j.state==='created')setMessage('Натисніть мікрофон, щоб продовжити цю спробу.');}else setMessage('Натисніть мікрофон, щоб почати.');}).catch(()=>{if(alive.current)setMessage('Не вдалося перевірити запис. Повторіть з’єднання.');}).finally(()=>{if(alive.current)setBusy(false);});
  window.addEventListener('pagehide',abandon);
  return()=>{alive.current=false;window.removeEventListener('pagehide',abandon);abandon();};
 },[run.id,activity.id]);
 useEffect(()=>{
  if(!job||!['queued','processing'].includes(job.state))return;let stopped=false,polling=false;
  const poll=async()=>{if(stopped||polling)return;polling=true;try{const value=await client.current!.get(job.job_id);if(!stopped)show(value);}catch{if(!stopped)setMessage('Очікуємо з’єднання. Запис обробляється з тим самим номером.');}finally{polling=false;}};
  const timer=setInterval(()=>void poll(),800);return()=>{stopped=true;clearInterval(timer);};
 },[job?.job_id,job?.state]);
 async function record(){
  if(inflight.current)return;inflight.current=true;setBusy(true);setMessage('Дозвольте доступ до мікрофона.');neutralReason.current=undefined;const epoch=++captureEpoch.current;stage('permission_request');
  try{
   const current=await ensureJob();if(terminalSpeech(current.state))return;if(!alive.current||epoch!==captureEpoch.current)return;
   if(current.state!=='created'){show(current);return;}
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){neutralReason.current='mic_absent';show(await client.current!.submit(current.job_id,neutralReason.current));return;}
   let stream:MediaStream;
   try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(error){neutralReason.current=error instanceof DOMException&&error.name==='NotAllowedError'?'mic_denied':'mic_absent';show(await client.current!.submit(current.job_id,neutralReason.current));return;}
   if(!alive.current||epoch!==captureEpoch.current){stream.getTracks().forEach(t=>t.stop());return;}
   media.current=stream;
   const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
   if(!mime){stopDevices();neutralReason.current='unsupported_audio';show(await client.current!.submit(current.job_id,neutralReason.current));return;}
   const recording=new MediaRecorder(stream,{mimeType:mime});recorder.current=recording;chunks.current=[];let size=0;
   recording.ondataavailable=event=>{if(epoch!==captureEpoch.current||!alive.current)return;size+=event.data.size;if(size>SPEECH_LIMITS.maxBytes){neutralReason.current='unsupported_audio';chunks.current=[];stopDevices();return;}if(!neutralReason.current)chunks.current.push(event.data);};
   recording.onerror=()=>{neutralReason.current='unsupported_audio';stopDevices();};
   recording.onstop=()=>{
    if(!alive.current||epoch!==captureEpoch.current){chunks.current=[];return;}
    media.current?.getTracks().forEach(t=>t.stop());media.current=null;if(recordTimer.current)clearTimeout(recordTimer.current);recordTimer.current=null;
    recorded.current=new Blob(chunks.current,{type:mime});chunks.current=[];if(!recorded.current.size)neutralReason.current='unsupported_audio';stage('processing');setMessage('Надсилаємо запис…');
    void recover();
   };
   recording.start(250);stage('recording');setMessage('Записуємо. Промовте фразу й натисніть «Завершити запис».');recordTimer.current=setTimeout(()=>stopDevices(),SPEECH_LIMITS.maxRecordingMs);
  }catch{setMessage('Не вдалося почати або надіслати запис. Повторіть з’єднання.');}
  finally{inflight.current=false;if(alive.current)setBusy(false);}
 }
 async function cancel(){
  captureEpoch.current++;stopDevices();chunks.current=[];recorded.current=null;neutralReason.current=undefined;setBusy(true);
  try{const current=jobRef.current&&!terminalSpeech(jobRef.current.state)?jobRef.current:await ensureJob();show(await client.current!.cancel(current.job_id));}
  catch{setMessage('Не вдалося підтвердити скасування. Повторіть скасування після відновлення з’єднання.');}
  finally{if(alive.current)setBusy(false);}
 }
 async function next(){
  if(inflight.current||!jobRef.current?.outcome)return;inflight.current=true;setBusy(true);
  try{const value=await client.current!.next(run.id,jobRef.current.job_id);if(alive.current)onNext(value);}
  catch{setMessage('Не вдалося перейти далі. Повторіть дію — нова спроба не створиться.');}
  finally{inflight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(!autoAdvance||!activity.runtime.auto_advance_allowed||!job?.outcome||busy||!['speech_correct','speech_incorrect','speech_unavailable'].includes(state.kind))return;const timer=setTimeout(()=>void next(),1200);return()=>clearTimeout(timer);},[autoAdvance,job?.job_id,job?.outcome,busy,state.kind]);
 const terminal=['speech_correct','speech_incorrect','speech_unavailable'].includes(state.kind)&&Boolean(job?.outcome),recording=state.kind==='recording';
 return <section className="speech-panel" aria-label="Практика вимови">
  <h2>{activity.presentation.prompt}</h2>{activity.presentation.stimulus&&<p lang={activity.language}>{activity.presentation.stimulus}</p>}
  <p role="status" aria-live="polite">{message}</p>
  {terminal?<div className="lesson-feedback" role="status" aria-live="polite"><strong>{job!.outcome==='speech_correct'?'Правильно':job!.outcome==='speech_incorrect'?'Спробуйте ще раз':'Оцінювання недоступне'}</strong><p>{job!.feedback}</p><button disabled={busy} onClick={()=>void record()}>Повторити запис</button><button disabled={busy} onClick={()=>void next()}>Далі</button></div>:<>
   {recording?<button className="speech-microphone recording" onClick={()=>stopDevices()}>Завершити запис</button>:<button className="speech-microphone" disabled={busy||state.kind==='processing'||state.kind==='permission_request'} onClick={()=>void record()}>Увімкнути мікрофон</button>}
   {recording&&<p>Мікрофон увімкнений</p>}
   {(job||pending.current)&&<button disabled={busy&&state.kind!=='permission_request'} onClick={()=>void cancel()}>Скасувати запис</button>}
  </>}
  {!recording&&message&&<button disabled={busy} onClick={()=>void recover()}>Відновити з’єднання</button>}
  <p>Запис використовується лише для цієї спроби й видаляється після оцінювання або скасування. Максимальний час зберігання — 14 хвилин.</p>
 </section>;
}
