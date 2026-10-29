import { createHash } from 'node:crypto';
import { ContractError, assertUuid } from '../../domain/src/identity.js';

export function bytesHash(body:Uint8Array):string { return createHash('sha256').update(body).digest('hex'); }
export function assetObjectKey(assetId:string,version:number,checksum:string):string {
  assertUuid(assetId);
  if(!Number.isSafeInteger(version)||version<1||!/^[a-f0-9]{64}$/u.test(checksum)) throw new ContractError('INVALID_INPUT','Invalid immutable asset identity');
  return `assets/${assetId}/${version}/${checksum}`;
}
export function validateObjectKey(key:string):void {
  if(!/^assets\/[a-f0-9-]{36}\/[1-9][0-9]*\/[a-f0-9]{64}$/u.test(key)) throw new ContractError('INVALID_INPUT','Platform asset key required');
  assertUuid(key.split('/')[1]!);
}
export function validateAssetBytes(body:Uint8Array,mime:string,checksum:string):void {
  if(!body.byteLength||body.byteLength>32*1024*1024||bytesHash(body)!==checksum) throw new ContractError('INVALID_INPUT','Asset size/checksum mismatch');
  const b=Buffer.from(body);
  const prefix=b.subarray(0,16).toString('ascii');
  const valid:Record<string,boolean>={
    'image/png':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    'image/jpeg':b[0]===255&&b[1]===216&&b[2]===255,
    'image/webp':prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP',
    'audio/wav':prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WAVE',
    'audio/ogg':prefix.startsWith('OggS'),
    'audio/mpeg':prefix.startsWith('ID3')||(b[0]===255&&((b[1]??0)&224)===224),
  };
  if(mime==='image/svg+xml') {
    const xml=b.toString('utf8');
    // Only the code-generated static SVG subset is ingested; no external/active XML content.
    if(!xml.startsWith('<svg ')||!xml.endsWith('</svg>')||/<!|<\?|&|\b(?:on[a-z]+|href|style)\s*=|url\s*\(/iu.test(xml)) throw new ContractError('INVALID_INPUT','Active or unsupported SVG');
    const tags=[...xml.matchAll(/<\/?([A-Za-z][A-Za-z0-9:-]*)\b/gu)].map(x=>x[1]);
    if(tags.some(t=>!['svg','g','path','rect','circle','ellipse','line','polyline','polygon','title','desc'].includes(t!))) throw new ContractError('INVALID_INPUT','Unsupported SVG element');
    return;
  }
  if(!valid[mime]) throw new ContractError('INVALID_INPUT','Asset MIME/signature mismatch');
}
