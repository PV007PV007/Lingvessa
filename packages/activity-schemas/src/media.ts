import { z } from 'zod';
import { UUID_PATTERN, STABLE_CODE_PATTERN } from '../../domain/src/identity.js';

const uuid = z.string().regex(UUID_PATTERN);
const code = z.string().regex(STABLE_CODE_PATTERN);
const version = z.string().min(1).max(80).refine(v => !/[\s*]/u.test(v));
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
export const mediaKindSchema = z.enum(['image','avatar','vector','audio']);
export const mediaScopeSchema = z.object({ language: z.enum(['en','cs']), variety: z.enum(['common','en-GB','en-US','cs-CZ']) }).strict()
  .refine(s => s.language === 'cs' ? s.variety === 'cs-CZ' : s.variety !== 'cs-CZ', 'Media language/variety mismatch');

export const rightsSchema = z.object({
  licence: z.string().min(1).max(500), provenance: z.string().min(1).max(4000),
  source_kind: z.enum(['programmatic','licensed','human_recorded','ai_generated']),
  generator_version: version, spec_hash: digest,
  real_person_clone: z.literal(false),
}).strict();
export const voiceSchema = z.object({
  id: uuid, stable_code: code, version_code: version,
  scope: mediaScopeSchema, profile: z.string().min(1).max(1000),
  provider_adapter_code: code, provider_external_id: z.string().min(1).max(500), rights: rightsSchema,
}).strict().refine(v => v.scope.variety !== 'common', 'A voice requires an exact variety');
export const characterSchema = z.object({
  id: uuid, stable_code: code, version_code: version, scope: mediaScopeSchema,
  style_profile: z.string().min(1).max(2000), allowed_contexts: z.array(code).min(1),
  voice_id: uuid, voice_version_code: version, rights: rightsSchema,
}).strict();
export const audioTurnSchema = z.object({
  speaker: code, voice_id: uuid, voice_version_code: version,
  character_id: uuid.optional(), character_version_code: version.optional(),
  start_ms: z.number().int().nonnegative(), end_ms: z.number().int().positive(),
  text: z.string().min(1).max(4000),
}).strict().refine(t => t.end_ms > t.start_ms && Boolean(t.character_id) === Boolean(t.character_version_code), 'Invalid speaker timing/binding');

export const assetVersionSchema = z.object({
  asset_id: uuid, stable_code: code, asset_version: z.number().int().positive(), version_code: version,
  kind: mediaKindSchema, scope: mediaScopeSchema, purpose: z.string().min(1).max(1000),
  mime: z.enum(['image/svg+xml','image/png','image/jpeg','image/webp','audio/wav','audio/mpeg','audio/ogg']),
  checksum: digest, byte_length: z.number().int().positive().max(32 * 1024 * 1024),
  width: z.number().int().positive().max(8192).optional(), height: z.number().int().positive().max(8192).optional(),
  duration_ms: z.number().int().positive().max(600000).optional(), codec: z.string().min(1).max(80).optional(),
  loudness_lufs: z.number().min(-100).max(0).optional(),
  decorative: z.boolean(), alt_text: z.string().max(1000), transcript: z.string().max(12000).optional(),
  script_version: version.optional(), script_hash: digest.optional(), speed: z.enum(['normal','slow']).optional(),
  voice_id: uuid.optional(), voice_version_code: version.optional(), turns: z.array(audioTurnSchema).max(100).optional(),
  normal_asset_id:uuid.optional(),normal_asset_version:z.number().int().positive().optional(),
  rights: rightsSchema,
}).strict().superRefine((a,ctx) => {
  const error = (message:string) => ctx.addIssue({code:'custom',message});
  if(a.kind==='audio') {
    if(!a.mime.startsWith('audio/') || !a.duration_ms || !a.codec || a.loudness_lufs===undefined || !a.transcript || !a.script_version || !a.script_hash || !a.speed || !a.voice_id || !a.voice_version_code || a.scope.variety==='common') error('Audio requires exact variety, script, transcript, voice, speed and technical metadata');
    if(a.decorative) error('Instructional audio is not decorative');
    if(a.speed==='slow'&&(!a.normal_asset_id||!a.normal_asset_version))error('Slow assets must pin their normal-speed source');
    if(a.speed!=='slow'&&(a.normal_asset_id||a.normal_asset_version))error('Normal-speed linkage is only valid for a slow asset');
    let end=0;
    for(const t of a.turns??[]) { if(t.start_ms<end || t.end_ms>(a.duration_ms??0)) error('Audio turns overlap or exceed duration'); end=t.end_ms; }
  } else if(!a.mime.startsWith('image/') || !a.width || !a.height || (!a.decorative && !a.alt_text.trim()) || (a.decorative && a.alt_text)) error('Image dimensions and correct alt/decorative treatment required');
});
export type AssetVersion = z.infer<typeof assetVersionSchema>;
export type Voice = z.infer<typeof voiceSchema>;
export type Character = z.infer<typeof characterSchema>;

export const mediaRequirementSchema = z.object({
  id:uuid, target_content_version_id:uuid, item_id:uuid, role:code, required:z.boolean(), kind:mediaKindSchema,
  scope:mediaScopeSchema, specification_version:version, specification:z.string().min(1).max(8000),
  accessibility_role:z.enum(['semantic','decorative']),
}).strict();
