// MyFatoorah API v2 (shared by create-payment, verify-payment and myfatoorah-webhook).
// Test: MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com with the public test token (KWD).
// Live (Saudi Arabia): https://api-sa.myfatoorah.com with the account's own token.
const BASE = (Deno.env.get('MYFATOORAH_BASE_URL') ?? 'https://apitest.myfatoorah.com').replace(/\/$/, '');
const TOKEN = Deno.env.get('MYFATOORAH_API_KEY') ?? '';
const CURRENCY = Deno.env.get('MYFATOORAH_CURRENCY') ?? ''; // e.g. SAR on live; empty on test (KWD)

type MfResponse<T> = { IsSuccess: boolean; Message: string; ValidationErrors: { Name: string; Error: string }[] | null; Data: T };

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!TOKEN) throw new Error('myfatoorah_not_configured');
  const res = await fetch(`${BASE}/v2/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as MfResponse<T> | null;
  if (!res.ok || !json?.IsSuccess) {
    const detail = json?.ValidationErrors?.map((e) => `${e.Name}: ${e.Error}`).join('; ') || json?.Message || `HTTP ${res.status}`;
    throw new Error(`myfatoorah ${path}: ${detail}`);
  }
  return json.Data;
}

export type SendPaymentInput = {
  value: number;
  customerName: string;
  customerEmail?: string;
  callbackUrl: string;
  errorUrl: string;
  language: 'ar' | 'en';
  reference: string; // our order_no
  orderId: string;
  itemName: string;
  quantity: number;
};

/** Creates an invoice and returns its hosted payment page (all enabled methods: mada, cards, Apple Pay). */
export function sendPayment(i: SendPaymentInput) {
  return call<{ InvoiceId: number; InvoiceURL: string }>('SendPayment', {
    NotificationOption: 'LNK',
    InvoiceValue: i.value,
    CustomerName: i.customerName.slice(0, 100) || 'Member',
    CustomerEmail: i.customerEmail,
    CallBackUrl: i.callbackUrl,
    ErrorUrl: i.errorUrl,
    Language: i.language === 'en' ? 'EN' : 'AR',
    CustomerReference: i.reference,
    UserDefinedField: i.orderId,
    ...(CURRENCY && { DisplayCurrencyIso: CURRENCY }),
    InvoiceItems: [{ ItemName: i.itemName, Quantity: i.quantity, UnitPrice: Math.round((i.value / i.quantity) * 1000) / 1000 }].filter(
      // MyFatoorah requires sum(items) == InvoiceValue: skip the line when rounding would break it.
      (it) => Math.abs(it.UnitPrice * it.Quantity - i.value) < 0.0005,
    ),
  });
}

export type PaymentStatus = {
  InvoiceId: number;
  InvoiceStatus: 'Pending' | 'Paid' | 'Canceled' | string;
  InvoiceValue: number;
  CustomerReference: string | null;
  UserDefinedField: string | null;
  InvoiceTransactions: { PaymentId: string; TransactionStatus: string; TransationValue?: string; PaidCurrency?: string }[];
};

export function getPaymentStatus(key: string, keyType: 'PaymentId' | 'InvoiceId') {
  return call<PaymentStatus>('GetPaymentStatus', { Key: key, KeyType: keyType });
}

/** Webhook V2 signature: HMAC-SHA256 (base64) of "Invoice.Id=…,Invoice.Status=…,Transaction.Status=…,Transaction.PaymentId=…,Invoice.ExternalIdentifier=…". */
export async function verifyWebhookSignature(data: Record<string, any>, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const v = (x: unknown) => (x === null || x === undefined ? '' : String(x));
  const text = [
    `Invoice.Id=${v(data?.Invoice?.Id)}`,
    `Invoice.Status=${v(data?.Invoice?.Status)}`,
    `Transaction.Status=${v(data?.Transaction?.Status)}`,
    `Transaction.PaymentId=${v(data?.Transaction?.PaymentId)}`,
    `Invoice.ExternalIdentifier=${v(data?.Invoice?.ExternalIdentifier)}`,
  ].join(',');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export const isPaid = (s: PaymentStatus) =>
  s.InvoiceStatus === 'Paid' || s.InvoiceTransactions?.some((t) => t.TransactionStatus === 'Succss' || t.TransactionStatus === 'Success');
