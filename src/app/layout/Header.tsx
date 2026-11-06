// Same markup and classes as the public pages' header and drawer (src/partials/header-*.html),
// driven by React, with the signed-in links.
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';

const active = ({ isActive }: { isActive: boolean }) => (isActive ? 'is-active' : undefined);

export function Logo() {
  return (
    <svg aria-hidden="true">
      <use href="/imgs/icons.svg#logo" />
    </svg>
  );
}

export function Header() {
  const { t, lang, setLang } = useT();
  const { session, isAdmin, isCompanyAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const home = lang === 'en' ? '/en/' : '/';

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [open]);

  const logout = async () => {
    setOpen(false);
    await signOut();
    navigate('/login');
  };
  const switchLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  const links = session ? (
    isAdmin ? (
      <>
        <NavLink to="/admin" className={active}>{t('nav.admin')}</NavLink>
        <NavLink to="/account/profile" className={active}>{t('nav.profile')}</NavLink>
      </>
    ) : (
      <>
        <NavLink to="/account" className={active}>{t('nav.account')}</NavLink>
        {isCompanyAdmin && <NavLink to="/company" className={active}>{t('nav.company')}</NavLink>}
        <a href={home}>{t('nav.home')}</a>
      </>
    )
  ) : (
    <>
      <a href={home}>{t('nav.home')}</a>
      <a href={`${home}#services`}>{t('nav.services')}</a>
    </>
  );

  return (
    <>
      <header className="site-header is-solid">
        <div className="container">
          <a className="brand" href={home} aria-label="The Luxury Club">
            <Logo />
          </a>
          <nav className="site-nav" aria-label={t('nav.menu')}>
            {links}
          </nav>
          <div className="header-actions">
            <button type="button" className="lang-switch" onClick={switchLang} lang={lang === 'ar' ? 'en' : 'ar'}>
              <Icon name="globe" />
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
            {session ? (
              <button type="button" className="login-link" onClick={logout}>
                <Icon name="logout" flip />
                {t('nav.logout')}
              </button>
            ) : (
              <Link className="login-link" to="/login">
                <Icon name="user" />
                {t('nav.login')}
              </Link>
            )}
            <button ref={toggleRef} className="menu-toggle" type="button" aria-controls="drawer" aria-expanded={open} aria-label={t('nav.menu')} onClick={() => setOpen(true)}>
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <div className={open ? 'drawer is-open' : 'drawer'} id="drawer" aria-hidden={!open}>
        <div className="drawer__top">
          <a className="brand" href={home} aria-label="The Luxury Club">
            <Logo />
          </a>
          <button
            className="menu-toggle"
            type="button"
            aria-label={t('nav.close')}
            onClick={() => {
              setOpen(false);
              toggleRef.current?.focus({ preventScroll: true });
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="drawer__nav" aria-label={t('nav.menu')} onClick={() => setOpen(false)}>
          {links}
          <button type="button" className="drawer__lang" onClick={switchLang}>
            {lang === 'ar' ? 'English' : 'العربية'} <Icon name="globe" />
          </button>
        </nav>
        <div className="drawer__foot">
          {session ? (
            <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={logout}>
              <Icon name="logout" flip />
              {t('nav.logout')}
            </button>
          ) : (
            <Link className="btn btn-gold btn-lg btn-block" to="/login" onClick={() => setOpen(false)}>
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
