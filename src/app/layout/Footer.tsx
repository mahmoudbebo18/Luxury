// Compact version of the public footer for platform pages, plus the WhatsApp button.
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';
import { CLUB_WHATSAPP } from '../lib/services';

export function Footer() {
  const { t, lang } = useT();
  const { account } = useAuth();
  const base = lang === 'en' ? '/en' : '';
  const hello = account?.member_no
    ? t('wa.messageMember', { name: account.full_name, no: account.member_no })
    : t('wa.message');
  return (
    <>
      <footer className="site-footer site-footer--compact">
        <div className="container site-footer__bottom">
          <span>© {new Date().getFullYear()} The Luxury Club</span>
          <span className="footer-mini-links">
            <a href={`${base}/terms`}>{lang === 'ar' ? 'الشروط والأحكام' : 'Terms'}</a>
            <a href={`${base}/privacy`}>{lang === 'ar' ? 'الخصوصية' : 'Privacy'}</a>
            <a href={`${base}/refund`}>{lang === 'ar' ? 'الاسترجاع' : 'Refunds'}</a>
          </span>
        </div>
      </footer>
      <a className="wa-float" href={`https://wa.me/${CLUB_WHATSAPP}?text=${encodeURIComponent(hello)}`} target="_blank" rel="noopener" aria-label={t('wa.open')}>
        <svg className="icon" aria-hidden="true">
          <use href="/imgs/icons.svg#i-whatsapp" />
        </svg>
      </a>
    </>
  );
}

export function FooterIcon() {
  return <Icon name="whatsapp" />;
}
