export function formatElapsedClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function workingProgress(elapsedMs: number, typicalMs = 16_000) {
  const t = Math.min(elapsedMs / typicalMs, 1);
  return Math.round((1 - (1 - t) * (1 - t)) * 90);
}

export function remainingEtaSeconds(elapsedMs: number, typicalMs = 16_000) {
  if (elapsedMs >= typicalMs) return null;
  return Math.ceil((typicalMs - elapsedMs) / 1000);
}
