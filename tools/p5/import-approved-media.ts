import {createFoundationPool} from '../../infra/persistence/database.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import {mediaStore} from '../../infra/config/media.js';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {assertUuid} from '../../packages/domain/src/identity.js';
import {loadMediaLibrary,importMediaLibrary} from './media-library.js';
import {isAbsolute,relative} from 'node:path';
import {realpath} from 'node:fs/promises';
const actor=process.env.MEDIA_IMPORT_ACTOR_ID??'';assertUuid(actor);const url=localDatabaseUrl(process.env);
if(!['private_local','s3'].includes(process.env.MEDIA_STORAGE_MODE??''))throw new Error('Explicit development/test private_local or S3 storage is required');
const audioRoot=process.env.MEDIA_SOURCE_AUDIO_ROOT;
if(!audioRoot||!isAbsolute(audioRoot))throw new Error('Explicit absolute external MEDIA_SOURCE_AUDIO_ROOT required');
const path=relative(await realpath(process.cwd()),await realpath(audioRoot));
if(path===''||(!path.startsWith('../')&&!isAbsolute(path)))throw new Error('Full M01 corpus must remain outside the Git checkout');
const library=await loadMediaLibrary(process.cwd(),{externalAudioRoot:audioRoot}),pool=createFoundationPool(url);
try{const result=await importMediaLibrary(new MediaRepository(pool,mediaStore(process.env)),actor,library,(done,total)=>{if(done%30===0)console.log(JSON.stringify({event:'media_import_progress',done,total}));});console.log(JSON.stringify({status:'PASS',imported_versions:result.length,approvals_inserted:0,publication_created:false,p6_authorized:false}));}finally{await pool.end();}
