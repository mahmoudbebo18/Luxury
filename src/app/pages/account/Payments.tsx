// Payments tab: a summary strip, every order in a table (cards on a phone), and a printable receipt
// for each paid one. ?receipt=<order id> opens that receipt directly (link from the overview).
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { formatDate, formatMoney } from '../../lib/format';
import { methodLabel, orderLabel, statusLabel, useMyOrders, type MyOrder } from './shared';

export default function Payments() {
  const { t, lang } = useT();
  const orders = useMyOrders();
  const [params, setParams] = useSearchParams();
  const list = orders.data ?? [];
  const paid = list.filter((o) => o.status === 'paid');
  const total = paid.reduce((sum, o) => sum + Number(o.total), 0);
  const open = list.find((o) => o.id === params.get('receipt') && o.status === 'paid') ?? null;
  const showReceipt = (id: string | null) => setParams(id ? { receipt: id } : {}, { replace: true });

  return (
    <div className="pays">
      <header className="tab-head">
        <div>
          <h2>{t('pay.title')}</h2>
          <p>{t('pay.lead')}</p>
        </div>
      </header>

      {orders.isLoading ? (
        <Skeleton rows={3} />
      ) : orders.isError ? (
        <ErrorState message={t('common.error')} onRetry={() => orders.refetch()} retryLabel={t('common.retry')} />
      ) : !list.length ? (
        <div className="surface"><EmptyState icon="receipt" title={t('pay.empty')} /></div>
      ) : (
        <>
          <div className="pays-stats">
            <div>
              <span>{t('pay.totalPaid')}</span>
              <strong>{formatMoney(total)} <small>{t('common.sar')}</small></strong>
            </div>
            <div>
              <span>{t('pay.count')}</span>
              <strong>{paid.length}</strong>
            </div>
            <div>
              <span>{t('pay.lastDate')}</span>
              <strong className="pays-stats__date">{paid[0] ? formatDate(paid[0].paid_at ?? paid[0].created_at, lang) : '—'}</strong>
            </div>
          </div>

          <div className="lux-table pays-table">
            <table>
              <thead>
                <tr>
                  <th>{t('pay.order')}</th>
                  <th>{t('pay.item')}</th>
                  <th>{t('pay.date')}</th>
                  <th>{t('pay.method')}</th>
                  <th>{t('pay.amount')}</th>
                  <th>{t('pay.status')}</th>
                  <th><span className="sr-only">{t('pay.receipt')}</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const method = methodLabel(o);
                  return (
                    <tr key={o.id}>
                      <td data-label={t('pay.order')}><span dir="ltr" className="mono">{o.order_no}</span></td>
                      <td data-label={t('pay.item')}><strong>{t(orderLabel(o), { n: o.quantity })}</strong></td>
                      <td data-label={t('pay.date')}>{formatDate(o.paid_at ?? o.created_at, lang)}</td>
                      <td data-label={t('pay.method')}>{method && o.status === 'paid' ? t(method) : '—'}</td>
                      <td data-label={t('pay.amount')} className="pays-amount">{formatMoney(o.total)} {t('common.sar')}</td>
                      <td data-label={t('pay.status')}><span className={`badge badge--${o.status}`}>{t(statusLabel(o))}</span></td>
                      <td className="end pays-action">
                        {o.status === 'paid' ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => showReceipt(o.id)}>
                            <Icon name="file" /> {t('pay.receipt')}
                          </button>
                        ) : o.status === 'pending' && o.type === 'individual' ? (
                          <Link className="btn btn-gold btn-sm" to="/checkout">{t('pay.continue')}</Link>
                        ) : o.status === 'pending' && o.payment_url ? (
                          <a className="btn btn-gold btn-sm" href={o.payment_url}>{t('pay.continue')}</a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={!!open} wide title={t('pay.receipt')} icon="receipt" onClose={() => showReceipt(null)} closeLabel={t('common.close')}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => showReceipt(null)}>{t('common.close')}</button>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}><Icon name="download" /> {t('pay.print')}</button>
          </div>
        }
      >
        {open && <Receipt o={open} />}
      </Modal>
    </div>
  );
}

type Seller = { seller_name: string; seller_cr: string; seller_vat: string; seller_address: string; vat_rate: number };

function Receipt({ o }: { o: MyOrder }) {
  const { t, lang } = useT();
  const { account } = useAuth();
  const seller = useQuery({
    queryKey: ['public-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_pricing');
      if (error) throw error;
      return data as unknown as Seller;
    },
    staleTime: 10 * 60_000,
  });
  const s = seller.data;
  const pct = Number(o.subtotal) > 0 ? Math.round((Number(o.vat_amount) / Number(o.subtotal)) * 100) : Math.round(Number(s?.vat_rate ?? 0) * 100);

  return (
    <div className="receipt" id="receipt">
      <div className="receipt__head">
        <svg className="receipt__logo" aria-hidden="true"><use href="/imgs/icons.svg#logo" /></svg>
        <div>
          <strong>{t('pay.receiptTitle')}</strong>
          <span dir="ltr" className="mono">{o.order_no}</span>
        </div>
      </div>

      <div className="receipt__parties">
        <div>
          <span>{t('pay.seller')}</span>
          <strong>{s?.seller_name ?? '…'}</strong>
          {s?.seller_address && <small>{s.seller_address}</small>}
          {s?.seller_vat && <small>{t('pay.vatNo')}: <span dir="ltr">{s.seller_vat}</span></small>}
          {s?.seller_cr && <small>{t('pay.crNo')}: <span dir="ltr">{s.seller_cr}</span></small>}
        </div>
        <div>
          <span>{t('pay.billedTo')}</span>
          <strong>{account?.full_name}</strong>
          {account?.member_no && <small dir="ltr">{account.member_no}</small>}
          <small dir="ltr">{account?.email}</small>
        </div>
      </div>

      <dl className="receipt__lines">
        <div><dt>{t('pay.item')}</dt><dd>{t(orderLabel(o), { n: o.quantity })}</dd></div>
        {o.type !== 'individual' && <div><dt>{t('pay.qty')}</dt><dd>{o.quantity}</dd></div>}
        <div><dt>{t('pay.paidOn')}</dt><dd>{formatDate(o.paid_at ?? o.created_at, lang)}</dd></div>
        {o.method && <div><dt>{t('pay.method')}</dt><dd>{t(methodLabel(o)!)}</dd></div>}
        {o.mf_payment_id && <div><dt>{t('pay.ref')}</dt><dd dir="ltr" className="mono">{o.mf_payment_id}</dd></div>}
      </dl>

      <dl className="receipt__totals">
        <div><dt>{t('pay.subtotal')}</dt><dd>{formatMoney(o.subtotal)} {t('common.sar')}</dd></div>
        <div><dt>{t('pay.vat', { pct })}</dt><dd>{formatMoney(o.vat_amount)} {t('common.sar')}</dd></div>
        <div className="receipt__total"><dt>{t('pay.total')}</dt><dd>{formatMoney(o.total)} {t('common.sar')}</dd></div>
      </dl>
    </div>
  );
}
