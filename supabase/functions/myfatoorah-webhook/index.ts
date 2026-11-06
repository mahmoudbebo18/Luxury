// MyFatoorah Webhook V2 (backup for payers who close the page before the redirect). Checks the
// signature, ignores repeats, then confirms with GetPaymentStatus before activating anything.
import { verifyWebhookSignature } from '../_shared/myfatoorah.ts';
import { admin, settle } from '../_shared/activate.ts';

const SECRET = Deno.env.get('MYFATOORAH_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const body = await req.json().catch(() => null);
  if (!body?.Event || !body?.Data) return new Response('bad request', { status: 400 });

  const ok = await verifyWebhookSignature(body.Data, req.headers.get('myfatoorah-signature'), SECRET);
  if (!ok) return new Response('invalid signature', { status: 401 });

  // Each webhook once (MyFatoorah retries up to 5 times).
  const reference = `webhook:${body.Event.Reference ?? crypto.randomUUID()}`;
  const { error: dup } = await admin.from('payment_events').insert({ source: 'webhook', reference, payload: body });
  if (dup) return new Response('ok');

  if (body.Event.Name === 'PAYMENT_STATUS_CHANGED' && body.Data.Transaction?.Status === 'SUCCESS') {
    try {
      await settle({ paymentId: body.Data.Transaction.PaymentId, orderId: body.Data.Invoice?.UserDefinedField ?? null }, 'webhook');
    } catch (err) {
      console.error(err);
      return new Response('retry', { status: 500 });
    }
  }
  return new Response('ok');
});
