export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ status: 'ready', service: 'admin' }, { headers: { 'Cache-Control': 'no-store' } });
}
