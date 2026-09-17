/** Stable semantic codes are authoring references, never database primary keys. TD §6/§12. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const STABLE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const languageIds = Object.freeze({
  en: '0198f000-0000-7000-8000-000000000001',
  cs: '0198f000-0000-7000-8000-000000000002',
});
export type Language = keyof typeof languageIds;
export function isUuid(value: string): boolean { return UUID_PATTERN.test(value); }
export function isStableCode(value: string): boolean { return STABLE_CODE_PATTERN.test(value); }
export class ContractError extends Error {
  constructor(public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'UNAUTHENTICATED' | 'UNSUPPORTED_CONTRACT' | 'VERSION_CONFLICT' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE', message: string) {
    super(message); this.name = 'ContractError';
  }
}
export function assertUuid(value: string): void {
  if (!isUuid(value)) throw new ContractError('INVALID_INPUT', 'Opaque UUID required');
}
export function normalizeText(value: string): string { return value.normalize('NFC'); }
