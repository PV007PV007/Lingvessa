import {createHmac,timingSafeEqual} from 'node:crypto';
import {speechCallbackSchema} from '../../activity-schemas/src/speech.js';
import type {SpeechCallback} from '../../activity-schemas/src/speech.js';
import {ContractError} from '../../domain/src/identity.js';
export function speechSignature(secret:Uint8Array,origin:string,timestamp:string,body:string):string {
 return createHmac('sha256',secret).update(`${origin}\n${timestamp}\n${body}`).digest('hex');
}
export function verifySpeechCallback(secret:Uint8Array,expectedOrigin:string,origin:string,timestamp:string,signature:string,body:string,now=Date.now()):SpeechCallback {
 if(secret.length<32||origin!==expectedOrigin||!/^\d{13}$/u.test(timestamp)||Math.abs(now-Number(timestamp))>300000||!/^[0-9a-f]{64}$/u.test(signature)||Buffer.byteLength(body)>32768)
  throw new ContractError('FORBIDDEN','Invalid internal speech callback');
 const expected=speechSignature(secret,origin,timestamp,body);if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))throw new ContractError('FORBIDDEN','Invalid internal speech callback');
 return speechCallbackSchema.parse(JSON.parse(body));
}
