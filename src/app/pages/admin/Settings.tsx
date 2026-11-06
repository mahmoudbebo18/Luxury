// Prices and company tiers, reminders, seller details for receipts, sender, and the automatic email
// templates (Arabic + English). Price changes also rebuild the public pages (publish-site).
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { sar } from './shared';
import { publishSite } from './Content';
import { Icon } from '../../components/Icon';
import { Tabs } from '../../components/Tabs';
import { Checkbox, TextArea, TextField } from '../../components/Field';
import { ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/Modal';
import type { Tables } from '../../types/database';
import { emailKind, kindOrder } from '../../lib/emailKinds';
import { PRICING_KEY } from '../../lib/pricing';
import { Admins } from './Admins';

type Settings = Tables<'app_settings'>;
type Template = Tables<'email_templates'>;
type Tier = { min: number; discount: number };
type Tab = 'pricing' | 'seller' | 'templates' | 'sender' | 'admins';
const TABS: Tab[] = ['pricing', 'seller', 'templates', 'sender', 'admins'];

const VARS: { key: string; label: string; sample: string; only?: string[] }[] = [
  { key: 'name', label: 'الاسم', sample: 'عبدالله الراشد' },
  { key: 'member_no', label: 'رقم العضوية', sample: 'LC-00128' },
  { key: 'expires_at', label: 'تاريخ الانتهاء', sample: '6 نوفمبر 2027' },
  { key: 'account_url', label: 'رابط الحساب', sample: 'https://the-luxury-club.com/account' },
  { key: 'checkout_url', label: 'رابط الدفع', sample: 'https://the-luxury-club.com/checkout' },
  { key: 'company_url', label: 'لوحة الشركة', sample: 'https://the-luxury-club.com/company' },
  { key: 'days', label: 'الأيام المتبقية', sample: '7', only: ['renewal_reminder', 'company_renewal'] },
  { key: 'company', label: 'الشركة', sample: 'شركة نجد القابضة', only: ['company_renewal', 'invite', 'seat_activated', 'seat_released', 'admin_quote', 'payment_link'] },
  { key: 'seats', label: 'عدد المقاعد', sample: '25', only: ['company_renewal'] },
  { key: 'invite_url', label: 'رابط الدعوة', sample: 'https://the-luxury-club.com/join/…', only: ['invite'] },
  { key: 'inviter', label: 'الداعي', sample: 'سارة العتيبي', only: ['invite'] },
  { key: 'order_no', label: 'رقم الطلب', sample: 'LC-2026-00042', only: ['payment_receipt', 'admin_payment', 'admin_quote', 'payment_link'] },
  { key: 'order_type_label', label: 'نوع الطلب', sample: 'عضوية فردية', only: ['payment_receipt', 'admin_payment', 'payment_link'] },
  { key: 'quantity', label: 'العدد', sample: '1', only: ['payment_receipt', 'admin_payment', 'admin_quote', 'payment_link'] },
  { key: 'total', label: 'الإجمالي', sample: '699', only: ['payment_receipt', 'admin_payment', 'admin_quote', 'payment_link'] },
  { key: 'subtotal', label: 'قبل الضريبة', sample: '607.83', only: ['payment_receipt'] },
  { key: 'vat_amount', label: 'الضريبة', sample: '91.17', only: ['payment_receipt'] },
  { key: 'payment_url', label: 'رابط ماي فاتورة', sample: 'https://…myfatoorah.com/…', only: ['payment_link'] },
  { key: 'method', label: 'طريقة الدفع', sample: 'myfatoorah', only: ['admin_payment'] },
  { key: 'contact', label: 'المسؤول', sample: 'سارة العتيبي', only: ['admin_quote'] },
  { key: 'phone', label: 'الجوال', sample: '0551234567', only: ['admin_quote'] },
  { key: 'email', label: 'البريد', sample: 'sara@najd.sa', only: ['admin_quote'] },
  { key: 'admin_url', label: 'لوحة الإدارة', sample: 'https://the-luxury-club.com/admin', only: ['admin_payment', 'admin_quote'] },
];
const fillSample = (html: string) => VARS.reduce((s, v) => s.replaceAll(`{{${v.key}}}`, v.sample), html);

export default function SettingsPage() {
  // ?tab=admins opens a tab directly (links from elsewhere in the panel)
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab') as Tab | null;
  const tab: Tab = fromUrl && TABS.includes(fromUrl) ? fromUrl : 'pricing';
  const setTab = (next: Tab) => setParams(next === 'pricing' ? {} : { tab: next }, { replace: true });
  const data = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const [settings, tpl] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', 1).single(),
        supabase.from('email_templates').select('*').order('kind'),
      ]);
      if (settings.error) throw settings.error;
      if (tpl.error) throw tpl.error;
      return { settings: settings.data, templates: [...tpl.data].sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind)) };
    },
  });

  return (
    <>
      <AdminTitle title="الإعدادات" lead="السعر وشرائح الشركات، وبيانات الإيصال، والمرسل، وقوالب الرسائل التلقائية، ومسؤولو النادي." />
      <div className="settings-tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pricing', label: 'الأسعار', icon: 'wallet' },
            { value: 'seller', label: 'الإيصال والتحويل', icon: 'receipt' },
            { value: 'templates', label: 'قوالب الرسائل', icon: 'file' },
            { value: 'sender', label: 'المرسل', icon: 'mail' },
            { value: 'admins', label: 'المسؤولين', icon: 'shield' },
          ]}
        />
      </div>
      {tab === 'admins' ? (
        <Admins />
      ) : data.isLoading ? (
        <Skeleton rows={3} height={90} />
      ) : data.isError || !data.data ? (
        <ErrorState message="تعذّر تحميل الإعدادات." onRetry={() => data.refetch()} />
      ) : tab === 'pricing' ? (
        <Pricing settings={data.data.settings} />
      ) : tab === 'seller' ? (
        <Seller settings={data.data.settings} />
      ) : tab === 'templates' ? (
        <Templates initial={data.data.templates} />
      ) : (
        <Sender settings={data.data.settings} />
      )}
    </>
  );
}

