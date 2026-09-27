'use client';
import {useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {deliveredMediaListSchema} from '../../../../packages/activity-schemas/src/media-delivery';
import type {DeliveredMedia} from '../../../../packages/activity-schemas/src/media-delivery';
import {activeAudioTurn} from '../../../../packages/lesson-engine/src/audio';

const path=(runId:string,itemId:string,a:DeliveredMedia)=>`/api/v1/lesson-runs/${runId}/media/${a.asset_id}/${a.asset_version}?item_id=${itemId}`;
function AudioPlayer({asset,slow,runId,itemId,onPlay,onTranscript}:{asset:DeliveredMedia;slow:DeliveredMedia|undefined;runId:string;itemId:string;onPlay:(audio:HTMLAudioElement)=>void;onTranscript:()=>void}) {
 const audio=useRef<HTMLAudioElement|null>(null),[rate,setRate]=useState(1),[position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[message,setMessage]=useState('');
 const selected=rate===1||!slow?asset:slow,turns=selected.turns??[],active=activeAudioTurn(turns,position);
 useEffect(()=>{const a=audio.current;return()=>{a?.pause();};},[]);
 async function play(speed:number){
  const a=audio.current;if(!a)return;setMessage('');
  if(speed!==1&&!slow&&!('preservesPitch' in a)){setMessage('Повільне відтворення недоступне. Скористайтеся звичайним записом.');return;}
  flushSync(()=>setRate(speed));const target=speed===1||!slow?asset:slow,newSource=path(runId,itemId,target);
  if(a.getAttribute('src')!==newSource){a.src=newSource;a.load();}
  a.playbackRate=speed!==1&&!slow?0.75:1;a.preservesPitch=true;onPlay(a);
  try{await a.play();setPlaying(true);}catch{setMessage('Не вдалося відтворити запис. Повторіть спробу або відкрийте текст.');}
 }
 return <section className="media-audio" aria-label={`Запис · ${asset.scope.variety}`}>
  <p>{asset.scope.variety} · {active===null?'Аудіозапис':turns[active]?.speaker}</p>
  <audio ref={audio} src={path(runId,itemId,selected)} preload="none" onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setPosition(0);}} onError={()=>setMessage('Запис тимчасово недоступний. Текст залишається доступним.')}/>
  <button type="button" onClick={()=>void play(1)}>Відтворити</button>
  <button type="button" aria-pressed={rate!==1} onClick={()=>void play(0.75)}>Повільно</button>
  <button type="button" disabled={!playing} onClick={()=>audio.current?.pause()}>Пауза</button>
  <button type="button" onClick={()=>{if(audio.current){audio.current.currentTime=0;setPosition(0);}void play(rate);}}>Ще раз</button>
  {message&&<p role="status">{message}</p>}
  <details onToggle={e=>{if(e.currentTarget.open)onTranscript();}}><summary>Текст запису</summary>
   {turns.length?<ol>{turns.map((turn,index)=><li key={index} aria-current={active===index?'true':undefined} className={active===index?'active-speaker':''}><strong>{turn.speaker}: </strong><span lang={selected.scope.variety}>{turn.text}</span></li>)}</ol>:<p lang={selected.scope.variety}>{selected.transcript}</p>}
  </details>
 </section>;
}
export function MediaPanel({runId,itemId,hasMedia,csrf}:{runId:string;itemId:string;hasMedia:boolean;csrf:()=>string}){
 const [assets,setAssets]=useState<DeliveredMedia[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),container=useRef<HTMLDivElement|null>(null),logged=useRef(false);
 useEffect(()=>{if(!hasMedia)return;const abort=new AbortController();setAssets(null);setError(false);logged.current=false;
  void fetch(`/api/v1/lesson-runs/${runId}/media?item_id=${itemId}`,{credentials:'include',signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error();const data=deliveredMediaListSchema.parse(await r.json());if(!abort.signal.aborted)setAssets(data);}).catch(()=>{if(!abort.signal.aborted)setError(true);});return()=>abort.abort();
 },[runId,itemId,hasMedia,retry]);
 if(!hasMedia)return null;
 const transcript=()=>{if(logged.current)return;logged.current=true;void fetch(`/api/v1/lesson-runs/${runId}/media/support`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf(),'x-lingvessa-client':'web'},credentials:'include',body:JSON.stringify({item_id:itemId,kind:'transcript'})}).then(r=>{if(!r.ok)logged.current=false;}).catch(()=>{logged.current=false;});};
 return <div ref={container} className="lesson-media" lang="uk">
  {error?<p role="status">Не вдалося завантажити медіа. <button type="button" onClick={()=>setRetry(retry+1)}>Повторити завантаження</button></p>:assets===null?<p role="status">Завантаження медіа…</p>:null}
  {assets?.filter(a=>a.kind!=='audio').map(a=><img key={`${a.asset_id}:${a.asset_version}`} src={path(runId,itemId,a)} alt={a.decorative?'':a.alt_text} loading="lazy" onError={e=>{e.currentTarget.hidden=true;setError(true);}}/>)}
  {assets?.filter(a=>a.kind==='audio'&&a.speed==='normal').map(a=><AudioPlayer key={`${a.asset_id}:${a.asset_version}`} asset={a} slow={assets.find(s=>s.speed==='slow'&&s.normal_asset_id===a.asset_id&&s.normal_asset_version===a.asset_version)} runId={runId} itemId={itemId}
   onPlay={current=>container.current?.querySelectorAll('audio').forEach(other=>{if(other!==current)other.pause();})} onTranscript={transcript}/>)}
 </div>;
}
