import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, PasswordField, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/PageLoader';
import { useCooldown } from '../../lib/useCooldown';
import { AuthHead, AuthSwitch } from './AuthShell';

/** Only same-site paths are allowed after login (no open redirect). */
export function safeNext(raw: string | null, fallback = '/account') {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : fallback;
}

export default function Login() {
  const { t } = useT();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const cooldown = useCooldown();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string; unconfirmed?: boolean } | null>(null);

  const schema = z.object({
    email: z.string().trim().min(1, t('common.required')).email(t('common.invalidEmail')),
    password: z.string().min(1, t('common.required')),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, getValues, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: params.get('email') ?? '' },
  });

  if (session) return <Navigate to={next} replace />;

  const onSubmit = async (values: Values) => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword({ email: values.email.toLowerCase(), password: values.password });
    if (!error) return navigate(next, { replace: true });
    if (error.code === 'email_not_confirmed') setStatus({ tone: 'error', text: t('auth.notConfirmed'), unconfirmed: true });
    else if (error.status === 429 || error.code === 'over_request_rate_limit') setStatus({ tone: 'error', text: t('auth.rateLimited') });
    else if (error.code === 'invalid_credentials') setStatus({ tone: 'error', text: t('auth.badCredentials') });
    else if (error.name === 'AuthRetryableFetchError') setStatus({ tone: 'error', text: t('common.network') });
    else setStatus({ tone: 'error', text: t('common.error') });
  };

  const resend = async () => {
    cooldown.start(60);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: getValues('email').trim().toLowerCase(),
      options: { emailRedirectTo: `${location.origin}/account` },
    });
    setStatus(error ? { tone: 'error', text: t('auth.rateLimited') } : { tone: 'success', text: t('auth.confirmResent') });
  };

  const e = formState.errors;
  return (
    <>
      <AuthHead title={t('auth.loginTitle')} lead={t('auth.loginLead')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="ui-form">
        <TextField
          label={t('common.email')}
          icon="mail"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('auth.emailPh')}
          error={e.email?.message}
          {...register('email')}
        />
        <div className="auth-pass">
          <PasswordField
            label={t('common.password')}
            icon="lock"
            autoComplete="current-password"
            placeholder={t('auth.passwordPh')}
            showLabel={t('common.show')}
            hideLabel={t('common.hide')}
            capsLabel={t('common.caps')}
            error={e.password?.message}
            {...register('password')}
          />
          <Link className="auth-forgot" to="/forgot">{t('auth.forgotLink')}</Link>
        </div>
        <AnimatePresence>
          {status && (
            <Alert tone={status.tone}>
              {status.text}
              {status.unconfirmed && (
                <div>
                  <button type="button" className="link-button" onClick={resend} disabled={cooldown.left > 0}>
                    {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resendConfirm')}
                  </button>
                </div>
              )}
            </Alert>
          )}
        </AnimatePresence>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : (
            <>
              {t('auth.loginBtn')}
              <Icon name="arrow" className="icon-flip" />
            </>
          )}
        </button>
      </form>
      <AuthSwitch text={t('auth.noAccount')} to="/register" label={t('auth.register')} />
    </>
  );
}
