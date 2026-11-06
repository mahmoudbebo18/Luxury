// Landing page of the admin invitation email (Settings → Admins). The invite link signs the person in
// from the URL; here they choose a password and go straight to /admin. Same shape as Reset.tsx.
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, PasswordField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PasswordStrength } from '../../components/PasswordStrength';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { passwordChecks } from '../../lib/options';
import { AuthHead } from './AuthShell';

export default function Welcome() {
  const { t } = useT();
  const { session, ready, invited, isAdmin, account, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const schema = z
    .object({
      password: z.string().refine((p) => Object.values(passwordChecks(p)).every(Boolean), t('auth.passwordMin')),
      confirm: z.string().min(1, t('common.required')),
    })
    .refine((v) => v.password === v.confirm, { message: t('auth.passwordMismatch'), path: ['confirm'] });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState, watch, trigger } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  const linkError = params.get('error_description') ?? params.get('error');

  if (!ready || (!invited && !waited && !linkError)) return <PageLoader />;

  // Already signed in without a fresh invite link: nothing to set here.
  if (session && !invited) {
    if (account === undefined) return <PageLoader />;
    return <Navigate to={isAdmin ? '/admin' : '/account'} replace />;
  }

  if (!session) {
    return (
      <>
        <AuthHead icon="alert" title={t('welcome.invalidTitle')} lead={t('welcome.invalid')} />
        <Link className="btn btn-primary btn-block btn-lg" to="/login">
          <Icon name="lock" />
          {t('auth.loginLink')}
        </Link>
        <Link className="auth-back" to="/forgot">
          <Icon name="key" />
          {t('auth.forgotLink')}
        </Link>
      </>
    );
  }

  const name = String(session.user.user_metadata?.full_name ?? '');

  const onSubmit = async ({ password }: Values) => {
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      if (err.code === 'weak_password') return setError(t('auth.passwordMin'));
      return setError(t('common.error'));
    }
    await refreshAccount();
    toast(t('welcome.done'));
    navigate('/admin', { replace: true });
  };

  const e = formState.errors;
  return (
    <>
      <AuthHead icon="shield" title={t('welcome.title')} lead={t('welcome.lead')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="ui-form">
        <p className="auth-who">
          <Icon name="user" />
          <span className="auth-who__text">
            {name && <strong>{name}</strong>}
            <small dir="ltr">{session.user.email}</small>
          </span>
        </p>
        <div className="ui-field">
          <PasswordField
            label={t('auth.newPassword')}
            icon="lock"
            autoComplete="new-password"
            showLabel={t('common.show')}
            hideLabel={t('common.hide')}
            capsLabel={t('common.caps')}
            error={e.password?.message}
            {...register('password', { onChange: () => formState.touchedFields.confirm && trigger('confirm') })}
          />
          <PasswordStrength value={watch('password') ?? ''} />
        </div>
        <PasswordField
          label={t('auth.confirmPassword')}
          icon="shield"
          autoComplete="new-password"
          showLabel={t('common.show')}
          hideLabel={t('common.hide')}
          error={e.confirm?.message}
          {...register('confirm')}
        />
        <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : t('welcome.btn')}
        </button>
      </form>
    </>
  );
}
