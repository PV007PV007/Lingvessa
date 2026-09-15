import { ContractError, assertUuid, isStableCode } from '../../domain/src/identity.js';
import type { ContentReference } from '../../activity-schemas/src/content.js';

export interface ContentLookup {
  resolve(languageId: string, stableCode: string, versionCode: string): Promise<{ entity_id: string; content_version_id: string } | null>;
}
export type AuthoringReference = { stable_code: string; version_code: string; relation: ContentReference['relation'] };
/** Explicit versions only; wildcards/ranges/groups must be expanded by the author before import. */
export async function resolveAuthoringReferences(lookup: ContentLookup, languageId: string, refs: readonly AuthoringReference[]): Promise<ContentReference[]> {
  assertUuid(languageId);
  const result: ContentReference[] = [];
  for (const ref of refs) {
    if (!isStableCode(ref.stable_code) || !ref.version_code || /[\s*]/u.test(ref.version_code))
      throw new ContractError('INVALID_INPUT', 'Atomic stable_code and exact version_code required');
    const target = await lookup.resolve(languageId, ref.stable_code, ref.version_code);
    if (!target) throw new ContractError('NOT_FOUND', 'Unresolved content reference in language scope');
    assertUuid(target.entity_id); assertUuid(target.content_version_id);
    result.push({ ...target, ...ref });
  }
  return result;
}
