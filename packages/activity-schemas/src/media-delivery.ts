import {z} from 'zod';
import {UUID_PATTERN} from '../../domain/src/identity.js';
import {mediaKindSchema,mediaScopeSchema,audioTurnSchema} from './media.js';
const uuid=z.string().regex(UUID_PATTERN);
/** Only learner presentation metadata. Provider IDs/URLs, credentials and internal QA notes are excluded. */
export const deliveredMediaSchema=z.object({
 asset_id:uuid,asset_version:z.number().int().positive(),role:z.string(),kind:mediaKindSchema,scope:mediaScopeSchema,
 mime:z.string(),checksum:z.string().regex(/^[a-f0-9]{64}$/u),byte_length:z.number().int().positive(),
 alt_text:z.string(),decorative:z.boolean(),duration_ms:z.number().int().positive().optional(),
 transcript:z.string().optional(),speed:z.enum(['normal','slow']).optional(),
 voice_id:uuid.optional(),voice_version_code:z.string().optional(),
 character_id:uuid.optional(),character_version_code:z.string().optional(),
 turns:z.array(audioTurnSchema).optional(),
 normal_asset_id:uuid.optional(),normal_asset_version:z.number().int().positive().optional(),
}).strict();
export const deliveredMediaListSchema=z.array(deliveredMediaSchema);
export type DeliveredMedia=z.infer<typeof deliveredMediaSchema>;
