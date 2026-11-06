// Called by /payment/result when MyFatoorah sends the payer back (?paymentId=…). Asks MyFatoorah for
// the real status and activates the order if paid; never trusts the redirect on its own.
import { cors, json, settle } from '../_shared/activate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { payment_id, order_id } = await req.json();
    if (!payment_id && !order_id) return json({ status: 'failed' }, 400);
    const outcome = await settle({ paymentId: payment_id ?? null, orderId: order_id ?? null }, 'callback');
    return json(outcome);
  } catch (err) {
    console.error(err);
    return json({ status: 'failed', error: String((err as Error).message ?? err) });
  }
});
