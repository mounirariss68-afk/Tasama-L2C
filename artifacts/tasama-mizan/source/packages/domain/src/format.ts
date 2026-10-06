export function money(n: number, currency = 'SAR', opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = false, decimals } = opts;
  if (compact) {
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000_000) return `${currency} ${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    if (abs >= 1_000) return `${currency} ${sign}${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
    return `${currency} ${sign}${abs.toFixed(0)}`;
  }
  const d = decimals ?? (Math.abs(n) % 1 === 0 ? 0 : 2);
  return `${currency} ${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
export const num = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
export const signed = (n: number, currency = 'SAR') => (n >= 0 ? '+' : '−') + money(Math.abs(n), currency, { compact: true }).replace(`${currency} `, '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (m: number) => MONTHS[m - 1];
export function date(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function dateTime(iso: string) {
  const t = new Date(iso);
  return `${date(iso)} · ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
export const period = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
/** CogniDocs integer ×10,000 → display number. Display only; never store the result. */
export const from10k = (n: number) => n / 10_000;
