// Member services: shared types, WhatsApp / email validation and the ready-made request messages
// (used by the member page and by the admin form's preview).
import type { Lang } from '../i18n';

/** The club's WhatsApp (same number as the marketing pages' chat button). */
export const CLUB_WHATSAPP = '966558103228';

export const SERVICE_ICONS = ['legal', 'roadside', 'passport', 'shield', 'sparkle', 'phone', 'car'] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];


/** One service as returned by list_services(); email / whatsapp are null unless the membership is active. */
export type MemberService = {
  id: string;
  slug: string | null;
  icon: ServiceIcon;
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  features_ar: string[];
  features_en: string[];
  how_ar: string;
  how_en: string;
  message_ar: string;
  message_en: string;
  ask_location: boolean;
  quota: number | null;
  quota_label_ar: string;
  quota_label_en: string;
  used: number;
  email: string | null;
  whatsapp: string | null;
  has_contact: boolean;
};

/** English text falls back to the Arabic one when the admin left it empty. */
export function pick(s: Record<string, unknown>, field: 'title' | 'summary' | 'how' | 'message', lang: Lang): string {
  const en = String(s[`${field}_en`] ?? '').trim();
  return lang === 'en' && en ? en : String(s[`${field}_ar`] ?? '');
}

export function pickList(s: { features_ar: string[]; features_en: string[] }, lang: Lang) {
  return lang === 'en' && s.features_en.length ? s.features_en : s.features_ar;
}

export const anchorOf = (s: { slug: string | null; id: string }) => s.slug ?? `s-${s.id.slice(0, 8)}`;

// ---------- validation ----------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const toLatin = (v: string) => v.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf));

// Mobile ranges for the countries members and providers are likely in; WhatsApp needs a mobile.
const COUNTRY_RULES: { cc: string; re: RegExp; name: string; example: string }[] = [
  { cc: '966', re: /^9665\d{8}$/, name: 'السعودية', example: '+966 5X XXX XXXX' },
  { cc: '965', re: /^965[4569]\d{7}$/, name: 'الكويت', example: '+965 XXXX XXXX' },
  { cc: '971', re: /^9715\d{8}$/, name: 'الإمارات', example: '+971 5X XXX XXXX' },
  { cc: '973', re: /^973[36]\d{7}$/, name: 'البحرين', example: '+973 3XXX XXXX' },
  { cc: '974', re: /^974[3567]\d{7}$/, name: 'قطر', example: '+974 XXXX XXXX' },
  { cc: '968', re: /^968[79]\d{7}$/, name: 'عُمان', example: '+968 9XXX XXXX' },
  { cc: '20', re: /^201[0125]\d{8}$/, name: 'مصر', example: '+20 1X XXXX XXXX' },
];

/**
 * Turns what the admin typed into the wa.me format (country code + number, digits only).
 * Accepts spaces, dashes, brackets, Arabic digits, a leading + or 00, and Saudi local numbers
 * (05XXXXXXXX / 5XXXXXXXX).
 */
export function normalizeWhatsapp(input: string): { ok: true; value: string } | { ok: false; error: string } {
  let v = toLatin(input).replace(/[\s‎‏‪-‮().\-–]/g, '');
  if (!v) return { ok: false, error: 'اكتب رقم الواتساب.' };
  if (v.startsWith('+')) v = v.slice(1);
  else if (v.startsWith('00')) v = v.slice(2);
  else if (/^05\d{8}$/.test(v)) v = '966' + v.slice(1);
  else if (/^5\d{8}$/.test(v)) v = '966' + v;
  else if (v.startsWith('0')) return { ok: false, error: 'اكتب الرقم مع مفتاح الدولة، مثل +966 أو +965.' };
  if (!/^\d+$/.test(v)) return { ok: false, error: 'الرقم يحتوي على أحرف غير مسموحة. استخدم الأرقام فقط.' };
  const rule = COUNTRY_RULES.find((r) => v.startsWith(r.cc));
  if (rule && !rule.re.test(v)) return { ok: false, error: `رقم جوال ${rule.name} غير صحيح. الصيغة: ${rule.example}` };
  if (!/^[1-9]\d{9,14}$/.test(v)) return { ok: false, error: 'الرقم الدولي من 10 إلى 15 رقمًا مع مفتاح الدولة.' };
  return { ok: true, value: v };
}

/** 966558103228 → +966 55 810 3228 (display only). */
export function formatWhatsapp(digits: string) {
  const rule = COUNTRY_RULES.find((r) => digits.startsWith(r.cc));
  // Country codes are 1–3 digits: without a known one, don't guess where it ends.
  if (!rule) return `+${digits}`;
  const rest = digits.slice(rule.cc.length);
  const groups =
    rest.length === 9 ? [rest.slice(0, 2), rest.slice(2, 5), rest.slice(5)]
    : rest.length === 10 ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)]
    : rest.match(/.{1,4}/g) ?? [rest];
  return `+${rule.cc} ${groups.join(' ')}`;
}

// ---------- request messages ----------
type Member = { full_name: string; member_no: string; phone?: string | null; company?: string | null };

function lines(service: string, extra: string, m: Member, lang: Lang, withContact: boolean) {
  const out =
    lang === 'en'
      ? [`Hello, I'm ${m.full_name}, a The Luxury Club member (${m.member_no}).`, `I'd like to request: ${service}.`]
      : [`مرحبًا، أنا ${m.full_name}، عضو في The Luxury Club (${m.member_no}).`, `أرغب في طلب خدمة: ${service}.`];
  if (withContact && m.phone) out.push(lang === 'en' ? `Mobile: ${m.phone}` : `الجوال: ${m.phone}`);
  if (withContact && m.company) out.push(lang === 'en' ? `Company: ${m.company}` : `الشركة: ${m.company}`);
  if (extra.trim()) out.push('', extra.trim());
  return out;
}

export function whatsappUrl(number: string, service: string, extra: string, m: Member, lang: Lang, location?: string) {
  const text = lines(service, extra, m, lang, false);
  if (location) text.push('', (lang === 'en' ? 'My location: ' : 'موقعي: ') + location);
  return `https://wa.me/${number}?text=${encodeURIComponent(text.join('\n'))}`;
}

export function emailParts(service: string, extra: string, m: Member, lang: Lang) {
  const subject = (lang === 'en' ? `Service request: ${service}` : `طلب خدمة: ${service}`) + ` · ${m.member_no}`;
  const body = [...lines(service, extra, m, lang, true), '', ''].join('\r\n');
  return { subject, body };
}

export function mailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Web compose links for members without a mail app on the device. */
export function webMailUrls(to: string, subject: string, body: string) {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${s}&body=${b}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${s}&body=${b}`,
  };
}
