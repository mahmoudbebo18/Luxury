// Individual membership checkout: the price comes from the server (quote_price), the order from
// create_order(), and the payment page from the create-payment Edge Function (MyFatoorah).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Alert } from '../../components/Field';
import { Spinner } from '../../components/PageLoader';
import { formatDate, formatMoney } from '../../lib/format';

type Quote = { total: number; subtotal: number; vat_amount: number; unit_price: number };

export async function startPayment(orderId: string) {
  const { data, error } = await supabase.functions.invoke('create-payment', { body: { order_id: orderId, origin: location.origin } });
  if (error || !data?.url) throw error ?? new Error('no_url');
  location.assign(data.url as string);
}

export default function Checkout() {
  const { t, lang } = useT();
  const { account } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const quote = useQuery({
    queryKey: ['quote', 'individual'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('quote_price', { p_type: 'individual', p_quantity: 1 });
      if (error) throw error;
      return data as unknown as Quote;
    },
  });

  if (!account) return null;
  const renewing = account.status === 'active' || account.status === 'expired';
  // A renewal starts after the last paid individual year (which may itself be an early renewal).
  const startsAt = account.membership?.kind === 'individual' && account.status === 'active' ? account.last_expires_at ?? account.membership.expires_at : null;
  const endsAt = new Date(new Date(startsAt ?? Date.now()).getTime() + 365 * 86_400_000).toISOString();
  const base = lang === 'en' ? '/en' : '';
  const q = quote.data;

  const pay = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { data, error } = await supabase.rpc('create_order', { p_type: 'individual' });
      if (error) throw error;
      await startPayment((data as { id: string }).id);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const agree = t('checkout.agree', { terms: '\u0001', refund: '\u0002' })
    .split(/([\u0001\u0002])/)
    .map((part, i) =>
      part === '\u0001' ? <a key={i} href={`${base}/terms`} target="_blank" rel="noopener">{t('reg.termsLink')}</a>
      : part === '\u0002' ? <a key={i} href={`${base}/refund`} target="_blank" rel="noopener">{t('checkout.refundLink')}</a>
      : part,
    );

  return (
    <div className="container page checkout">
      <header className="acct-head">
        <span className="eyebrow">The Luxury Club</span>
        <h1>{t(renewing ? 'checkout.renewTitle' : 'checkout.title')}</h1>
      </header>

      <div className="checkout__grid">
        <section className="checkout__summary">
          <div className="checkout__item">
            <span className="checkout__arch"><Icon name="card" /></span>
            <div>
              <strong>{t('checkout.item')}</strong>
              <small>{account.full_name} · {account.email}</small>
            </div>
          </div>
          <p className="checkout__label">{t('checkout.includes')}</p>
          <ul className="check-list">
            {(['aside.perk1', 'aside.perk2', 'aside.perk3'] as const).map((k) => (
              <li key={k}><Icon name="check" />{t(k)}</li>
            ))}
          </ul>
          <dl className="checkout__dates">
            <div><dt>{t('checkout.validFrom')}</dt><dd>{startsAt ? formatDate(startsAt, lang) : t('checkout.today')}</dd></div>
            <div><dt>{t('checkout.validTo')}</dt><dd>{formatDate(endsAt, lang)}</dd></div>
          </dl>
        </section>

        <section className="checkout__pay">
          {!q ? (
            <div className="auth-center"><Spinner /></div>
          ) : (
            <>
              <dl className="checkout__totals">
                <div><dt>{t('checkout.subtotal')}</dt><dd>{formatMoney(q.subtotal)} {t('common.sar')}</dd></div>
                <div><dt>{t('checkout.vat')}</dt><dd>{formatMoney(q.vat_amount)} {t('common.sar')}</dd></div>
                <div className="checkout__total"><dt>{t('checkout.total')}</dt><dd><span className="num">{formatMoney(q.total)}</span> {t('common.sar')}</dd></div>
              </dl>
              {failed && <Alert tone="error">{t('checkout.unavailable')}</Alert>}
              <button type="button" className="btn btn-gold btn-lg btn-block" onClick={pay} disabled={busy}>
                {busy ? <><Spinner small /> {t('checkout.redirecting')}</> : <><Icon name="lock" /> {t('checkout.pay', { total: formatMoney(q.total) })}</>}
              </button>
              <p className="checkout__agree">{agree}</p>
              <p className="checkout__secure"><Icon name="shield" /> {t('checkout.secure')}</p>
              <p className="checkout__methods">{t('checkout.methods')}</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