function useSave() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const save = async (patch: Partial<Settings>, ok: string) => {
    setBusy(true);
    const { error } = await supabase.from('app_settings').update(patch).eq('id', 1);
    setBusy(false);
    if (error) {
      toast('تعذّر الحفظ. راجع القيم.', 'error');
      return false;
    }
    toast(ok);
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: PRICING_KEY });
    return true;
  };
  return { busy, save };
}

function Pricing({ settings }: { settings: Settings }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { busy, save } = useSave();
  const initialTiers = (settings.company_tiers as Tier[] | null) ?? [{ min: 1, discount: 0 }];
  const [f, setF] = useState({
    price: String(settings.price_individual),
    vat: String(Math.round(Number(settings.vat_rate) * 10000) / 100),
    min: String(settings.company_min_seats),
    max: String(settings.company_online_max),
    reminders: settings.renewal_reminder_days.join('، '),
  });
  const [tiers, setTiers] = useState(initialTiers.map((t) => ({ min: String(t.min), discount: String(t.discount) })));

  const price = Number(f.price);
  const vat = Number(f.vat);
  const days = f.reminders.split(/[,،\s]+/).filter(Boolean).map(Number);
  const parsedTiers = tiers.map((t) => ({ min: Number(t.min), discount: Number(t.discount) }));
  const valid =
    price > 0 && vat >= 0 && vat <= 100 &&
    Number.isInteger(Number(f.min)) && Number(f.min) >= 1 &&
    Number.isInteger(Number(f.max)) && Number(f.max) >= 1 &&
    days.length > 0 && days.every((d) => Number.isInteger(d) && d >= 1 && d <= 365) &&
    parsedTiers.every((t) => Number.isInteger(t.min) && t.min >= 1 && t.discount >= 0 && t.discount < 100);

  const priceChanged = price !== Number(settings.price_individual) || vat / 100 !== Number(settings.vat_rate);

  const submit = async () => {
    if (!valid) return toast('راجع القيم: أرقام صحيحة، والخصم أقل من 100%.', 'error');
    if (priceChanged && !(await confirm({ title: 'تغيير السعر', message: <>السعر الجديد <b>{sar(price)} ريال</b> شامل ضريبة {vat}%. يسري على الطلبات الجديدة فقط، وتُحدَّث صفحات الموقع خلال دقائق.</>, confirm: 'حفظ السعر', icon: 'wallet' }))) return;
    const sorted = [...parsedTiers].sort((a, b) => a.min - b.min);
    if (!sorted.length || sorted[0].min !== 1) sorted.unshift({ min: 1, discount: 0 });
    const ok = await save(
      {
        price_individual: price,
        vat_rate: Math.round(vat * 100) / 10000,
        company_min_seats: Number(f.min),
        company_online_max: Number(f.max),
        company_tiers: sorted,
        renewal_reminder_days: [...new Set(days)].sort((a, b) => b - a),
      },
      'حُفظت إعدادات الأسعار.',
    );
    if (ok) {
      setTiers(sorted.map((t) => ({ min: String(t.min), discount: String(t.discount) })));
      const res = await publishSite();
      if (res === 'not_configured') toast('الأسعار في صفحات الموقع تتحدث مع البناء القادم (رابط البناء التلقائي غير مضبوط بعد).', 'error');
    }
  };

  const sub = price > 0 ? Math.round((price / (1 + vat / 100)) * 100) / 100 : 0;
  return (
    <motion.section className="surface sender" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="surface-title"><Icon name="wallet" />السعر</h2>
      <div className="ui-grid">
        <TextField label="سعر العضوية السنوية (شامل الضريبة)" icon="wallet" type="number" dir="ltr" min={1} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} hint={price > 0 ? `${sar(sub)} + ضريبة ${sar(Math.round((price - sub) * 100) / 100)}` : undefined} />
        <TextField label="ضريبة القيمة المضافة %" icon="receipt" type="number" dir="ltr" min={0} max={100} step="0.01" value={f.vat} onChange={(e) => setF({ ...f, vat: e.target.value })} />
      </div>

      <h2 className="surface-title"><Icon name="building" />الشركات</h2>
      <div className="ui-grid">
        <TextField label="أقل عدد عضويات لشركة" icon="users" type="number" dir="ltr" min={1} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
        <TextField label="أقصى عدد للدفع المباشر" icon="bolt" type="number" dir="ltr" min={1} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} hint="فوقه يصبح الطلب «عرض سعر» تتابعه الإدارة." />
      </div>
      <div className="ui-field">
        <span className="ui-label">شرائح الخصم حسب العدد</span>
        <div className="tiers">
          {tiers.map((t, i) => (
            <div className="tier-row" key={i}>
              <span>من</span>
              <input className="ui-input" type="number" dir="ltr" min={1} value={t.min} disabled={i === 0} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} aria-label="من عدد" />
              <span>عضوية فأكثر: خصم</span>
              <input className="ui-input" type="number" dir="ltr" min={0} max={99} step="0.5" value={t.discount} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, discount: e.target.value } : x)))} aria-label="نسبة الخصم" />
              <span>%</span>
              <span className="tier-price">= {sar(Math.round(price * (1 - (Number(t.discount) || 0) / 100) * 100) / 100)} ريال</span>
              {i > 0 && (
                <button type="button" className="ui-icon-btn" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="حذف الشريحة"><Icon name="trash" /></button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setTiers([...tiers, { min: String(Math.max(...tiers.map((t) => Number(t.min) || 1)) + 25), discount: '5' }])}>
            <Icon name="plus" />
            شريحة
          </button>
        </div>
        <p className="ui-hint">الخصم يُحسب على كل العضويات حسب العدد الكلي، ويظهر في حاسبة صفحة الشركات.</p>
      </div>

      <h2 className="surface-title"><Icon name="bell" />تذكير التجديد</h2>
      <TextField label="قبل انتهاء العضوية الفردية بـ (أيام)" icon="calendar" dir="ltr" value={f.reminders} onChange={(e) => setF({ ...f, reminders: e.target.value })} hint="أكثر من رقم بفاصلة، مثال: 30، 7، 1" />

      <div className="tpl-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
          {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
        </button>
      </div>
    </motion.section>
  );
}

