export type MarkupPart =
  | { kind: 'text'; text: string }
  | { kind: 'image'; src: string };

const IMG_RE = /<img\b[^>]*?\bsrc\s*=\s*(["'])([\s\S]*?)\1[^>]*?>/gi;

function decodeEntities(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function usableImageSrc(raw: string) {
  const src = decodeEntities(raw).trim();
  if (!src) return null;
  if (/image content will be provided separately/i.test(src)) return null;
  return src;
}

export function splitMarkupImages(raw: string): MarkupPart[] {
  const parts: MarkupPart[] = [];
  const pattern = new RegExp(IMG_RE);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', text: raw.slice(lastIndex, match.index) });
    }
    const src = usableImageSrc(match[2] ?? '');
    if (src) parts.push({ kind: 'image', src });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push({ kind: 'text', text: raw.slice(lastIndex) });
  }

  return parts.filter((part) => part.kind === 'image' || part.text.length > 0);
}
