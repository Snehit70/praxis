import { expect, test } from 'bun:test';
import { splitMarkupImages } from './markupImages';

test('keeps surrounding text and extracts inline data-URI images', () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const parts = splitMarkupImages(
    `Consider the hash functions given below. • <img src="${png}" class="inline-image" /> Identify the hash function(s).`,
  );

  expect(parts).toEqual([
    { kind: 'text', text: 'Consider the hash functions given below. • ' },
    { kind: 'image', src: png },
    { kind: 'text', text: ' Identify the hash function(s).' },
  ]);
});

test('drops placeholder img srcs that have no pixels', () => {
  expect(
    splitMarkupImages(
      '<img src="[image content will be provided separately]" class="inline-image" />',
    ),
  ).toEqual([]);
});
