// One account area for members: a dark "lounge" band with the member's name and status, a tab bar
// (overview, my details, payments, services) and the tab's page under it. Every tab keeps its own
// URL (/account, /account/profile, /account/payments, /account/services).
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { PageLoader } from '../../components/PageLoader';
import { daysLeft, formatDate } from '../../lib/format';

export default function AccountLayout() {
  const { t, lang } = useT();
  const { account, isAdmin } = useAuth();
  const { pathname } = useLocation();

  if (!account) return <PageLoader />;
  // The admin account only reaches /account/profile (its password); it has no membership tabs.
  if (isAdmin) return <Outlet />;

  const m = account.membership;
  const isCompanyAdmin = account.companies.length > 0;
  const left = m ? daysLeft(m.expires_at) : 0;
  const renewEarly = m?.kind === 'individual' && !account.next_starts_at && left <= 60;

  const tabs = [
    { to: '/account', end: true, icon: 'home', label: t('acc.tab.overview') },
    { to: '/account/profile', icon: 'user', label: t('acc.tab.profile') },
    { to: '/account/payments', icon: 'receipt', label: t('acc.tab.payments') },
    { to: '/account/services', icon: 'sparkle', label: t('acc.tab.services') },
  ];

  const meta =
    account.status === 'active' && m
      ? t('acc.validUntil', { date: formatDate(m.expires_at, lang) })
      : account.status === 'expired' && account.last_expires_at
        ? t('acc.endedOn', { date: formatDate(account.last_expires_at, lang) })
        : account.status === 'none'
          ? t('acc.notActive')
          : null;

  const cta =
    account.status === 'none' && !isCompanyAdmin ? (
      <Link className="btn btn-gold" to="/checkout">{t('account.payBtn')} <Icon name="arrow" className="icon-flip" /></Link>
    ) : account.status === 'expired' ? (
      <Link className="btn btn-gold" to="/checkout">{t('account.renew')} <Icon name="arrow" className="icon-flip" /></Link>
    ) : renewEarly ? (
      <Link className="btn btn-gold" to="/checkout">{t('account.renewEarly')}</Link>
    ) : isCompanyAdmin ? (
      <Link className="btn btn-ghost" to="/company"><Icon name="building" /> {t('account.companyBtn')}</Link>
    ) : null;

  return (
    <div className="acc">
      <section className="acc-hero">
        <div className="container acc-hero__in">
          <span className="acc-avatar" aria-hidden="true">{account.full_name.trim().charAt(0)}</span>
          <div className="acc-hero__text">
            <span className="acc-hero__eyebrow" dir="ltr">{account.member_no ?? 'The Luxury Club'}</span>
            <h1>{t('account.hello', { name: account.full_name.split(' ')[0] })}</h1>
            <p className="acc-hero__meta">
              <span className={`badge badge--${account.status}`}>{t(`status.${account.status}`)}</span>
              {meta && <span>{meta}</span>}
              {m?.kind === 'corporate' && m.company && <span>{t('account.via', { company: m.company })}</span>}
            </p>
          </div>
          {cta && <div className="acc-hero__cta">{cta}</div>}
        </div>
      </section>

      <nav className="acc-tabs" aria-label={t('acc.tabs')}>
        <div className="container">
          <div className="acc-tabs__bar">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'acc-tab is-active' : 'acc-tab')}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="acc-tab-pill" className="acc-tab__pill" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                    <Icon name={tab.icon} />
                    <span>{tab.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <motion.div
        key={pathname}
        className="container acc-body"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
