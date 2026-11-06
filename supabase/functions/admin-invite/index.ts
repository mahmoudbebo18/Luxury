// Club admins from Settings → Admins (club admins only; anyone else gets 403).
//   invite {email, full_name, lang, promote?}: a new email gets an Auth invite (bilingual "Invite user"
//     template) whose link opens /welcome to set a password, and the account is made an admin at once.
//     An email that already has an account is made an admin only with promote = true (the page asks first,
//     because an admin has no member pages).
//   resend {user_id}: sends the invite again to an admin who hasn't set a password yet.
//   remove {user_id}: admin_remove_admin as the caller (never yourself, never the last admin); an untouched
//     pending invite is deleted outright so no empty account is left behind.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin, cors, json } from '../_shared/activate.ts';

const SITE = 'https://the-luxury-club.com';
const ALLOWED_ORIGIN = /^(https:\/\/((www\.)?the-luxury-club\.com|([\w-]+\.)?luxury-club-d7s\.pages\.dev)|http:\/\/(localhost|127\.0\.0\.1):5173)$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'not_signed_in' }, 401);
    const { data: isAdmin } = await userClient.rpc('is_admin');
    if (isAdmin !== true) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const origin = req.headers.get('origin') ?? '';
    const redirectTo = `${ALLOWED_ORIGIN.test(origin) ? origin : SITE}/welcome`;
    const { data: me } = await admin.from('profiles').select('full_name').eq('id', userData.user.id).single();
    const inviter = me?.full_name ?? '';

    if (body.action === 'invite') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const fullName = String(body.full_name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
      const lang = body.lang === 'en' ? 'en' : 'ar';
      if (!EMAIL.test(email) || email.length > 254) return json({ error: 'bad_email' }, 400);
      if (fullName.length < 2) return json({ error: 'bad_name' }, 400);

      const { data: existing } = await admin.from('profiles').select('id, role, full_name').eq('email', email).maybeSingle();
      if (existing) {
        if (existing.role === 'admin') return json({ status: 'already_admin' });
        if (body.promote !== true) return json({ status: 'exists', full_name: existing.full_name });
        const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('id', existing.id);
        if (error) throw error;
        return json({ status: 'promoted', user_id: existing.id });
      }

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, lang, invited_as: 'admin', inviter },
        redirectTo,
      });
      if (error) return authError(error);
      const id = data.user.id;
      const { error: upErr } = await admin.from('profiles').update({ role: 'admin', full_name: fullName, lang }).eq('id', id);
      if (upErr) {
        // never leave a half-made account behind
        await admin.auth.admin.deleteUser(id);
        throw upErr;
      }
      return json({ status: 'invited', user_id: id });
    }

    if (body.action === 'resend') {
      const id = String(body.user_id ?? '');
      const { data: target } = await admin.from('profiles').select('email, role, full_name, lang').eq('id', id).maybeSingle();
      if (!target || target.role !== 'admin') return json({ error: 'not_admin' }, 404);
      // Auth refuses once the link was opened (email confirmed): answered as already_active, and the
      // person then uses "forgot password" if they never finished setting one.
      const { error } = await admin.auth.admin.inviteUserByEmail(target.email, {
        data: { full_name: target.full_name, lang: target.lang, invited_as: 'admin', inviter },
        redirectTo,
      });
      if (error) return authError(error);
      return json({ status: 'resent' });
    }

    if (body.action === 'remove') {
      const id = String(body.user_id ?? '');
      const { data, error } = await userClient.rpc('admin_remove_admin', { p_user: id });
      if (error) {
        const code = ['cannot_remove_self', 'last_admin', 'not_admin'].find((c) => error.message.includes(c));
        return json({ error: code ?? error.message }, code ? 409 : 500);
      }
      const r = data as { pending: boolean; bare: boolean };
      if (r.pending && r.bare) {
        const { error: delErr } = await admin.auth.admin.deleteUser(id);
        if (delErr) console.error('delete pending invite', delErr);
        return json({ status: 'removed', deleted: !delErr });
      }
      return json({ status: 'removed', deleted: false });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});

// Auth answers: an email that is already confirmed can't be invited again; sending too often is rate limited.
function authError(error: { status?: number; code?: string; message: string }) {
  if (error.code === 'email_exists' || /already been registered/i.test(error.message)) return json({ error: 'already_active' }, 409);
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') return json({ error: 'rate_limited' }, 429);
  console.error('auth', error);
  return json({ error: error.message }, 502);
}
