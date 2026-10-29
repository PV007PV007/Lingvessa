import { createHash, createHmac } from 'node:crypto';
import type { AssetStore, StoredAsset } from '../../application/src/media.js';
import { ContractError } from '../../domain/src/identity.js';
import { bytesHash, validateAssetBytes, validateObjectKey } from './asset-integrity.js';

export type S3Configuration = {
  endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string;
  allowLoopbackHttp?: boolean; timeoutMs?: number;
};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const hmac=(key:string|Uint8Array,s:string)=>createHmac('sha256',key).update(s).digest();
const encode=(s:string)=>encodeURIComponent(s).replace(/[!'()*]/gu,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());

/** SigV4 for platform-controlled path-style S3 requests; credentials remain infrastructure-only. */
export function signedS3Headers(config:S3Configuration,method:string,url:URL,body:Uint8Array,extra:Record<string,string>={},now=new Date()):Record<string,string> {
  const stamp=now.toISOString().replace(/[:-]|\.\d{3}/gu,''),day=stamp.slice(0,8);
  const headers:Record<string,string>={host:url.host,'x-amz-date':stamp,'x-amz-content-sha256':bytesHash(body),...extra};
  const keys=Object.keys(headers).sort();
  const canonicalHeaders=keys.map(k=>`${k}:${headers[k]!.trim().replace(/\s+/gu,' ')}\n`).join('');
  const query=[...url.searchParams.entries()].map(([k,v])=>[encode(k),encode(v)]).sort((a,b)=>a[0]!<b[0]!?-1:a[0]!>b[0]!?1:a[1]!<b[1]!?-1:1).map(([k,v])=>`${k}=${v}`).join('&');
  const canonical=[method,url.pathname,query,canonicalHeaders,keys.join(';'),headers['x-amz-content-sha256']].join('\n');
  const scope=`${day}/${config.region}/s3/aws4_request`;
  const signing=hmac(hmac(hmac(hmac(`AWS4${config.secretKey}`,day),config.region),'s3'),'aws4_request');
  const signature=hmac(signing,`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${hash(canonical)}`).toString('hex');
  return {...headers,authorization:`AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${keys.join(';')}, Signature=${signature}`};
}

export class S3AssetStore implements AssetStore {
  private readonly endpoint:URL;
  constructor(private readonly config:S3Configuration) {
    this.endpoint=new URL(config.endpoint);
    const local=config.allowLoopbackHttp&&['localhost','127.0.0.1','[::1]'].includes(this.endpoint.hostname);
    if(!(this.endpoint.protocol==='https:'||(this.endpoint.protocol==='http:'&&local))||this.endpoint.username||this.endpoint.password||this.endpoint.search||this.endpoint.hash||this.endpoint.pathname!=='/'||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(config.bucket)||!config.region||!config.accessKey||!config.secretKey)
      throw new ContractError('INVALID_INPUT','Invalid private S3 configuration');
  }
  private async request(method:'GET'|'HEAD'|'PUT',key:string,body:Uint8Array=new Uint8Array(),extra:Record<string,string>={}):Promise<Response> {
    validateObjectKey(key);
    const url=new URL(this.endpoint);url.pathname=`/${encode(this.config.bucket)}/${key.split('/').map(encode).join('/')}`;
    try {
      return await fetch(url,{method,headers:signedS3Headers(this.config,method,url,body,extra),
        ...(method==='PUT'?{body:Buffer.from(body)}:{}),redirect:'error',signal:AbortSignal.timeout(this.config.timeoutMs??5000)});
    } catch { throw new ContractError('SERVICE_UNAVAILABLE','Asset storage is unavailable'); }
  }
  async inspect(key:string):Promise<StoredAsset|null> {
    const r=await this.request('HEAD',key);if(r.status===404)return null;
    if(!r.ok)throw new ContractError('SERVICE_UNAVAILABLE','Asset storage metadata unavailable');
    const checksum=r.headers.get('x-amz-meta-sha256')??'',bytes=Number(r.headers.get('content-length'));
    if(!/^[a-f0-9]{64}$/u.test(checksum)||!Number.isSafeInteger(bytes)||bytes<=0)throw new ContractError('CONFLICT','Stored asset metadata is invalid');
    return {key,checksum,bytes,mime:r.headers.get('content-type')??'application/octet-stream'};
  }
  async putImmutable(key:string,body:Uint8Array,mime:string,checksum:string):Promise<StoredAsset> {
    validateObjectKey(key);validateAssetBytes(body,mime,checksum);
    if(!key.endsWith('/'+checksum))throw new ContractError('INVALID_INPUT','Object key/checksum mismatch');
    const r=await this.request('PUT',key,body,{'content-type':mime,'if-none-match':'*','x-amz-meta-sha256':checksum,'cache-control':'public, max-age=31536000, immutable'});
    if(!r.ok&&r.status!==412&&r.status!==409)throw new ContractError('SERVICE_UNAVAILABLE','Asset upload failed');
    const stored=await this.inspect(key);
    if(!stored||stored.checksum!==checksum||stored.bytes!==body.byteLength||stored.mime!==mime)throw new ContractError('CONFLICT','Immutable object collision or incomplete upload');
    // A matching header is not proof of matching bytes; the caller may only approve verified ingestion.
    await this.readVerified(key,checksum,body.byteLength);
    return stored;
  }
  async readVerified(key:string,checksum:string,maximumBytes:number):Promise<Uint8Array> {
    if(!Number.isSafeInteger(maximumBytes)||maximumBytes<1||maximumBytes>32*1024*1024)throw new ContractError('INVALID_INPUT','Invalid asset byte limit');
    const r=await this.request('GET',key);
    if(!r.ok||!r.body)throw new ContractError('SERVICE_UNAVAILABLE','Asset bytes unavailable');
    const reader=r.body.getReader(),chunks:Uint8Array[]=[];let count=0;
    try {while(true){const v=await reader.read();if(v.done)break;count+=v.value.byteLength;if(count>maximumBytes){await reader.cancel();throw new ContractError('CONFLICT','Stored asset exceeds byte limit');}chunks.push(v.value);}}
    finally{reader.releaseLock();}
    const result=Buffer.concat(chunks);
    if(bytesHash(result)!==checksum)throw new ContractError('CONFLICT','Stored asset checksum mismatch');
    return result;
  }
}
