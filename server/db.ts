import { SQL } from 'bun';

export const DEFAULT_DATABASE_URL = 'postgres://praxis:praxis@127.0.0.1:5432/praxis';
type DbClientOptions = ConstructorParameters<typeof SQL>[0] extends infer T
  ? Exclude<T, string | undefined>
  : never;

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function createDbClient(databaseUrl = getDatabaseUrl(), overrides: DbClientOptions = {}) {
  return new SQL({
    url: databaseUrl,
    max: 10,
    idleTimeout: 20,
    connectionTimeout: 15,
    ...overrides,
  });
}

export type DbClient = ReturnType<typeof createDbClient>;
