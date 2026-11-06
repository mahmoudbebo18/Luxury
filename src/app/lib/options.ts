/** Saudi and other international mobiles: 9–15 digits, optional leading +. */
export const PHONE_RE = /^\+?\d{9,15}$/;
export const cleanPhone = (v: string) =>
  v.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf)).replace(/[\s()-]/g, '');

/** Password rule shared by sign-up, reset and change password (also enforced by Supabase Auth). */
export const passwordChecks = (p: string) => ({
  length: p.length >= 8,
  letter: /[A-Za-z]/.test(p),
  number: /\d/.test(p),
});

export function passwordScore(p: string) {
  if (!p) return 0;
  const c = passwordChecks(p);
  let s = (c.length ? 1 : 0) + (c.letter && c.number ? 1 : 0);
  if (p.length >= 12) s += 1;
  if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s += 1;
  return Math.min(4, s);
}
