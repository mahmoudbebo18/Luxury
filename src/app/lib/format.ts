// Dates are shown in Riyadh time with Latin digits, in both languages.
import type { Lang } from '../i18n';

const TZ = 'Asia/Riyadh';

export function formatDate(value: string | null | undefined, lang: Lang = 'ar') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined, lang: Lang = 'ar') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

export function formatTime(value: string | null | undefined, lang: Lang = 'ar') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

/** YYYY-MM-DD in Riyadh time, for <input type="date"> and Excel. */
export function isoDay(value: string | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(value));
}

/** End of the given day (YYYY-MM-DD) in Riyadh, as an ISO timestamp. */
export function endOfDayRiyadh(day: string) {
  return new Date(`${day}T23:59:59+03:00`).toISOString();
}

export function startOfDayRiyadh(day: string) {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in Riyadh, for <input type="datetime-local">. */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${isoDay(value)}T${time}`;
}

/** "YYYY-MM-DDTHH:mm" typed in Riyadh time → ISO timestamp. */
export function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00+03:00`).toISOString() : null;
}

export function daysLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export function memberLabel(memberNo: number) {
  return 'LC-' + String(memberNo).padStart(5, '0');
}

export function formatMoney(value: number | string) {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export type MembershipStatus = 'active' | 'expired' | 'suspended' | 'none';
