// Service requests log (mark done = uses the member's yearly quota) and the services themselves
// (what members see in "My services": texts, contact, yearly limit).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle, Pager, StatCard } from './AdminLayout';
import { adminError, REQUEST_STATUS } from './shared';
import { Icon } from '../../components/Icon';
import { Tabs } from '../../components/Tabs';
import { Dropdown } from '../../components/Dropdown';
import { Modal } from '../../components/Modal';
import { Checkbox, TextArea, TextField } from '../../components/Field';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/format';
import type { Tables } from '../../types/database';

type Service = Tables<'admin_services'>;
const PAGE = 50;
const CHANNEL: Record<string, string> = { whatsapp: 'واتساب', email: 'بريد', admin: 'الإدارة' };

export default function Services() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'services' ? 'services' : 'requests';
  const services = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_services').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <AdminTitle title="الخدمات" lead="طلبات الأعضاء، وما يظهر لهم في «خدماتي». الطلب المعلَّم «تم» يُخصم من رصيد العضو السنوي." />
      {services.data && (
        <div className="stats stats--3">
          {services.data.map((s) => (
            <StatCard key={s.id} icon={s.icon === 'passport' ? 'passport' : s.icon === 'roadside' ? 'roadside' : s.icon === 'legal' ? 'legal' : 'sparkle'} tone={s.requests_open ? 'gold' : 'olive'} label={s.title_ar ?? ''} value={s.requests_open ?? 0} foot={`طلب جديد · ${s.requests_30d ?? 0} خلال 30 يومًا`} />
          ))}
        </div>
      )}
      <div className="settings-tabs">
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'services' ? { tab: 'services' } : {}, { replace: true })}
          tabs={[
            { value: 'requests', label: 'سجل الطلبات', icon: 'list' },
            { value: 'services', label: 'تعديل الخدمات', icon: 'edit' },
          ]}
        />
      </div>
      {services.isError ? (
        <ErrorState message="تعذّر تحميل الخدمات." onRetry={() => services.refetch()} />
      ) : tab === 'requests' ? (
        <Requests services={services.data ?? []} />
      ) : !services.data ? (
        <Skeleton rows={3} height={90} />
      ) : (
        <ServiceEditor services={services.data} />
      )}
    </>
  );
}

