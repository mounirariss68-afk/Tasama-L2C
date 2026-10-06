import type { CloseInstance } from './close-types';
export const validPeriod = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && Number(s.slice(0, 4)) >= 2000 && Number(s.slice(0, 4)) <= 2100;
export function validDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function periodEnd(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
export function followingPeriod(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}
export function addWorkingDays(iso: string, days: number, calendar: CloseInstance['calendar']) {
  const d = new Date(`${iso}T00:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!calendar.weekends.includes(d.getUTCDay()) && !calendar.holidays.includes(d.toISOString().slice(0, 10))) remaining--;
  }
  return d.toISOString().slice(0, 10);
}
export function procedureDeadline(instance: CloseInstance, number: number): string | null {
  if (number === 1) return `${instance.period}-25`;
  if (!instance.calendar.confirmed) return null;
  if (number === 2) {
    const paid = instance.papers['2'].values.paidDate;
    return validDate(paid) ? addWorkingDays(paid, 3, instance.calendar) : null;
  }
  if (number <= 5) return addWorkingDays(periodEnd(instance.period), 2, instance.calendar);
  const inputs = [1, 2, 3, 4, 5].map(n => instance.papers[String(n)]);
  if (!inputs.every(p => p.state === 'accepted' && p.acceptedAt)) return null;
  return addWorkingDays(inputs.map(p => p.acceptedAt!.slice(0, 10)).sort().at(-1)!, 2, instance.calendar);
}
