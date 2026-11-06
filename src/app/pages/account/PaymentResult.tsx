// MyFatoorah sends the payer back here (?paymentId=… on success and on error). The verify-payment
// Edge Function asks MyFatoorah for the real status and activates the order; the page never trusts
// the URL on its own.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/PageLoader';

type Result = 'checking' | 'paid' | 'failed';

export default function PaymentResult() {
  const { t } = useT();
  const { refreshAccount, isCompanyAdmin } = useAuth();
  const [params] = useSearchParams();
  const [result, setResult] = useState<Result>('checking');
  const paymentId = params.get('paymentId') ?? params.get('Id');
  const orderId = params.get('order');

  useEffect(() => {
    let stop = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('verify-payment', { body: { payment_id: paymentId, order_id: orderId } });
      if (stop) return;
      const paid = !error && data?.status === 'paid';
      setResult(paid ? 'paid' : 'failed');
      if (paid) refreshAccount();
    })();
    return () => {
      stop = true;
    };
  }, [paymentId, orderId, refreshAccount]);

  const company = params.get('for') === 'company';

  return (
    <div className="container page">
      <div className="pay-result">
        {result === 'checking' ? (
          <>
            <Spinner />
            <p>{t('checkout.checking')}</p>
          </>
        ) : result === 'paid' ? (
          <>
            <span className="pay-result__icon is-ok"><Icon name="check" /></span>
            <h1>{t('checkout.okTitle')}</h1>
            <p>{t('checkout.okLead')}</p>
            <Link className="btn btn-gold btn-lg" to={company && isCompanyAdmin ? '/company' : '/account'}>
              {company ? t('account.companyBtn') : t('checkout.okBtn')}
            </Link>
          </>
        ) : (
          <>
            <span className="pay-result__icon is-fail"><Icon name="alert" /></span>
            <h1>{t('checkout.failTitle')}</h1>
            <p>{t('checkout.failLead')}</p>
            <Link className="btn btn-primary btn-lg" to={company ? '/company' : '/checkout'}>{t('checkout.retry')}</Link>
          </>
        )}
      </div>
    </div>
  );
}
