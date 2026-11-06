// Every 5 minutes: keeps the free Supabase project active (a real API read), then lets the
// process-email-queue Edge Function send the mail queue (and run the daily jobs at 8:00 Riyadh).
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
};

async function run(env) {
  const keepAlive = await fetch(`${env.SUPABASE_URL}/rest/v1/keep_alive?select=id&limit=1`, {
    headers: { apikey: env.SUPABASE_ANON_KEY },
  });
  console.log('keep_alive', keepAlive.status);

  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/process-email-queue`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET, 'content-type': 'application/json' },
    body: '{}',
  });
  console.log('process-email-queue', res.status, await res.text());
}
