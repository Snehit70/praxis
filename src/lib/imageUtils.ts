/**
 * Image URL utilities for Cloudflare R2 CDN
 * 
 * Images are stored in R2 bucket 'praxis-images' and served via public URL.
 * Total: 26,652 images (9,186 question + 17,466 option images)
 */

const R2_PUBLIC_URL = 'https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev';
/** Original scrape CDN. R2 is a partial copy; newer papers 404 there. */
const SOURCE_CDN_URL = 'https://saram.blr1.cdn.digitaloceanspaces.com';

export function imageSourceFallbacks(url: string): string[] {
  if (url.startsWith(R2_PUBLIC_URL)) {
    return [url, `${SOURCE_CDN_URL}${url.slice(R2_PUBLIC_URL.length)}`];
  }
  if (url.startsWith(SOURCE_CDN_URL)) {
    return [url, `${R2_PUBLIC_URL}${url.slice(SOURCE_CDN_URL.length)}`];
  }
  return [url];
}

/**
 * Get full CDN URL for a question image
 * @param filename - Image filename (e.g., "abc123.png")
 * @returns Full CDN URL or undefined if no filename
 */
export function getQuestionImageUrl(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  
  const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
  
  if (cleanFilename.startsWith('question_images/')) {
    return `${R2_PUBLIC_URL}/${cleanFilename}`;
  }
  
  return `${R2_PUBLIC_URL}/question_images/${cleanFilename}`;
}

/**
 * Get full CDN URL for an option image
 * @param filename - Image filename (e.g., "xyz789.png")
 * @returns Full CDN URL or undefined if no filename
 */
export function getOptionImageUrl(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  
  const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
  
  if (cleanFilename.startsWith('option_images/')) {
    return `${R2_PUBLIC_URL}/${cleanFilename}`;
  }
  
  return `${R2_PUBLIC_URL}/option_images/${cleanFilename}`;
}
