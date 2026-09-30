import {createCipheriv,createDecipheriv,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {mkdir,open,unlink,readdir,lstat,statfs,link} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {assertUuid,ContractError} from '../../domain/src/identity.js';
import {SPEECH_LIMITS} from '../../application/src/speech.js';
import type {TransientSpeechStore} from '../../application/src/speech.js';

/** Shared tmpfs only. AES-256-GCM binds job and expiry. No permanent object-storage adapter is used. */
export class EncryptedTransientSpeechStore implements TransientSpeechStore {
 private readonly root:string;
 constructor(root:string,private readonly key:Uint8Array){if(!root.startsWith('/')||key.byteLength!==32)throw new TypeError('Absolute transient path and 32-byte key required');this.root=resolve(root);}
 private async ready(){await mkdir(this.root,{recursive:true,mode:0o700});const info=await statfs(this.root);if(Number(info.type)!==0x01021994)throw new ContractError('SERVICE_UNAVAILABLE','Speech audio requires an ephemeral memory filesystem');const meta=await lstat(this.root);if(meta.isSymbolicLink()||(meta.mode&0o077)!==0)throw new ContractError('SERVICE_UNAVAILABLE','Private transient root required');}
 private path(id:string){assertUuid(id);return join(this.root,id+'.speech');}
 private aad(id:string,expiry:number){return Buffer.from(`${id}:${expiry}`);}
 async put(id:string,bytes:Uint8Array,expiresAt:Date):Promise<void>{
  const path=this.path(id),expiry=expiresAt.getTime();if(!bytes.length||bytes.length>SPEECH_LIMITS.maxBytes||expiry<=Date.now()||expiry>Date.now()+SPEECH_LIMITS.ttlMs)throw new ContractError('INVALID_INPUT','Transient audio size or retention invalid');await this.ready();
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(this.aad(id,expiry));
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]),header=Buffer.alloc(36);header.writeDoubleBE(expiry,0);iv.copy(header,8);cipher.getAuthTag().copy(header,20);
  // Publish only a complete encrypted object. A concurrent sweeper must never
  // mistake an in-progress final file for an expired/invalid recording.
  const staging=join(this.root,`${id}.${randomUUID()}.part`);
  const file=await open(staging,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await file.writeFile(Buffer.concat([header,encrypted]));await link(staging,path);}
  finally{await file.close();await unlink(staging).catch(()=>undefined);}
 }
 async read(id:string):Promise<Uint8Array>{
  await this.ready();const path=this.path(id),file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const stat=await file.stat();if(stat.size<37||stat.size>SPEECH_LIMITS.maxBytes+36)throw new ContractError('INVALID_INPUT','Transient audio size invalid');
   const data=await file.readFile(),expiry=data.readDoubleBE(0);if(!Number.isFinite(expiry)||expiry<=Date.now()){await this.delete(id);throw new ContractError('CONFLICT','Transient audio expired');}
   const decipher=createDecipheriv('aes-256-gcm',this.key,data.subarray(8,20));decipher.setAAD(this.aad(id,expiry));decipher.setAuthTag(data.subarray(20,36));
   return Buffer.concat([decipher.update(data.subarray(36)),decipher.final()]);
  }finally{await file.close();}
 }
 async delete(id:string):Promise<void>{try{await unlink(this.path(id));}catch(e){if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e;}}
 async prune():Promise<number>{await this.ready();let count=0;for(const name of await readdir(this.root)){
  const staged=/^[0-9a-f-]{36}\.[0-9a-f-]{36}\.part$/u.test(name);
  if(!staged&&!/^[0-9a-f-]{36}\.speech$/u.test(name))continue;const path=join(this.root,name);const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW).catch(()=>null);if(!file)continue;
  try{const header=Buffer.alloc(8),read=await file.read(header,0,8,0),stat=await file.stat();const expiry=read.bytesRead===8?header.readDoubleBE():0;
   const incomplete=read.bytesRead!==8||!Number.isFinite(expiry);
   if((!staged&&incomplete)||(!incomplete&&expiry<=Date.now())||stat.mtimeMs+SPEECH_LIMITS.ttlMs<=Date.now()){await unlink(path).catch(()=>undefined);count++;}
  }finally{await file.close();}
 }return count;}
}
export function uploadToken(secret:Uint8Array,jobId:string,userId:string,expiresAt:Date):string {return createHmac('sha256',secret).update(`${jobId}:${userId}:${expiresAt.toISOString()}`).digest('base64url');}
export function validUploadToken(secret:Uint8Array,jobId:string,userId:string,expiresAt:Date,token:string):boolean {
 if(expiresAt.getTime()<=Date.now()||!/^[A-Za-z0-9_-]{43}$/u.test(token))return false;
 return timingSafeEqual(Buffer.from(token),Buffer.from(uploadToken(secret,jobId,userId,expiresAt)));
}
export class UnavailableTransientSpeechStore implements TransientSpeechStore {
 async put():Promise<never>{throw new ContractError('SERVICE_UNAVAILABLE','Speech recording unavailable');}
 async read():Promise<never>{throw new ContractError('SERVICE_UNAVAILABLE','Speech recording unavailable');}
 async delete():Promise<void>{}
 async prune():Promise<number>{return 0;}
}
