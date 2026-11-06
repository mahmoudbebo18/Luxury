// My account: the card and its status, the next step (pay / renew), the services, and the company
// shortcut for company admins.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { MemberCard, verifyUrl } from '../../components/MemberCard';
import { daysLeft, formatDate } from '../../lib/format';
import { pick, type MemberService } from '../../lib/services';

export default function Dashboard() {
  const { t, lang } = useT();
  const { account } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const services = useQuery({
    queryKey: ['services', account?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_services');
      if (error) throw error;
      return data as unknown as (MemberService & { quota: number | null; used: number })[];
    },
  });

  if (!account) return null;
  const m = account.membership;
  const left = m ? daysLeft(m.expires_at) : 0;
  const isBusinessAdmin = account.companies.length > 0;
  const company = account.companies[0];

  const saveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `luxury-club-${account.member_no ?? 'card'}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  const nextStep =
    account.status === 'suspended' ? (
      <div className="acct-note acct-note--warn">
        <strong>{t('account.suspendedTitle')}</strong>
        <p>{t('account.suspendedLead')}</p>
      </div>
    ) : account.status === 'none' && !isBusinessAdmin ? (
      <div className="acct-note acct-note--pay">
        <div>
          <strong>{t('account.payTitle')}</strong>
          <p>{t('account.payLead')}</p>
        </div>
        <Link className="btn btn-gold btn-lg" to="/checkout">
          {t('account.payBtn')} <Icon name="arrow" className="icon-flip" />
        </Link>
      </div>
    ) : account.status === 'expired' ? (
      <div className="acct-note acct-note--pay">
        <div>
          <strong>{t('account.expiredTitle')}</strong>
          <p>{t('account.expiredLead')}</p>
        </div>
        <Link className="btn btn-gold btn-lg" to="/checkout">
          {t('account.renew')} <Icon name="arrow" className="icon-flip" />
        </Link>
      </div>
    ) : null;

  return (
    <div className="container page acct">
      <motion.header className="acct-head" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="eyebrow">{account.member_no ?? 'The Luxury Club'}</span>
        <h1>{t('account.hello', { name: account.full_name.split(' ')[0] })}</h1>
        {account.status === 'active' && <p>{t('account.leadActive')}</p>}
      </motion.header>

      {nextStep}

      {isBusinessAdmin && (
        <div className="acct-note acct-note--company">
          <span className="acct-note__icon"><Icon name="building" /></span>
          <div>
            <strong>{t('account.companyTitle', { company: company.name })}</strong>
            <p>{account.status === 'none' ? t('account.businessNoMember') : t('account.companyLead')}</p>
          </div>
          <Link className="btn btn-primary" to="/company">{t('account.companyBtn')}</Link>
        </div>
      )}

      {(account.status !== 'none' || !isBusinessAdmin) && account.status !== 'none' && (
        <section className="acct-grid">
          <div className="acct-card">
            <MemberCard ref={cardRef} account={account} />
            <div className="acct-card__actions">
              {account.status === 'active' && (
                <button type="button" className="btn btn-primary" onClick={() => setQrOpen(true)}>
                  <Icon name="qr" /> {t('account.showQr')}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={saveImage} disabled={saving}>
                <Icon name="download" /> {saving ? t('account.saving') : t('account.saveImage')}
              </button>
            </div>
          </div>

          <div className="acct-status">
            <dl>
              <div>
                <dt>{t('pay.status')}</dt>
                <dd><span className={`badge badge--${account.status}`}>{t(`status.${account.status}`)}</span></dd>
              </div>
              {m && (
                <>
                  <div>
                    <dt>{t('account.expires')}</dt>
                    <dd>{formatDate(m.expires_at, lang)}</dd>
                  </div>
                  <div>
                    <dt>&nbsp;</dt>
                    <dd className="acct-days">{t('account.daysLeft', { n: left })}</dd>
                  </div>
                  {m.kind === 'corporate' && m.company && (
                    <div>
                      <dt>{t('verify.company')}</dt>
                      <dd>{t('account.via', { company: m.company })}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {account.next_starts_at && <p className="acct-hint"><Icon name="check-circle" /> {t('account.nextYear', { date: formatDate(account.next_starts_at, lang) })}</p>}
            {m?.kind === 'individual' && !account.next_starts_at && left <= 60 && (
              <div className="acct-renew">
                <Link className="btn btn-gold" to="/checkout">{t('account.renewEarly')}</Link>
                <small>{t('account.renewEarlyHint')}</small>
              </div>
            )}
            <Link className="link-arrow" to="/account/payments">{t('nav.payments')} <Icon name="arrow" className="icon-flip" /></Link>
          </div>
        </section>
      )}

      {account.status === 'active' && (
        <section className="acct-services">
          <div className="acct-section-head">
            <h2>{t('account.services')}</h2>
            <Link className="link-arrow" to="/account/services">{t('account.allServices')} <Icon name="arrow" className="icon-flip" /></Link>
          </div>
          <div className="acct-services__grid">
            {(services.data ?? []).map((s) => (
              <Link key={s.id} to={`/account/services#${s.slug ?? s.id}`} className="acct-svc">
                <span className="acct-svc__icon"><Icon name={s.icon === 'passport' ? 'passport' : s.icon === 'roadside' ? 'roadside' : 'legal'} /></span>
                <strong>{pick(s, 'title', lang)}</strong>
                <small>
                  {s.quota ? t('svc.remaining', { left: Math.max(0, s.quota - s.used), quota: s.quota }) : t('svc.unlimited')}
                </small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Modal open={qrOpen} title={t('account.showQr')} onClose={() => setQrOpen(false)} closeLabel={t('nav.close')}>
        <div className="qr-big">
          <QRCodeSVG value={verifyUrl(account.member_code)} size={240} level="M" />
          <strong dir="ltr">{account.member_no}</strong>
          <p>{t('account.qrHint')}</p>
        </div>
      </Modal>
    </div>
  );
}
