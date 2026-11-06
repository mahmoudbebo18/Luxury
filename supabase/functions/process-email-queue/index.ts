// Sends pending rows of email_queue through Brevo, within the daily budget, in each member's language.
// Called by the luxury-cron Worker (header x-cron-secret). Once a day (8:00 Riyadh) it also queues the
// renewal / expiry / unpaid reminders and pings Brevo so the API key never goes idle.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAILY_LIMIT = 140; // Brevo free plan is 300/day, shared with Dasman and the Auth emails
const PER_RUN = 40;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const LOGO = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/media/brand/email-logo.png`;

type QueueRow = {
  id: number;
  campaign_id: string | null;
  member_id: string | null;
  kind: string;
  to_email: string;
  to_name: string | null;
  lang: string;
  subject: string | null;
  body_html: string | null;
  vars: Record<string, string>;
};

const ORDER_TYPE: Record<string, [string, string]> = {
  individual: ['عضويتك الفردية', 'individual membership'],
  company_new: ['عضويات الشركة', 'company memberships'],
  company_add_seats: ['العضويات الإضافية', 'additional memberships'],
  company_renew: ['تجديد عضويات الشركة', 'company renewal'],
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function riyadhDayStart() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

function formatDate(value: string | undefined, en: boolean) {
  if (!value) return '';
  return new Intl.DateTimeFormat(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => esc(vars[key] ?? ''));
}

function layout(bodyHtml: string, siteUrl: string, en: boolean) {
  const dir = en ? 'ltr' : 'rtl';
  return `<!doctype html>
