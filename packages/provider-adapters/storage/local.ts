import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { AssetStore, StoredAsset } from '../../application/src/media.js';
import { ContractError } from '../../domain/src/identity.js';
import { bytesHash, validateObjectKey, validateAssetBytes } from './asset-integrity.js';

/** Controlled local fixture fallback. Production S3 integration uses S3AssetStore. */
export class LocalAssetStore implements AssetStore {
  constructor(private readonly root:string) {}
  private path(key:string):string {validateObjectKey(key);return join(this.root,key.replaceAll('/','_'));}
  private async object(key:string):Promise<{metadata:StoredAsset;body:Buffer}|null>{
    let stored:Buffer;try{stored=await readFile(this.path(key));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
    const delimiter=stored.indexOf(10);if(delimiter<0||delimiter>2048)throw new ContractError('CONFLICT','Local asset metadata invalid');
    const metadata=JSON.parse(stored.subarray(0,delimiter).toString('utf8')) as StoredAsset;
    return {metadata,body:stored.subarray(delimiter+1)};
  }
  async inspect(key:string):Promise<StoredAsset|null>{return (await this.object(key))?.metadata??null;}
  async putImmutable(key:string,body:Uint8Array,mime:string,checksum:string):Promise<StoredAsset>{
    const path=this.path(key);validateAssetBytes(body,mime,checksum);
    if(!key.endsWith('/'+checksum))throw new ContractError('INVALID_INPUT','Object key/checksum mismatch');
    const metadata={key,checksum,bytes:body.byteLength,mime};await mkdir(this.root,{recursive:true,mode:0o700});
    const temporary=join(this.root,`${randomUUID()}.tmp`);
    await writeFile(temporary,Buffer.concat([Buffer.from(JSON.stringify(metadata)+'\n'),Buffer.from(body)]),{flag:'wx',mode:0o600});
    try {await link(temporary,path);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}finally{await unlink(temporary);}
    const existing=await this.object(key);
    if(!existing||JSON.stringify(existing.metadata)!==JSON.stringify(metadata)||bytesHash(existing.body)!==checksum)throw new ContractError('CONFLICT','Immutable local asset collision');
    return metadata;
  }
  async readVerified(key:string,checksum:string,maximumBytes:number):Promise<Uint8Array>{
    const stored=await this.object(key);if(!stored)throw new ContractError('NOT_FOUND','Asset is missing');
    if(stored.body.byteLength>maximumBytes||bytesHash(stored.body)!==checksum)throw new ContractError('CONFLICT','Asset integrity failed');
    return stored.body;
  }
}
