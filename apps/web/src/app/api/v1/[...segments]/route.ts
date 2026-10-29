import type { NextRequest } from 'next/server';
export const dynamic='force-dynamic';
/** Fixed service origin configured on the server; request data cannot choose a remote host. */
async function forward(request: NextRequest, context: {params:Promise<{segments:string[]}>}) {
  const {segments}=await context.params;
  if (!['auth','me','catalog','lesson-runs','mastery','mistakes','review-sessions','collections','learning-resets','speech'].includes(segments[0]??'')) return new Response(null,{status:404});
  const origin=new URL(process.env.LINGVESSA_API_ORIGIN??'http://127.0.0.1:3002');
  if (!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/') return new Response(null,{status:503});
  // Next normalizes loopback nextUrl.host to localhost; Origin must match the actual request authority.
  const requestOrigin=`${request.nextUrl.protocol}//${request.headers.get('host')??request.nextUrl.host}`;
  if (request.method!=='GET' && request.headers.get('origin') && request.headers.get('origin')!==requestOrigin)
    return new Response(null,{status:403});
  const target=new URL(`/api/v1/${segments.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,origin);
  const headers=new Headers();
  for(const key of ['cookie','content-type','x-csrf-token','x-lingvessa-client','x-correlation-id','range','idempotency-key']) {
    const value=request.headers.get(key); if(value) headers.set(key,value);
  }
  try {
    const body=request.method==='GET'?undefined:await boundedBody(request,segments[0]==='speech'&&request.method==='PUT'?5*1024*1024:100*1024);
    const upstream=await fetch(target,{method:request.method,headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
      ...(body===undefined?{}:{body})});
    const safe=new Headers({'cache-control':'private, no-store'});
    for(const key of ['content-type','set-cookie','x-correlation-id','content-length','content-range','accept-ranges','x-content-type-options','content-security-policy']){const value=upstream.headers.get(key);if(value)safe.set(key,value);}
    return new Response(upstream.body,{status:upstream.status,headers:safe});
  } catch(error) { if(error instanceof RangeError)return new Response(null,{status:413});return Response.json({type:'about:blank',title:'Service unavailable',status:503,code:'SERVICE_UNAVAILABLE',detail_safe:'Сервіс тимчасово недоступний.',correlation_id:crypto.randomUUID()},{status:503,headers:{'cache-control':'no-store'}}); }
}
export const GET=forward; export const POST=forward; export const PATCH=forward; export const PUT=forward; export const DELETE=forward;

async function boundedBody(request:NextRequest,limit:number):Promise<ArrayBuffer>{
 const reader=request.body?.getReader();if(!reader)return new ArrayBuffer(0);const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RangeError('Request exceeds bound');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;
}
