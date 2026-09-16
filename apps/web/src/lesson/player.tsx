'use client';
import { useEffect, useRef, useState, useReducer } from 'react';
import type { LearnerRun } from '../../../../packages/activity-schemas/src/learner';
import { ApiProblem, LessonApiClient, UnsentAttemptQueue } from '../../../../packages/api-client/src/lesson';
import type { AttemptCommand, AttemptResult } from '../../../../packages/api-client/src/lesson';
import type { ActivityResponse } from '../../../../packages/lesson-engine/src/evaluator';
import { lessonPlayerReducer, mayAutoAdvance } from '../../../../packages/lesson-engine/src/state';
import type { LessonPlayerState } from '../../../../packages/lesson-engine/src/state';
import { ActivityRenderer } from './activity';
import { IndexedAttemptStorage } from './queue';

export function LessonPlayer({runId}:{runId:string}) {
  const [player,dispatch]=useReducer(lessonPlayerReducer,{kind:'loading'});
  const restore=(value:LearnerRun)=>{const state:LessonPlayerState=value.state==='completed'?{kind:'completed',revision:value.revision,unresolved_count:value.unresolved_count}:
    value.state==='remediation'?{kind:'remediation',activity_id:value.current_activity_id!,position:value.position,revision:value.revision,unresolved_count:value.unresolved_count}:
    {kind:'active',activity_id:value.current_activity_id!,position:value.position,revision:value.revision};dispatch({type:'RESUME',state});setRun(value);};
  const [run,setRun]=useState<LearnerRun|null>(null);const [result,setResult]=useState<AttemptResult|null>(null);
  const [notice,setNotice]=useState('Завантаження уроку…');const [busy,setBusy]=useState(true);const [loginRequired,setLoginRequired]=useState(false);
  const [autoAdvance,setAutoAdvance]=useState(false);const csrf=useRef('');const client=useRef<LessonApiClient|null>(null);const queue=useRef<UnsentAttemptQueue|null>(null);
  const inflight=useRef(false);const loading=useRef(false);
  async function load() {
    if(loading.current)return;loading.current=true;
    setBusy(true);setNotice('Завантаження уроку…');
    try {
      const session=await fetch('/api/v1/auth/csrf',{method:'POST',headers:{'x-lingvessa-client':'web'},credentials:'include'});
      if(session.status===401){setLoginRequired(true);setNotice('Увійдіть, щоб відновити урок.');return;}
      if(!session.ok)throw new Error('SESSION_UNAVAILABLE');
      csrf.current=(await session.json() as {csrf_token:string}).csrf_token;
      const me=await fetch('/api/v1/me',{credentials:'include'});if(!me.ok)throw new Error('SESSION_UNAVAILABLE');
      const owner=(await me.json() as {id:string}).id;
      client.current=new LessonApiClient(window.location.origin,()=>csrf.current);
      queue.current=new UnsentAttemptQueue(new IndexedAttemptStorage(owner));
      const pending=await queue.current.pending();
      // Replay only this run, in original sequence, with original attempt identities.
      for(const record of pending.filter(entry=>entry.run_id===runId)){
        await client.current.submitAttempt(runId,record.command);await queue.current.acknowledge(record.command.attempt_id);
      }
      restore(await client.current.getRun(runId));setResult(null);setLoginRequired(false);setNotice('');
    } catch(error){setNotice(error instanceof ApiProblem && error.problem.code==='VERSION_CONFLICT'?'Позиція уроку змінилася. Відновіть її з сервера; непідтверджена відповідь збережена.':'Не вдалося відновити урок. Повторіть спробу, коли з’єднання відновиться.');}
    finally{setBusy(false);loading.current=false;}
  }
  useEffect(()=>{void load();const reconnect=()=>{if(!inflight.current)void load();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[runId]);
  async function next(){if(!client.current)return;setBusy(true);try{restore(await client.current.getRun(runId));setResult(null);setNotice('');}catch{setNotice('Не вдалося відновити позицію. Спробуйте ще раз.');}finally{setBusy(false);}}
  useEffect(()=>{
    const activity=run?.manifest.activities[run.position];
    if(!autoAdvance||!activity?.runtime.auto_advance_allowed||!result||!mayAutoAdvance(player,true))return;
    const timer=setTimeout(()=>void next(),1200);return()=>clearTimeout(timer);
  },[autoAdvance,result]);
  async function answer(response:ActivityResponse,reveal=false){
    if(!run||!client.current||!queue.current||inflight.current)return;
    const activity=run.manifest.activities[run.position];if(!activity)return;
    inflight.current=true;setBusy(true);setNotice('');
    if(player.kind==='incorrect')dispatch({type:'RETRY'});
    const command:AttemptCommand={attempt_id:crypto.randomUUID(),content_version_id:run.content_version_id,item_id:activity.id,
      client_sequence:run.client_sequence+1,intent:reveal?'reveal':response.kind==='none'?'continue':'submit',response,
      presentation:{seed:activity.runtime.presentation_seed,order:activity.runtime.presentation_order},assistance:{hint_count:0,reveal}};
    dispatch({type:'SUBMIT',attempt_id:command.attempt_id});
    try{
      await queue.current.enqueue({run_id:runId,queued_at:new Date().toISOString(),command});
      const accepted=await client.current.submitAttempt(runId,command);await queue.current.acknowledge(command.attempt_id);
      dispatch({type:'AUTHORITATIVE_RESULT',attempt_id:accepted.attempt_id,outcome:accepted.outcome,feedback:accepted.feedback,revision:accepted.run.revision});
      setResult(accepted);setRun({...run,client_sequence:command.client_sequence,revision:accepted.run.revision});
    }catch(error){
      dispatch({type:'FAIL',code:error instanceof ApiProblem?error.problem.code:'NETWORK_UNAVAILABLE'});
      if(error instanceof ApiProblem&&error.problem.status<500&&error.problem.status!==401){
        await queue.current.acknowledge(command.attempt_id);setNotice('Відповідь не прийнята. Відновіть урок із сервера.');
      }else setNotice('З’єднання перервано. Відповідь збережена й буде повторно надіслана з тим самим номером.');
    }finally{setBusy(false);inflight.current=false;}
  }
  async function exit(){if(!run||!client.current)return;setBusy(true);try{restore(await client.current.exitRun(runId,run.revision,true));setResult(null);}catch{setNotice('Не вдалося завершити повторення. Відновіть урок.');}finally{setBusy(false);}}
  return <main className="lesson-player"><header><a href="/">Lingvessa</a><h1>Урок</h1></header>
    <p role="status" aria-live="polite">{notice}</p>
    {loginRequired&&<form onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);
      try{const response=await fetch('/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json','x-lingvessa-client':'web'},credentials:'include',body:JSON.stringify({email:data.get('email'),password:data.get('password')})});
        event.currentTarget?.reset();if(!response.ok){setNotice('Не вдалося увійти. Перевірте дані.');setBusy(false);return;}await load();}catch{setNotice('Сервіс входу недоступний.');setBusy(false);}}}>
      <label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Пароль<input name="password" type="password" autoComplete="current-password" required/></label><button disabled={busy}>Увійти та відновити</button></form>}
    {!loginRequired&&<>
      {run&&run.state!=='completed'&&<><p>{run.manifest.language==='en'?'English':'Čeština'} · {run.position+1} / {run.manifest.activities.length}</p>
        {run.state==='remediation'&&<p>Повторення: невирішених вправ — {run.unresolved_count}.</p>}
        {run.manifest.activities[run.position]&&<ActivityRenderer key={`${run.id}:${run.position}:${result?.attempt_id??'active'}`} activity={run.manifest.activities[run.position]!} disabled={busy||result!==null||notice!==''} onAnswer={response=>void answer(response)}/>}
        {result&&<div className="lesson-feedback" aria-live="polite" role="status"><strong>{result.outcome==='correct'?'Правильно':result.outcome==='incorrect'?'Спробуйте ще раз':result.outcome==='assisted'?'Завершено з допомогою':'Продовжуймо'}</strong><p>{result.feedback}</p>
          {result.outcome==='incorrect'?<button disabled={busy} onClick={()=>{dispatch({type:'RETRY'});setResult(null);}}>Повторити</button>:<button disabled={busy} onClick={()=>void next()}>Далі</button>}</div>}
        {(!result||result.outcome==='incorrect')&&run.manifest.activities[run.position]?.response_kind!=='none'&&<button disabled={busy||notice!==''} onClick={()=>void answer({kind:'none'},true)}>Показати відповідь</button>}
        <label><input type="checkbox" checked={autoAdvance} onChange={event=>setAutoAdvance(event.target.checked)}/>Автоматично переходити після відповіді</label>
        {run.state==='remediation'&&<button disabled={busy} onClick={()=>void exit()}>Завершити з невирішеними вправами</button>}
      </>}
      {run?.state==='completed'&&<section><h2>Урок завершено</h2><p>{run.unresolved_count?`Залишилося для повторення: ${run.unresolved_count}.`:'Усі вправи опрацьовано.'}</p></section>}
      <button disabled={busy} onClick={()=>void load()}>Відновити урок</button>
    </>}
  </main>;
}
