// Settings → Admins: who can open /admin. Invite by name + email (the person needs no account or
// membership: the email link lets them set a password and lands on /admin), resend a waiting invite,
// remove an admin (never yourself, never the last one). Server side: Edge Function admin-invite.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { Icon } from '../../components/Icon';
import { Alert, SelectField, TextField } from '../../components/Field';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { Badge } from '../../components/StatusBadge';
import { Modal, useConfirm } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { formatDate, formatTime } from '../../lib/format';

type AdminRow = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  invited_at: string | null;
  last_sign_in_at: string | null;
  pending: boolean;
  is_self: boolean;
};

type Answer = { status?: string; error?: string; full_name?: string; deleted?: boolean };

const ERRORS: Record<string, string> = {
  bad_email: 'البريد الإلكتروني غير صحيح.',
  bad_name: 'اكتب اسم الشخص (حرفان على الأقل).',
  forbidden: 'هذه الصفحة لمسؤولي النادي فقط.',
  already_active: 'صاحب هذا البريد فتح الدعوة من قبل. إن لم يكمل تعيين كلمة المرور فليستخدم «نسيت كلمة المرور» من صفحة الدخول.',
  rate_limited: 'أُرسلت رسالة لهذا البريد قبل قليل. انتظر دقيقة ثم أعد المحاولة.',
  cannot_remove_self: 'لا يمكنك إزالة نفسك. اطلب من مسؤول آخر ذلك.',
  last_admin: 'لا يمكن إزالة آخر مسؤول للنادي.',
  not_admin: 'هذا الحساب ليس مسؤولًا (ربما أُزيل للتو).',
};

async function call(body: Record<string, unknown>): Promise<Answer> {
  const { data, error } = await supabase.functions.invoke('admin-invite', { body });
  if (!error) return data as Answer;
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    const b = await ctx.json().catch(() => null);
    if (b?.error) return { error: b.error };
  }
  return { error: 'network' };
}

const errorText = (code?: string) => (code && ERRORS[code]) || 'تعذّر تنفيذ الطلب. حاول مرة أخرى.';

