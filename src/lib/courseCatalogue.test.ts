import { expect, test } from 'bun:test';
import { buildCatalogue } from '@/lib/courseCatalogue';

test('buildCatalogue drops entries that only have unsupported exam slugs', () => {
  const catalogue = buildCatalogue([
    {
      uuid: 'course-supported',
      courseName: 'Computational Thinking',
      courseCode: 'CT',
      programId: 1,
      paperCount: 2,
      examSlugs: ['quiz1'],
    },
    {
      uuid: 'course-unsupported',
      courseName: 'OPPE Archive',
      courseCode: 'OP',
      programId: 1,
      paperCount: 4,
      examSlugs: ['oppe', '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa'],
    },
  ]);

  expect(catalogue).toHaveLength(1);
  expect(catalogue[0]).toMatchObject({
    primaryUuid: 'course-supported',
    examSlugs: ['quiz1'],
    paperCount: 2,
  });
});
