import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { Alert, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/PageLoader';
import { AuthHead } from './AuthShell';
import { CheckEmail } from './CheckEmail';

export default function Forgot() {
  const { t } = useT();
  const [params] = useSearchParams();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ email: z.string().trim().min(1, t('common.required')).email(t('common.invalidEmail')) });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: params.get('email') ?? '' },
  });

  if (sentTo) return <CheckEmail email={sentTo} kind="recovery" />;

  const onSubmit = async ({ email }: Values) => {
    setError(null);
    const clean = email.trim().toLowerCase();
    const { error: err } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: `${location.origin}/reset` });
    // Same screen whether or not the address exists, so the form can't be used to probe accounts.
    if (err?.status === 429) return setError(t('auth.rateLimited'));
    if (err?.name === 'AuthRetryableFetchError') return setError(t('common.network'));
    setSentTo(clean);
  };

  return (
    <>
      <AuthHead icon="key" title={t('auth.forgotTitle')} lead={t('auth.forgotLead')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="ui-form">
        <TextField
          label={t('common.email')}
          icon="mail"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('auth.emailPh')}
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : (
            <>
              <Icon name="send" />
              {t('auth.forgotBtn')}
            </>
          )}
        </button>
      </form>
      <Link className="auth-back" to="/login">
        <Icon name="arrow" className="icon-back" />
        {t('auth.backToLogin')}
      </Link>
    </>
  );
}
