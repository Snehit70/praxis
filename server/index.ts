import { createApiFetchHandler } from './app';
import { createDbClient, type DbClient } from './db';
import { ensureSchema } from './schema';
import { resolveClientIp } from './contentGuard';

const PORT = Number(process.env.PORT ?? 8787);

export async function startApiServer(port = PORT, sql: DbClient = createDbClient()) {
  await ensureSchema(sql);
  const clientIps = new WeakMap<Request, string>();
  const trustedProxies = new Set(['127.0.0.1', '::1', ...(process.env.API_TRUSTED_PROXY_IPS ?? '')
    .split(',').map((ip) => ip.trim()).filter(Boolean)]);
  const handler = createApiFetchHandler(sql, { getClientIp: (request) => clientIps.get(request) ?? null });
  const server = Bun.serve({
    port,
    fetch(request, server) {
      const peer = server.requestIP(request)?.address;
      // The deployment supplies Docker's bridge gateway as an explicit proxy.
      const ip = resolveClientIp(request, peer ?? null, trustedProxies);
      if (ip) clientIps.set(request, ip);
      return handler(request);
    },
  });

  console.log(`Praxis API listening on http://127.0.0.1:${server.port}`);
  return server;
}

if (import.meta.main) {
  await startApiServer();
}
