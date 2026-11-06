import type { MembershipStatus } from '../lib/format';

const AR: Record<MembershipStatus, string> = { active: 'سارية', expired: 'منتهية', suspended: 'موقوفة', none: 'بانتظار الدفع' };

export type Tone = 'neutral' | 'active' | 'expired' | 'suspended' | 'gold';

export function StatusBadge({ status, label }: { status: MembershipStatus; label?: string }) {
  return <span className={`badge badge--${status}`}>{label ?? AR[status]}</span>;
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
