// Sign-up: individual or business, two short steps each. An employee invite link (/register?invite=TOKEN)
// fixes the email to the invited one. The profile (and, for a business, the company) is created from
// the sign-up metadata by a database trigger; the account works after the emailed confirmation link.
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, Checkbox, PasswordField, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PasswordStrength } from '../../components/PasswordStrength';
import { Spinner } from '../../components/PageLoader';
import { PHONE_RE, cleanPhone, passwordChecks } from '../../lib/options';
import { readPricingNow, usePricing } from '../../lib/pricing';
import { AuthHead, AuthSwitch } from './AuthShell';
import { CheckEmail } from './CheckEmail';

type Kind = 'individual' | 'business' | 'invite';
type Invite = { ok: boolean; error?: string; company?: string; email?: string; full_name?: string; phone?: string };

const STEP1 = ['full_name', 'email', 'password', 'confirm'] as const;

export default function Register() {
  const { t, lang } = useT();
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pricing = usePricing();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite');
  const [kind, setKind] = useState<Kind | null>(
    inviteToken ? 'invite' : pathname.startsWith('/register/business') ? 'business' : params.get('kind') === 'individual' ? 'individual' : null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [dir, setDir] = useState(1);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; exists?: boolean } | null>(null);

  const invite = useQuery({
    queryKey: ['invite', inviteToken],
    enabled: !!inviteToken,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_invite', { p_token: inviteToken! });
      if (error) throw error;
      return data as unknown as Invite;
    },
  });

  const req = z.string().trim().min(1, t('common.required'));
  const isBiz = kind === 'business';
  const schema = z
    .object({
      full_name: req.refine((v) => v.split(/\s+/).length >= 2, t('reg.nameShort')),
      email: req.email(t('common.invalidEmail')),
      password: z.string().refine((p) => Object.values(passwordChecks(p)).every(Boolean), t('auth.passwordMin')),
      confirm: z.string().min(1, t('common.required')),
      phone: req.refine((v) => PHONE_RE.test(cleanPhone(v)), t('reg.phoneInvalid')),
      city: z.string().trim().max(60),
      legal_name: isBiz ? req.max(160) : z.string(),
      card_name: isBiz ? req.max(40) : z.string(),
      cr_number: z.string().trim().max(30),
      vat_number: z.string().trim().max(30),
      terms: z.boolean().refine((v) => v, t('reg.termsRequired')),
    })
    .refine((v) => v.password === v.confirm, { message: t('auth.passwordMismatch'), path: ['confirm'] });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, trigger, watch, formState, setFocus, setValue, getValues } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { full_name: '', email: '', password: '', confirm: '', phone: '', city: '', legal_name: '', card_name: '', cr_number: '', vat_number: '', terms: false },
  });
  const password = watch('password');
  const legalName = watch('legal_name');

  // Invite: the email is the invited one (the membership is matched on it).
  useEffect(() => {
    const d = invite.data;
    if (!d?.ok) return;
    setValue('email', d.email ?? '');
    if (d.full_name && !getValues('full_name')) setValue('full_name', d.full_name);
    if (d.phone && !getValues('phone')) setValue('phone', d.phone);
  }, [invite.data, setValue, getValues]);

  if (session && !doneEmail) return <Navigate to={inviteToken ? `/join/${inviteToken}` : isBiz ? '/company' : '/account'} replace />;
  if (doneEmail) return <CheckEmail email={doneEmail} kind="signup" />;

  const base = lang === 'en' ? '/en' : '';
  const termsLabel = (
    <>
      {t('reg.terms', { terms: '\u0001', privacy: '\u0002' })
        .split(/([\u0001\u0002])/)
        .map((part, i) =>
          part === '\u0001' ? <a key={i} href={`${base}/terms`} target="_blank" rel="noopener">{t('reg.termsLink')}</a>
          : part === '\u0002' ? <a key={i} href={`${base}/privacy`} target="_blank" rel="noopener">{t('reg.privacyLink')}</a>
          : part,
        )}
    </>
  );

  // ---------------------------------------------------------------- choose the type
  if (!kind) {
    return (
      <>
        <AuthHead title={t('reg.title')} lead={t('reg.kindTitle')} />
        <div className="kind-picker">
          {(['individual', 'business'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="kind-option"
              onClick={() => {
                setKind(k);
                navigate(k === 'business' ? `/register/business${location.search}` : `/register${location.search}`, { replace: true });
              }}
            >
              <span className="kind-option__icon"><Icon name={k === 'business' ? 'building' : 'user'} /></span>
              <span className="kind-option__text">
                <strong>{t(k === 'business' ? 'reg.business' : 'reg.individual')}</strong>
                <small>{k === 'business' ? t('reg.businessLead') : t('reg.individualLead', { price: pricing.priceText })}</small>
              </span>
              <Icon name="arrow" className="icon-flip kind-option__arrow" />
            </button>
          ))}
        </div>
        <AuthSwitch text={t('auth.haveAccount')} to="/login" label={t('auth.loginLink')} />
      </>
    );
  }

  if (kind === 'invite' && invite.isLoading) return <div className="auth-center"><Spinner /></div>;
  const inviteError = kind === 'invite' && (invite.isError || (invite.data && !invite.data.ok));

  const goNext = async () => {
    if (!(await trigger([...STEP1], { shouldFocus: true }))) return;
    setDir(1);
    setStep(2);
    setTimeout(() => setFocus(isBiz ? 'legal_name' : 'phone'), 320);
  };
  const goBack = () => {
    setDir(-1);
    setStep(1);
  };

  const onSubmit = async (v: Values) => {
    setStatus(null);
    const email = v.email.trim().toLowerCase();
    const termsVersion = (await readPricingNow(qc).catch(() => null))?.terms_version ?? 1;
    const redirect = kind === 'invite' ? `/join/${inviteToken}` : isBiz ? '/company' : '/checkout';
    const { data, error } = await supabase.auth.signUp({
      email,
      password: v.password,
      options: {
        emailRedirectTo: `${location.origin}${redirect}`,
        data: {
          signup_kind: kind,
          full_name: v.full_name.trim().replace(/\s+/g, ' '),
          phone: cleanPhone(v.phone),
          city: v.city.trim(),
          lang,
          terms_version: String(termsVersion),
          ...(isBiz && {
            company: {
              legal_name: v.legal_name.trim(),
              card_name: v.card_name.trim(),
              cr_number: v.cr_number.trim(),
              vat_number: v.vat_number.trim(),
              city: v.city.trim(),
            },
          }),
        },
      },
    });
    if (error) {
      const code = error.code;
      if (code === 'user_already_exists' || code === 'email_exists') return setStatus({ text: t('reg.exists'), exists: true });
      if (code === 'weak_password') return setStatus({ text: t('auth.passwordMin') });
      if (error.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return setStatus({ text: t('auth.rateLimited') });
      if (error.name === 'AuthRetryableFetchError') return setStatus({ text: t('common.network') });
      return setStatus({ text: t('common.error') });
    }
    if (data.user && data.user.identities?.length === 0) return setStatus({ text: t('reg.exists'), exists: true });
    setDoneEmail(email);
  };

  const onInvalid = (errs: Partial<Record<keyof Values, unknown>>) => {
    if (STEP1.some((k) => errs[k])) goBack();
  };

  const e = formState.errors;
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: 40 * d * (lang === 'ar' ? -1 : 1) }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: -40 * d * (lang === 'ar' ? -1 : 1) }),
  };
  const stepLabels = isBiz ? ['reg.stepAccount', 'reg.stepCompany'] as const : ['reg.stepAccount', 'reg.stepDetails'] as const;
  const title = kind === 'invite' && invite.data?.ok ? t('reg.inviteFor', { company: invite.data.company ?? '' }) : t(isBiz ? 'reg.business' : 'reg.individual');
  const lead = kind === 'invite' ? t('reg.inviteLead') : t(isBiz ? 'reg.leadBusiness' : 'reg.leadIndividual');

  if (inviteError) {
    const err = invite.data?.error ?? 'invalid';
    return (
      <>
        <AuthHead icon="alert" title={t('join.err.invalid')} lead={t(`join.err.${err === 'used' || err === 'contract_inactive' ? err : 'invalid'}` as 'join.err.invalid')} />
        <Link className="btn btn-primary btn-block btn-lg" to="/login">{t('auth.loginLink')}</Link>
      </>
    );
  }

  return (
    <>
      <AuthHead title={title} lead={lead} />
      {kind !== 'invite' && (
        <button type="button" className="kind-switch" onClick={() => { setKind(null); navigate('/register', { replace: true }); }}>
          <Icon name={isBiz ? 'building' : 'user'} />
          {t(isBiz ? 'reg.business' : 'reg.individual')}
          <span>{lang === 'ar' ? 'تغيير' : 'Change'}</span>
        </button>
      )}

      <ol className="steps" aria-label={t('reg.stepOf', { n: step, total: 2 })}>
        {[1, 2].map((n) => (
          <li key={n} className={n === step ? 'is-current' : n < step ? 'is-done' : undefined} aria-current={n === step ? 'step' : undefined}>
            <span className="steps-dot">{n < step ? <Icon name="check" /> : n}</span>
            <span className="steps-label">{t(stepLabels[n - 1])}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="ui-form">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          {step === 1 ? (
            <motion.div key="s1" className="ui-form" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              {isBiz && <p className="form-section-title">{t('reg.contactTitle')}</p>}
              <TextField label={t('reg.name')} icon="user" autoComplete="name" placeholder={t('reg.namePh')} error={e.full_name?.message} {...register('full_name')} />
              <TextField
                label={kind === 'invite' ? t('reg.inviteEmail') : t('common.email')}
                icon="mail"
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                readOnly={kind === 'invite'}
                className={kind === 'invite' ? 'ui-input--locked' : undefined}
                placeholder={t('auth.emailPh')}
                error={e.email?.message}
                {...register('email')}
              />
              <div className="ui-field">
                <PasswordField
                  label={t('common.password')}
                  icon="lock"
                  autoComplete="new-password"
                  showLabel={t('common.show')}
                  hideLabel={t('common.hide')}
                  capsLabel={t('common.caps')}
                  error={e.password?.message}
                  {...register('password', { onChange: () => formState.touchedFields.confirm && trigger('confirm') })}
                />
                <PasswordStrength value={password} />
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
              <button type="button" className="btn btn-primary btn-block btn-lg" onClick={goNext}>
                {t('common.next')}
                <Icon name="arrow" className="icon-flip" />
              </button>
            </motion.div>
          ) : (
            <motion.div key="s2" className="ui-form" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              {isBiz && (
                <>
                  <TextField label={t('reg.companyLegal')} icon="building" placeholder={t('reg.companyLegalPh')} error={e.legal_name?.message}
                    {...register('legal_name', { onBlur: () => !getValues('card_name') && legalName && setValue('card_name', legalName.slice(0, 40)) })} />
                  <TextField label={t('reg.cardName')} icon="card" maxLength={40} hint={t('reg.cardNameHint')} error={e.card_name?.message} {...register('card_name')} />
                  <div className="ui-grid">
                    <TextField label={t('reg.cr')} icon="hash" dir="ltr" inputMode="numeric" optional={t('common.optional')} {...register('cr_number')} />
                    <TextField label={t('reg.vat')} icon="receipt" dir="ltr" inputMode="numeric" optional={t('common.optional')} hint={t('reg.vatHint')} {...register('vat_number')} />
                  </div>
                </>
              )}
              <div className="ui-grid">
                <TextField label={t('reg.phone')} icon="phone" type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder={t('reg.phonePh')} error={e.phone?.message} {...register('phone')} />
                <TextField label={t('reg.city')} icon="pin" autoComplete="address-level2" placeholder={t('reg.cityPh')} optional={t('common.optional')} {...register('city')} />
              </div>
              <Checkbox error={e.terms?.message} {...register('terms')}>
                {termsLabel}
              </Checkbox>

              <AnimatePresence>
                {status && (
                  <Alert tone="error">
                    {status.text}
                    {status.exists && (
                      <div>
                        <Link className="link-button" to={`/login?email=${encodeURIComponent(watch('email'))}`}>{t('reg.existsAction')}</Link>
                      </div>
                    )}
                  </Alert>
                )}
              </AnimatePresence>

              <div className="step-actions">
                <button type="button" className="btn btn-ghost btn-lg" onClick={goBack}>
                  <Icon name="arrow" className="icon-back" />
                  {t('common.back')}
                </button>
                <button className="btn btn-primary btn-lg" type="submit" disabled={formState.isSubmitting}>
                  {formState.isSubmitting ? <Spinner small /> : (
                    <>
                      <Icon name="sparkle" />
                      {t('reg.submit')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
      <AuthSwitch text={t('auth.haveAccount')} to={inviteToken ? `/login?next=${encodeURIComponent(`/join/${inviteToken}`)}` : '/login'} label={t('auth.loginLink')} />
    </>
  );
}
