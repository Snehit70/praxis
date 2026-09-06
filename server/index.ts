import { createApiFetchHandler } from './app';
import { createDbClient, type DbClient } from './db';
import { ensureSchema } from './schema';

const PORT = Number(process.env.PORT ?? 8787);

export async function startApiServer(port = PORT, sql: DbClient = createDbClient()) {
  await ensureSchema(sql);
  const server = Bun.serve({
    port,
    fetch: createApiFetchHandler(sql),
  });

  console.log(`Praxis API listening on http://127.0.0.1:${server.port}`);
  return server;
}

if (import.meta.main) {
  await startApiServer();
}
