// Site content: the legal pages (site_pages, Markdown). Saving keeps the previous text as a version
// (trigger site_pages_version) and rebuilds the public site, where the pages are static HTML.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { renderMarkdown } from '../../../lib/markdown';
import { AdminTitle } from './AdminLayout';
import { Icon } from '../../components/Icon';
import { Tabs } from '../../components/Tabs';
import { TextField } from '../../components/Field';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/Modal';
import { formatDateTime } from '../../lib/format';
import type { Tables } from '../../types/database';

type Page = Tables<'site_pages'>;
const PAGES: { slug: string; icon: string; path: string }[] = [
  { slug: 'terms', icon: 'file', path: '/terms' },
  { slug: 'privacy', icon: 'lock', path: '/privacy' },
  { slug: 'refund', icon: 'wallet', path: '/refund' },
  { slug: 'rules', icon: 'shield', path: '/rules' },
];

/** Starts a rebuild of the public site (Edge Function publish-site → Cloudflare Pages deploy hook). */
export async function publishSite(): Promise<'ok' | 'not_configured' | 'error'> {
  const { data, error } = await supabase.functions.invoke('publish-site', { body: {} });
  if (data?.ok) return 'ok';
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    const body = await ctx.json().catch(() => null);
    if (body?.error === 'not_configured') return 'not_configured';
  }
  return 'error';
}

export default function Content() {
  const pages = useQuery({
    queryKey: ['admin', 'site-pages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_pages').select('*').in('slug', PAGES.map((p) => p.slug));
      if (error) throw error;
      return PAGES.map((p) => data.find((d) => d.slug === p.slug)).filter(Boolean) as Page[];
    },
  });
  return (
    <>
      <AdminTitle title="محتوى الموقع" lead="الشروط والأحكام، والخصوصية، والاسترجاع، وقواعد النادي. بعد الحفظ تتحدث صفحات الموقع خلال دقيقتين تقريبًا." />
      {pages.isLoading ? (
        <Skeleton rows={3} height={90} />
      ) : pages.isError || !pages.data ? (
        <ErrorState message="تعذّر تحميل الصفحات." onRetry={() => pages.refetch()} />
      ) : (
        <Editor pages={pages.data} />
      )}
    </>
  );
}

