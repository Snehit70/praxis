import { randomUUID } from 'node:crypto';
import { createApiFetchHandler, type ApiHandlerOptions } from './app';
import { createDbClient, type DbClient } from './db';
import { ensureSchema } from './schema';

const DEFAULT_TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres@127.0.0.1:5432/postgres';

function getSchemaDatabaseUrl(schemaName: string) {
  const url = new URL(DEFAULT_TEST_DATABASE_URL);
  const searchPath = `-csearch_path=${schemaName},public`;
  const existingOptions = url.searchParams.get('options');

  url.searchParams.set('options', existingOptions ? `${existingOptions} ${searchPath}` : searchPath);
  return url.toString();
}

export interface IsolatedTestDatabase {
  adminSql: DbClient;
  sql: DbClient;
  schemaName: string;
  dispose: () => Promise<void>;
}

export interface ApiTestContext {
  database: IsolatedTestDatabase;
  fetchHandler: ReturnType<typeof createApiFetchHandler>;
  get: (path: string) => Promise<Response>;
  getJson: <T = unknown>(path: string) => Promise<{ response: Response; json: T }>;
  dispose: () => Promise<void>;
}

export async function createIsolatedTestDatabase(): Promise<IsolatedTestDatabase> {
  const schemaName = `test_${randomUUID().replaceAll('-', '_')}`;
  const adminSql = createDbClient(DEFAULT_TEST_DATABASE_URL, {
    max: 1,
    idleTimeout: 30,
    connectionTimeout: 5,
  });

  await adminSql.unsafe(`CREATE SCHEMA "${schemaName}"`);

  const sql = createDbClient(getSchemaDatabaseUrl(schemaName), {
    max: 1,
    idleTimeout: 30,
    connectionTimeout: 5,
  });

  await ensureSchema(sql);

  return {
    adminSql,
    sql,
    schemaName,
    async dispose() {
      await sql.close({ timeout: 1 });
      await adminSql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await adminSql.close({ timeout: 1 });
    },
  };
}

export async function createApiTestContext(
  options: ApiHandlerOptions = {},
): Promise<ApiTestContext> {
  const database = await createIsolatedTestDatabase();
  await seedIntegrationFixture(database.sql);
  const fetchHandler = createApiFetchHandler(database.sql, options);

  return {
    database,
    fetchHandler,
    get(path: string) {
      return fetchHandler(new Request(`http://local.test${path}`));
    },
    async getJson<T = unknown>(path: string) {
      const response = await fetchHandler(new Request(`http://local.test${path}`));
      return {
        response,
        json: (await response.json()) as T,
      };
    },
    dispose() {
      return database.dispose();
    },
  };
}

export async function seedIntegrationFixture(sql: DbClient) {
  await sql`
    INSERT INTO exams (source_uuid, exam_name, exam_slug)
    VALUES ('exam-1', 'Quiz 1', 'quiz1')
  `;

  await sql`
    INSERT INTO courses (source_uuid, course_name, course_code, program_id, label, canonical_name)
    VALUES ('course-1', 'Computational Thinking', 'CT', 1, 'Foundation', 'Computational Thinking')
  `;

  await sql`
    INSERT INTO paper_variants (
      id,
      source_uuid,
      exam_uuid,
      course_uuid,
      group_id,
      total_score,
      duration,
      paper_name,
      paper_description,
      year,
      is_new,
      source_path
    )
    VALUES
      (
        'variant-2025',
        'paper-2025',
        'exam-1',
        'course-1',
        1,
        '3',
        45,
        'Computational Thinking Quiz 1 2025',
        'Primary fixture paper',
        2025,
        1,
        'fixtures/paper-2025.json'
      ),
      (
        'variant-2024',
        'paper-2024',
        'exam-1',
        'course-1',
        1,
        '4',
        45,
        'Computational Thinking Quiz 1 2024',
        'Older fixture paper',
        2024,
        0,
        'fixtures/paper-2024.json'
      )
  `;

  await sql`
    INSERT INTO questions (
      id,
      source_uuid,
      paper_variant_id,
      question_number,
      question_type,
      total_mark,
      total_mark_value,
      hash,
      question_text_1,
      parent_question_uuid,
      is_markdown,
      have_answers,
      question_num_long
    )
    VALUES
      (
        'variant-2025:q-comp',
        'q-comp',
        'variant-2025',
        1,
        'COMPREHENSION',
        '0',
        0,
        'hash-comp',
        'Read the passage before answering.',
        NULL,
        0,
        1,
        1
      ),
      (
        'variant-2025:q-child',
        'q-child',
        'variant-2025',
        2,
        'MCQ',
        '1',
        1,
        'hash-child',
        'Which statement matches the passage?',
        'q-comp',
        0,
        1,
        2
      ),
      (
        'variant-2025:q-main',
        'q-main',
        'variant-2025',
        3,
        'MCQ',
        '2',
        2,
        'hash-main',
        'What is 1 + 1?',
        NULL,
        0,
        1,
        3
      ),
      (
        'variant-2024:q-old',
        'q-old',
        'variant-2024',
        1,
        'MCQ',
        '4',
        4,
        'hash-old',
        'Legacy question',
        NULL,
        0,
        1,
        1
      )
  `;

  await sql`
    INSERT INTO options (
      id,
      question_id,
      option_text,
      score,
      is_correct,
      option_number
    )
    VALUES
      ('variant-2025:q-child:1', 'variant-2025:q-child', 'Correct child answer', '1', 1, 1),
      ('variant-2025:q-child:2', 'variant-2025:q-child', 'Wrong child answer', '0', 0, 2),
      ('variant-2025:q-main:1', 'variant-2025:q-main', '2', '1', 1, 1),
      ('variant-2025:q-main:2', 'variant-2025:q-main', '3', '0', 0, 2),
      ('variant-2024:q-old:1', 'variant-2024:q-old', 'Legacy option', '1', 1, 1)
  `;
}

export async function seedAliasCourseFixture(sql: DbClient) {
  await sql`
    INSERT INTO courses (source_uuid, course_name, course_code, program_id, label, canonical_name)
    VALUES ('course-2', 'Computational Thinking (New)', 'CT', 1, 'Foundation', 'Computational Thinking')
  `;

  await sql`
    INSERT INTO paper_variants (
      id,
      source_uuid,
      exam_uuid,
      course_uuid,
      group_id,
      total_score,
      duration,
      paper_name,
      paper_description,
      year,
      is_new,
      source_path
    )
    VALUES (
      'variant-2023',
      'paper-2023',
      'exam-1',
      'course-2',
      1,
      '2',
      45,
      'Computational Thinking Quiz 1 2023',
      'Alias fixture paper',
      2023,
      0,
      'fixtures/paper-2023.json'
    )
  `;

  await sql`
    INSERT INTO questions (
      id,
      source_uuid,
      paper_variant_id,
      question_number,
      question_type,
      total_mark,
      total_mark_value,
      hash,
      question_text_1,
      parent_question_uuid,
      is_markdown,
      have_answers,
      question_num_long
    )
    VALUES (
      'variant-2023:q-alias',
      'q-alias',
      'variant-2023',
      1,
      'MCQ',
      '2',
      2,
      'hash-alias',
      'Alias question',
      NULL,
      0,
      1,
      1
    )
  `;
}
