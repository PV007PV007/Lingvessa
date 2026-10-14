import {z} from 'zod';
import type {AssetStore} from '../../packages/application/src/media.js';
import {ContractError} from '../../packages/domain/src/identity.js';
import {ConfigurationError} from './runtime.js';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {S3AssetStore} from '../../packages/provider-adapters/storage/s3.js';

const schema=z.object({
 LINGVESSA_ENV:z.enum(['local','preview','staging','production']),
 MEDIA_STORAGE_MODE:z.enum(['unavailable','local_fixture','private_local','s3']).default('unavailable'),
 MEDIA_LOCAL_ROOT:z.string().startsWith('/').optional(),
 MEDIA_S3_ENDPOINT:z.url().optional(),MEDIA_S3_REGION:z.string().min(1).optional(),MEDIA_S3_BUCKET:z.string().min(1).optional(),
 MEDIA_S3_ACCESS_KEY:z.string().min(1).optional(),MEDIA_S3_SECRET_KEY:z.string().min(1).optional(),
}).superRefine((c,ctx)=>{
 if(c.MEDIA_STORAGE_MODE==='private_local'&&(c.LINGVESSA_ENV!=='local'||!c.MEDIA_LOCAL_ROOT))ctx.addIssue({code:'custom',path:['MEDIA_STORAGE_MODE'],message:'Explicit private local scope/root required'});
 if(c.MEDIA_STORAGE_MODE==='local_fixture'&&(c.LINGVESSA_ENV!=='local'||!c.MEDIA_LOCAL_ROOT))ctx.addIssue({code:'custom',path:['MEDIA_STORAGE_MODE'],message:'Explicit local fixture root required'});
 if(c.MEDIA_STORAGE_MODE==='s3')for(const key of ['MEDIA_S3_ENDPOINT','MEDIA_S3_REGION','MEDIA_S3_BUCKET','MEDIA_S3_ACCESS_KEY','MEDIA_S3_SECRET_KEY'] as const)if(!c[key])ctx.addIssue({code:'custom',path:[key],message:'Required'});
});
class UnavailableAssetStore implements AssetStore {
 async inspect():Promise<never>{throw new ContractError('SERVICE_UNAVAILABLE','Media delivery is not configured');}
 async readVerified():Promise<never>{throw new ContractError('SERVICE_UNAVAILABLE','Media delivery is not configured');}
 async putImmutable():Promise<never>{throw new ContractError('SERVICE_UNAVAILABLE','Media ingestion is not configured');}
}
/** Production profile approval is an operational gate (OD-004); no provider is selected by default. */
export function mediaStore(env:NodeJS.ProcessEnv):AssetStore {
 const result=schema.safeParse(env);if(!result.success)throw new ConfigurationError([...new Set(result.error.issues.map(i=>String(i.path[0]??'media')))]);
 const c=result.data;
 if(c.MEDIA_STORAGE_MODE==='local_fixture'||c.MEDIA_STORAGE_MODE==='private_local')return new LocalAssetStore(c.MEDIA_LOCAL_ROOT!);
 if(c.MEDIA_STORAGE_MODE==='s3')return new S3AssetStore({endpoint:c.MEDIA_S3_ENDPOINT!,region:c.MEDIA_S3_REGION!,bucket:c.MEDIA_S3_BUCKET!,accessKey:c.MEDIA_S3_ACCESS_KEY!,secretKey:c.MEDIA_S3_SECRET_KEY!});
 return new UnavailableAssetStore();
}
