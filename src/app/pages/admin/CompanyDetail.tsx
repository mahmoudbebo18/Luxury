import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { contractState } from './Companies';
import { adminError, METHOD, ORDER_STATUS, ORDER_TYPE, sar } from './shared';
import { Icon } from '../../components/Icon';
import { Modal, useConfirm } from '../../components/Modal';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { daysLeft, formatDate, formatDateTime } from '../../lib/format';

type Overview = {
  company: { id: string; company_no: string; legal_name: string; card_name: string; cr_number: string; vat_number: string; city: string; address: string; email_domain: string | null };
  contract: { id: string; status: 'pending' | 'active' | 'cancelled'; seats: number; starts_at: string | null; expires_at: string | null; expired: boolean; join_token: string | null; used: number; reserved: number } | null;
  members: { membership_id: string; user_id: string; full_name: string; email: string; phone: string; member_no: string | null; assigned_at: string | null }[];
  invites: { id: string; email: string; full_name: string; phone: string; created_at: string }[];
  orders: { id: string; order_no: string; type: string; quantity: number; total: number; status: string; method: string | null; payment_url: string | null; paid_at: string | null; created_at: string }[];
  admins: { user_id: string; full_name: string; email: string }[];
};

export default function CompanyDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'adjust' | 'order' | 'admin' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adjust, setAdjust] = useState({ seats: '0', days: '0', note: '' });
  const [order, setOrder] = useState({ type: 'company_new', quantity: '10', unit: '', notes: '' });
  const [adminEmail, setAdminEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ['admin', 'company', id],
    queryFn: async () => {
      const [ov, notes, pricing] = await Promise.all([
        supabase.rpc('company_overview', { p_company: id }),
        supabase.from('admin_notes').select('body, updated_at').eq('entity_type', 'company').eq('entity_id', id).maybeSingle(),
        supabase.rpc('public_pricing'),
      ]);
      if (ov.error) throw ov.error;
      return {
        ov: ov.data as unknown as Overview,
        note: notes.data?.body ?? '',
        noteAt: notes.data?.updated_at ?? null,
        price: Number((pricing.data as { price_individual?: number } | null)?.price_individual ?? 699),
      };
    },
  });

  useEffect(() => {
    if (data.data && note === null) setNote(data.data.note);
  }, [data.data, note]);

  if (data.isLoading) return <PageLoader />;
  if (data.isError || !data.data?.ov?.company?.id) return <ErrorState message="تعذّر تحميل الشركة." onRetry={() => data.refetch()} />;
  const { ov, price } = data.data;
  const { company: co, contract: ct } = ov;
  const state = contractState({ contract_status: ct?.status ?? null, expires_at: ct?.expires_at ?? null });
  const active = state === 'active';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(key);
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

  const doAdjust = async () => {
    const seats = Number(adjust.seats || 0);
    const days = Number(adjust.days || 0);
    if (!Number.isInteger(seats) || !Number.isInteger(days) || seats < 0 || days < 0 || seats + days === 0) return toast('اكتب عدد مقاعد أو أيام.', 'error');
    const ok = await run('adjust', () => supabase.rpc('admin_company_adjust', { p_company: co.id, p_add_seats: seats, p_add_days: days, p_note: adjust.note.trim() || undefined }), 'تم التعديل على العقد.');
    if (ok) {
      setModal(null);
      setAdjust({ seats: '0', days: '0', note: '' });
      setNote(null);
    }
  };

  const openOrder = () => {
    setOrder({ type: active ? 'company_add_seats' : ct?.status === 'active' ? 'company_renew' : 'company_new', quantity: String(active ? 5 : Math.max(ct?.seats ?? 0, 10)), unit: String(price), notes: '' });
    setModal('order');
  };
  const doOrder = async () => {
    const quantity = Number(order.quantity);
    const unit = Number(order.unit);
    if (!Number.isInteger(quantity) || quantity < 1 || !(unit > 0)) return toast('راجع العدد والسعر.', 'error');
    setBusy('order');
    const { data: res, error } = await supabase.rpc('admin_create_company_order', { p_company: co.id, p_type: order.type, p_quantity: quantity, p_unit_price: unit, p_notes: order.notes.trim() || undefined });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    const r = res as unknown as { order_no: string; total: number };
    toast(`أُنشئ الطلب ${r.order_no} بمبلغ ${sar(r.total)} ريال. أرسل رابط الدفع أو سجّل التحويل من المدفوعات.`);
    refresh();
    navigate(`/admin/payments?q=${r.order_no}`);
  };

  const doAddAdmin = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) return toast('اكتب بريدًا صحيحًا.', 'error');
    const ok = await run('admin', () => supabase.rpc('admin_add_company_admin', { p_company: co.id, p_email: adminEmail.trim() }), 'أُضيف المسؤول، ويرى لوحة الشركة عند دخوله.');
    if (ok) {
      setModal(null);
      setAdminEmail('');
    }
  };

  const release = async (m: Overview['members'][number]) => {
    if (!(await confirm({ title: 'سحب المقعد؟', message: <>تنتهي عضوية <b>{m.full_name}</b> عبر الشركة ويعود المقعد متاحًا للشركة.</>, confirm: 'سحب المقعد', danger: true }))) return;
    run(`rel-${m.membership_id}`, () => supabase.rpc('company_release_seat', { p_membership: m.membership_id }), 'سُحب المقعد.');
  };

  const saveNote = () => run('note', () => supabase.rpc('admin_save_note', { p_type: 'company', p_id: co.id, p_body: note ?? '' }), 'حُفظت الملاحظة.');
  const noteDirty = note !== null && note !== data.data.note;
  const free = ct ? Math.max(0, ct.seats - ct.used - ct.reserved) : 0;
  const pct = ct?.seats ? (ct.used / ct.seats) * 100 : 0;
  const quantity = Number(order.quantity) || 0;
  const unit = Number(order.unit) || 0;

  return (
    <>
      <AdminTitle
        back={{ to: '/admin/companies', label: 'الشركات' }}
        title={co.legal_name}
        lead={<span dir="ltr">{co.company_no}</span>}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('admin')}><Icon name="user" />إضافة مسؤول</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openOrder}><Icon name="receipt" />طلب بسعر خاص</button>
          </>
        }
      />

      <motion.section className="member-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="avatar avatar--xl"><Icon name="building" /></span>
        <div className="member-hero-main">
          <div className="member-hero-tags">
            <Badge tone={active ? 'active' : state === 'expired' ? 'expired' : 'neutral'}>{active ? 'عقد ساري' : state === 'expired' ? 'عقد منتهي' : state === 'pending' ? 'لم يُدفع بعد' : 'بدون عقد'}</Badge>
            <span className="tag">على البطاقة: {co.card_name}</span>
          </div>
          {ct?.seats ? (
            <div className="member-hero-bar">
              <div className="bar"><motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.2 }} className={active ? 'is-active' : 'is-expired'} /></div>
              <div className="member-hero-dates">
                <span><b>{ct.used}</b> مستخدم · {ct.reserved} دعوة معلقة · {free} متاح</span>
                <b>{ct.seats} مقعد</b>
                <span>{ct.expires_at ? (active ? `${daysLeft(ct.expires_at)} يوم متبقٍ · ينتهي ${formatDate(ct.expires_at)}` : `انتهى ${formatDate(ct.expires_at)}`) : ''}</span>
              </div>
            </div>
          ) : (
            <p>لم تشترِ الشركة عضويات بعد.</p>
          )}
        </div>
      </motion.section>

      <div className="adm-grid-2 adm-grid-2--detail">
        <section className="surface">
          <h2 className="surface-title"><Icon name="building" />بيانات الشركة</h2>
          <dl className="facts">
            <div><dt><Icon name="hash" />السجل التجاري</dt><dd dir="ltr">{co.cr_number || '—'}</dd></div>
            <div><dt><Icon name="receipt" />الرقم الضريبي</dt><dd dir="ltr">{co.vat_number || '—'}</dd></div>
            <div><dt><Icon name="pin" />المدينة</dt><dd>{co.city || '—'}</dd></div>
            <div><dt><Icon name="mail" />نطاق رابط الانضمام</dt><dd dir="ltr">{co.email_domain ? `@${co.email_domain}` : '—'}</dd></div>
            {co.address && <div className="facts-full"><dt><Icon name="pin" />العنوان</dt><dd>{co.address}</dd></div>}
            <div className="facts-full">
              <dt><Icon name="users" />المسؤولون</dt>
              <dd>{ov.admins.map((a, i) => <span key={a.user_id}>{i > 0 && '، '}<Link to={`/admin/members/${a.user_id}`}>{a.full_name || a.email}</Link></span>)}</dd>
            </div>
          </dl>
        </section>

        <section className="surface">
          <h2 className="surface-title"><Icon name="settings" />الإجراءات</h2>
          <div className="actions-list">
            <button type="button" onClick={() => setModal('adjust')} disabled={!active || !!busy}>
              <span className="al-icon al-icon--green"><Icon name="plus" /></span>
              <span><strong>مقاعد أو أيام مجانية</strong><small>{active ? 'تعويض أو اتفاق خارج الموقع' : 'يحتاج عقدًا ساريًا'}</small></span>
            </button>
            <button type="button" onClick={openOrder} disabled={!!busy}>
              <span className="al-icon al-icon--gold"><Icon name="receipt" /></span>
              <span><strong>طلب بسعر خاص</strong><small>عقد جديد أو مقاعد أو تجديد، ثم رابط دفع أو تحويل</small></span>
            </button>
            <Link to={`/admin/members?company=${co.id}`}>
              <span className="al-icon"><Icon name="users" /></span>
              <span><strong>الموظفون في قائمة الأعضاء</strong><small>للبحث والتصدير والمراسلة</small></span>
            </Link>
          </div>
        </section>
      </div>

      <section className="surface">
        <div className="surface-head">
          <h2><Icon name="file" />ملاحظات الإدارة</h2>
          {data.data.noteAt && <span className="muted">آخر تعديل {formatDateTime(data.data.noteAt)}</span>}
        </div>
        <TextArea label="ملاحظات لا تراها الشركة" rows={3} value={note ?? ''} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
        <div className="tpl-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={saveNote} disabled={!noteDirty || busy === 'note'}>
            {busy === 'note' ? <Spinner small /> : <><Icon name="check" />حفظ الملاحظة</>}
          </button>
        </div>
      </section>

      <section className="surface">
        <div className="surface-head">
          <h2><Icon name="users" />الموظفون</h2>
          <span className="muted">{ov.members.length} موظف · {ov.invites.length} دعوة معلقة</span>
        </div>
        {!ov.members.length && !ov.invites.length ? (
          <EmptyState icon="users">لم تدعُ الشركة أي موظف بعد.</EmptyState>
        ) : (
          <div className="table-card table-card--flat">
            <table className="dtable">
              <thead><tr><th>الموظف</th><th>الجوال</th><th>الحالة</th><th>منذ</th><th></th></tr></thead>
              <tbody>
                {ov.members.map((m) => (
                  <tr key={m.membership_id}>
                    <td className="cell-title">
                      <Link className="cell-strong" to={`/admin/members/${m.user_id}`}>{m.full_name || m.email}</Link>
                      <small className="cell-sub" dir="ltr">{[m.member_no, m.email].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td data-label="الجوال" dir="ltr">{m.phone || '—'}</td>
                    <td data-label="الحالة"><Badge tone="active">مفعّل</Badge></td>
                    <td data-label="منذ">{formatDate(m.assigned_at)}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn-xs btn-ghost" disabled={!!busy} onClick={() => release(m)}>سحب المقعد</button>
                    </td>
                  </tr>
                ))}
                {ov.invites.map((i) => (
                  <tr key={i.id}>
                    <td className="cell-title"><span className="cell-strong">{i.full_name || i.email}</span><small className="cell-sub" dir="ltr">{i.email}</small></td>
                    <td data-label="الجوال" dir="ltr">{i.phone || '—'}</td>
                    <td data-label="الحالة"><Badge tone="gold">دعوة معلقة</Badge></td>
                    <td data-label="منذ">{formatDate(i.created_at)}</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ui-hint">خدمات كل موظف تظهر في ملفه فقط. الشركة نفسها لا تراها.</p>
      </section>

      <section className="surface">
        <div className="surface-head"><h2><Icon name="receipt" />الطلبات والفواتير</h2></div>
        {!ov.orders.length ? (
          <EmptyState icon="receipt">لا توجد طلبات.</EmptyState>
        ) : (
          <div className="table-card table-card--flat">
            <table className="dtable">
              <thead><tr><th>الطلب</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {ov.orders.map((o) => {
                  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
                  return (
                    <tr key={o.id}>
                      <td className="cell-title">
                        <Link className="cell-strong mono" dir="ltr" to={`/admin/payments?q=${o.order_no}`}>{o.order_no}</Link>
                        <small className="cell-sub">{ORDER_TYPE[o.type]} × {o.quantity}</small>
                      </td>
                      <td data-label="المبلغ">{sar(o.total)} ريال</td>
                      <td data-label="الحالة"><Badge tone={st.tone}>{st.label}</Badge>{o.method && <small className="cell-sub">{METHOD[o.method]}</small>}</td>
                      <td data-label="التاريخ">{formatDateTime(o.paid_at ?? o.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modal === 'adjust'}
        icon="plus"
        title="مقاعد أو أيام مجانية"
        lead="تُضاف للعقد الساري بدون دفع، وتُسجَّل في ملاحظات الشركة."
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={doAdjust} disabled={busy === 'adjust'}>{busy === 'adjust' ? <Spinner small /> : <><Icon name="check" />تطبيق</>}</button>
          </div>
        }
      >
        <div className="ui-grid">
          <TextField label="مقاعد إضافية" icon="users" type="number" dir="ltr" min={0} max={1000} inputMode="numeric" value={adjust.seats} onChange={(e) => setAdjust({ ...adjust, seats: e.target.value })} />
          <TextField label="أيام إضافية" icon="calendar" type="number" dir="ltr" min={0} max={3650} inputMode="numeric" value={adjust.days} onChange={(e) => setAdjust({ ...adjust, days: e.target.value })} hint="تمدد كل عضويات الشركة" />
          <TextField label="السبب" icon="file" full value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} placeholder="مثال: تعويض عن تأخر خدمة" />
        </div>
      </Modal>

      <Modal
        open={modal === 'order'}
        icon="receipt"
        title="طلب بسعر خاص"
        lead="يُنشأ طلب بانتظار الدفع باسم مسؤول الشركة، ثم ترسل له رابط الدفع أو تسجّل التحويل البنكي من صفحة المدفوعات."
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <span className="foot-note"><Icon name="info" />الإجمالي التقريبي: <b>{sar(quantity * unit)}</b> ريال{order.type === 'company_add_seats' ? ' (قبل احتساب الأشهر المتبقية)' : ''}</span>
            <button type="button" className="btn btn-primary" onClick={doOrder} disabled={busy === 'order'}>{busy === 'order' ? <Spinner small /> : <><Icon name="check" />إنشاء الطلب</>}</button>
          </div>
        }
      >
        <div className="ui-grid">
          <SelectField label="النوع" icon="receipt" full value={order.type} onChange={(e) => setOrder({ ...order, type: e.target.value })}>
            <option value="company_new" disabled={active}>عضويات شركة (عقد جديد)</option>
            <option value="company_add_seats" disabled={!active}>مقاعد إضافية حتى نهاية العقد</option>
            <option value="company_renew" disabled={!ct || ct.status !== 'active'}>تجديد سنة</option>
          </SelectField>
          <TextField label="العدد" icon="users" type="number" dir="ltr" min={1} inputMode="numeric" value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} />
          <TextField label="سعر العضوية الواحدة (شامل الضريبة)" icon="wallet" type="number" dir="ltr" min={1} step="0.01" inputMode="decimal" value={order.unit} onChange={(e) => setOrder({ ...order, unit: e.target.value })} hint={`السعر العادي ${sar(price)} ريال`} />
          <TextField label="ملاحظة على الطلب" icon="file" full value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={modal === 'admin'}
        icon="user"
        title="إضافة مسؤول للشركة"
        lead="الشخص يجب أن يكون مسجّلًا في الموقع. بعد الإضافة يرى لوحة الشركة عند دخوله."
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={doAddAdmin} disabled={busy === 'admin'}>{busy === 'admin' ? <Spinner small /> : <><Icon name="check" />إضافة</>}</button>
          </div>
        }
      >
        <TextField label="البريد الإلكتروني" icon="mail" type="email" dir="ltr" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
      </Modal>
    </>
  );
}
