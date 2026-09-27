/** Platform-owned media identities. Provider URLs and SDK objects never cross this port. */
export type StoredAsset = { key: string; checksum: string; bytes: number; mime: string };
export interface AssetStore {
  putImmutable(key: string, body: Uint8Array, mime: string, checksum: string): Promise<StoredAsset>;
  readVerified(key: string, checksum: string, maximumBytes: number): Promise<Uint8Array>;
  inspect(key: string): Promise<StoredAsset | null>;
}
export type MediaReference = { asset_id: string; asset_stable_code: string; asset_version: number; role: string };
export type MediaApprovalGate = 'semantic' | 'linguistic' | 'originality' | 'accessibility' | 'rights' | 'technical';
export const mediaApprovalGates: readonly MediaApprovalGate[] = ['semantic','linguistic','originality','accessibility','rights','technical'];