export function Admins() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', lang: 'ar' });
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_admins');
      if (error) throw error;
      return (data ?? []) as unknown as AdminRow[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'admins'] });

  const openInvite = () => {
    setForm({ full_name: '', email: '', lang: 'ar' });
    setFormError(null);
    setOpen(true);
  };

  const invite = async (promote = false) => {
    setFormError(null);
    setBusy('invite');
    const r = await call({ action: 'invite', ...form, promote });
    setBusy(null);
    if (r.status === 'exists') {
      const ok = await confirm({
        title: 'البريد مسجّل بالفعل',
        message: (
          <>
            يوجد حساب بهذا البريد{r.full_name ? <> باسم <b>{r.full_name}</b></> : null}. جعله مسؤولًا يعطيه لوحة الإدارة كاملة،
            ويُخفي عنه صفحات العضو (حسابي والبطاقة والخدمات). يدخل بكلمة مروره الحالية ولن تصله رسالة.
          </>
        ),
        confirm: 'اجعله مسؤولًا',
        icon: 'shield',
      });
      if (ok) return invite(true);
      return;
    }
    if (r.status === 'already_admin') return setFormError('هذا البريد لمسؤول بالفعل.');
    if (r.error) return setFormError(errorText(r.error));
    setOpen(false);
    toast(r.status === 'promoted' ? 'أصبح مسؤولًا. يدخل لوحة الإدارة بكلمة مروره.' : `أُرسلت الدعوة إلى ${form.email.trim()}.`);
    refresh();
  };

  const resend = async (a: AdminRow) => {
    setBusy(`resend:${a.id}`);
    const r = await call({ action: 'resend', user_id: a.id });
    setBusy(null);
    if (r.error) return toast(errorText(r.error), 'error');
    toast(`أُعيد إرسال الدعوة إلى ${a.email}.`);
    refresh();
  };

  const remove = async (a: AdminRow) => {
    const ok = await confirm({
      title: 'إزالة مسؤول',
      message: a.pending ? (
        <>تُلغى دعوة <b>{a.full_name || a.email}</b>، ولن يعمل رابطها.</>
      ) : (
        <>يفقد <b>{a.full_name || a.email}</b> الوصول إلى لوحة الإدارة فورًا، ويبقى حسابه حسابًا عاديًا في الموقع.</>
      ),
      confirm: a.pending ? 'إلغاء الدعوة' : 'إزالة',
      icon: 'trash',
      danger: true,
    });
    if (!ok) return;
    setBusy(`remove:${a.id}`);
    const r = await call({ action: 'remove', user_id: a.id });
    setBusy(null);
    if (r.error) return toast(errorText(r.error), 'error');
    toast(a.pending ? 'أُلغيت الدعوة.' : 'أُزيل من المسؤولين.');
    refresh();
  };

  const rows = list.data ?? [];
  const admins = rows.filter((a) => !a.pending).length;

  return (
    <motion.section className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="surface-head">
        <h2><Icon name="shield" />مسؤولو النادي</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openInvite}><Icon name="plus" />دعوة مسؤول</button>
      </div>
      <p className="ui-hint admins-lead">
        المسؤول يرى كل شيء في لوحة الإدارة ويعدّل الأسعار والمحتوى. الدعوة تصل بالبريد، ولا يحتاج الشخص حسابًا أو عضوية من قبل.
      </p>

      {list.isLoading ? (
        <Skeleton rows={3} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل المسؤولين." onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="users">لا يوجد مسؤولون.</EmptyState>
      ) : (
        <div className="table-card table-card--flat">
          <table className="dtable admins-table">
            <thead><tr><th>المسؤول</th><th>الحالة</th><th>أُضيف</th><th>آخر دخول</th><th></th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="cell-title">
                    <span className="cell-strong">{a.full_name || '—'}{a.is_self && <span className="muted"> (أنت)</span>}</span>
                    <small className="cell-sub" dir="ltr">{a.email}</small>
                  </td>
                  <td data-label="الحالة">
                    {a.pending ? <Badge tone="gold">بانتظار قبول الدعوة</Badge> : <Badge tone="active">مفعّل</Badge>}
                    {a.pending && a.invited_at && <small className="cell-sub cell-when">أُرسلت {formatDate(a.invited_at)}</small>}
                  </td>
                  <td data-label="أُضيف" className="cell-when">{formatDate(a.created_at)}</td>
                  <td data-label="آخر دخول" className="cell-when">
                    {!a.pending && a.last_sign_in_at ? (
                      <>
                        {formatDate(a.last_sign_in_at)}
                        <small className="cell-sub">{formatTime(a.last_sign_in_at)}</small>
                      </>
                    ) : '—'}
                  </td>
                  <td className="cell-actions">
                    {a.pending && (
                      <button type="button" className="btn btn-xs btn-ghost" disabled={!!busy} onClick={() => resend(a)}>
                        {busy === `resend:${a.id}` ? <Spinner small /> : <><Icon name="send" />إعادة الإرسال</>}
                      </button>
                    )}
                    {!a.is_self && (a.pending || admins > 1) && (
                      <button type="button" className="btn btn-xs btn-ghost btn-danger-text" disabled={!!busy} onClick={() => remove(a)}>
                        {busy === `remove:${a.id}` ? <Spinner small /> : <><Icon name="trash" />{a.pending ? 'إلغاء الدعوة' : 'إزالة'}</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        icon="shield"
        title="دعوة مسؤول"
        lead="تصله رسالة فيها رابط، يختار منه كلمة مرور ويدخل لوحة الإدارة مباشرة."
        onClose={() => setOpen(false)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={() => invite()} disabled={busy === 'invite'}>
              {busy === 'invite' ? <Spinner small /> : <><Icon name="send" />إرسال الدعوة</>}
            </button>
          </div>
        }
      >
        <form className="ui-grid" onSubmit={(e) => { e.preventDefault(); invite(); }} noValidate>
          <TextField label="الاسم" icon="user" full value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="off" />
          <TextField label="البريد الإلكتروني" icon="mail" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          <SelectField label="لغة الرسالة" icon="globe" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </SelectField>
          <button type="submit" hidden />
        </form>
        {formError && <Alert tone="error">{formError}</Alert>}
      </Modal>
    </motion.section>
  );
}
