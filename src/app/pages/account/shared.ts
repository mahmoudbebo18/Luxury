// Data and labels shared by the account tabs.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import type { StringKey } from '../../i18n/ar';
import type { MemberService } from '../../lib/services';

export type MyOrder = {
  id: string;
  order_no: string;
  type: 'individual' | 'company_new' | 'company_add_seats' | 'company_renew';
  quantity: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: 'quote' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  method: 'myfatoorah' | 'bank_transfer' | 'manual' | null;
  mf_payment_id: string | null;
  payment_url: string | null;
  company_id: string | null;
  created_at: string;
  paid_at: string | null;
};

/** The member's own orders, newest first (RLS: own rows only). Cancelled ones are left out. */
export function useMyOrders() {
  const { account } = useAuth();
  return useQuery({
    queryKey: ['my-orders', account?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_no, type, quantity, subtotal, vat_amount, total, status, method, mf_payment_id, payment_url, company_id, created_at, paid_at')
        .eq('user_id', account!.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MyOrder[];
    },
    enabled: !!account,
  });
}

export type ServiceWithQuota = MemberService & { quota: number | null; used: number };

export function useMyServices() {
  const { account } = useAuth();
  return useQuery({
    queryKey: ['services', account?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_services');
      if (error) throw error;
      return (data ?? []) as unknown as ServiceWithQuota[];
    },
    enabled: !!account,
  });
}

export const orderLabel = (o: Pick<MyOrder, 'type'>) => `pay.t.${o.type}` as StringKey;
export const methodLabel = (o: Pick<MyOrder, 'method'>) => (o.method ? (`pay.m.${o.method}` as StringKey) : null);
export const statusLabel = (o: Pick<MyOrder, 'status'>) => `pay.${o.status}` as StringKey;
