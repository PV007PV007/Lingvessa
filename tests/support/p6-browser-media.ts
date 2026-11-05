/// <reference lib="dom" />
import {expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {deliveredMediaListSchema} from '../../packages/activity-schemas/src/media-delivery.js';
import type {AuthoredUnit} from '../../packages/content-tools/src/authored-unit.js';

/** Match the learner endpoint and the actual rendered media to the author's immutable pins. */
export async function checkItemMedia(page:Page,runId:string,item:AuthoredUnit['activities'][number],pins:AuthoredUnit['media_pins']){
  const refs=item.presentation.media_refs,base='/api/v1/lesson-runs/'+runId+'/media';
  const url=(id:string,version:number)=>base+'/'+id+'/'+version+'?item_id='+item.id;
  if(!refs.length){await expect(page.locator('.lesson-media')).toHaveCount(0);return;}
  const list=await page.request.get(base+'?item_id='+item.id);expect(list.status()).toBe(200);
  const assets=deliveredMediaListSchema.parse(await list.json());
  expect(assets.map(a=>a.asset_id).sort()).toEqual(refs.map(r=>r.asset_id).sort());
  for(const ref of refs){
    const pin=pins.find(p=>p.asset_id===ref.asset_id)!,a=assets.find(m=>m.asset_id===ref.asset_id)!;
    expect([a.asset_version,a.role,a.kind,a.checksum,a.byte_length]).toEqual([pin.asset_version,ref.role,pin.kind,pin.checksum,pin.byte_length]);
    const src=url(a.asset_id,a.asset_version),response=await page.request.get(src);expect(response.status()).toBe(200);
    const body=await response.body();expect(body.length).toBe(pin.byte_length);expect(createHash('sha256').update(body).digest('hex')).toBe(pin.checksum);
    if(pin.kind!=='audio'){
      const img=page.locator('.lesson-media img[src="'+src+'"]');await expect(img).toBeVisible();
      await expect.poll(()=>img.evaluate(el=>(el as HTMLImageElement).complete&&(el as HTMLImageElement).naturalWidth>0)).toBe(true);
    }
  }
  const normal=assets.filter(a=>a.kind==='audio'&&a.speed==='normal'),players=page.locator('.lesson-media .media-audio');
  await expect(players).toHaveCount(normal.length);
  for(const [i,n] of normal.entries()){
    const slows=assets.filter(a=>a.kind==='audio'&&a.speed==='slow'&&a.normal_asset_id===n.asset_id&&a.normal_asset_version===n.asset_version);
    expect(slows).toHaveLength(1);
    const player=players.nth(i),audio=player.locator('audio');
    for(const [asset,button] of [[n,'Відтворити'],[slows[0]!,'Повільно']] as const){
      const src=url(asset.asset_id,asset.asset_version);await player.getByRole('button',{name:button,exact:true}).click();
      await expect(audio).toHaveAttribute('src',src);
      // A native playing event on this exact source confirms decoder/playback success even on short words.
      await expect.poll(()=>audio.evaluate(el=>(el as HTMLAudioElement).dataset.p6Played)).toBe(src);
      expect(await audio.evaluate(el=>(el as HTMLAudioElement).duration)).toBeGreaterThan(0);
    }
    if((n.turns?.length??0)>1){
      const speakers=new Set(n.turns!.map(t=>t.character_id));expect(speakers.size).toBe(2);
      for(const id of speakers)await expect(player.locator('figure[data-character-id="'+id+'"] img')).toBeVisible();
      await expect(player.locator('figure[aria-current="true"]')).toHaveCount(1);
    }
  }
}
