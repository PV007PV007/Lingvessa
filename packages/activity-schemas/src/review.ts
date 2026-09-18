import {z} from 'zod';
import {UUID_PATTERN} from '../../domain/src/identity.js';
import {skillFacetMatrix} from './mastery.js';
const uuid=z.string().regex(UUID_PATTERN);
export const reviewStartSchema=z.object({language_profile_id:uuid,mode:z.enum(['recommended','mistakes','all','words','phrases']).default('recommended'),
  skill:z.enum(Object.keys(skillFacetMatrix) as [keyof typeof skillFacetMatrix,...Array<keyof typeof skillFacetMatrix>]).optional(),
  topic_id:uuid.optional(),collection_id:uuid.optional(),cap:z.number().int().min(1).max(20).default(10)}).strict();
export const reviewSkipSchema=z.object({expected_position:z.number().int().min(0).max(20)}).strict();
export const collectionCreateSchema=z.object({language_profile_id:uuid,name:z.string().trim().min(1).max(160)}).strict();
export const collectionUpdateSchema=z.object({expected_revision:z.number().int().positive(),name:z.string().trim().min(1).max(160).optional(),status:z.enum(['active','archived']).optional()}).strict();
export const collectionEntrySchema=z.object({knowledge_item_id:uuid.optional(),content_entity_id:uuid.optional(),custom_text:z.string().trim().min(1).max(2000).optional(),
  translation:z.string().max(2000).optional(),note:z.string().max(4000).optional()}).strict().refine(x=>Boolean(x.custom_text)!==Boolean(x.knowledge_item_id||x.content_entity_id),'Choose custom text or a curated reference');
export const resetSchema=z.object({request_id:uuid,language_profile_id:uuid,scope:z.enum(['lesson','module','language']),target_id:uuid.optional(),
  reset_mastery:z.boolean().default(false),confirmed:z.literal(true),confirmation:z.string().optional()}).strict()
  .refine(x=>(x.scope==='language')===(x.target_id===undefined),'Language scope has no target; lesson/module require a target')
  .refine(x=>x.scope!=='language'||x.confirmation==='RESET_LANGUAGE','Full language reset requires explicit confirmation');
