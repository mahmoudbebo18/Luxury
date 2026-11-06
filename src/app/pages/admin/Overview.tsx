import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { AdminTitle, StatCard } from './AdminLayout';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/StatusBadge';
import { ErrorState, EmptyState, Skeleton } from '../../components/States';
import { formatDateTime } from '../../lib/format';
import { n, ORDER_STATUS, ORDER_TYPE, REQUEST_STATUS, sar } from './shared';

type Stats = {
  members_total: number;
  active_individual: number;
  active_corporate: number;
  unpaid: number;
  expiring_30: number;
  companies: number;
  seats_total: number;
  seats_used: number;
  quotes_open: number;
  revenue_month: number;
  revenue_total: number;
  requests_open: number;
  emails_pending: number;
};

export default function Overview() {
  const { account } = useAuth();
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
  const orders = useQuery({
    queryKey: ['admin', 'orders', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_orders')
        .select('id, order_no, type, status, total, quantity, user_name, company_name, created_at, paid_at')
        .in('status', ['paid', 'quote', 'pending'])
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });
  const requests = useQuery({
    queryKey: ['admin', 'requests', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_service_requests')
        .select('id, service_title, member_name, member_id, status, channel, created_at')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(new Date()));
  const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير';

  if (stats.isError) return <ErrorState message="تعذّر تحميل الإحصائيات." onRetry={() => stats.refetch()} />;
  const s = stats.data;
  const active = s ? s.active_individual + s.active_corporate : 0;
  const seatPct = s && s.seats_total ? Math.round((s.seats_used / s.seats_total) * 100) : 0;

  return (
    <>
      <AdminTitle
        title={`${greeting}، ${account?.full_name?.split(' ')[0] ?? ''}`}
        lead="نظرة سريعة على العضويات والمدفوعات وطلبات الخدمات."
        actions={
          <>
            <Link to="/admin/emails?new=1" className="btn btn-ghost btn-sm"><Icon name="send" />رسالة جديدة</Link>
            <Link to="/admin/payments?status=quote" className="btn btn-primary btn-sm"><Icon name="receipt" />عروض الأسعار</Link>
          </>
        }
      />

      {!s ? (
        <Skeleton rows={2} height={120} />
      ) : (
        <>
          <div className="stats">
            <StatCard icon="users" label="العضويات السارية" value={n(active)} to="/admin/members?status=active" foot={`${n(s.active_individual)} فرد · ${n(s.active_corporate)} موظف شركة`} />
            <StatCard icon="wallet" tone="gold" label="إيرادات هذا الشهر" value={<>{sar(s.revenue_month)} <small>ريال</small></>} to="/admin/payments?status=paid" foot={`الإجمالي ${sar(s.revenue_total)} ريال`} />
            <StatCard icon="building" tone="green" label="الشركات" value={n(s.companies)} to="/admin/companies" foot={`${n(s.seats_used)} من ${n(s.seats_total)} مقعد مستخدم (${seatPct}%)`} />
            <StatCard icon="clock" tone="amber" label="تنتهي خلال 30 يومًا" value={n(s.expiring_30)} to="/admin/members?status=active" foot={`${n(s.unpaid)} سجّلوا ولم يدفعوا`} />
          </div>

          {(s.quotes_open > 0 || s.requests_open > 0) && (
            <div className="adm-notes">
              {s.quotes_open > 0 && (
                <Link to="/admin/payments?status=quote" className="adm-note">
                  <Icon name="receipt" />
                  <span><b>{n(s.quotes_open)}</b> طلب عرض سعر من الشركات بانتظار التسعير.</span>
                  <Icon name="arrow" className="icon-flip" />
                </Link>
              )}
              {s.requests_open > 0 && (
                <Link to="/admin/services?status=requested" className="adm-note">
                  <Icon name="sparkle" />
                  <span><b>{n(s.requests_open)}</b> طلب خدمة جديد لم يُعلَّم «تم» بعد.</span>
                  <Icon name="arrow" className="icon-flip" />
                </Link>
              )}
            </div>
          )}

          <div className="adm-grid-2">
            <motion.section className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="surface-head">
                <h2><Icon name="receipt" />آخر الطلبات</h2>
                <Link className="text-more" to="/admin/payments">كل المدفوعات</Link>
              </div>
              {orders.isLoading ? (
                <Skeleton rows={4} height={44} />
              ) : !orders.data?.length ? (
                <EmptyState icon="receipt">لا توجد طلبات بعد.</EmptyState>
              ) : (
                <ul className="feed">
                  {orders.data.map((o) => {
                    const st = ORDER_STATUS[o.status ?? 'pending'];
                    return (
                      <li key={o.id}>
                        <span className="feed-icon"><Icon name={o.type === 'individual' ? 'user' : 'building'} /></span>
                        <span className="feed-body">
                          <strong>
                            <Link to={`/admin/payments?q=${o.order_no}`}>{o.company_name || o.user_name || '—'}</Link>
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </strong>
                          <small>{ORDER_TYPE[o.type ?? '']}{o.type !== 'individual' ? ` × ${o.quantity}` : ''} · {formatDateTime(o.paid_at ?? o.created_at)}</small>
                        </span>
                        <span className="feed-value">{sar(o.total)} <small>ريال</small></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.section>

            <motion.section className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="surface-head">
                <h2><Icon name="sparkle" />آخر طلبات الخدمات</h2>
                <Link className="text-more" to="/admin/services">السجل الكامل</Link>
              </div>
              {requests.isLoading ? (
                <Skeleton rows={4} height={44} />
              ) : !requests.data?.length ? (
                <EmptyState icon="sparkle">لا توجد طلبات خدمات بعد.</EmptyState>
              ) : (
                <ul className="feed">
                  {requests.data.map((r) => {
                    const st = REQUEST_STATUS[r.status ?? 'requested'];
                    return (
                      <li key={r.id}>
                        <span className="feed-icon"><Icon name={r.channel === 'whatsapp' ? 'whatsapp' : r.channel === 'email' ? 'mail' : 'edit'} /></span>
                        <span className="feed-body">
                          <strong>
                            <Link to={`/admin/members/${r.member_id}`}>{r.member_name}</Link>
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </strong>
                          <small>{r.service_title} · {formatDateTime(r.created_at)}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.section>
          </div>

          {s.emails_pending > 0 && (
            <Link to="/admin/emails" className="adm-note">
              <Icon name="mail" />
              <span>في طابور البريد <b>{n(s.emails_pending)}</b> رسالة، تُرسل تلقائيًا خلال دقائق ضمن الحد اليومي.</span>
              <Icon name="arrow" className="icon-flip" />
            </Link>
          )}

          <div className="quick">
            <Link to="/admin/members" className="quick-item"><Icon name="users" /><span><strong>الأعضاء ({n(s.members_total)})</strong><small>بحث، ملف العضو، عضوية مجانية، تصدير</small></span></Link>
            <Link to="/admin/companies" className="quick-item"><Icon name="building" /><span><strong>الشركات</strong><small>العقود والمقاعد والموظفون</small></span></Link>
            <Link to="/admin/content" className="quick-item"><Icon name="file" /><span><strong>محتوى الموقع</strong><small>الشروط والخصوصية والاسترجاع والقواعد</small></span></Link>
            <Link to="/admin/settings" className="quick-item"><Icon name="settings" /><span><strong>الإعدادات</strong><small>السعر والشرائح وقوالب الرسائل</small></span></Link>
          </div>
        </>
      )}
    </>
  );
}
