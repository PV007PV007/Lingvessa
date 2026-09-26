import type { NextRequest } from 'next/server';
export const dynamic='force-dynamic';
/** Fixed service origin configured on the server; request data cannot choose a remote host. */
async function forward(request: NextRequest, context: {params:Promise<{segments:string[]}>}) {
  const {segments}=await context.params;
  if (!['auth','me','catalog','lesson-runs','mastery','mistakes','review-sessions','collections','learning-resets'].includes(segments[0]??'')) return new Response(null,{status:404});
  const origin=new URL(process.env.LINGVESSA_API_ORIGIN??'http://127.0.0.1:3002');
  if (!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/') return new Response(null,{status:503});
  // Next normalizes loopback nextUrl.host to localhost; Origin must match the actual request authority.
  const requestOrigin=`${request.nextUrl.protocol}//${request.headers.get('host')??request.nextUrl.host}`;
  if (request.method!=='GET' && request.headers.get('origin') && request.headers.get('origin')!==requestOrigin)
    return new Response(null,{status:403});
  const target=new URL(`/api/v1/${segments.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,origin);
  const headers=new Headers();
  for(const key of ['cookie','content-type','x-csrf-token','x-lingvessa-client','x-correlation-id']) {
    const value=request.headers.get(key); if(value) headers.set(key,value);
  }
  try {
    const upstream=await fetch(target,{method:request.method,headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
      ...(request.method==='GET'?{}:{body:await request.text()})});
    const safe=new Headers({'cache-control':'private, no-store'});
    for(const key of ['content-type','set-cookie','x-correlation-id']){const value=upstream.headers.get(key);if(value)safe.set(key,value);}
    return new Response(upstream.body,{status:upstream.status,headers:safe});
  } catch { return Response.json({type:'about:blank',title:'Service unavailable',status:503,code:'SERVICE_UNAVAILABLE',detail_safe:'Сервіс тимчасово недоступний.',correlation_id:crypto.randomUUID()},{status:503,headers:{'cache-control':'no-store'}}); }
}
export const GET=forward; export const POST=forward; export const PATCH=forward; export const PUT=forward; export const DELETE=forward;
