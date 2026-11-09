/** 32.5 → « 32,5 », 30 → « 30 ». */
export function formatNumber(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

export function formatWeight(w: number | null): string {
  return w === null ? '— kg' : `${formatNumber(w)} kg`;
}

/** 154 → « 2:34 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 150 → « 2 min 30 », 90 → « 1 min 30 », 45 → « 45 s ». */
export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

export function formatDate(ts: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('fr-FR', opts).format(new Date(ts));
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
