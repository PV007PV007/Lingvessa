import {createFoundationPool} from '../../infra/persistence/database.js';
import {MediaRepository} from '../../infra/persistence/media.js';
import {mediaStore} from '../../infra/config/media.js';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {assertUuid} from '../../packages/domain/src/identity.js';
import {loadMediaLibrary,importMediaLibrary} from './media-library.js';
const actor=process.env.MEDIA_IMPORT_ACTOR_ID??'';assertUuid(actor);const url=localDatabaseUrl(process.env);
if(process.env.MEDIA_STORAGE_MODE!=='private_local')throw new Error('Explicit private_local storage is required');
const audioRoot=process.env.MEDIA_SOURCE_AUDIO_ROOT;
const library=await loadMediaLibrary(process.cwd(),audioRoot?{externalAudioRoot:audioRoot}:{}),pool=createFoundationPool(url);
try{const result=await importMediaLibrary(new MediaRepository(pool,mediaStore(process.env)),actor,library,(done,total)=>{if(done%30===0)console.log(JSON.stringify({event:'media_import_progress',done,total}));});console.log(JSON.stringify({status:'PASS',imported_versions:result.length,approvals_inserted:0,publication_created:false,p6_authorized:false}));}finally{await pool.end();}