function Seller({ settings }: { settings: Settings }) {
  const { busy, save } = useSave();
  const [f, setF] = useState({
    seller_name: settings.seller_name,
    seller_cr: settings.seller_cr,
    seller_vat: settings.seller_vat,
    seller_address: settings.seller_address,
    bank_transfer: settings.bank_transfer,
    bank_details: settings.bank_details,
  });
  const changed = (Object.keys(f) as (keyof typeof f)[]).some((k) => f[k] !== settings[k]);
  return (
    <motion.section className="surface sender" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="surface-title"><Icon name="receipt" />بيانات البائع على الإيصال</h2>
      <div className="ui-grid">
        <TextField label="اسم المنشأة" icon="building" full value={f.seller_name} onChange={(e) => setF({ ...f, seller_name: e.target.value })} />
        <TextField label="السجل التجاري" icon="hash" dir="ltr" value={f.seller_cr} onChange={(e) => setF({ ...f, seller_cr: e.target.value })} />
        <TextField label="الرقم الضريبي" icon="receipt" dir="ltr" value={f.seller_vat} onChange={(e) => setF({ ...f, seller_vat: e.target.value })} />
        <TextField label="العنوان" icon="pin" full value={f.seller_address} onChange={(e) => setF({ ...f, seller_address: e.target.value })} />
      </div>
      <h2 className="surface-title"><Icon name="wallet" />التحويل البنكي للشركات</h2>
      <Checkbox checked={f.bank_transfer} onChange={(e) => setF({ ...f, bank_transfer: e.target.checked })}>إتاحة التحويل البنكي للشركات</Checkbox>
      <TextArea label="بيانات الحساب" rows={4} value={f.bank_details} onChange={(e) => setF({ ...f, bank_details: e.target.value })} placeholder={'اسم البنك:\nاسم المستفيد:\nIBAN:'} />
      <div className="tpl-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => save(f, 'حُفظت بيانات الإيصال والتحويل.')} disabled={busy || !changed}>
          {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
        </button>
      </div>
    </motion.section>
  );
}

function Sender({ settings }: { settings: Settings }) {
  const toast = useToast();
  const { busy, save } = useSave();
  const [f, setF] = useState({ sender_name: settings.sender_name, reply_to: settings.reply_to, notify_email: settings.notify_email });
  const changed = f.sender_name !== settings.sender_name || f.reply_to !== settings.reply_to || f.notify_email !== settings.notify_email;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const submit = () => {
    if (!f.sender_name.trim()) return toast('اكتب اسم المرسل.', 'error');
    if (!email.test(f.reply_to.trim())) return toast('بريد «الرد على» غير صحيح.', 'error');
    if (!email.test(f.notify_email.trim())) return toast('بريد تنبيهات الإدارة غير صحيح.', 'error');
    save({ sender_name: f.sender_name.trim(), reply_to: f.reply_to.trim(), notify_email: f.notify_email.trim().toLowerCase() }, 'حُفظت بيانات المرسل.');
  };
  return (
    <motion.section className="surface sender" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="surface-title"><Icon name="mail" />المرسل</h2>
      <div className="ui-grid">
        <TextField label="اسم المرسل" icon="user" value={f.sender_name} onChange={(e) => setF({ ...f, sender_name: e.target.value })} hint="يظهر للأعضاء في صندوق الوارد." />
        <TextField label="الرد على" icon="send" type="email" dir="ltr" value={f.reply_to} onChange={(e) => setF({ ...f, reply_to: e.target.value })} />
        <TextField label="بريد الإرسال" icon="lock" full dir="ltr" value={settings.sender_email} disabled readOnly hint="موثّق في Brevo على دومين الموقع." />
        <TextField label="بريد تنبيهات الإدارة" icon="bell" full type="email" dir="ltr" value={f.notify_email} onChange={(e) => setF({ ...f, notify_email: e.target.value })} hint="يصله بريد مع كل دفعة وكل طلب عرض سعر." />
      </div>
      <div className="tpl-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !changed}>
          {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
        </button>
      </div>
    </motion.section>
  );
}

function Templates({ initial }: { initial: Template[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [list, setList] = useState(initial);
  const [current, setCurrent] = useState(initial[0]?.kind ?? '');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setList(initial), [initial]);

  const tpl = list.find((t) => t.kind === current);
  const saved = initial.find((t) => t.kind === current);
  const dirty = (t: Template) => {
    const s = initial.find((x) => x.kind === t.kind);
    return !!s && (s.subject !== t.subject || s.body_html !== t.body_html || s.subject_en !== t.subject_en || s.body_html_en !== t.body_html_en);
  };
  const subjectKey = lang === 'ar' ? 'subject' : 'subject_en';
  const bodyKey = lang === 'ar' ? 'body_html' : 'body_html_en';
  const edit = (patch: Partial<Template>) => setList((l) => l.map((t) => (t.kind === current ? { ...t, ...patch } : t)));

  const pick = async (kind: string) => {
    if (kind === current) return;
    if (tpl && dirty(tpl) && !(await confirm({ title: 'تغييرات غير محفوظة', message: `لم تحفظ تعديلات «${tpl.label}». هل تريد المتابعة بدون حفظ؟`, confirm: 'متابعة بدون حفظ', cancel: 'البقاء' }))) return;
    if (tpl && dirty(tpl)) setList((l) => l.map((t) => (t.kind === current && saved ? saved : t)));
    setCurrent(kind);
  };

  const insert = (key: string) => {
    const el = area.current;
    if (!el || !tpl) return;
    const token = `{{${key}}}`;
    const body = tpl[bodyKey];
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? start;
    edit({ [bodyKey]: body.slice(0, start) + token + body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (!tpl) return;
    setBusy(true);
    const { error } = await supabase
      .from('email_templates')
      .update({ subject: tpl.subject, body_html: tpl.body_html, subject_en: tpl.subject_en, body_html_en: tpl.body_html_en, updated_at: new Date().toISOString() })
      .eq('kind', tpl.kind);
    setBusy(false);
    if (error) return toast('تعذّر حفظ القالب.', 'error');
    toast(`تم حفظ قالب «${tpl.label}».`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
  };

  const k = tpl ? emailKind(tpl.kind) : null;
  return (
    <div className="tpl">
      <nav className="tpl-list" aria-label="القوالب">
        {list.map((t) => (
          <button key={t.kind} type="button" className={t.kind === current ? 'tpl-item is-active' : 'tpl-item'} onClick={() => pick(t.kind)}>
            <span className="tpl-item-icon"><Icon name={emailKind(t.kind).icon} /></span>
            <span className="tpl-item-body">
              <strong>{t.label}{dirty(t) && <i className="dot" aria-label="غير محفوظ" />}</strong>
              <small>{emailKind(t.kind).when}</small>
            </span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        {tpl && k && (
          <motion.section key={tpl.kind} className="surface tpl-editor" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
            <div className="surface-head">
              <h2><Icon name={k.icon} />{tpl.label}</h2>
              <Tabs value={view} onChange={setView} tabs={[{ value: 'edit', label: 'تعديل', icon: 'edit' }, { value: 'preview', label: 'معاينة', icon: 'eye' }]} />
            </div>
            {!k.toAdmin && (
              <Tabs value={lang} onChange={setLang} label="لغة القالب" tabs={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
            )}

            {view === 'edit' ? (
              <div className="ui-form">
                <TextField label={lang === 'ar' ? 'عنوان الرسالة' : 'Subject'} icon="file" dir={lang === 'ar' ? 'rtl' : 'ltr'} value={tpl[subjectKey]} onChange={(e) => edit({ [subjectKey]: e.target.value })} />
                <div className="ui-field">
                  <label className="ui-label" htmlFor="tplBody">المحتوى (HTML)</label>
                  <textarea id="tplBody" ref={area} className="ui-input ui-textarea code-area" rows={12} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={tpl[bodyKey]} onChange={(e) => edit({ [bodyKey]: e.target.value })} />
                  {lang === 'en' && !tpl.body_html_en.trim() && <p className="ui-hint">فارغ = يصل العضو الذي اختار الإنجليزية النص العربي.</p>}
                  <div className="var-chips">
                    <span>إدراج متغير:</span>
                    {VARS.filter((v) => !v.only || v.only.includes(tpl.kind)).map((v) => (
                      <button key={v.key} type="button" className="var-chip" onClick={() => insert(v.key)} title={`{{${v.key}}}`}>{v.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mail-preview" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="mail-preview-head">
                  <span className="avatar">L</span>
                  <span><strong>The Luxury Club</strong><small dir="ltr">info@the-luxury-club.com</small></span>
                </div>
                <div className="mail-preview-subject">{fillSample(tpl[subjectKey])}</div>
                <div className="mail-preview-body" dangerouslySetInnerHTML={{ __html: fillSample(tpl[bodyKey]) }} />
                <p className="ui-hint">المعاينة ببيانات تجريبية.</p>
              </div>
            )}

            <div className="tpl-actions">
              {dirty(tpl) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => saved && setList((l) => l.map((t) => (t.kind === current ? saved : t)))}>
                  <Icon name="undo" />
                  تراجع
                </button>
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty(tpl)}>
                {busy ? <Spinner small /> : <><Icon name="check" />حفظ القالب</>}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
