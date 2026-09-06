import type { DbClient } from './db';

export async function ensureSchema(sql: DbClient) {
  await sql.unsafe(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE TABLE IF NOT EXISTS exams (
      source_uuid TEXT PRIMARY KEY,
      exam_name TEXT NOT NULL,
      exam_slug TEXT NOT NULL UNIQUE,
      en_id TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS courses (
      source_uuid TEXT PRIMARY KEY,
      course_name TEXT NOT NULL,
      course_code TEXT NOT NULL,
      program_id INTEGER NOT NULL,
      label TEXT,
      canonical_name TEXT NOT NULL,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS paper_variants (
      id TEXT PRIMARY KEY,
      source_uuid TEXT NOT NULL,
      exam_uuid TEXT NOT NULL REFERENCES exams(source_uuid) ON DELETE CASCADE,
      course_uuid TEXT NOT NULL REFERENCES courses(source_uuid) ON DELETE CASCADE,
      group_id INTEGER NOT NULL,
      total_score TEXT NOT NULL,
      duration INTEGER NOT NULL,
      paper_name TEXT NOT NULL,
      paper_description TEXT NOT NULL,
      year INTEGER,
      is_new INTEGER NOT NULL,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      source_path TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_paper_variants_exam_course
      ON paper_variants (exam_uuid, course_uuid, year DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_paper_variants_source_uuid
      ON paper_variants (source_uuid);

    CREATE INDEX IF NOT EXISTS idx_paper_variants_source_context
      ON paper_variants (source_uuid, course_uuid, exam_uuid, year DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_paper_variants_course_exam_group
      ON paper_variants (exam_uuid, course_uuid, group_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_paper_variants_search_name_trgm
      ON paper_variants USING gin (paper_name gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_paper_variants_search_description_trgm
      ON paper_variants USING gin (paper_description gin_trgm_ops);

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      source_uuid TEXT NOT NULL,
      paper_variant_id TEXT NOT NULL REFERENCES paper_variants(id) ON DELETE CASCADE,
      question_number INTEGER NOT NULL,
      question_type TEXT NOT NULL,
      total_mark TEXT NOT NULL,
      total_mark_value DOUBLE PRECISION NOT NULL,
      hash TEXT NOT NULL,
      question_text_1 TEXT,
      question_text_2 TEXT,
      question_text_3 TEXT,
      question_text_4 TEXT,
      question_text_5 TEXT,
      question_image_1 TEXT,
      question_image_2 TEXT,
      question_image_3 TEXT,
      question_image_4 TEXT,
      question_image_5 TEXT,
      question_image_6 TEXT,
      question_image_7 TEXT,
      question_image_8 TEXT,
      question_image_9 TEXT,
      question_image_10 TEXT,
      answer_type TEXT,
      response_type TEXT,
      value_start TEXT,
      value_end TEXT,
      parent_question_uuid TEXT,
      is_markdown INTEGER NOT NULL,
      have_answers INTEGER NOT NULL,
      question_num_long BIGINT NOT NULL,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_questions_paper_variant
      ON questions (paper_variant_id, question_number, question_num_long);

    CREATE INDEX IF NOT EXISTS idx_questions_parent
      ON questions (paper_variant_id, parent_question_uuid);

    CREATE INDEX IF NOT EXISTS idx_questions_source_uuid
      ON questions (source_uuid);

    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      option_image TEXT,
      score TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      option_number BIGINT,
      option_position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );

    ALTER TABLE options
      ADD COLUMN IF NOT EXISTS option_position INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_options_question
      ON options (question_id, option_number, option_position);

    ALTER TABLE paper_variants
      ALTER COLUMN year DROP NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_courses_search_name_trgm
      ON courses USING gin (course_name gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_courses_search_code_trgm
      ON courses USING gin (course_code gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_courses_search_canonical_trgm
      ON courses USING gin (canonical_name gin_trgm_ops);

    -- Auth / per-user data (Clerk is the identity source; we mirror the id only).
    CREATE TABLE IF NOT EXISTS users (
      clerk_user_id TEXT PRIMARY KEY,
      email TEXT,
      level TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Deployments created before the term/level feature need the column added.
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS level TEXT;

    -- Courses a user is taking this term. The key is the canonical course name
    -- (the stable identity used for dedup/display), not a source_uuid, because a
    -- single canonical course can map to several source rows across programs.
    CREATE TABLE IF NOT EXISTS user_courses (
      clerk_user_id TEXT NOT NULL,
      course_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (clerk_user_id, course_key)
    );

    CREATE INDEX IF NOT EXISTS idx_user_courses_user
      ON user_courses (clerk_user_id, created_at);

    CREATE TABLE IF NOT EXISTS saved_papers (
      clerk_user_id TEXT NOT NULL,
      paper_id TEXT NOT NULL REFERENCES paper_variants(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (clerk_user_id, paper_id)
    );

    CREATE INDEX IF NOT EXISTS idx_saved_papers_user_recent
      ON saved_papers (clerk_user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS paper_views (
      id BIGSERIAL PRIMARY KEY,
      clerk_user_id TEXT NOT NULL,
      paper_id TEXT NOT NULL REFERENCES paper_variants(id) ON DELETE CASCADE,
      viewed_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_paper_views_user_recent
      ON paper_views (clerk_user_id, viewed_at DESC);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS pdf_rate_limit_bypass BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS pdf_rate_buckets (
      clerk_user_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (clerk_user_id, bucket, window_start)
    );

    CREATE TABLE IF NOT EXISTS pdf_download_events (
      id BIGSERIAL PRIMARY KEY,
      clerk_user_id TEXT NOT NULL,
      paper_uuid TEXT NOT NULL,
      answers INTEGER NOT NULL DEFAULT 0,
      bypassed INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_download_events_user_time
      ON pdf_download_events (clerk_user_id, created_at DESC);
  `);
}

export async function resetSchema(sql: DbClient) {
  await sql.unsafe(`
    TRUNCATE TABLE options, questions, paper_variants, courses, exams RESTART IDENTITY CASCADE;
  `);
}
