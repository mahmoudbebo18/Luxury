import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle, Pager } from './AdminLayout';
import { CampaignModal, type Target } from './CampaignModal';
import { describeFilter, KIND_LABELS, memberQuery, STATUS_LABELS, type AdminMember, type MemberFilter } from './shared';
import { Icon } from '../../components/Icon';
import { Dropdown } from '../../components/Dropdown';
import { Badge, StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDate, isoDay, type MembershipStatus } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

const PAGE = 50;

export default function Members() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const filter: MemberFilter = {
    q: params.get('q') ?? '',
    status: (params.get('status') as MemberFilter['status']) ?? '',
    kind: (params.get('kind') as MemberFilter['kind']) ?? '',
    company: params.get('company') ?? '',
  };
  const page = Number(params.get('page') ?? 0);
  const [search, setSearch] = useState(filter.q ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => setSearch(filter.q ?? ''), [filter.q]);
  useEffect(() => {
    const timer = setTimeout(() => search.trim() !== (filter.q ?? '') && setParam('q', search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [filterKey]);

  const companies = useQuery({
    queryKey: ['admin', 'company-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, legal_name').order('legal_name');
      if (error) throw error;
      return data;
    },
  });
  const companyName = companies.data?.find((c) => c.id === filter.company)?.legal_name;

  const list = useQuery({
    queryKey: ['admin', 'members', filterKey, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await memberQuery('*', filter, 'exact')
        .order('created_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data as unknown as AdminMember[], count: count ?? 0 };
    },
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const pageIds = rows.map((r) => r.id!);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const filtered = !!(filter.q || filter.status || filter.kind || filter.company);

  const target: Target | null = useMemo(() => {
    if (allMatching) return { filter, label: describeFilter(filter, companyName), count: total };
    if (selected.size) return { ids: [...selected], label: `${selected.size} عضو محدد`, count: selected.size };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatching, selected, filterKey, total, companyName]);

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
      return next;
    });
  };
  const clearSelection = () => {
    setSelected(new Set());
    setAllMatching(false);
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const out: AdminMember[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await memberQuery('*', filter).order('created_at').range(from, from + 999);
        if (error) throw error;
        out.push(...(data as unknown as AdminMember[]));
        if (data.length < 1000) break;
      }
      await exportExcel(
        `luxury-members-${isoDay(new Date().toISOString())}`,
        'الأعضاء',
        out.map((m) => ({
          'رقم العضوية': m.member_label ?? '',
          الاسم: m.full_name,
          'البريد الإلكتروني': m.email,
          الجوال: m.phone,
          المدينة: m.city,
          'نوع الحساب': KIND_LABELS[(m.signup_kind ?? 'individual') as keyof typeof KIND_LABELS],
          الحالة: STATUS_LABELS[(m.status ?? 'none') as keyof typeof STATUS_LABELS],
          'نوع العضوية': m.membership_kind === 'corporate' ? 'شركة' : m.membership_kind === 'individual' ? 'فردية' : '',
          الشركة: m.company_name ?? '',
          'تاريخ التسجيل': isoDay(m.created_at),
          'تاريخ الانتهاء': isoDay(m.expires_at ?? m.last_expires_at),
          'خدمات منفّذة': m.services_done ?? 0,
        })),
      );
      toast(`تم تصدير ${out.length} عضو.`);
    } catch {
      toast('تعذّر التصدير، حاول مرة أخرى.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const count = allMatching ? total : selected.size;

  return (
    <>
      <AdminTitle
        title="الأعضاء"
        lead={list.data ? `${total.toLocaleString('en-US')} حساب${filtered ? ' مطابق للبحث' : ''}` : 'جارٍ التحميل…'}
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
          <input type="search" placeholder="بحث بالاسم أو البريد أو الجوال أو رقم العضوية" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
          {list.isFetching && !list.isLoading && <Spinner small />}
        </label>
        <Dropdown
          label="الحالة"
          icon="filter"
          placeholder="كل الحالات"
          value={filter.status ?? ''}
          onChange={(v) => setParam('status', v)}
          options={[
            { value: '', label: 'كل الحالات' },
            { value: 'active', label: 'سارية' },
            { value: 'expired', label: 'منتهية' },
            { value: 'none', label: 'بانتظار الدفع' },
            { value: 'suspended', label: 'موقوفة' },
          ]}
        />
        <Dropdown
          label="نوع العضوية"
          icon="user"
          placeholder="الكل"
          value={filter.kind ?? ''}
          onChange={(v) => setParam('kind', v)}
          options={[
            { value: '', label: 'الكل' },
            { value: 'individual', label: 'فردية' },
            { value: 'corporate', label: 'موظفو الشركات' },
          ]}
        />
        <Dropdown
          label="الشركة"
          icon="building"
          placeholder="كل الشركات"
          searchable
          searchPlaceholder="ابحث عن شركة…"
          value={filter.company ?? ''}
          onChange={(v) => setParam('company', v)}
          options={[{ value: '', label: 'كل الشركات' }, ...(companies.data ?? []).map((c) => ({ value: c.id, label: c.legal_name }))]}
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
        <ErrorState message="تعذّر تحميل الأعضاء." onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <div className="surface">
          <EmptyState icon="users" title="لا يوجد أعضاء مطابقون" action={filtered ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>مسح الفلاتر</button> : undefined}>
            جرّب كلمة بحث أخرى أو غيّر الفلاتر.
          </EmptyState>
        </div>
      ) : (
        <div className="table-card">
          <table className="dtable dtable--members">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    checked={allOnPage || allMatching}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPage && !allOnPage && !allMatching;
                    }}
                    onChange={togglePage}
                    aria-label="تحديد الصفحة"
                  />
                </th>
                <th>العضو</th>
                <th>العضوية</th>
                <th>الجوال</th>
                <th>الحالة</th>
                <th>الانتهاء</th>
                <th className="num">الخدمات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const isSel = allMatching || selected.has(m.id!);
                return (
                  <tr key={m.id} className={isSel ? 'is-selected is-link' : 'is-link'} onClick={() => navigate(`/admin/members/${m.id}`)}>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="ui-checkbox" checked={isSel} onChange={() => toggle(m.id!)} aria-label={`تحديد ${m.full_name}`} />
                    </td>
                    <td>
                      <div className="cell-person">
                        <span className="avatar">{(m.full_name || '؟').trim().charAt(0)}</span>
                        <span>
                          <span className="cell-name">
                            <Link to={`/admin/members/${m.id}`} className="cell-strong" onClick={(e) => e.stopPropagation()}>{m.full_name || '—'}</Link>
                            {m.signup_kind === 'business' && <Badge tone="gold">مسؤول شركة</Badge>}
                          </span>
                          <small dir="ltr">{[m.member_label, m.email].filter(Boolean).join(' · ')}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="العضوية">
                      {m.membership_kind === 'corporate' ? m.company_name : m.membership_kind === 'individual' ? 'فردية' : '—'}
                    </td>
                    <td data-label="الجوال" className="cell-phone"><span dir="ltr">{m.phone || '—'}</span></td>
                    <td data-label="الحالة"><StatusBadge status={(m.status ?? 'none') as MembershipStatus} /></td>
                    <td data-label="الانتهاء">{formatDate(m.expires_at ?? m.last_expires_at)}</td>
                    <td data-label="الخدمات" className="num">{m.services_done ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE} total={total} onPage={(p) => setParam('page', String(p))} />
        </div>
      )}

      <AnimatePresence>
        {count > 0 && (
          <motion.div className="bulk" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} role="region" aria-label="إجراءات المحددين">
            <div className="bulk-count">
              <span>{count.toLocaleString('en-US')}</span>
              <div>
                <strong>{allMatching ? 'كل المطابقين محددون' : 'عضو محدد'}</strong>
                {!allMatching && allOnPage && total > pageIds.length && (
                  <button type="button" className="bulk-all" onClick={() => setAllMatching(true)}>
                    تحديد كل المطابقين ({total.toLocaleString('en-US')})
                  </button>
                )}
              </div>
            </div>
            <div className="bulk-actions">
              <button type="button" className="btn btn-gold btn-sm" onClick={() => setEmailOpen(true)}>
                <Icon name="send" />
                <span>إرسال بريد</span>
              </button>
              <button type="button" className="bulk-close" onClick={clearSelection} aria-label="إلغاء التحديد">
                <Icon name="close" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CampaignModal open={emailOpen} onClose={() => setEmailOpen(false)} target={target} onDone={clearSelection} />
    </>
  );
}
