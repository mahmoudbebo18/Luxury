// Shared by the admin pages: labels, member search, readable errors.
import { supabase } from '../../../lib/supabase';
import type { Tables } from '../../types/database';
import type { Tone } from '../../components/StatusBadge';

export type AdminMember = Tables<'admin_members'>;
export type AdminOrder = Tables<'admin_orders'>;
export type AdminCompany = Tables<'admin_companies'>;

export const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-US');
export const sar = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const STATUS_LABELS = { active: 'سارية', expired: 'منتهية', suspended: 'موقوفة', none: 'بانتظار الدفع' } as const;
export const KIND_LABELS = { individual: 'فرد', business: 'مسؤول شركة', invite: 'موظف شركة' } as const;

export const ORDER_TYPE: Record<string, string> = {
  individual: 'عضوية فردية',
  company_new: 'عضويات شركة',
  company_add_seats: 'مقاعد إضافية',
  company_renew: 'تجديد شركة',
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  quote: { label: 'عرض سعر', tone: 'gold' },
  pending: { label: 'بانتظار الدفع', tone: 'neutral' },
  paid: { label: 'مدفوع', tone: 'active' },
  failed: { label: 'فشل', tone: 'suspended' },
  cancelled: { label: 'ملغي', tone: 'expired' },
  refunded: { label: 'مسترجع', tone: 'suspended' },
};

export const METHOD: Record<string, string> = { myfatoorah: 'ماي فاتورة', bank_transfer: 'تحويل بنكي', manual: 'يدوي' };

export const REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  requested: { label: 'جديد', tone: 'gold' },
  done: { label: 'تم', tone: 'active' },
  cancelled: { label: 'ملغي', tone: 'expired' },
};

export type MemberFilter = {
  q?: string;
  status?: '' | 'active' | 'expired' | 'suspended' | 'none';
  kind?: '' | 'individual' | 'corporate';
  company?: string;
};

export function describeFilter(f: MemberFilter, companyName?: string) {
  const parts = [
    f.status && `الحالة: ${STATUS_LABELS[f.status]}`,
    f.kind && (f.kind === 'individual' ? 'عضويات فردية' : 'موظفو الشركات'),
    f.company && `الشركة: ${companyName ?? ''}`,
    f.q && `بحث: ${f.q}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'كل الأعضاء';
}

export function memberQuery<T extends string>(columns: T, f: MemberFilter, count?: 'exact') {
  let q = supabase.from('admin_members').select(columns, count ? { count } : undefined).eq('role', 'member');
  if (f.status) q = q.eq('status', f.status);
  if (f.kind) q = q.eq('membership_kind', f.kind);
  if (f.company) q = q.eq('company_id', f.company);
  const term = f.q?.trim().replace(/[%,()]/g, ' ');
  if (term) {
    q = q.or(['full_name', 'email', 'phone', 'member_label', 'member_code'].map((c) => `${c}.ilike.%${term}%`).join(','));
  }
  return q;
}

/** All member ids matching a filter (paged past PostgREST's 1000-row limit). */
export async function memberIdsFor(f: MemberFilter) {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await memberQuery('id', f).order('created_at').range(from, from + 999);
    if (error) throw error;
    ids.push(...(data as unknown as { id: string }[]).map((r) => r.id));
    if (!data || data.length < 1000) return ids;
  }
}

/** WhatsApp link for a Saudi mobile typed in any common form. */
export const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '').replace(/^0/, '966')}`;

/** Readable message for errors raised by the database functions. */
export function adminError(err: unknown) {
  const e = err as { message?: string; details?: string } | null;
  switch (e?.message) {
    case 'contract_inactive':
      return 'لا يوجد عقد ساري لهذه الشركة.';
    case 'contract_exists':
      return 'للشركة عقد ساري بالفعل. استخدم «مقاعد إضافية» أو «تجديد».';
    case 'contract_not_found':
      return 'لا يوجد عقد لهذه الشركة بعد. ابدأ بـ«عضويات شركة».';
    case 'renew_fewer_seats':
      return `التجديد لا يقل عن عدد المقاعد الحالي (${e.details ?? ''}).`;
    case 'no_company_admin':
      return 'لا يوجد مسؤول لهذه الشركة.';
    case 'user_not_found':
      return 'لا يوجد حساب بهذا البريد. اطلب منه التسجيل أولًا.';
    case 'no_membership':
      return 'لا توجد عضوية سارية لهذا العضو.';
    case 'not_editable':
      return 'لا يمكن تعديل هذا الطلب (مدفوع أو ملغي).';
    case 'not_refundable':
      return 'الاسترجاع للطلبات المدفوعة فقط.';
    case 'no_link':
      return 'أنشئ رابط الدفع أولًا.';
    case 'order_refunded':
      return 'هذا الطلب مسترجع.';
    case 'bad_values':
    case 'bad_days':
      return 'راجع الأرقام المدخلة.';
    case 'forbidden':
      return 'ليست لديك صلاحية لهذا الإجراء.';
    default:
      return 'حدث خطأ، الرجاء المحاولة مرة أخرى.';
  }
}
