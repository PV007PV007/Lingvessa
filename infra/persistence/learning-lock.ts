import type pg from 'pg';
import { assertUuid, ContractError } from '../../packages/domain/src/identity.js';
/** Consistent first lock for attempts, Review, resets and recompute; prevents lost projection updates. */
export async function lockLearningProfile(db:pg.PoolClient,userId:string,profileId:string){
  assertUuid(userId);assertUuid(profileId);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`learning-profile:${profileId}`]);
  const row=(await db.query('SELECT * FROM language_profiles WHERE id=$1 AND user_id=$2',[profileId,userId])).rows[0];
  if(!row)throw new ContractError('NOT_FOUND','Language profile not found');
  return row as {id:string;user_id:string;language_id:string;variant_id:string};
}
