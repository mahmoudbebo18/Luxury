import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { type AdminCompany } from './shared';
import { Icon } from '../../components/Icon';
import { Dropdown } from '../../components/Dropdown';
import { Badge, type Tone } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDate, isoDay } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

type State = 'active' | 'expired' | 'pending' | 'none';
const STATE: Record<State, { label: string; tone: Tone }> = {
  active: { label: 'ساري', tone: 'active' },
  expired: { label: 'منتهي', tone: 'expired' },
  pending: { label: 'لم يُدفع', tone: 'neutral' },
  none: { label: 'بدون عقد', tone: 'neutral' },
};

export const contractState = (c: Pick<AdminCompany, 'contract_status' | 'expires_at'>): State =>
  !c.contract_status ? 'none' : c.contract_status === 'pending' ? 'pending' : c.expires_at && new Date(c.expires_at) > new Date() ? 'active' : 'expired';

export default function Companies() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const q = params.get('q') ?? '';
  const state = (params.get('state') ?? '') as State | '';
  const [search, setSearch] = useState(q);
  const [exporting, setExporting] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const timer = setTimeout(() => search.trim() !== q && setParam('q', search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Few companies: load them all and filter here.
  const list = useQuery({
    queryKey: ['admin', 'companies'],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_companies').select('*').order('company_no', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const term = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (c) =>
      (!state || contractState(c) === state) &&
      (!term || [c.legal_name, c.card_name, c.cr_number, c.company_label, c.admins].some((v) => v?.toLowerCase().includes(term))),
  );

  const exportAll = async () => {
    setExporting(true);
    try {
      await exportExcel(
        `luxury-companies-${isoDay(new Date().toISOString())}`,
        'الشركات',
        rows.map((c) => ({
          'رقم الشركة': c.company_label,
          الاسم: c.legal_name,
          'الاسم على البطاقة': c.card_name,
          'السجل التجاري': c.cr_number,
          'الرقم الضريبي': c.vat_number,
          المدينة: c.city,
          المسؤولون: c.admins ?? '',
          العقد: STATE[contractState(c)].label,
          المقاعد: c.seats ?? 0,
          المستخدم: c.seats_used ?? 0,
          'دعوات معلقة': c.invites_pending ?? 0,
          'ينتهي في': isoDay(c.expires_at),
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
        title="الشركات"
        lead={list.data ? `${rows.length.toLocaleString('en-US')} شركة` : 'جارٍ التحميل…'}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportAll} disabled={exporting || !rows.length}>
            {exporting ? <Spinner small /> : <Icon name="download" />}
            تصدير Excel
          </button>
        }
      />

      <div className="toolbar">
        <label className="toolbar-search">
          <Icon name="search" />
          <input type="search" placeholder="بحث بالاسم أو السجل التجاري أو المسؤول" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
        </label>
        <Dropdown
          label="العقد"
          icon="filter"
          placeholder="كل الشركات"
          value={state}
          onChange={(v) => setParam('state', v)}
          options={[{ value: '', label: 'كل الشركات' }, ...(Object.keys(STATE) as State[]).map((k) => ({ value: k, label: STATE[k].label }))]}
        />
      </div>

      {list.isLoading ? (
        <Skeleton rows={5} height={58} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الشركات." onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <div className="surface">
          <EmptyState icon="building" title={list.data?.length ? 'لا توجد شركات مطابقة' : 'لا توجد شركات بعد'}>
            تُضاف الشركة عندما يسجّل مسؤولها من «عضوية الشركات» في الموقع.
          </EmptyState>
        </div>
      ) : (
        <div className="table-card">
          <table className="dtable">
            <thead>
              <tr>
                <th>الشركة</th>
                <th>المسؤول</th>
                <th>العقد</th>
                <th className="num">المقاعد</th>
                <th>ينتهي</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = STATE[contractState(c)];
                return (
                  <tr key={c.id} className="is-link" onClick={() => navigate(`/admin/companies/${c.id}`)}>
                    <td>
                      <div className="cell-person">
                        <span className="avatar"><Icon name="building" /></span>
                        <span>
                          <span className="cell-name">
                            <Link to={`/admin/companies/${c.id}`} className="cell-strong" onClick={(e) => e.stopPropagation()}>{c.legal_name}</Link>
                            {!!c.quotes_open && <Badge tone="gold">عرض سعر</Badge>}
                          </span>
                          <small dir="ltr">{[c.company_label, c.cr_number && `CR ${c.cr_number}`].filter(Boolean).join(' · ')}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="المسؤول">{c.admins || '—'}</td>
                    <td data-label="العقد"><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td data-label="المقاعد" className="num">{c.seats ? <><b>{c.seats_used}</b> / {c.seats}</> : '—'}{!!c.invites_pending && <small className="cell-sub">{c.invites_pending} دعوة معلقة</small>}</td>
                    <td data-label="ينتهي">{formatDate(c.expires_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
