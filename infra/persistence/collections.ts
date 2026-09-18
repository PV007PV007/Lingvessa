import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {collectionCreateSchema,collectionUpdateSchema,collectionEntrySchema} from '../../packages/activity-schemas/src/review.js';
import {assertUuid,ContractError} from '../../packages/domain/src/identity.js';
import {transaction} from './database.js';
import {lockLearningProfile} from './learning-lock.js';
export class CollectionRepository {
  constructor(private readonly pool:pg.Pool){}
  async create(userId:string,raw:unknown){const input=collectionCreateSchema.parse(raw);return transaction(this.pool,async db=>{
    const p=await lockLearningProfile(db,userId,input.language_profile_id);const id=randomUUID();
    return (await db.query('INSERT INTO collections(id,user_id,language_profile_id,language_id,name) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,userId,p.id,p.language_id,input.name])).rows[0];
  });}
  async list(userId:string,profileId:string){return transaction(this.pool,async db=>{await lockLearningProfile(db,userId,profileId);return (await db.query('SELECT * FROM collections WHERE user_id=$1 AND language_profile_id=$2 ORDER BY created_at,id',[userId,profileId])).rows;});}
  async get(userId:string,id:string){return transaction(this.pool,async db=>{const c=await this.owned(db,userId,id);return {...c,entries:(await db.query('SELECT * FROM collection_entries WHERE collection_id=$1 ORDER BY created_at,id',[id])).rows};});}
  async update(userId:string,id:string,raw:unknown){const input=collectionUpdateSchema.parse(raw);return transaction(this.pool,async db=>{
    const c=await this.owned(db,userId,id);if(c.revision!==input.expected_revision)throw new ContractError('VERSION_CONFLICT','Collection revision changed');
    return (await db.query('UPDATE collections SET name=$1,status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$3 RETURNING *',[input.name??c.name,input.status??c.status,id])).rows[0];
  });}
  async remove(userId:string,id:string){return transaction(this.pool,async db=>{await this.owned(db,userId,id);await db.query('DELETE FROM collections WHERE id=$1',[id]);return {deleted:true};});}
  async putEntry(userId:string,id:string,raw:unknown,entryId?:string){const input=collectionEntrySchema.parse(raw);if(entryId)assertUuid(entryId);
    return transaction(this.pool,async db=>{const c=await this.owned(db,userId,id);if(c.status!=='active')throw new ContractError('CONFLICT','Collection is archived');
      let text=input.custom_text;
      if(input.knowledge_item_id){const k=(await db.query('SELECT canonical_form FROM knowledge_items WHERE id=$1 AND language_id=$2',[input.knowledge_item_id,c.language_id])).rows[0];if(!k)throw new ContractError('NOT_FOUND','Knowledge reference not found in this language');text=k.canonical_form;}
      if(input.content_entity_id){const v=(await db.query('SELECT stable_code FROM content_entities WHERE id=$1 AND language_id=$2',[input.content_entity_id,c.language_id])).rows[0];if(!v)throw new ContractError('NOT_FOUND','Content reference not found in this language');text??=v.stable_code;}
      const normalized=text!.normalize('NFC').trim().replace(/\s+/gu,' ');const key=entryId??randomUUID();
      if(entryId&&!((await db.query('SELECT 1 FROM collection_entries WHERE id=$1 AND collection_id=$2',[entryId,id])).rowCount))throw new ContractError('NOT_FOUND','Collection entry not found');
      const values=[key,id,userId,c.language_profile_id,c.language_id,input.knowledge_item_id??null,input.content_entity_id??null,input.custom_text??null,normalized,input.translation??null,input.note??null];
      const row=(await db.query(`INSERT INTO collection_entries(id,collection_id,user_id,language_profile_id,language_id,knowledge_item_id,content_entity_id,custom_text,normalized_text,translation,note)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET knowledge_item_id=EXCLUDED.knowledge_item_id,content_entity_id=EXCLUDED.content_entity_id,
        custom_text=EXCLUDED.custom_text,normalized_text=EXCLUDED.normalized_text,translation=EXCLUDED.translation,note=EXCLUDED.note,audio_status='unavailable' RETURNING *`,values)).rows[0];
      await db.query('UPDATE collections SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[id]);return row;
    });
  }
  async removeEntry(userId:string,id:string,entryId:string){assertUuid(entryId);return transaction(this.pool,async db=>{await this.owned(db,userId,id);await db.query('DELETE FROM collection_entries WHERE id=$1 AND collection_id=$2',[entryId,id]);await db.query('UPDATE collections SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',[id]);return {deleted:true};});}
  private async owned(db:pg.PoolClient,userId:string,id:string){assertUuid(userId);assertUuid(id);const first=(await db.query('SELECT * FROM collections WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];if(!first)throw new ContractError('NOT_FOUND','Collection not found');await lockLearningProfile(db,userId,first.language_profile_id);
    const c=(await db.query('SELECT * FROM collections WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])).rows[0];if(!c)throw new ContractError('NOT_FOUND','Collection not found');return c;}
}
