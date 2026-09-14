import { createServer } from 'node:http';
import type { HealthProbe } from './probe.js';

export function createWorkerHealthServer(probe: HealthProbe) {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end(JSON.stringify({ status: 'method_not_allowed' }));
    } else if (request.url === '/api/v1/health/live') {
      response.writeHead(200).end(JSON.stringify({ status: 'ok' }));
    } else if (request.url === '/api/v1/health/ready') {
      Promise.resolve().then(() => probe.ready()).catch(() => false).then((ready) => {
        response.writeHead(ready ? 200 : 503).end(JSON.stringify({ status: ready ? 'ready' : 'not_ready' }));
      });
    } else response.writeHead(404).end(JSON.stringify({ status: 'not_found' }));
  });
}