function Editor({ pages }: { pages: Page[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [list, setList] = useState(pages);
  const [current, setCurrent] = useState(pages[0]?.slug ?? '');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [view, setView] = useState<'edit' | 'preview' | 'history'>('edit');
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setList(pages), [pages]);

  const page = list.find((p) => p.slug === current);
  const saved = pages.find((p) => p.slug === current);
  const dirty = (p: Page) => {
    const s = pages.find((x) => x.slug === p.slug);
    return !!s && (s.title_ar !== p.title_ar || s.title_en !== p.title_en || s.body_ar !== p.body_ar || s.body_en !== p.body_en);
  };
  const edit = (patch: Partial<Page>) => setList((l) => l.map((p) => (p.slug === current ? { ...p, ...patch } : p)));
  const bodyKey = lang === 'ar' ? 'body_ar' : 'body_en';
  const titleKey = lang === 'ar' ? 'title_ar' : 'title_en';
  const body = page?.[bodyKey] ?? '';
  const preview = useMemo(() => renderMarkdown(body).html, [body]);
  const pending = (body.match(/\[[^\]]+\](?!\()/g) ?? []).length;

  const versions = useQuery({
    queryKey: ['admin', 'site-page-versions', current],
    enabled: view === 'history',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_page_versions')
        .select('id, version, title_ar, title_en, body_ar, body_en, saved_at, profiles:saved_by(full_name)')
        .eq('slug', current)
        .order('version', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pick = async (slug: string) => {
    if (slug === current) return;
    if (page && dirty(page) && !(await confirm({ title: 'تغييرات غير محفوظة', message: 'لم تحفظ تعديلات هذه الصفحة. هل تريد المتابعة بدون حفظ؟', confirm: 'متابعة بدون حفظ', cancel: 'البقاء' }))) return;
    if (page && dirty(page)) setList((l) => l.map((p) => (p.slug === current && saved ? saved : p)));
    setCurrent(slug);
    setView('edit');
  };

  // Toolbar: wrap the selection or start a line with a Markdown mark.
  const wrap = (before: string, after = '', placeholder = '') => {
    const el = area.current;
    if (!el || !page) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const chosen = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + chosen + after + body.slice(e);
    edit({ [bodyKey]: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + chosen.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const el = area.current;
    if (!el || !page) return;
    const s = body.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const next = body.slice(0, s) + prefix + body.slice(s);
    edit({ [bodyKey]: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(el.selectionStart + prefix.length, el.selectionStart + prefix.length);
    });
  };

  const save = async () => {
    if (!page) return;
    if (!page.title_ar.trim() || !page.title_en.trim()) return toast('اكتب العنوان بالعربي والإنجليزي.', 'error');
    if (!page.body_ar.trim() || !page.body_en.trim()) return toast('المحتوى بالعربي والإنجليزي مطلوب.', 'error');
    if (page.slug === 'terms' && !(await confirm({ title: 'نشر نسخة جديدة من الشروط', message: 'يزيد رقم نسخة الشروط، ويُحفظ مع كل تسجيل ودفع من الآن. النسخة الحالية تبقى في السجل.', confirm: 'حفظ ونشر', icon: 'file' }))) return;
    setBusy(true);
    const { error } = await supabase
      .from('site_pages')
      .update({ title_ar: page.title_ar.trim(), title_en: page.title_en.trim(), body_ar: page.body_ar.trim(), body_en: page.body_en.trim() })
      .eq('slug', page.slug);
    if (error) {
      setBusy(false);
      return toast('تعذّر الحفظ.', 'error');
    }
    const res = await publishSite();
    setBusy(false);
    queryClient.invalidateQueries({ queryKey: ['admin', 'site-pages'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'site-page-versions'] });
    if (res === 'ok') toast('حُفظت الصفحة، وتظهر على الموقع خلال دقيقتين تقريبًا.');
    else if (res === 'not_configured') toast('حُفظت الصفحة. تظهر على الموقع مع البناء القادم (رابط البناء التلقائي غير مضبوط بعد).', 'error');
    else toast('حُفظت الصفحة، لكن تعذّر بدء تحديث الموقع. حاول الحفظ مرة أخرى لاحقًا.', 'error');
  };

  const restore = async (v: { version: number; title_ar: string; title_en: string; body_ar: string; body_en: string }) => {
    if (!(await confirm({ title: `استرجاع النسخة ${v.version}`, message: 'يُنسخ نص هذه النسخة إلى المحرر. راجعه ثم احفظ لنشره.', confirm: 'نسخ للمحرر', icon: 'history' }))) return;
    edit({ title_ar: v.title_ar, title_en: v.title_en, body_ar: v.body_ar, body_en: v.body_en });
    setView('edit');
  };

  const meta = PAGES.find((p) => p.slug === current);
  return (
    <div className="tpl">
      <nav className="tpl-list" aria-label="الصفحات">
        {list.map((p) => {
          const m = PAGES.find((x) => x.slug === p.slug);
          return (
            <button key={p.slug} type="button" className={p.slug === current ? 'tpl-item is-active' : 'tpl-item'} onClick={() => pick(p.slug)}>
              <span className="tpl-item-icon"><Icon name={m?.icon ?? 'file'} /></span>
              <span className="tpl-item-body">
                <strong>{p.title_ar}{dirty(p) && <i className="dot" aria-label="غير محفوظ" />}</strong>
                <small>النسخة {p.version} · {formatDateTime(p.updated_at)}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait">
        {page && (
          <motion.section key={page.slug} className="surface tpl-editor" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
            <div className="surface-head">
              <h2><Icon name={meta?.icon ?? 'file'} />{page.title_ar}</h2>
              <Tabs value={view} onChange={setView} tabs={[{ value: 'edit', label: 'تعديل', icon: 'edit' }, { value: 'preview', label: 'معاينة', icon: 'eye' }, { value: 'history', label: 'النسخ', icon: 'history' }]} />
            </div>

            {view !== 'history' && (
              <div className="content-bar">
                <Tabs value={lang} onChange={setLang} label="اللغة" tabs={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
                <a className="text-more" href={`${lang === 'en' ? '/en' : ''}${meta?.path}`} target="_blank" rel="noopener">الصفحة على الموقع <Icon name="arrow-out" /></a>
              </div>
            )}

            {view === 'edit' && (
              <div className="ui-form">
                <TextField label={lang === 'ar' ? 'العنوان' : 'Title'} icon="file" dir={lang === 'ar' ? 'rtl' : 'ltr'} value={page[titleKey]} onChange={(e) => edit({ [titleKey]: e.target.value })} />
                <div className="ui-field">
                  <div className="md-toolbar" role="toolbar" aria-label="تنسيق">
                    <button type="button" onClick={() => linePrefix('## ')} title="عنوان قسم">عنوان</button>
                    <button type="button" onClick={() => linePrefix('### ')} title="عنوان فرعي">عنوان فرعي</button>
                    <button type="button" onClick={() => linePrefix('- ')} title="قائمة">• قائمة</button>
                    <button type="button" onClick={() => linePrefix('1. ')} title="قائمة مرقمة">1. مرقمة</button>
                    <button type="button" onClick={() => wrap('**', '**', 'نص')} title="عريض"><b>B</b></button>
                    <button type="button" onClick={() => wrap('[', '](/refund)', 'نص الرابط')} title="رابط">رابط</button>
                  </div>
                  <textarea ref={area} className="ui-input ui-textarea code-area" rows={18} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={body} onChange={(e) => edit({ [bodyKey]: e.target.value })} aria-label="المحتوى" />
                  <p className="ui-hint">
                    استخدم أزرار التنسيق، واترك سطرًا فارغًا بين الفقرات. النص بين [ ] بدون رابط يظهر مميزًا على الموقع كبيانات ناقصة.
                    {pending > 0 && <> · <Badge tone="gold">{pending} نص بين [ ] ينتظر البيانات</Badge></>}
                  </p>
                </div>
              </div>
            )}

            {view === 'preview' && (
              <div className="md-preview" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <h1>{page[titleKey]}</h1>
                <div dangerouslySetInnerHTML={{ __html: preview }} />
              </div>
            )}

            {view === 'history' && (
              versions.isLoading ? (
                <Skeleton rows={3} height={48} />
              ) : !versions.data?.length ? (
                <EmptyState icon="history">لا توجد نسخ سابقة. كل حفظ يضيف النسخة السابقة هنا.</EmptyState>
              ) : (
                <ul className="feed">
                  {versions.data.map((v) => (
                    <li key={v.id}>
                      <span className="feed-icon"><Icon name="history" /></span>
                      <span className="feed-body">
                        <strong>النسخة {v.version}</strong>
                        <small>{formatDateTime(v.saved_at)}{(v.profiles as { full_name?: string } | null)?.full_name ? ` · ${(v.profiles as { full_name: string }).full_name}` : ''}</small>
                      </span>
                      <span className="feed-side">
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => restore(v)}><Icon name="undo" />استرجاع</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}

            {view !== 'history' && (
              <div className="tpl-actions">
                {dirty(page) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => saved && setList((l) => l.map((p) => (p.slug === current ? saved : p)))}>
                    <Icon name="undo" />
                    تراجع
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty(page)}>
                  {busy ? <Spinner small /> : <><Icon name="check" />حفظ ونشر</>}
                </button>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
