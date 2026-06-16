import { expect, test } from 'bun:test';
import {
  buildPaperBundles,
  getCourseUuids,
  getSearchPattern,
  parseBundleDate,
} from './paperCatalogue';

test('getSearchPattern trims and escapes wildcard characters', () => {
  const params = new URLSearchParams({ q: ' CT_100% ' });

  expect(getSearchPattern(params)).toEqual({
    query: 'CT_100%',
    pattern: '%CT\\_100\\%%',
    prefixPattern: 'CT\\_100\\%%',
  });
});

test('getCourseUuids returns unique requested courses or fallback', () => {
  expect(getCourseUuids(new URLSearchParams(), 'course-1')).toEqual(['course-1']);
  expect(
    getCourseUuids(
      new URLSearchParams({ courseUuids: 'course-1,course-2,course-1' }),
      'course-0',
    ),
  ).toEqual(['course-1', 'course-2']);
});

test('parseBundleDate handles source paper date formats', () => {
  expect(parseBundleDate('2025 Aug3')).toMatchObject({ year: 2025, month: 8, day: 3 });
  expect(parseBundleDate('03 Aug 25')).toMatchObject({ year: 2025, month: 8, day: 3 });
  expect(parseBundleDate('Aug 2025')).toMatchObject({ year: 2025, month: 8, day: 1 });
});

test('buildPaperBundles derives labels, dates, term labels, and sort order', () => {
  const bundles = buildPaperBundles([
    {
      groupId: 1,
      paperName: 'Historical bucket',
      paperDescription: 'No clean date',
      createdAt: '2024-01-01T00:00:00.000Z',
      uuid: 'other',
    },
    {
      groupId: 31,
      paperName: '2025 Oct26: QIO2',
      paperDescription: 'Bundle 31',
      createdAt: '2025-10-26T10:00:00.000Z',
      uuid: 'newer',
    },
    {
      groupId: 31,
      paperName: '2025 Oct26: QIM4',
      paperDescription: 'Bundle 31',
      createdAt: '2025-10-26T11:00:00.000Z',
      uuid: 'newest-in-bundle',
    },
    {
      groupId: 12,
      paperName: '2024 Aug 3 QP',
      paperDescription: 'Older bundle',
      createdAt: '2024-08-03T00:00:00.000Z',
      uuid: 'older',
    },
  ]);

  expect(bundles.map((bundle) => bundle.groupId)).toEqual([31, 12, 1]);
  expect(bundles[0]).toMatchObject({
    groupId: 31,
    bundleLabel: 'QP Bundle 31',
    dateLabel: '26 Oct 2025',
    termLabel: 'Term 3 2025',
    variantCount: 2,
  });
  expect(bundles[0]?.papers.map((paper) => paper.uuid)).toEqual([
    'newest-in-bundle',
    'newer',
  ]);
  expect(bundles[2]).toMatchObject({
    groupId: 1,
    bundleLabel: 'Others',
    dateLabel: 'Others',
  });
});
