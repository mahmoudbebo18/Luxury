// Rebuilds the public site after an admin changes the legal pages or the prices: those are written into
// the static pages at build time (vite.config.ts), so a change shows once Cloudflare Pages rebuilds.
// The build is started through a Pages deploy hook (secret PAGES_DEPLOY_HOOK); club admins only.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin, cors, json } from '../_shared/activate.ts';

// Several saves in a row start one build: a call within a minute of the last one is skipped.
let lastRun = 0;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'not_signed_in' }, 401);
    const { data: isAdmin } = await admin.from('profiles').select('id').eq('id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const hook = Deno.env.get('PAGES_DEPLOY_HOOK');
    if (!hook) return json({ error: 'not_configured' }, 503);
    if (Date.now() - lastRun < 60_000) return json({ ok: true, skipped: true });

    const res = await fetch(hook, { method: 'POST' });
    if (!res.ok) return json({ error: `deploy hook answered ${res.status}` }, 502);
    lastRun = Date.now();
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
