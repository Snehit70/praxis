import { expect, test } from 'bun:test';
import { imageSourceFallbacks } from './imageUtils';

test('imageSourceFallbacks tries R2 then the original Spaces CDN', () => {
  const r2 =
    'https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev/question_images/TyjfuxEzpWecsOZD2b2ZoEOTs2z4oCeUiokwmxULiy6BISPvQ2.png';
  expect(imageSourceFallbacks(r2)).toEqual([
    r2,
    'https://saram.blr1.cdn.digitaloceanspaces.com/question_images/TyjfuxEzpWecsOZD2b2ZoEOTs2z4oCeUiokwmxULiy6BISPvQ2.png',
  ]);
});
