// Layout for login / register / forgot / reset: brand panel (desktop) + focused form column.
import { Suspense, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { PageLoader } from '../../components/PageLoader';
import { usePricing } from '../../lib/pricing';

export function AuthLayout() {
  const { t, lang, setLang } = useT();
  const location = useLocation();
  const pricing = usePricing();
  const home = lang === 'en' ? '/en/' : '/';

  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-inner">
          <a href={home} className="auth-aside-logo" tabIndex={-1}>
            <svg><use href="/imgs/icons.svg#logo" /></svg>
          </a>
          <div className="auth-aside-copy">
            <span className="eyebrow eyebrow--light">{t('aside.eyebrow')}</span>
            <h2>{t('aside.title')}</h2>
            <p>{t('aside.lead')}</p>
          </div>
          <div className="auth-arch">
            <span className="arch-outline" />
            <div className="arch">
              <img src="/imgs/lounge-mirror-480.webp" alt="" width="480" height="694" />
            </div>
          </div>
          <ul className="auth-perks">
            {(['aside.perk1', 'aside.perk2', 'aside.perk3'] as const).map((k, i) => (
              <motion.li key={k} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                <Icon name="check" />
                {t(k)}
              </motion.li>
            ))}
          </ul>
          {pricing.data && <p className="auth-price">{t('aside.price', { price: pricing.priceText })}</p>}
        </div>
      </aside>

      <div className="auth-main">
        <header className="auth-top">
          <a href={home} className="auth-top-logo" aria-label="The Luxury Club">
            <svg><use href="/imgs/icons.svg#logo" /></svg>
          </a>
          <div className="auth-top-actions">
            <a href={home} className="auth-top-link">
              <Icon name="arrow" className="icon-back" />
              <span>{t('nav.backHome')}</span>
            </a>
            <button type="button" className="lang-switch" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} lang={lang === 'ar' ? 'en' : 'ar'}>
              <Icon name="globe" />
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </header>
        <main id="main" className="auth-body">
          <Suspense fallback={<PageLoader />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                className="auth-panel"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function AuthHead({ icon, title, lead }: { icon?: string; title: string; lead?: ReactNode }) {
  return (
    <div className="auth-head">
      {icon && (
        <span className="auth-head-icon">
          <Icon name={icon} />
        </span>
      )}
      <h1>{title}</h1>
      {lead && <p>{lead}</p>}
    </div>
  );
}

export function AuthSwitch({ text, to, label }: { text: string; to: string; label: string }) {
  return (
    <p className="auth-switch">
      {text} <Link to={to}>{label}</Link>
    </p>
  );
}
