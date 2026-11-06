// Accepting a company seat: a personal invite (/join/:token, email must match) or the company's
// shared link (/join/link/:token). Signed-out visitors are sent to sign in or register first.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/PageLoader';

type Check = { ok: boolean; error?: string; company?: string; email?: string; email_domain?: string | null };
type Accept = { ok: boolean; error?: string; email?: string; domain?: string; already?: boolean };

export default function Join({ kind }: { kind: 'invite' | 'link' }) {
  const { t } = useT();
  const { token = '' } = useParams();
  const { session, account, refreshAccount } = useAuth();
  const [result, setResult] = useState<Accept | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useQuery({
    queryKey: ['join', kind, token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(kind === 'invite' ? 'check_invite' : 'check_join_link', { p_token: token });
      if (error) throw error;
      return data as unknown as Check;
    },
  });

  const accept = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc(kind === 'invite' ? 'accept_invite' : 'join_by_link', { p_token: token });
    setBusy(false);
    const r = (error ? { ok: false, error: 'invalid' } : data) as Accept;
    setResult(r);
    if (r.ok) refreshAccount();
  };

  if (check.isLoading) return <div className="container page auth-center"><Spinner /></div>;
  const c = check.data;
  const company = c?.company ?? '';
  const here = `/join/${kind === 'link' ? 'link/' : ''}${token}`;
  const err = (code?: string, vars: Record<string, string> = {}) =>
    t(`join.err.${code && ['invalid', 'used', 'contract_inactive', 'email_mismatch', 'no_seats', 'domain'].includes(code) ? code : 'invalid'}` as 'join.err.invalid', vars);

  return (
    <div className="container page">
      <div className="join-box">
        <span className="join-box__icon"><Icon name="building" /></span>
        {!c?.ok ? (
          <>
            <h1>{err(c?.error)}</h1>
            <Link className="btn btn-primary" to="/account">{t('nav.account')}</Link>
          </>
        ) : result?.ok ? (
          <>
            <h1>{t('join.done', { company })}</h1>
            <Link className="btn btn-gold btn-lg" to="/account">{t('checkout.okBtn')}</Link>
          </>
        ) : (
          <>
            <h1>{t(kind === 'invite' ? 'join.title' : 'join.linkTitle', { company })}</h1>
            {!session ? (
              <>
                <p>{t('join.lead')}</p>
                {c.email && <p className="join-box__email" dir="ltr">{c.email}</p>}
                <div className="join-box__actions">
                  <Link className="btn btn-gold btn-lg" to={kind === 'invite' ? `/register?invite=${token}` : `/register?kind=individual&next=${encodeURIComponent(here)}`}>{t('join.registerBtn')}</Link>
                  <Link className="btn btn-ghost btn-lg" to={`/login?next=${encodeURIComponent(here)}`}>{t('join.loginBtn')}</Link>
                </div>
              </>
            ) : (
              <>
                <p dir="ltr" className="join-box__email">{account?.email}</p>
                {result && !result.ok && <p className="join-box__error">{err(result.error, { email: result.email ?? '', domain: result.domain ?? '' })}</p>}
                <button type="button" className="btn btn-gold btn-lg" onClick={accept} disabled={busy}>
                  {busy ? <Spinner small /> : t('join.accept')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