<html lang="${en ? 'en' : 'ar'}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2ecdf;font-family:Tahoma,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ecdf;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="background:#12160e;padding:26px;text-align:center;">
<img src="${LOGO}" alt="The Luxury Club" width="150" style="display:inline-block;height:auto;border:0;">
</td></tr>
<tr><td dir="${dir}" style="padding:30px 28px;color:#12160e;font-size:16px;line-height:1.9;text-align:${en ? 'left' : 'right'};">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e5dcc8;color:#6b6e5e;font-size:12px;text-align:center;line-height:1.8;">
The Luxury Club<br><a href="${siteUrl}" style="color:#7d6136;">${siteUrl.replace('https://', '')}</a>
</td></tr>
</table></td></tr></table></body></html>`
    .replace(/<a class="btn" href="([^"]+)">([^<]+)<\/a>/g,
      '<a href="$1" style="display:inline-block;background:#12160e;color:#e0c796;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:bold;">$2</a>')
    .replace(/<table class="receipt">/g, '<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:14px 0;border-top:1px solid #e5dcc8;">')
    .replace(/<tr><td>/g, '<tr><td style="border-bottom:1px solid #e5dcc8;color:#6b6e5e;">')
    .replace(/<\/td><td>/g, '</td><td style="border-bottom:1px solid #e5dcc8;text-align:end;">');
}

async function sendBrevo(sender: { name: string; email: string }, replyTo: string, row: QueueRow, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender,
      replyTo: { email: replyTo },
      to: [{ email: row.to_email, ...(row.to_name ? { name: row.to_name } : {}) }],
      subject,
      htmlContent: html,
      tags: ['luxury', row.kind],
    }),
  });
  if (!res.ok) throw new Error(`brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  const body = await req.json().catch(() => ({}));
  const report: Record<string, unknown> = {};

  const riyadhHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(new Date()));
  if (body.daily || (riyadhHour === 8 && new Date().getUTCMinutes() < 5)) {
    const { data, error } = await supabase.rpc('queue_daily_notices');
    report.daily = error ? `error: ${error.message}` : data;
    const ping = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': BREVO_KEY } });
    report.brevo_ping = ping.status;
  }

  const { count: sentToday } = await supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', riyadhDayStart());
  const budget = Math.min(PER_RUN, DAILY_LIMIT - (sentToday ?? 0));
  report.sent_today_before = sentToday;
  if (budget <= 0) return Response.json({ ...report, sent: 0, reason: 'daily limit reached' });

  // Automatic emails first, campaigns after
  const auto = await supabase.from('email_queue').select('*').eq('status', 'pending').neq('kind', 'campaign').order('id').limit(budget);
  const rows: QueueRow[] = auto.data ?? [];
  if (rows.length < budget) {
    const camp = await supabase.from('email_queue').select('*').eq('status', 'pending').eq('kind', 'campaign').order('id').limit(budget - rows.length);
    rows.push(...(camp.data ?? []));
  }
  if (!rows.length) return Response.json({ ...report, sent: 0 });

  const [{ data: settings }, { data: templates }] = await Promise.all([
    supabase.from('app_settings').select('*').eq('id', 1).single(),
    supabase.from('email_templates').select('*'),
  ]);
  const tpl = new Map((templates ?? []).map((t) => [t.kind, t]));
  const memberIds = [...new Set(rows.map((r) => r.member_id).filter(Boolean))] as string[];
  const { data: members } = await supabase.from('profiles').select('id, full_name, member_no, lang').in('id', memberIds);
  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const sender = { name: settings!.sender_name, email: settings!.sender_email };
  const siteUrl = settings!.site_url.replace(/\/$/, '');

  const campaignIds = new Set<string>();
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.campaign_id) {
      if (!campaignIds.has(row.campaign_id)) await supabase.from('email_campaigns').update({ status: 'sending' }).eq('id', row.campaign_id).eq('status', 'queued');
      campaignIds.add(row.campaign_id);
    }
    try {
      const m = row.member_id ? memberMap.get(row.member_id) : undefined;
      const en = (m?.lang ?? row.lang) === 'en';
      const vars: Record<string, string> = {
        name: m?.full_name || row.to_name || (en ? 'there' : ''),
        member_no: m?.member_no ? 'LC-' + String(m.member_no).padStart(5, '0') : '',
        account_url: `${siteUrl}/account`,
        checkout_url: `${siteUrl}/checkout`,
        company_url: `${siteUrl}/company`,
        admin_url: `${siteUrl}/admin`,
        ...row.vars,
      };
      vars.expires_at = formatDate(row.vars.expires_at, en);
      if (row.vars.token) vars.invite_url = `${siteUrl}/join/${row.vars.token}`;
      if (row.vars.order_type) vars.order_type_label = ORDER_TYPE[row.vars.order_type]?.[en ? 1 : 0] ?? row.vars.order_type;

      let subject = row.subject;
      let html = row.body_html;
      if (!subject || !html) {
        const t = tpl.get(row.kind);
        if (!t) throw new Error(`no template for ${row.kind}`);
        const useEn = en && t.body_html_en.trim() !== '';
        subject = useEn ? t.subject_en : t.subject;
        html = useEn ? t.body_html_en : t.body_html;
      }
      const bodyHtml = fill(html!, vars).replace(/<p>\s*<\/p>\n?/g, '');
      await sendBrevo(sender, settings!.reply_to, row, fill(subject!, vars).replace(/&amp;/g, '&'), layout(bodyHtml, siteUrl, en && !!tpl.get(row.kind)?.body_html_en));
      await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id);
      sent++;
    } catch (err) {
      const message = String((err as Error).message ?? err).slice(0, 500);
      await supabase.from('email_queue').update({ status: 'failed', error: message }).eq('id', row.id);
      failed++;
      if (/brevo (401|403|429)/.test(message)) {
        await supabase.from('email_queue').update({ status: 'pending' }).eq('id', row.id);
        report.stopped = message;
        break;
      }
    }
  }

  for (const id of campaignIds) {
    const counts = await Promise.all(
      ['sent', 'failed', 'pending'].map((s) => supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', s)),
    );
    const [s, f, p] = counts.map((c) => c.count ?? 0);
    await supabase.from('email_campaigns').update({ sent: s, failed: f, status: p === 0 ? (s === 0 && f > 0 ? 'failed' : 'done') : 'sending' }).eq('id', id);
  }

  return Response.json({ ...report, sent, failed });
});