function Requests({ services }: { services: Service[] }) {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const status = params.get('status') ?? '';
  const service = params.get('service') ?? '';
  const page = Number(params.get('page') ?? 0);
  const [busy, setBusy] = useState<string | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const list = useQuery({
    queryKey: ['admin', 'requests', status, service, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('admin_service_requests').select('*', { count: 'exact' });
      if (status) q = q.eq('status', status);
      if (service) q = q.eq('service_id', service);
      const { data, error, count } = await q.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const set = async (id: string, next: 'done' | 'cancelled' | 'requested') => {
    setBusy(id);
    const { error } = await supabase.rpc('admin_set_request', { p_request: id, p_status: next });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast(next === 'done' ? 'عُلّم الطلب «تم».' : next === 'cancelled' ? 'أُلغي الطلب.' : 'أُعيد الطلب إلى «جديد».');
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const rows = list.data?.rows ?? [];
  return (
    <>
      <div className="toolbar">
        <Dropdown
          label="الحالة"
          icon="filter"
          placeholder="كل الحالات"
          value={status}
          onChange={(v) => setParam('status', v)}
          options={[{ value: '', label: 'كل الحالات' }, ...Object.entries(REQUEST_STATUS).map(([value, s]) => ({ value, label: s.label }))]}
        />
        <Dropdown
          label="الخدمة"
          icon="sparkle"
          placeholder="كل الخدمات"
          value={service}
          onChange={(v) => setParam('service', v)}
          options={[{ value: '', label: 'كل الخدمات' }, ...services.map((s) => ({ value: s.id!, label: s.title_ar ?? '' }))]}
        />
      </div>
      {list.isLoading ? (
        <Skeleton rows={5} height={58} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الطلبات." onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <div className="surface"><EmptyState icon="sparkle" title="لا توجد طلبات">تظهر هنا كل ضغطة على زر طلب خدمة من حساب العضو.</EmptyState></div>
      ) : (
        <div className="table-card">
          <table className="dtable">
            <thead>
              <tr><th>العضو</th><th>الخدمة</th><th>التاريخ</th><th>الحالة</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = REQUEST_STATUS[r.status ?? 'requested'];
                return (
                  <tr key={r.id}>
                    <td className="cell-title">
                      <Link className="cell-strong" to={`/admin/members/${r.member_id}`}>{r.member_name}</Link>
                      <small className="cell-sub" dir="ltr">{[r.member_label, r.member_phone].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td data-label="الخدمة">{r.service_title}<small className="cell-sub">{CHANNEL[r.channel ?? ''] ?? r.channel}{r.note ? ` · ${r.note}` : ''}</small></td>
                    <td data-label="التاريخ">{formatDateTime(r.created_at)}</td>
                    <td data-label="الحالة"><Badge tone={st.tone}>{st.label}</Badge>{r.done_by_name && <small className="cell-sub">{r.done_by_name}</small>}</td>
                    <td className="cell-actions">
                      {busy === r.id ? (
                        <Spinner small />
                      ) : r.status === 'requested' ? (
                        <>
                          <button type="button" className="btn btn-xs btn-primary" onClick={() => set(r.id!, 'done')}>تم</button>
                          <button type="button" className="btn btn-xs btn-ghost" onClick={() => set(r.id!, 'cancelled')}>إلغاء</button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => set(r.id!, 'requested')}><Icon name="undo" />تراجع</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE} total={list.data?.count ?? 0} onPage={(p) => setParam('page', String(p))} />
        </div>
      )}
    </>
  );
}

type Form = {
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  features_ar: string;
  features_en: string;
  how_ar: string;
  how_en: string;
  message_ar: string;
  message_en: string;
  annual_quota: string;
  quota_label_ar: string;
  quota_label_en: string;
  email: string;
  whatsapp: string;
  ask_location: boolean;
  is_published: boolean;
};

const toForm = (s: Service): Form => ({
  title_ar: s.title_ar ?? '',
  title_en: s.title_en ?? '',
  summary_ar: s.summary_ar ?? '',
  summary_en: s.summary_en ?? '',
  features_ar: (s.features_ar ?? []).join('\n'),
  features_en: (s.features_en ?? []).join('\n'),
  how_ar: s.how_ar ?? '',
  how_en: s.how_en ?? '',
  message_ar: s.message_ar ?? '',
  message_en: s.message_en ?? '',
  annual_quota: s.annual_quota ? String(s.annual_quota) : '',
  quota_label_ar: s.quota_label_ar ?? '',
  quota_label_en: s.quota_label_en ?? '',
  email: s.email ?? '',
  whatsapp: s.whatsapp ?? '',
  ask_location: !!s.ask_location,
  is_published: !!s.is_published,
});

function ServiceEditor({ services }: { services: Service[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState<Service | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(edit ? toForm(edit) : null), [edit]);

  const save = async () => {
    if (!edit || !form) return;
    const quota = form.annual_quota.trim() ? Number(form.annual_quota) : null;
    if (quota !== null && (!Number.isInteger(quota) || quota < 1 || quota > 1000)) return toast('الحد السنوي رقم من 1 إلى 1000، أو اتركه فارغًا لغير محدود.', 'error');
    if (form.title_ar.trim().length < 2) return toast('اكتب اسم الخدمة.', 'error');
    const wa = form.whatsapp.replace(/[^\d]/g, '').replace(/^0+/, '');
    if (wa && !/^[1-9]\d{9,14}$/.test(wa)) return toast('رقم واتساب بالصيغة الدولية بدون + (مثال 9665xxxxxxxx).', 'error');
    if (!wa && !form.email.trim()) return toast('حدد واتساب أو بريدًا لاستقبال الطلبات.', 'error');
    const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12);
    setBusy(true);
    const { error } = await supabase
      .from('services')
      .update({
        title_ar: form.title_ar.trim(),
        title_en: form.title_en.trim(),
        summary_ar: form.summary_ar.trim(),
        summary_en: form.summary_en.trim(),
        features_ar: lines(form.features_ar),
        features_en: lines(form.features_en),
        how_ar: form.how_ar.trim(),
        how_en: form.how_en.trim(),
        message_ar: form.message_ar.trim(),
        message_en: form.message_en.trim(),
        annual_quota: quota,
        quota_label_ar: form.quota_label_ar.trim(),
        quota_label_en: form.quota_label_en.trim(),
        email: form.email.trim() || null,
        whatsapp: wa || null,
        ask_location: form.ask_location,
        is_published: form.is_published,
      })
      .eq('id', edit.id!);
    setBusy(false);
    if (error) return toast('تعذّر الحفظ. راجع طول النصوص والبريد.', 'error');
    toast(`حُفظت خدمة «${form.title_ar}».`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    setEdit(null);
  };

  const f = form;
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((x) => (x ? { ...x, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value } : x));

  return (
    <>
      <div className="cards">
        {services.map((s) => (
          <article key={s.id} className="pcard">
            <div className="pcard-head">
              <span className="pcard-icon"><Icon name={s.icon === 'passport' ? 'passport' : s.icon === 'roadside' ? 'roadside' : s.icon === 'legal' ? 'legal' : 'sparkle'} /></span>
              <div>
                <h3>{s.title_ar}</h3>
                <small dir="ltr">{s.title_en}</small>
              </div>
            </div>
            <p>{s.summary_ar}</p>
            <div className="pcard-tags">
              <Badge tone={s.is_published ? 'active' : 'neutral'}>{s.is_published ? 'ظاهرة' : 'مخفية'}</Badge>
              <Badge tone="gold">{s.annual_quota ? `${s.annual_quota} ${s.quota_label_ar || 'طلب'} سنويًا` : 'بدون حد سنوي'}</Badge>
              <Badge>{s.whatsapp ? 'واتساب' : 'بريد'}</Badge>
            </div>
            <div className="pcard-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}><Icon name="edit" />تعديل</button>
            </div>
          </article>
        ))}
      </div>
      <p className="ui-hint">صفحة «الخدمات» في الموقع العام نص ثابت؛ هذه الإعدادات لما يراه العضو في حسابه ولأزرار الطلب.</p>

      <Modal
        open={!!edit}
        wide
        icon="edit"
        title={`تعديل: ${edit?.title_ar ?? ''}`}
        onClose={() => setEdit(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}</button>
          </div>
        }
      >
        {f && (
          <div className="ui-grid">
            <TextField label="الاسم بالعربي" icon="sparkle" value={f.title_ar} onChange={set('title_ar')} maxLength={80} />
            <TextField label="الاسم بالإنجليزي" icon="globe" dir="ltr" value={f.title_en} onChange={set('title_en')} maxLength={80} />
            <TextArea label="الوصف بالعربي" rows={3} value={f.summary_ar} onChange={set('summary_ar')} maxLength={600} />
            <TextArea label="الوصف بالإنجليزي" rows={3} dir="ltr" value={f.summary_en} onChange={set('summary_en')} maxLength={600} />
            <TextArea label="ما تشمله (سطر لكل بند)" rows={4} value={f.features_ar} onChange={set('features_ar')} />
            <TextArea label="What's included (one per line)" rows={4} dir="ltr" value={f.features_en} onChange={set('features_en')} />
            <TextArea label="طريقة الطلب" rows={3} value={f.how_ar} onChange={set('how_ar')} maxLength={600} />
            <TextArea label="How to request" rows={3} dir="ltr" value={f.how_en} onChange={set('how_en')} maxLength={600} />
            <TextArea label="الرسالة الجاهزة (بعد الاسم ورقم العضوية)" rows={3} value={f.message_ar} onChange={set('message_ar')} maxLength={500} />
            <TextArea label="Ready message" rows={3} dir="ltr" value={f.message_en} onChange={set('message_en')} maxLength={500} />
            <TextField label="الحد السنوي لكل عضوية" icon="hash" type="number" dir="ltr" min={1} max={1000} inputMode="numeric" value={f.annual_quota} onChange={set('annual_quota')} hint="فارغ = بدون حد" />
            <TextField label="وحدة الحد (عربي / English)" value={f.quota_label_ar} onChange={set('quota_label_ar')} placeholder="استشارة" maxLength={60} />
            <TextField label="Quota unit" dir="ltr" value={f.quota_label_en} onChange={set('quota_label_en')} placeholder="consultation" maxLength={60} />
            <span />
            <TextField label="واتساب الطلبات" icon="whatsapp" dir="ltr" inputMode="numeric" value={f.whatsapp} onChange={set('whatsapp')} placeholder="9665xxxxxxxx" hint="إن وُجد، يفتح الطلب واتساب؛ وإلا البريد." />
            <TextField label="بريد الطلبات" icon="mail" type="email" dir="ltr" value={f.email} onChange={set('email')} />
            <Checkbox checked={f.ask_location} onChange={set('ask_location')}>يطلب موقع العضو مع الرسالة (المساعدة على الطريق)</Checkbox>
            <Checkbox checked={f.is_published} onChange={set('is_published')}>ظاهرة للأعضاء</Checkbox>
          </div>
        )}
      </Modal>
    </>
  );
}
