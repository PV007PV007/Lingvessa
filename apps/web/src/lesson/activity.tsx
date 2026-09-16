'use client';
import { useState } from 'react';
import type { LearnerActivity } from '../../../../packages/activity-schemas/src/learner';
import type { ActivityResponse } from '../../../../packages/lesson-engine/src/evaluator';

export function ActivityRenderer({activity,disabled,onAnswer}:{activity:LearnerActivity;disabled:boolean;onAnswer:(response:ActivityResponse)=>void}) {
  const [selected,setSelected]=useState<string[]>([]); const [text,setText]=useState(''); const [pairs,setPairs]=useState<Record<string,string>>({});
  const options=activity.presentation.options??[]; const tokens=activity.presentation.tokens??options;
  const kind=activity.response_kind;
  const submit=()=>{
    if(kind==='single' && selected[0])onAnswer({kind,option_id:selected[0]});
    if(kind==='set'||kind==='order')onAnswer({kind,option_ids:selected});
    if(kind==='text')onAnswer({kind,text});
    if(kind==='mapping')onAnswer({kind,pairs:Object.entries(pairs).map(([left,right])=>({left,right}))});
    if(kind==='none')onAnswer({kind});
  };
  const ready=kind==='none'||kind==='text'&&text.trim().length>0||['single','set','order'].includes(kind)&&selected.length>0||kind==='mapping'&&Object.keys(pairs).length===(activity.presentation.pairs??[]).length;
  return <section aria-labelledby="activity-prompt" lang={activity.variety}>
    <h2 id="activity-prompt">{activity.presentation.prompt}</h2>
    {activity.presentation.stimulus&&<p>{activity.presentation.stimulus}</p>}
    {activity.presentation.segments?.map((segment,index)=><p key={index}><strong>{segment.speaker}: </strong>{segment.text}</p>)}
    {activity.presentation.accessibility.transcript&&<details><summary lang="uk">Текст запису</summary><p>{activity.presentation.accessibility.transcript}</p></details>}
    <form onSubmit={event=>{event.preventDefault();if(ready)submit();}}>
      <fieldset disabled={disabled}><legend className="sr-only">Ваша відповідь</legend>
        {(kind==='single'||kind==='set')&&options.map(option=><label className="answer-option" key={option.id}>
          <input type={kind==='single'?'radio':'checkbox'} name={activity.id} value={option.id} checked={selected.includes(option.id)}
            onChange={()=>setSelected(kind==='single'?[option.id]:selected.includes(option.id)?selected.filter(id=>id!==option.id):[...selected,option.id])}/>{option.label}</label>)}
        {kind==='text'&&<label lang="uk">Ваша відповідь<textarea lang={activity.variety} value={text} maxLength={4000} autoComplete="off" spellCheck={false} onChange={event=>setText(event.target.value)}/></label>}
        {kind==='order'&&<><p aria-live="polite">{selected.map(id=>tokens.find(token=>token.id===id)?.label).join(' ')||'…'}</p>
          {tokens.map(token=><button type="button" key={token.id} disabled={selected.includes(token.id)} onClick={()=>setSelected([...selected,token.id])}>{token.label}</button>)}
          <button type="button" lang="uk" onClick={()=>setSelected(selected.slice(0,-1))}>Скасувати останнє</button></>}
        {kind==='mapping'&&activity.presentation.pairs?.map(pair=><label className="answer-option" key={pair.left.id}>{pair.left.label}
          <select aria-label={pair.left.accessibility_label??pair.left.label} value={pairs[pair.left.id]??''} onChange={event=>setPairs({...pairs,[pair.left.id]:event.target.value})}>
            <option value="">—</option>{activity.presentation.pairs?.map(candidate=><option key={candidate.right.id} value={candidate.right.id}>{candidate.right.label}</option>)}
          </select></label>)}
        <button type="submit" disabled={!ready} lang="uk">{kind==='none'?'Продовжити':'Перевірити'}</button>
      </fieldset>
    </form>
  </section>;
}
