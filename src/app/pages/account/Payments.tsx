// The member's own orders (RLS: own rows only).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { EmptyState, Skeleton } from '../../components/States';
import { formatDate, formatMoney } from '../../lib/format';

export default function Payments() {
  const { t, lang } = useT();
  const { account } = useAuth();
  const orders = useQuery({
    queryKey: ['my-orders', account?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_no, type, quantity, total, status, created_at, paid_at, company_id')
        .eq('user_id', account!.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!account,
  });

  return (
    <div className="container page">
      <header className="acct-head">
        <h1>{t('pay.title')}</h1>
      </header>
      {orders.isLoading ? (
        <Skeleton rows={3} />
      ) : !orders.data?.length ? (
        <EmptyState icon="receipt" title={t('pay.empty')} />
      ) : (
        <div className="lux-table">
          <table>
            <thead>
              <tr>
                <th>{t('pay.order')}</th>
                <th>{t('pay.date')}</th>
                <th>{t('pay.amount')}</th>
                <th>{t('pay.status')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <tr key={o.id}>
                  <td dir="ltr" className="mono">{o.order_no}</td>
                  <td>{formatDate(o.paid_at ?? o.created_at, lang)}</td>
                  <td>{formatMoney(o.total)} {t('common.sar')}</td>
                  <td><span className={`badge badge--${o.status}`}>{t(`pay.${o.status}` as 'pay.paid')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
