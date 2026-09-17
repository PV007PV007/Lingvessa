'use client';
import { useState } from 'react';
import { pinnedOrder } from '../../../../packages/lesson-engine/src/presentation';
import type { LearnerActivity } from '../../../../packages/activity-schemas/src/learner';
import type { ActivityResponse } from '../../../../packages/lesson-engine/src/evaluator';

export function ActivityRenderer({activity,disabled,onAnswer}:{activity:LearnerActivity;disabled:boolean;onAnswer:(response:ActivityResponse)=>void}) {
  const [selected,setSelected]=useState<string[]>([]); const [text,setText]=useState(''); const [pairs,setPairs]=useState<Record<string,string>>({});
  const kind=activity.response_kind;const order=activity.runtime.presentation_order;
  const options=['single','set'].includes(kind)?pinnedOrder(activity.presentation.options??[],order,option=>option.id):[];
  const tokens=kind==='order'?pinnedOrder(activity.presentation.tokens??[],order,token=>token.id):[];
  const mappings=kind==='mapping'?pinnedOrder(activity.presentation.pairs??[],order,pair=>pair.left.id):[];
  const [step,setStep]=useState(0);const steps=activity.presentation.steps??[];
  const scaffoldComplete=steps.length===0||step===steps.length-1;
  const submit=()=>{
    if(kind==='single' && selected[0])onAnswer({kind,option_id:selected[0]});
    if(kind==='set'||kind==='order')onAnswer({kind,option_ids:selected});
    if(kind==='text')onAnswer({kind,text});
    if(kind==='mapping')onAnswer({kind,pairs:Object.entries(pairs).map(([left,right])=>({left,right}))});
    if(kind==='none')onAnswer({kind});
  };
  const ready=kind==='none'||kind==='text'&&text.trim().length>0||['single','set','order'].includes(kind)&&selected.length>0||kind==='mapping'&&mappings.length>0&&mappings.every(pair=>Boolean(pairs[pair.left.id]));
  return <section aria-labelledby="activity-prompt" lang={activity.variety}>
    <h2 id="activity-prompt">{activity.presentation.prompt}</h2>
    {activity.presentation.stimulus&&<p>{activity.presentation.stimulus}</p>}
    {activity.presentation.segments?.map((segment,index)=><p key={index}><strong>{segment.speaker}: </strong>{segment.text}</p>)}
    {activity.presentation.accessibility.transcript&&<details><summary lang="uk">Текст запису</summary><p>{activity.presentation.accessibility.transcript}</p></details>}
    {steps.length>0&&<div><p aria-live="polite">{steps[step]}</p>{!scaffoldComplete&&<button type="button" disabled={disabled} lang="uk" onClick={()=>setStep(step+1)}>Наступний приклад</button>}</div>}
    <form onSubmit={event=>{event.preventDefault();if(ready&&scaffoldComplete)submit();}}>
      <fieldset disabled={disabled||!scaffoldComplete}><legend className="sr-only">Ваша відповідь</legend>
        {(kind==='single'||kind==='set')&&options.map(option=><label className="answer-option" key={option.id}>
          <input type={kind==='single'?'radio':'checkbox'} name={activity.id} value={option.id} checked={selected.includes(option.id)}
            onChange={()=>setSelected(kind==='single'?[option.id]:selected.includes(option.id)?selected.filter(id=>id!==option.id):[...selected,option.id])}/>{option.label}</label>)}
        {kind==='text'&&<label lang="uk">Ваша відповідь<textarea lang={activity.variety} value={text} maxLength={4000} autoComplete="off" spellCheck={false} onChange={event=>setText(event.target.value)}/></label>}
        {kind==='order'&&<><p aria-live="polite">{selected.map(id=>tokens.find(token=>token.id===id)?.label).join(' ')||'…'}</p>
          {tokens.map(token=><button type="button" key={token.id} disabled={selected.includes(token.id)} onClick={()=>setSelected([...selected,token.id])}>{token.label}</button>)}
          <button type="button" lang="uk" onClick={()=>setSelected(selected.slice(0,-1))}>Скасувати останнє</button></>}
        {kind==='mapping'&&mappings.map(pair=><label className="answer-option" key={pair.left.id}>{pair.left.label}
          <select aria-label={pair.left.accessibility_label??pair.left.label} value={pairs[pair.left.id]??''} onChange={event=>setPairs({...pairs,[pair.left.id]:event.target.value})}>
            <option value="">—</option>{activity.presentation.pairs?.map(candidate=><option key={candidate.right.id} value={candidate.right.id}>{candidate.right.label}</option>)}
          </select></label>)}
        <button type="submit" disabled={!ready} lang="uk">{kind==='none'?'Продовжити':'Перевірити'}</button>
      </fieldset>
    </form>
  </section>;
}
