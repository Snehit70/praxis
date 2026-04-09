import postgres from 'postgres';

export const DEFAULT_DATABASE_URL = 'postgres://praxis:praxis@127.0.0.1:5432/praxis';
type DbClientOptions = NonNullable<Parameters<typeof postgres>[1]>;

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function createDbClient(databaseUrl = getDatabaseUrl(), overrides: DbClientOptions = {}) {
  return postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ...overrides,
  });
}

export type DbClient = ReturnType<typeof createDbClient>;
