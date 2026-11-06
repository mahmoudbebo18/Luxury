import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { CampaignModal } from './CampaignModal';
import { adminError, KIND_LABELS, METHOD, ORDER_STATUS, ORDER_TYPE, REQUEST_STATUS, sar, waLink } from './shared';
import { Icon } from '../../components/Icon';
import { Modal, useConfirm } from '../../components/Modal';
import { Alert, SelectField, TextArea, TextField } from '../../components/Field';
import { Badge, StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { daysLeft, formatDate, formatDateTime, type MembershipStatus } from '../../lib/format';

type EditForm = { full_name: string; phone: string; city: string; lang: 'ar' | 'en' };

export default function MemberDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'email' | 'edit' | 'grant' | 'service' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [grant, setGrant] = useState({ days: '365', note: '' });
  const [service, setService] = useState({ id: '', note: '' });
  const [note, setNote] = useState<string | null>(null);

  const member = useQuery({
    queryKey: ['admin', 'member', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_members').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const extra = useQuery({
    queryKey: ['admin', 'member', id, 'extra'],
    queryFn: async () => {
      const [memberships, orders, requests, notes, admins, services] = await Promise.all([
        supabase.from('memberships').select('id, kind, starts_at, expires_at, order_id, contracts(company_id, companies(legal_name))').eq('holder_id', id).order('starts_at', { ascending: false }),
        supabase.from('admin_orders').select('id, order_no, type, quantity, total, status, method, created_at, paid_at, company_name').eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('admin_service_requests').select('id, service_title, channel, status, note, created_at, done_at, done_by_name').eq('member_id', id).order('created_at', { ascending: false }),
        supabase.from('admin_notes').select('body, updated_at').eq('entity_type', 'member').eq('entity_id', id).maybeSingle(),
        supabase.from('company_admins').select('company_id, companies(legal_name)').eq('user_id', id),
        supabase.from('services').select('id, title_ar').order('sort_order'),
      ]);
      const failed = [memberships, orders, requests, notes, admins, services].find((r) => r.error);
      if (failed?.error) throw failed.error;
      return {
        memberships: memberships.data ?? [],
        orders: orders.data ?? [],
        requests: requests.data ?? [],
        note: notes.data?.body ?? '',
        noteAt: notes.data?.updated_at ?? null,
        admins: admins.data ?? [],
        services: services.data ?? [],
      };
    },
  });

  useEffect(() => {
    if (extra.data && note === null) setNote(extra.data.note);
  }, [extra.data, note]);

  if (member.isLoading) return <PageLoader />;
  if (member.isError) return <ErrorState message="تعذّر تحميل العضو." onRetry={() => member.refetch()} />;
  const m = member.data;
  if (!m) return <EmptyState icon="user" title="العضو غير موجود" />;

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

  const setActive = async (active: boolean) => {
    if (!active && !(await confirm({ title: 'إيقاف الحساب؟', message: 'تظهر بطاقة العضو موقوفة لمقدّمي الخدمات، ولا يستطيع طلب الخدمات حتى تعيد تفعيله.', confirm: 'إيقاف الحساب', danger: true }))) return;
    run('active', () => supabase.rpc('admin_set_active', { p_member: m.id!, p_active: active }), active ? 'تمت إعادة تفعيل الحساب.' : 'تم إيقاف الحساب.');
  };
  const sendReset = async () => {
    if (!(await confirm({ title: 'إرسال رابط كلمة المرور', message: <>سيصل رابط تعيين كلمة مرور جديدة إلى <b dir="ltr">{m.email}</b>.</>, confirm: 'إرسال الرابط', icon: 'key' }))) return;
    run('reset', () => supabase.auth.resetPasswordForEmail(m.email!, { redirectTo: `${location.origin}/reset` }), 'أُرسل رابط تعيين كلمة المرور إلى العضو.');
  };
  const doGrant = async () => {
    const days = Number(grant.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return toast('اكتب عدد أيام من 1 إلى 3650.', 'error');
    const ok = await run('grant', () => supabase.rpc('admin_grant_membership', { p_member: m.id!, p_days: days, p_note: grant.note.trim() || undefined }), `أُضيفت ${days} يوم إلى عضوية ${m.full_name}.`);
    if (ok) {
      setModal(null);
      setGrant({ days: '365', note: '' });
      setNote(null);
    }
  };
  const doService = async () => {
    if (!service.id) return toast('اختر الخدمة.', 'error');
    const ok = await run('service', () => supabase.rpc('admin_record_service', { p_member: m.id!, p_service: service.id, p_note: service.note.trim() || undefined }), 'سُجّلت الخدمة منفّذة على العضوية الحالية.');
    if (ok) {
      setModal(null);
      setService({ id: '', note: '' });
    }
  };
  const setRequest = (rid: string, status: 'done' | 'cancelled' | 'requested') =>
    run(`req-${rid}`, () => supabase.rpc('admin_set_request', { p_request: rid, p_status: status }), status === 'done' ? 'عُلّم الطلب «تم» وخُصم من الرصيد.' : status === 'cancelled' ? 'أُلغي الطلب.' : 'أُعيد الطلب إلى «جديد».');
  const saveNote = () => run('note', () => supabase.rpc('admin_save_note', { p_type: 'member', p_id: m.id!, p_body: note ?? '' }), 'حُفظت الملاحظة.');

  const openEdit = () => {
    setForm({ full_name: m.full_name ?? '', phone: m.phone ?? '', city: m.city ?? '', lang: (m.lang as 'ar' | 'en') ?? 'ar' });
    setFormError(null);
    setModal('edit');
  };
  const saveEdit = async () => {
    if (!form) return;
    if (form.full_name.trim().length < 2) return setFormError('اكتب اسم العضو.');
    setBusy('edit');
    const { error } = await supabase.from('profiles').update({ full_name: form.full_name.trim(), phone: form.phone.trim(), city: form.city.trim(), lang: form.lang }).eq('id', m.id!);
    setBusy(null);
    if (error) return setFormError('تعذّر حفظ البيانات.');
    toast('تم حفظ بيانات العضو.');
    setModal(null);
    refresh();
  };

  const status = (m.status ?? 'none') as MembershipStatus;
  const current = extra.data?.memberships.find((x) => x.id === m.membership_id);
  const start = current ? new Date(current.starts_at).getTime() : 0;
  const end = current ? new Date(current.expires_at).getTime() : 0;
  const progress = current ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0;
  const set = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f));
  const noteDirty = note !== null && note !== (extra.data?.note ?? '');

  return (
    <>
      <AdminTitle
        back={{ to: '/admin/members', label: 'الأعضاء' }}
        title={m.full_name || '—'}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openEdit}><Icon name="edit" />تعديل</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('email')}><Icon name="send" />إرسال بريد</button>
          </>
        }
      />

      <motion.section className="member-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="avatar avatar--xl">{(m.full_name || '؟').trim().charAt(0)}</span>
        <div className="member-hero-main">
          <div className="member-hero-tags">
            <StatusBadge status={status} />
            {m.role === 'admin' && <Badge tone="gold">أدمن</Badge>}
            <Badge>{KIND_LABELS[(m.signup_kind ?? 'individual') as keyof typeof KIND_LABELS]}</Badge>
            {m.member_label && <span className="tag mono" dir="ltr">{m.member_label}</span>}
          </div>
          <p>
            {m.membership_kind === 'corporate' ? <>عضوية شركة: <Link to={`/admin/companies/${m.company_id}`}>{m.company_name}</Link></> : m.membership_kind === 'individual' ? 'عضوية فردية' : status === 'none' ? 'لم يدفع بعد' : 'لا توجد عضوية سارية'}
          </p>
          {current && (
            <div className="member-hero-bar">
              <div className="bar"><motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9, delay: 0.2 }} className={`is-${status}`} /></div>
              <div className="member-hero-dates">
                <span>من {formatDate(current.starts_at)}</span>
                <b>{daysLeft(current.expires_at)} يوم متبقٍ</b>
                <span>إلى {formatDate(current.expires_at)}</span>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      <div className="adm-grid-2 adm-grid-2--detail">
        <section className="surface">
          <h2 className="surface-title"><Icon name="user" />البيانات</h2>
          <dl className="facts">
            <div><dt><Icon name="mail" />البريد</dt><dd dir="ltr">{m.email}</dd></div>
            <div><dt><Icon name="phone" />الجوال</dt><dd dir="ltr">{m.phone ? <a href={waLink(m.phone)} target="_blank" rel="noopener">{m.phone}</a> : '—'}</dd></div>
            <div><dt><Icon name="pin" />المدينة</dt><dd>{m.city || '—'}</dd></div>
            <div><dt><Icon name="globe" />لغة الرسائل</dt><dd>{m.lang === 'en' ? 'الإنجليزية' : 'العربية'}</dd></div>
            <div><dt><Icon name="calendar" />التسجيل</dt><dd>{formatDate(m.created_at)}</dd></div>
            <div><dt><Icon name="check-circle" />خدمات منفّذة</dt><dd>{m.services_done ?? 0}</dd></div>
            {!!extra.data?.admins.length && (
              <div className="facts-full">
                <dt><Icon name="building" />مسؤول عن</dt>
                <dd>{extra.data.admins.map((a, i) => <span key={a.company_id}>{i > 0 && '، '}<Link to={`/admin/companies/${a.company_id}`}>{a.companies?.legal_name}</Link></span>)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="surface">
          <h2 className="surface-title"><Icon name="settings" />الإجراءات</h2>
          <div className="actions-list">
            <button type="button" onClick={() => setModal('grant')} disabled={!!busy}>
              <span className="al-icon al-icon--green"><Icon name="refresh" /></span>
              <span><strong>إضافة مدة عضوية</strong><small>سنة مجانية أو دفع خارج الموقع (فردية)</small></span>
            </button>
            <button type="button" onClick={() => setModal('service')} disabled={!!busy || status !== 'active'}>
              <span className="al-icon al-icon--gold"><Icon name="sparkle" /></span>
              <span><strong>تسجيل خدمة منفّذة</strong><small>{status === 'active' ? 'طلب وصل بالهاتف، يُخصم من الرصيد' : 'يحتاج عضوية سارية'}</small></span>
            </button>
            <button type="button" onClick={sendReset} disabled={!!busy}>
              <span className="al-icon">{busy === 'reset' ? <Spinner small /> : <Icon name="key" />}</span>
              <span><strong>رابط تعيين كلمة المرور</strong><small>يصل إلى بريد العضو</small></span>
            </button>
            <a href={`/v/${m.member_code}`} target="_blank" rel="noopener">
              <span className="al-icon"><Icon name="qr" /></span>
              <span><strong>صفحة التحقق</strong><small>كما يراها مقدّم الخدمة</small></span>
            </a>
            {m.is_active ? (
              <button type="button" className="is-danger" onClick={() => setActive(false)} disabled={!!busy}>
                <span className="al-icon al-icon--red">{busy === 'active' ? <Spinner small /> : <Icon name="lock" />}</span>
                <span><strong>إيقاف الحساب</strong><small>تتوقف البطاقة وطلب الخدمات</small></span>
              </button>
            ) : (
              <button type="button" onClick={() => setActive(true)} disabled={!!busy}>
                <span className="al-icon al-icon--green">{busy === 'active' ? <Spinner small /> : <Icon name="check" />}</span>
                <span><strong>إعادة التفعيل</strong><small>تعود البطاقة كما كانت</small></span>
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="surface">
        <div className="surface-head">
          <h2><Icon name="file" />ملاحظات الإدارة</h2>
          {extra.data?.noteAt && <span className="muted">آخر تعديل {formatDateTime(extra.data.noteAt)}</span>}
        </div>
        <TextArea label="ملاحظات لا يراها العضو" rows={3} value={note ?? ''} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
        <div className="tpl-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={saveNote} disabled={!noteDirty || busy === 'note'}>
            {busy === 'note' ? <Spinner small /> : <><Icon name="check" />حفظ الملاحظة</>}
          </button>
        </div>
      </section>

      <section className="surface">
        <div className="surface-head">
          <h2><Icon name="sparkle" />طلبات الخدمات</h2>
          <span className="muted">{extra.data?.requests.length ?? 0} طلب</span>
        </div>
        {extra.isLoading ? (
          <Skeleton rows={2} height={48} />
        ) : !extra.data?.requests.length ? (
          <EmptyState icon="sparkle">لم يطلب العضو أي خدمة بعد.</EmptyState>
        ) : (
          <div className="table-card table-card--flat">
            <table className="dtable">
              <thead><tr><th>الخدمة</th><th>الطريقة</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {extra.data.requests.map((r) => {
                  const st = REQUEST_STATUS[r.status ?? 'requested'];
                  return (
                    <tr key={r.id}>
                      <td className="cell-title"><span className="cell-strong">{r.service_title}</span>{r.note && <small className="cell-sub">{r.note}</small>}</td>
                      <td data-label="الطريقة">{r.channel === 'whatsapp' ? 'واتساب' : r.channel === 'email' ? 'بريد' : 'الإدارة'}</td>
                      <td data-label="التاريخ">{formatDateTime(r.created_at)}</td>
                      <td data-label="الحالة"><Badge tone={st.tone}>{st.label}</Badge>{r.done_by_name && <small className="cell-sub">{r.done_by_name}</small>}</td>
                      <td className="cell-actions">
                        {r.status === 'requested' ? (
                          <>
                            <button type="button" className="btn btn-xs btn-primary" disabled={!!busy} onClick={() => setRequest(r.id!, 'done')}>تم</button>
                            <button type="button" className="btn btn-xs btn-ghost" disabled={!!busy} onClick={() => setRequest(r.id!, 'cancelled')}>إلغاء</button>
                          </>
                        ) : (
                          <button type="button" className="btn btn-xs btn-ghost" disabled={!!busy} onClick={() => setRequest(r.id!, 'requested')}><Icon name="undo" />تراجع</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface">
        <div className="surface-head"><h2><Icon name="calendar" />العضويات</h2></div>
        {extra.isLoading ? (
          <Skeleton rows={2} height={48} />
        ) : !extra.data?.memberships.length ? (
          <EmptyState icon="card">لا توجد عضويات بعد.</EmptyState>
        ) : (
          <div className="table-card table-card--flat">
            <table className="dtable">
              <thead><tr><th>النوع</th><th>من</th><th>إلى</th><th>المصدر</th></tr></thead>
              <tbody>
                {extra.data.memberships.map((x) => (
                  <tr key={x.id}>
                    <td className="cell-title">
                      <span className="cell-strong">{x.kind === 'corporate' ? `شركة: ${x.contracts?.companies?.legal_name ?? ''}` : 'فردية'}</span>
                      {x.id === m.membership_id && <Badge tone="active">الحالية</Badge>}
                    </td>
                    <td data-label="من">{formatDate(x.starts_at)}</td>
                    <td data-label="إلى">{formatDate(x.expires_at)}</td>
                    <td data-label="المصدر">{x.kind === 'corporate' ? 'مقعد شركة' : x.order_id ? 'دفع' : 'من الإدارة'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface">
        <div className="surface-head"><h2><Icon name="receipt" />الطلبات والمدفوعات</h2></div>
        {extra.isLoading ? (
          <Skeleton rows={2} height={48} />
        ) : !extra.data?.orders.length ? (
          <EmptyState icon="receipt">لا توجد طلبات.</EmptyState>
        ) : (
          <div className="table-card table-card--flat">
            <table className="dtable">
              <thead><tr><th>الطلب</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {extra.data.orders.map((o) => {
                  const st = ORDER_STATUS[o.status ?? 'pending'];
                  return (
                    <tr key={o.id}>
                      <td className="cell-title">
                        <Link className="cell-strong mono" dir="ltr" to={`/admin/payments?q=${o.order_no}`}>{o.order_no}</Link>
                        <small className="cell-sub">{ORDER_TYPE[o.type ?? '']}{o.company_name ? ` · ${o.company_name}` : ''}{o.type !== 'individual' ? ` × ${o.quantity}` : ''}</small>
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

      <CampaignModal open={modal === 'email'} onClose={() => setModal(null)} target={{ ids: [m.id!], label: m.full_name ?? '', count: 1 }} />

      <Modal
        open={modal === 'grant'}
        icon="refresh"
        title="إضافة مدة عضوية فردية"
        lead="تُضاف بعد نهاية العضوية الفردية الحالية إن وُجدت، أو تبدأ من اليوم."
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={doGrant} disabled={busy === 'grant'}>{busy === 'grant' ? <Spinner small /> : <><Icon name="check" />إضافة</>}</button>
          </div>
        }
      >
        <div className="ui-form">
          <div className="presets" role="group" aria-label="مدد سريعة">
            {[30, 90, 180, 365].map((d) => (
              <button key={d} type="button" className={grant.days === String(d) ? 'preset is-on' : 'preset'} onClick={() => setGrant({ ...grant, days: String(d) })}>
                {d === 365 ? 'سنة' : `${d} يوم`}
              </button>
            ))}
          </div>
          <TextField label="عدد الأيام" icon="calendar" type="number" dir="ltr" inputMode="numeric" min={1} max={3650} value={grant.days} onChange={(e) => setGrant({ ...grant, days: e.target.value })} />
          <TextField label="السبب (يُحفظ في الملاحظات)" icon="file" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} placeholder="مثال: دفع نقدًا، أو تعويض" />
        </div>
      </Modal>

      <Modal
        open={modal === 'service'}
        icon="sparkle"
        title="تسجيل خدمة منفّذة"
        lead="لطلب وصل خارج الموقع (اتصال مثلًا). يُسجَّل «تم» على العضوية الحالية ويُخصم من الرصيد."
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={doService} disabled={busy === 'service'}>{busy === 'service' ? <Spinner small /> : <><Icon name="check" />تسجيل</>}</button>
          </div>
        }
      >
        <div className="ui-form">
          <SelectField label="الخدمة" icon="sparkle" value={service.id} onChange={(e) => setService({ ...service, id: e.target.value })}>
            <option value="">اختر الخدمة</option>
            {extra.data?.services.map((s) => <option key={s.id} value={s.id}>{s.title_ar}</option>)}
          </SelectField>
          <TextField label="ملاحظة (اختياري)" icon="file" value={service.note} onChange={(e) => setService({ ...service, note: e.target.value })} maxLength={500} />
        </div>
      </Modal>

      <Modal
        open={modal === 'edit'}
        wide
        icon="edit"
        title="تعديل بيانات العضو"
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy === 'edit'}>
              {busy === 'edit' ? <Spinner small /> : <><Icon name="check" />حفظ</>}
            </button>
          </div>
        }
      >
        {form && (
          <div className="ui-grid">
            <TextField label="الاسم" icon="user" full value={form.full_name} onChange={set('full_name')} />
            <TextField label="الجوال" icon="phone" dir="ltr" type="tel" value={form.phone} onChange={set('phone')} />
            <TextField label="المدينة" icon="pin" value={form.city} onChange={set('city')} />
            <SelectField label="لغة الرسائل" icon="globe" value={form.lang} onChange={set('lang')}>
              <option value="ar">العربية</option>
              <option value="en">الإنجليزية</option>
            </SelectField>
            <p className="ui-hint ui-field--full">البريد الإلكتروني يغيّره العضو من حسابه (يحتاج تأكيدًا من البريد الجديد).</p>
            <AnimatePresence>{formError && <div className="ui-field--full"><Alert tone="error">{formError}</Alert></div>}</AnimatePresence>
          </div>
        )}
      </Modal>
    </>
  );
}
