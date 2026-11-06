// Landing page of the reset-password email (also "set your password" for imported members).
// Only a recovery session may set a password here; signed-in members change it from their profile.
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

export default function Reset() {
  const { t } = useT();
  const { session, ready, recovery } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  // The recovery link signs the user in from the URL; give supabase-js a moment to finish.
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

  if (!ready || (!recovery && !waited && !linkError)) return <PageLoader />;

  if (session && !recovery) return <Navigate to="/account/profile#security" replace />;

  if (!session) {
    return (
      <>
        <AuthHead icon="alert" title={t('auth.resetInvalidTitle')} lead={t('auth.resetInvalid')} />
        <Link className="btn btn-primary btn-block btn-lg" to="/forgot">
          <Icon name="send" />
          {t('auth.forgotBtn')}
        </Link>
        <Link className="auth-back" to="/login">
          <Icon name="arrow" className="icon-back" />
          {t('auth.backToLogin')}
        </Link>
      </>
    );
  }

  const imported = session.user.user_metadata?.imported === 'true';

  const onSubmit = async ({ password }: Values) => {
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      if (err.code === 'same_password') return setError(t('auth.samePassword'));
      if (err.code === 'weak_password') return setError(t('auth.passwordMin'));
      return setError(t('common.error'));
    }
    toast(t('auth.resetDone'));
    navigate('/account', { replace: true });
  };

  const e = formState.errors;
  return (
    <>
      <AuthHead icon="key" title={imported ? t('auth.setTitle') : t('auth.resetTitle')} lead={t('auth.resetLead')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="ui-form">
        <p className="auth-who">
          <Icon name="user" />
          <span dir="ltr">{session.user.email}</span>
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
          {formState.isSubmitting ? <Spinner small /> : t('auth.resetBtn')}
        </button>
      </form>
    </>
  );
}
