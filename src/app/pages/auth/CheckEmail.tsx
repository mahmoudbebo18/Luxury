// "Check your inbox" screen after sign-up or a reset request, with resend (rate-limited) and mail shortcuts.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { Alert } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { useCooldown } from '../../lib/useCooldown';

export function CheckEmail({ email, kind }: { email: string; kind: 'signup' | 'recovery' }) {
  const { t } = useT();
  const cooldown = useCooldown();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const resend = async () => {
    cooldown.start(60);
    const { error } =
      kind === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${location.origin}/account` } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` });
    setStatus(error ? { tone: 'error', text: t('auth.rateLimited') } : { tone: 'success', text: t('auth.confirmResent') });
  };

  const domain = email.split('@')[1] ?? '';
  const outlook = /(hotmail|outlook|live|msn)\./i.test(domain);
  const gmail = /gmail\.|googlemail\./i.test(domain);

  return (
    <div className="check-email">
      <motion.span
        className="check-email-icon"
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <Icon name="mail" />
        <span className="check-email-dot">
          <Icon name="check" />
        </span>
      </motion.span>
      <h1>{kind === 'signup' ? t('reg.doneTitle') : t('auth.forgotSentTitle')}</h1>
      {kind === 'signup' ? (
        <p>
          {t('reg.doneLead')} <strong dir="ltr">{email}</strong>
          <br />
          {t('reg.doneHint')}
        </p>
      ) : (
        <p>{t('auth.forgotSent', { email })}</p>
      )}

      <div className="check-email-actions">
        {(gmail || !outlook) && (
          <a className="btn btn-primary btn-block" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener">
            <Icon name="mail" />
            {t('auth.openGmail')}
          </a>
        )}
        {(outlook || !gmail) && (
          <a className={gmail || !outlook ? 'btn btn-ghost btn-block' : 'btn btn-primary btn-block'} href="https://outlook.live.com/mail/" target="_blank" rel="noopener">
            <Icon name="mail" />
            {t('auth.openOutlook')}
          </a>
        )}
      </div>

      <p className="check-email-spam">{t('auth.checkSpam')}</p>
      <button type="button" className="btn btn-soft btn-sm" onClick={resend} disabled={cooldown.left > 0}>
        <Icon name="refresh" />
        {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : kind === 'signup' ? t('auth.resendConfirm') : t('auth.forgotBtn')}
      </button>
      <AnimatePresence>{status && <Alert tone={status.tone}>{status.text}</Alert>}</AnimatePresence>
      <Link className="auth-back" to="/login">
        <Icon name="arrow" className="icon-back" />
        {t('auth.backToLogin')}
      </Link>
    </div>
  );
}
