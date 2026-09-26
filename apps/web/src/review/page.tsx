'use client';
import {useEffect,useState,useRef} from 'react';
import {LessonPlayer} from '../lesson/player';
type Profile={id:string;language_id:string;language?:string;variety?:string};
type Collection={id:string;name:string;status:string;revision:number;entries?:Array<{id:string;normalized_text:string;note:string|null;translation:string|null}>};
type Session={id:string;state:string;position:number;item_count:number;eta_seconds:number;items:Array<{ordinal:number;lesson_run_id:string;state:string}>};
export function ReviewPage(){
 const [profiles,setProfiles]=useState<Profile[]>([]),[profile,setProfile]=useState(''),[mode,setMode]=useState('recommended'),[collection,setCollection]=useState('');
 const [collections,setCollections]=useState<Collection[]>([]),[selected,setSelected]=useState<Collection|null>(null),[session,setSession]=useState<Session|null>(null);
 const [notice,setNotice]=useState('Завантаження…'),[busy,setBusy]=useState(false),[login,setLogin]=useState(false);const csrf=useRef('');
 const name=(p:Profile|undefined)=>p?.language_id==='0198f000-0000-7000-8000-000000000002'?'Čeština':'English';
 async function api(path:string,method='GET',body?:unknown){const r=await fetch(`/api/v1/${path}`,{method,credentials:'include',headers:{'content-type':'application/json','x-csrf-token':csrf.current,'x-lingvessa-client':'web'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(r.status===401){setLogin(true);throw new Error('Увійдіть, щоб продовжити.');}if(!r.ok){const problem=await r.json().catch(()=>({}));throw new Error(problem.status===409?'Стан змінився. Оновіть повторення або завершіть поточну сесію.':'Не вдалося виконати дію. Перевірте з’єднання та повторіть.');}return r.json();}
 async function act(work:()=>Promise<void>){setBusy(true);setNotice('');try{await work();}catch(e){setNotice(e instanceof Error?e.message:'Сервіс недоступний');}finally{setBusy(false);}}
 async function load(){await act(async()=>{csrf.current=(await api('auth/csrf','POST')).csrf_token;const ps=await api('me/language-profiles') as Profile[];setProfiles(ps);
  const desired=new URLSearchParams(window.location.search).get('profile');const id=ps.find(p=>p.id===desired)?.id??ps[0]?.id??'';setProfile(id);if(id)setCollections(await api(`collections?language_profile_id=${id}`));setLogin(false);});}
 useEffect(()=>{void load();},[]);
 const current=session?.items.find(i=>i.ordinal===session.position);
 async function refreshCollections(){setCollections(await api(`collections?language_profile_id=${profile}`));if(selected)setSelected(await api(`collections/${selected.id}`));}
 return <main className="lesson-player"><header><a href="/">Lingvessa</a><h1>Повторення</h1></header><p role="status">{notice}</p>
 {login?<form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void act(async()=>{await api('auth/login','POST',{email:data.get('email'),password:data.get('password')});await load();});}}>
 <label>Email<input name="email" type="email" required autoComplete="username"/></label><label>Пароль<input name="password" type="password" required autoComplete="current-password"/></label><button disabled={busy}>Увійти</button></form>:<>
 <label>Мова<select value={profile} disabled={busy} onChange={event=>{const id=event.target.value;setProfile(id);setSession(null);setSelected(null);setCollection('');void act(async()=>setCollections(await api(`collections?language_profile_id=${id}`)));}}>{profiles.map(p=><option key={p.id} value={p.id}>{name(p)}</option>)}</select></label>
 <label>Режим<select value={mode} disabled={busy||session?.state==='active'} onChange={e=>setMode(e.target.value)}><option value="recommended">Рекомендовано</option><option value="mistakes">Помилки</option><option value="all">Усі навчальні елементи</option><option value="words">Слова</option><option value="phrases">Фрази</option></select></label>
 <label>Колекція<select value={collection} disabled={busy||session?.state==='active'} onChange={e=>setCollection(e.target.value)}><option value="">Усі</option>{collections.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <button disabled={busy||!profile} onClick={()=>void act(async()=>setSession(await api('review-sessions','POST',{language_profile_id:profile,mode,cap:10,...(collection?{collection_id:collection}:{})})))}>Почати повторення</button>
 {session&&<section><h2>{name(profiles.find(p=>p.id===profile))}: повторення</h2><p>{Math.min(session.position+1,session.item_count)} / {session.item_count} · Приблизно {Math.ceil(session.eta_seconds/60)} хв.</p>
 {session.state==='active'&&current?<>
 <LessonPlayer embedded key={current.lesson_run_id} runId={current.lesson_run_id} sessionCsrf={()=>csrf.current}/>
 <div className="review-actions"><button disabled={busy} onClick={()=>void act(async()=>setSession(await api(`review-sessions/${session.id}`)))}>Наступна вправа / оновити</button>
 <button disabled={busy} onClick={()=>void act(async()=>setSession(await api(`review-sessions/${session.id}/skip`,'POST',{expected_position:session.position})))}>Пропустити без зарахування</button>
 <button disabled={busy} onClick={()=>void act(async()=>setSession(await api(`review-sessions/${session.id}/cancel`,'POST')))}>Завершити сесію</button></div></>:<p>{session.state==='completed'?(session.item_count?'Повторення завершено.':'Немає доступних вправ для цього вибору.'):'Сесію завершено або її час минув. Можна почати нову.'}</p>}</section>}
 <section><h2>Мої колекції</h2><form onSubmit={event=>{event.preventDefault();const name=new FormData(event.currentTarget).get('name');event.currentTarget.reset();void act(async()=>{await api('collections','POST',{language_profile_id:profile,name});await refreshCollections();});}}>
 <label>Назва колекції<input name="name" maxLength={160} required/></label><button disabled={busy||!profile}>Створити колекцію</button></form>
 <ul>{collections.map(c=><li key={c.id}><button disabled={busy} onClick={()=>void act(async()=>setSelected(await api(`collections/${c.id}`)))}>{c.name}{c.status==='archived'?' (архів)':''}</button></li>)}</ul>
 {selected&&<section><h3>{selected.name}</h3><form onSubmit={event=>{event.preventDefault();const name=new FormData(event.currentTarget).get('name');void act(async()=>{await api(`collections/${selected.id}`,'PATCH',{expected_revision:selected.revision,name});await refreshCollections();});}}>
 <label>Нова назва<input name="name" defaultValue={selected.name} key={selected.id} required maxLength={160}/></label><button disabled={busy}>Перейменувати</button></form>
 <button disabled={busy} onClick={()=>void act(async()=>{await api(`collections/${selected.id}`,'PATCH',{expected_revision:selected.revision,status:selected.status==='active'?'archived':'active'});await refreshCollections();})}>{selected.status==='active'?'Архівувати':'Відновити з архіву'}</button>
 <button disabled={busy} onClick={()=>{if(window.confirm('Видалити колекцію? Навчальна історія збережеться.'))void act(async()=>{await api(`collections/${selected.id}`,'DELETE');setSelected(null);setCollections(await api(`collections?language_profile_id=${profile}`));});}}>Видалити колекцію</button>
 {selected.status==='active'&&<form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);event.currentTarget.reset();void act(async()=>{await api(`collections/${selected.id}/entries`,'POST',{custom_text:data.get('text'),translation:data.get('translation'),note:data.get('note')});await refreshCollections();});}}>
 <label>Слово або фраза<input name="text" required maxLength={2000}/></label><label>Переклад<input name="translation" maxLength={2000}/></label><label>Нотатка<input name="note" maxLength={4000}/></label><button disabled={busy}>Додати запис</button></form>}
 <p>Власні записи зберігаються як нотатки. Для повторення використовуйте записи, пов’язані з навчальним матеріалом. Аудіо наразі недоступне.</p>
 <ul>{selected.entries?.map(e=><li key={e.id}>{e.normalized_text}{e.translation?` — ${e.translation}`:''}<button disabled={busy} onClick={()=>void act(async()=>{await api(`collections/${selected.id}/entries/${e.id}`,'DELETE');await refreshCollections();})}>Видалити запис</button></li>)}</ul></section>}</section>
 </>}
 </main>;
}
