// Turns a confirmed MyFatoorah payment into membership time (activate_order), after checking that
// the invoice really belongs to the order and the amount matches. Used by verify-payment and the webhook.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaymentStatus, isPaid, type PaymentStatus } from './myfatoorah.ts';

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

export type Outcome = { status: 'paid' | 'pending' | 'failed'; order_id?: string; order_no?: string; for?: 'company' | 'individual' };

export async function settle(key: { paymentId?: string | null; orderId?: string | null }, source: 'callback' | 'webhook'): Promise<Outcome> {
  let status: PaymentStatus | null = null;
  let order: Record<string, any> | null = null;

  if (key.orderId) {
    const { data } = await admin.from('orders').select('*').eq('id', key.orderId).maybeSingle();
    order = data;
  }
  if (key.paymentId) status = await getPaymentStatus(key.paymentId, 'PaymentId');
  else if (order?.mf_invoice_id) status = await getPaymentStatus(order.mf_invoice_id, 'InvoiceId');
  if (!status) return { status: 'failed' };

  // The invoice says which order it is for (UserDefinedField = order id, CustomerReference = order_no).
  if (!order || (status.UserDefinedField && status.UserDefinedField !== order.id)) {
    const { data } = await admin.from('orders').select('*').eq('id', status.UserDefinedField ?? '').maybeSingle();
    order = data;
  }
  if (!order) return { status: 'failed' };

  const paymentId = key.paymentId ?? status.InvoiceTransactions?.find((t) => t.TransactionStatus === 'Succss')?.PaymentId ?? null;
  await admin.from('payment_events').insert({
    source,
    reference: `${source}:${status.InvoiceId}:${paymentId ?? 'none'}:${status.InvoiceStatus}`,
    order_id: order.id,
    payload: status as unknown as Record<string, unknown>,
  }).then(() => undefined, () => undefined); // a repeat of the same check is not an error

  const kind = order.type === 'individual' ? 'individual' : 'company';
  if (order.status === 'paid') return { status: 'paid', order_id: order.id, order_no: order.order_no, for: kind };
  if (!isPaid(status)) return { status: status.InvoiceStatus === 'Canceled' ? 'failed' : 'pending', order_id: order.id, for: kind };

  // Same invoice and same amount, or nothing is activated.
  if (order.mf_invoice_id && String(order.mf_invoice_id) !== String(status.InvoiceId)) return { status: 'failed', order_id: order.id, for: kind };
  if (Math.abs(Number(status.InvoiceValue) - Number(order.total)) > 0.01) {
    console.error('amount mismatch', order.order_no, status.InvoiceValue, order.total);
    return { status: 'failed', order_id: order.id, for: kind };
  }

  const { error } = await admin.rpc('activate_order', { p_order: order.id, p_method: 'myfatoorah', p_payment_id: paymentId ?? undefined });
  if (error) {
    console.error('activate_order', order.order_no, error.message);
    return { status: 'pending', order_id: order.id, for: kind };
  }
  return { status: 'paid', order_id: order.id, order_no: order.order_no, for: kind };
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
