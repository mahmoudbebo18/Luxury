import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, PasswordField, SelectField, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PasswordStrength } from '../../components/PasswordStrength';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { PHONE_RE, cleanPhone, passwordChecks } from '../../lib/options';
import { useCooldown } from '../../lib/useCooldown';

export default function Profile() {
  const { t, lang, setLang } = useT();
  const { account: profile, isAdmin, refreshAccount } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const req = z.string().trim().min(1, t('common.required'));
  const schema = z.object({
    full_name: req.refine((v) => v.split(/\s+/).length >= 2, t('reg.nameShort')),
    phone: req.refine((v) => PHONE_RE.test(cleanPhone(v)), t('reg.phoneInvalid')),
    city: z.string().trim().max(60),
    lang: z.enum(['ar', 'en']),
  });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    values: profile
      ? { full_name: profile.full_name, phone: profile.phone, city: profile.city, lang: profile.lang }
      : undefined,
  });

  if (!profile) return <PageLoader />;

  // The admin account has no membership details: only its password is managed here.
  if (isAdmin) {
    return (
      <div className="container page page--narrow">
        <Link className="back-link" to="/admin">
          <Icon name="arrow" className="icon-back" />
          {t('nav.admin')}
        </Link>
        <motion.header className="page-head" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="avatar avatar--lg" aria-hidden="true">{profile.full_name.trim().charAt(0)}</span>
          <div>
            <h1>{profile.full_name}</h1>
            <p dir="ltr" className="page-head-email">{profile.email}</p>
          </div>
        </motion.header>
        <ChangePassword email={profile.email} />
      </div>
    );
  }

  const onSubmit = async (values: Values) => {
    setError(null);
    const clean = { full_name: values.full_name.trim().replace(/\s+/g, ' '), phone: cleanPhone(values.phone), city: values.city.trim(), lang: values.lang };
    const { error: err } = await supabase.from('profiles').update(clean).eq('id', profile.id);
    if (err) return setError(t('common.error'));
    await queryClient.invalidateQueries({ queryKey: ['account'] });
    await refreshAccount();
    if (values.lang !== lang) setLang(values.lang);
    reset(values);
    toast(t('profile.saved'));
  };

  const e = formState.errors;
  return (
    <div className="container page page--narrow">
      <Link className="back-link" to="/account">
        <Icon name="arrow" className="icon-back" />
        {t('nav.account')}
      </Link>
      <motion.header className="page-head" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="avatar avatar--lg" aria-hidden="true">{profile.full_name.trim().charAt(0)}</span>
        <div>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.lead')}</p>
        </div>
      </motion.header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="profile-form">
        <motion.section className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2 className="surface-title"><Icon name="user" />{t('profile.personal')}</h2>
          <div className="ui-grid">
            <TextField label={t('profile.name')} icon="user" autoComplete="name" full error={e.full_name?.message} {...register('full_name')} />
            <TextField label={t('profile.phone')} icon="phone" type="tel" dir="ltr" inputMode="tel" autoComplete="tel" error={e.phone?.message} {...register('phone')} />
            <TextField label={t('reg.city')} icon="pin" error={e.city?.message} {...register('city')} />
            <TextField label={t('common.email')} icon="mail" type="email" dir="ltr" value={profile.email} disabled readOnly full hint={t('profile.emailLocked')} />
          </div>
        </motion.section>

        <motion.section className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="surface-title"><Icon name="globe" />{lang === 'ar' ? 'لغة الرسائل' : 'Email language'}</h2>
          <SelectField label={lang === 'ar' ? 'اللغة' : 'Language'} icon="globe" {...register('lang')}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </SelectField>
        </motion.section>

        <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>

        <AnimatePresence>
          {formState.isDirty && (
            <motion.div className="save-bar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
              <span>{t('common.save')}?</span>
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => reset()}>{t('common.cancel')}</button>
                <button className="btn btn-gold btn-sm" type="submit" disabled={formState.isSubmitting}>
                  {formState.isSubmitting ? <Spinner small /> : <><Icon name="check" />{t('common.save')}</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <ChangePassword email={profile.email} />
    </div>
  );
}

// Changing the password from a signed-in session requires the current password, so a borrowed
// unlocked phone can't take over the account.
function ChangePassword({ email }: { email: string }) {
  const { t } = useT();
  const toast = useToast();
  const cooldown = useCooldown();
  const [error, setError] = useState<string | null>(null);

  const schema = z
    .object({
      current: z.string().min(1, t('common.required')),
      password: z.string().refine((p) => Object.values(passwordChecks(p)).every(Boolean), t('auth.passwordMin')),
      confirm: z.string().min(1, t('common.required')),
    })
    .refine((v) => v.password === v.confirm, { message: t('auth.passwordMismatch'), path: ['confirm'] })
    .refine((v) => v.password !== v.current, { message: t('auth.samePassword'), path: ['password'] });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState, watch, reset, setError: setFieldError, trigger } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const onSubmit = async (v: Values) => {
    setError(null);
    const check = await supabase.auth.signInWithPassword({ email, password: v.current });
    if (check.error) {
      if (check.error.status === 429) return setError(t('auth.rateLimited'));
      return setFieldError('current', { message: t('profile.currentWrong') }, { shouldFocus: true });
    }
    const { error: err } = await supabase.auth.updateUser({ password: v.password });
    if (err) return setError(err.code === 'same_password' ? t('auth.samePassword') : err.code === 'weak_password' ? t('auth.passwordMin') : t('common.error'));
    reset({ current: '', password: '', confirm: '' });
    toast(t('profile.passwordChanged'));
  };

  const sendReset = async () => {
    cooldown.start(60);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` });
    if (err) setError(t('auth.rateLimited'));
    else toast(t('profile.resetSent'));
  };

  const e = formState.errors;
  return (
    <motion.section id="security" className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <h2 className="surface-title"><Icon name="shield" />{t('profile.changePassword')}</h2>
      <p className="surface-lead">{t('profile.changePasswordLead')}</p>
      <form className="ui-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <PasswordField label={t('profile.currentPassword')} icon="lock" autoComplete="current-password" showLabel={t('common.show')} hideLabel={t('common.hide')} error={e.current?.message} {...register('current')} />
        <div className="ui-grid">
          <div className="ui-field">
            <PasswordField
              label={t('auth.newPassword')}
              icon="key"
              autoComplete="new-password"
              showLabel={t('common.show')}
              hideLabel={t('common.hide')}
              error={e.password?.message}
              {...register('password', { onChange: () => formState.touchedFields.confirm && trigger('confirm') })}
            />
            <PasswordStrength value={watch('password') ?? ''} />
          </div>
          <PasswordField label={t('auth.confirmPassword')} icon="shield" autoComplete="new-password" showLabel={t('common.show')} hideLabel={t('common.hide')} error={e.confirm?.message} {...register('confirm')} />
        </div>
        <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
        <div className="surface-actions">
          <button type="button" className="link-button" onClick={sendReset} disabled={cooldown.left > 0}>
            {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('profile.forgotCurrent')}
          </button>
          <button className="btn btn-primary" type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Spinner small /> : t('profile.changePassword')}
          </button>
        </div>
      </form>
    </motion.section>
  );
}
