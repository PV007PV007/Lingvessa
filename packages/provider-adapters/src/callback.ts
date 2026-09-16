import { createHmac, timingSafeEqual } from 'node:crypto';

export type CallbackClaims = {
  job_id: string;
  provider_id: string;
  model_version: string;
  timestamp: string;
  nonce: string;
};

/** Generic security primitive only. P3 exposes no provider callback endpoint or provider job runtime. */
export function verifyProviderCallback(
  claims: CallbackClaims,
  signature: string,
  secret: string,
  acceptedProviderId: string,
  acceptedModelVersion: string,
  seenNonce: (nonce: string) => boolean,
  now = Date.now(),
  replayWindowMs = 5 * 60 * 1000,
): boolean {
  const timestamp = Date.parse(claims.timestamp);
  if (!claims.job_id || claims.provider_id !== acceptedProviderId || claims.model_version !== acceptedModelVersion ||
      !Number.isFinite(timestamp) || Math.abs(now - timestamp) > replayWindowMs || seenNonce(claims.nonce)) return false;
  const payload = [claims.job_id, claims.provider_id, claims.model_version, claims.timestamp, claims.nonce].join('\n');
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, 'hex'); } catch { return false; }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
