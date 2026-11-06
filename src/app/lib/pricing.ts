// One shared read of public_pricing(): price, VAT, company rules, terms version and seller details.
// Admin edits in Settings invalidate PRICING_KEY, so every screen picks up the new price.
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { formatMoney } from './format';

export type PublicPricing = {
  price_individual: number;
  vat_rate: number;
  company_tiers: { min: number; discount: number }[] | null;
  company_min_seats: number;
  company_online_max: number;
  bank_transfer: boolean;
  terms_version: number;
  seller_name: string;
  seller_cr: string;
  seller_vat: string;
  seller_address: string;
};

export const PRICING_KEY = ['public-pricing'] as const;

async function fetchPricing() {
  const { data, error } = await supabase.rpc('public_pricing');
  if (error) throw error;
  return data as unknown as PublicPricing;
}

export function usePricing() {
  const q = useQuery({ queryKey: PRICING_KEY, queryFn: fetchPricing, staleTime: 30 * 60_000 });
  return {
    ...q,
    /** The yearly price formatted for text ("699"), or "…" while loading: never a stale hard-coded number. */
    priceText: q.data ? formatMoney(q.data.price_individual) : '…',
  };
}

/** Fresh read (ignores the cache), for values that must be current at the moment of use, like the terms version at sign-up. */
export function readPricingNow(qc: QueryClient) {
  return qc.fetchQuery({ queryKey: PRICING_KEY, queryFn: fetchPricing, staleTime: 0 });
}
