import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle, Pager } from './AdminLayout';
import { adminError, METHOD, ORDER_STATUS, ORDER_TYPE, sar, type AdminOrder } from './shared';
import { Icon } from '../../components/Icon';
import { Dropdown } from '../../components/Dropdown';
import { Modal, useConfirm } from '../../components/Modal';
import { TextField } from '../../components/Field';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime, isoDay } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

const PAGE = 50;

function orderQuery<T extends string>(columns: T, f: { q: string; status: string; type: string }, count?: 'exact') {
  let q = supabase.from('admin_orders').select(columns, count ? { count } : undefined);
  if (f.status) q = q.eq('status', f.status);
  else q = q.neq('status', 'cancelled');
  if (f.type === 'individual') q = q.eq('type', 'individual');
  if (f.type === 'company') q = q.neq('type', 'individual');
  const term = f.q.trim().replace(/[%,()]/g, ' ');
  if (term) q = q.or(['order_no', 'user_name', 'user_email', 'company_name', 'member_label'].map((c) => `${c}.ilike.%${term}%`).join(','));
  return q;
}

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const filter = { q: params.get('q') ?? '', status: params.get('status') ?? '', type: params.get('type') ?? '' };
  const page = Number(params.get('page') ?? 0);
  const [search, setSearch] = useState(filter.q);
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [exporting, setExporting] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => setSearch(filter.q), [filter.q]);
  useEffect(() => {
    const timer = setTimeout(() => search.trim() !== filter.q && setParam('q', search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const key = JSON.stringify(filter);
  const list = useQuery({
    queryKey: ['admin', 'orders', key, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await orderQuery('*', filter, 'exact')
        .order('created_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data as unknown as AdminOrder[], count: count ?? 0 };
    },
  });
  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const filtered = !!(filter.q || filter.status || filter.type);

  // Keep the open order in sync after an action refreshes the list.
  useEffect(() => {
    if (open) setOpen(rows.find((r) => r.id === open.id) ?? open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  const exportAll = async () => {
    setExporting(true);
    try {
      const out: AdminOrder[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await orderQuery('*', filter).order('created_at').range(from, from + 999);
        if (error) throw error;
        out.push(...(data as unknown as AdminOrder[]));
        if (data.length < 1000) break;
      }
      await exportExcel(
        `luxury-payments-${isoDay(new Date().toISOString())}`,
        'المدفوعات',
        out.map((o) => ({
          'رقم الطلب': o.order_no,
          النوع: ORDER_TYPE[o.type ?? ''],
          العميل: o.user_name ?? '',
          البريد: o.user_email ?? '',
          الشركة: o.company_name ?? '',
          العدد: o.quantity,
          'سعر الوحدة': Number(o.unit_price),
          'قبل الضريبة': Number(o.subtotal),
          الضريبة: Number(o.vat_amount),
          الإجمالي: Number(o.total),
          الحالة: ORDER_STATUS[o.status ?? '']?.label ?? o.status,
          الطريقة: o.method ? METHOD[o.method] : '',
          'رقم الدفع': o.mf_payment_id ?? '',
          'تاريخ الطلب': isoDay(o.created_at),
          'تاريخ الدفع': isoDay(o.paid_at),
        })),
      );
    } catch {
      toast('تعذّر التصدير.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AdminTitle
        title="المدفوعات وعروض الأسعار"
        lead={list.data ? `${total.toLocaleString('en-US')} طلب${filtered ? ' مطابق' : ''}` : 'جارٍ التحميل…'}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportAll} disabled={exporting || !total}>
            {exporting ? <Spinner small /> : <Icon name="download" />}
            تصدير Excel
          </button>
        }
      />

      <div className="toolbar">
        <label className="toolbar-search">
          <Icon name="search" />
          <input type="search" placeholder="رقم الطلب أو الاسم أو البريد أو الشركة" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
          {list.isFetching && !list.isLoading && <Spinner small />}
        </label>
        <Dropdown
          label="الحالة"
          icon="filter"
          placeholder="كل الحالات"
          value={filter.status}
          onChange={(v) => setParam('status', v)}
          options={[{ value: '', label: 'كل الحالات (عدا الملغاة)' }, ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))]}
        />
        <Dropdown
          label="النوع"
          icon="receipt"
          placeholder="الكل"
          value={filter.type}
          onChange={(v) => setParam('type', v)}
          options={[{ value: '', label: 'الكل' }, { value: 'individual', label: 'أفراد' }, { value: 'company', label: 'شركات' }]}
        />
        {filtered && (
          <button type="button" className="btn btn-xs btn-soft" onClick={() => setParams({}, { replace: true })}>
            <Icon name="close" />
            مسح الفلاتر
          </button>
        )}
      </div>

      {list.isLoading ? (
        <Skeleton rows={6} height={58} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الطلبات." onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <div className="surface"><EmptyState icon="receipt" title="لا توجد طلبات مطابقة" /></div>
      ) : (
        <div className="table-card">
          <table className="dtable">
            <thead>
              <tr>
                <th>الطلب</th>
                <th>العميل</th>
                <th className="num">المبلغ</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const st = ORDER_STATUS[o.status ?? 'pending'];
                return (
                  <tr key={o.id} className="is-link" onClick={() => setOpen(o)}>
                    <td className="cell-title">
                      <span className="cell-strong mono" dir="ltr">{o.order_no}</span>
                      <small className="cell-sub">{ORDER_TYPE[o.type ?? '']}{o.type !== 'individual' ? ` × ${o.quantity}` : ''}</small>
                    </td>
                    <td data-label="العميل">
                      {o.company_name ? <>{o.company_name}<small className="cell-sub">{o.user_name}</small></> : <>{o.user_name}<small className="cell-sub"><span dir="ltr">{o.member_label ?? o.user_email}</span></small></>}
                    </td>
                    <td data-label="المبلغ" className="num">{sar(o.total)} <small>ريال</small></td>
                    <td data-label="الحالة"><Badge tone={st.tone}>{st.label}</Badge>{o.method && <small className="cell-sub">{METHOD[o.method]}</small>}</td>
                    <td data-label="التاريخ">{formatDateTime(o.paid_at ?? o.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE} total={total} onPage={(p) => setParam('page', String(p))} />
        </div>
      )}

      <OrderModal order={open} onClose={() => setOpen(null)} />
    </>
  );
}

function OrderModal({ order: o, onClose }: { order: AdminOrder | null; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'main' | 'price' | 'bank' | 'refund'>('main');
  const [price, setPrice] = useState({ quantity: '', unit: '', notes: '' });
  const [ref, setRef] = useState('');
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    setView('main');
    setRef('');
    setLink(o?.payment_url ?? null);
    if (o) setPrice({ quantity: String(o.quantity), unit: String(Number(o.unit_price)), notes: o.notes ?? '' });
  }, [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!o) return <Modal open={false} title="" onClose={onClose}>{null}</Modal>;
  const st = ORDER_STATUS[o.status ?? 'pending'];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const call = async (k: string, fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(k);
    const { error } = await fn();
    setBusy(null);
    if (error) {
      toast(adminError(error), 'error');
      return false;
    }
    toast(ok);
    refresh();
    return true;
  };

  const savePrice = async () => {
    const quantity = Number(price.quantity);
    const unit = Number(price.unit);
    if (!Number.isInteger(quantity) || quantity < 1 || !(unit > 0)) return toast('راجع العدد والسعر.', 'error');
    if (await call('price', () => supabase.rpc('admin_price_quote', { p_order: o.id!, p_quantity: quantity, p_unit_price: unit, p_notes: price.notes.trim() || undefined }), 'سُعّر الطلب وأصبح جاهزًا للدفع.')) setView('main');
  };

  const makeLink = async () => {
    setBusy('link');
    const { data, error } = await supabase.functions.invoke('create-payment', { body: { order_id: o.id, origin: location.origin } });
    setBusy(null);
    if (error || !data?.url) return toast('تعذّر إنشاء رابط الدفع.', 'error');
    setLink(data.url);
    refresh();
    toast('أُنشئ رابط الدفع.');
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('نُسخ الرابط.');
    } catch {
      /* clipboard blocked */
    }
  };
  const emailLink = () => call('email', () => supabase.rpc('admin_send_payment_link', { p_order: o.id! }), 'أُضيفت رسالة الرابط إلى طابور البريد.');

  const bank = async () => {
    if (!(await confirm({ title: 'تأكيد استلام التحويل', message: <>ستُفعَّل العضوية فورًا ويصل الإيصال للعميل. المبلغ: <b>{sar(o.total)} ريال</b>.</>, confirm: 'تأكيد وتفعيل', icon: 'check' }))) return;
    if (await call('bank', () => supabase.rpc('activate_order', { p_order: o.id!, p_method: 'bank_transfer', p_payment_id: ref.trim() || undefined }), 'سُجّل التحويل وفُعّلت العضوية.')) setView('main');
  };
  const refund = async () => {
    if (await call('refund', () => supabase.rpc('admin_mark_refunded', { p_order: o.id!, p_note: ref.trim() || undefined }), 'سُجّل الاسترجاع.')) setView('main');
  };

  const isCompany = o.type !== 'individual';
  const unit = Number(price.unit) || 0;
  const qty = Number(price.quantity) || 0;

  return (
    <Modal
      open={!!o}
      wide
      icon="receipt"
      title={o.order_no ?? ''}
      lead={<><Badge tone={st.tone}>{st.label}</Badge> {ORDER_TYPE[o.type ?? '']}{isCompany ? ` × ${o.quantity}` : ''}</>}
      onClose={onClose}
    >
      {view === 'main' && (
        <div className="ui-form">
          <dl className="facts">
            <div><dt><Icon name={isCompany ? 'building' : 'user'} />العميل</dt><dd>{o.company_name ? <Link to={`/admin/companies/${o.company_id}`} onClick={onClose}>{o.company_name}</Link> : null}{o.company_name && ' · '}<Link to={`/admin/members/${o.user_id}`} onClick={onClose}>{o.user_name}</Link></dd></div>
            <div><dt><Icon name="mail" />البريد</dt><dd dir="ltr">{o.user_email}</dd></div>
            <div><dt><Icon name="wallet" />الإجمالي</dt><dd><b>{sar(o.total)}</b> ريال</dd></div>
            <div><dt><Icon name="receipt" />قبل الضريبة / الضريبة</dt><dd>{sar(o.subtotal)} / {sar(o.vat_amount)}</dd></div>
            <div><dt><Icon name="hash" />سعر الوحدة</dt><dd>{sar(o.unit_price)}{Number(o.discount_pct) > 0 && ` (خصم ${sar(o.discount_pct)}%)`}{Number(o.period_factor) < 1 && ` · ${Math.round(Number(o.period_factor) * 12)} شهر`}</dd></div>
            <div><dt><Icon name="calendar" />التاريخ</dt><dd>{formatDateTime(o.created_at)}{o.paid_at && <> · دُفع {formatDateTime(o.paid_at)}</>}</dd></div>
            {o.method && <div><dt><Icon name="check-circle" />الطريقة</dt><dd>{METHOD[o.method]}{o.mf_payment_id && <span className="mono" dir="ltr"> · {o.mf_payment_id}</span>}</dd></div>}
            {o.notes && <div className="facts-full"><dt><Icon name="file" />ملاحظات</dt><dd style={{ whiteSpace: 'pre-line' }}>{o.notes}</dd></div>}
          </dl>

          {o.status === 'quote' && (
            <div className="adm-note"><Icon name="info" /><span>الشركة طلبت عرض سعر. حدّد السعر، ثم أنشئ رابط الدفع وأرسله، أو انتظر التحويل البنكي.</span></div>
          )}

          {o.status === 'pending' && link && (
            <div className="ui-field">
              <span className="ui-label">رابط الدفع</span>
              <div className="link-row">
                <input className="ui-input mono" dir="ltr" readOnly value={link} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={copy}><Icon name="copy" />نسخ</button>
              </div>
              {isCompany && <p className="ui-hint">يظهر الرابط أيضًا للشركة في لوحتها تحت «الفواتير».</p>}
            </div>
          )}

          <div className="actions-list">
            {(o.status === 'quote' || (o.status === 'pending' && isCompany)) && (
              <button type="button" onClick={() => setView('price')} disabled={!!busy}>
                <span className="al-icon al-icon--gold"><Icon name="edit" /></span>
                <span><strong>{o.status === 'quote' ? 'تسعير الطلب' : 'تعديل السعر'}</strong><small>العدد وسعر العضوية الواحدة</small></span>
              </button>
            )}
            {o.status === 'pending' && (
              <>
                <button type="button" onClick={makeLink} disabled={!!busy}>
                  <span className="al-icon al-icon--green">{busy === 'link' ? <Spinner small /> : <Icon name="wallet" />}</span>
                  <span><strong>{link ? 'تحديث رابط الدفع' : 'إنشاء رابط دفع'}</strong><small>صفحة ماي فاتورة بالمبلغ</small></span>
                </button>
                {link && o.user_id && (
                  <button type="button" onClick={emailLink} disabled={!!busy}>
                    <span className="al-icon">{busy === 'email' ? <Spinner small /> : <Icon name="send" />}</span>
                    <span><strong>إرسال الرابط بالبريد</strong><small>إلى <span dir="ltr">{o.user_email}</span></small></span>
                  </button>
                )}
                <button type="button" onClick={() => setView('bank')} disabled={!!busy}>
                  <span className="al-icon al-icon--green"><Icon name="check" /></span>
                  <span><strong>تسجيل تحويل بنكي</strong><small>بعد وصول المبلغ للحساب، يفعّل العضوية فورًا</small></span>
                </button>
              </>
            )}
            {o.status === 'paid' && (
              <button type="button" className="is-danger" onClick={() => setView('refund')} disabled={!!busy}>
                <span className="al-icon al-icon--red"><Icon name="undo" /></span>
                <span><strong>تسجيل استرجاع</strong><small>بعد تنفيذه من بوابة ماي فاتورة أو البنك</small></span>
              </button>
            )}
          </div>
        </div>
      )}

      {view === 'price' && (
        <div className="ui-grid">
          <TextField label="العدد" icon="users" type="number" dir="ltr" min={1} inputMode="numeric" value={price.quantity} onChange={(e) => setPrice({ ...price, quantity: e.target.value })} />
          <TextField label="سعر العضوية الواحدة (شامل الضريبة)" icon="wallet" type="number" dir="ltr" min={1} step="0.01" inputMode="decimal" value={price.unit} onChange={(e) => setPrice({ ...price, unit: e.target.value })} />
          <TextField label="ملاحظة على الطلب" icon="file" full value={price.notes} onChange={(e) => setPrice({ ...price, notes: e.target.value })} />
          <p className="ui-hint ui-field--full">الإجمالي: <b>{sar(Math.round(qty * unit * Number(o.period_factor) * 100) / 100)}</b> ريال شامل الضريبة{Number(o.period_factor) < 1 ? ` (${Math.round(Number(o.period_factor) * 12)} شهر متبقٍ)` : ''}.</p>
          <div className="ui-modal-actions ui-field--full">
            <button type="button" className="btn btn-ghost" onClick={() => setView('main')}>رجوع</button>
            <button type="button" className="btn btn-primary" onClick={savePrice} disabled={busy === 'price'}>{busy === 'price' ? <Spinner small /> : <><Icon name="check" />حفظ السعر</>}</button>
          </div>
        </div>
      )}

      {view === 'bank' && (
        <div className="ui-form">
          <TextField label="مرجع التحويل (اختياري)" icon="hash" dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="رقم العملية في كشف الحساب" />
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setView('main')}>رجوع</button>
            <button type="button" className="btn btn-primary" onClick={bank} disabled={busy === 'bank'}>{busy === 'bank' ? <Spinner small /> : <><Icon name="check" />تأكيد الاستلام</>}</button>
          </div>
        </div>
      )}

      {view === 'refund' && (
        <div className="ui-form">
          <div className="adm-note"><Icon name="alert" /><span>نفّذ الاسترجاع أولًا من بوابة ماي فاتورة (أو بالتحويل). هنا يُسجَّل فقط{o.type === 'individual' ? '، وتنتهي العضوية الفردية التي اشتراها هذا الطلب الآن.' : '. مقاعد الشركة لا تتغير تلقائيًا.'}</span></div>
          <TextField label="سبب أو مرجع الاسترجاع" icon="file" value={ref} onChange={(e) => setRef(e.target.value)} />
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setView('main')}>رجوع</button>
            <button type="button" className="btn btn-danger" onClick={refund} disabled={busy === 'refund'}>{busy === 'refund' ? <Spinner small /> : 'تسجيل الاسترجاع'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
