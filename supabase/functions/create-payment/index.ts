// Creates (or reuses) the MyFatoorah payment page for an order and returns its URL.
// Allowed for the order's owner, an admin of the order's company, or a club admin (quote links).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendPayment } from '../_shared/myfatoorah.ts';
import { admin, cors, json } from '../_shared/activate.ts';

// Where MyFatoorah may send the payer back: the real domain, the Pages previews, local dev.
const ALLOWED_ORIGIN = /^(https:\/\/(www\.)?the-luxury-club\.com|https:\/\/([a-z0-9-]+\.)?luxury-club-d7s\.pages\.dev|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;
const ITEM = { individual: 'The Luxury Club membership (1 year)', company: 'The Luxury Club corporate memberships' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: 'not_signed_in' }, 401);

    const { order_id, origin } = await req.json();
    const { data: order } = await admin.from('orders').select('*').eq('id', order_id).maybeSingle();
    if (!order) return json({ error: 'not_found' }, 404);
    if (order.status !== 'pending') return json({ error: 'not_payable', status: order.status }, 409);

    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      admin.from('profiles').select('full_name, email, lang, role').eq('id', user.id).single(),
      admin.from('profiles').select('id').eq('id', user.id).eq('role', 'admin').maybeSingle(),
    ]);
    let allowed = order.user_id === user.id || !!isAdmin;
    if (!allowed && order.company_id) {
      const { data } = await admin.from('company_admins').select('user_id').eq('company_id', order.company_id).eq('user_id', user.id).maybeSingle();
      allowed = !!data;
    }
    if (!allowed) return json({ error: 'forbidden' }, 403);

    // A link made in the last 12 hours is reused, so a double click doesn't create two invoices.
    if (order.payment_url && order.mf_invoice_id && Date.now() - new Date(order.updated_at).getTime() < 12 * 3600_000) {
      return json({ url: order.payment_url });
    }

    const { data: settings } = await admin.from('app_settings').select('site_url').eq('id', 1).single();
    const base = typeof origin === 'string' && ALLOWED_ORIGIN.test(origin) ? origin : settings!.site_url;
    const isCompany = order.type !== 'individual';
    const back = `${base}/payment/result?order=${order.id}${isCompany ? '&for=company' : ''}`;

    // The payer is the order's owner (for a club-admin quote link, the company contact).
    const { data: payer } = await admin.from('profiles').select('full_name, email, lang').eq('id', order.user_id ?? user.id).single();
    const invoice = await sendPayment({
      value: Number(order.total),
      customerName: payer?.full_name || profile?.full_name || 'Member',
      customerEmail: payer?.email ?? undefined,
      callbackUrl: back,
      errorUrl: back,
      language: (payer?.lang ?? 'ar') as 'ar' | 'en',
      reference: order.order_no,
      orderId: order.id,
      itemName: isCompany ? ITEM.company : ITEM.individual,
      quantity: order.quantity,
    });

    await admin.from('orders').update({ mf_invoice_id: String(invoice.InvoiceId), payment_url: invoice.InvoiceURL, method: 'myfatoorah' }).eq('id', order.id);
    return json({ url: invoice.InvoiceURL });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
