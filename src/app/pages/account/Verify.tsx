// What a service provider sees after scanning a member's QR: name, number, status, end date and the
// company, never the phone or email (get_member_card is public by design).
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/PageLoader';
import { formatDate, formatTime } from '../../lib/format';

type Card = { ok: boolean; status?: 'active' | 'expired' | 'suspended' | 'none'; name?: string; member_no?: string; company?: string | null; expires_at?: string | null };

export default function Verify() {
  const { t, lang } = useT();
  const { code = '' } = useParams();
  const card = useQuery({
    queryKey: ['verify', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_member_card', { p_code: code });
      if (error) throw error;
      return data as unknown as Card;
    },
  });

  if (card.isLoading) return <div className="container page auth-center"><Spinner /></div>;
  const c = card.data;
  if (!c?.ok) {
    return (
      <div className="container page">
        <div className="verify verify--invalid">
          <span className="verify__icon"><Icon name="x-circle" /></span>
          <h1>{t('verify.invalid')}</h1>
          <p>{t('verify.invalidLead')}</p>
        </div>
      </div>
    );
  }
  const ok = c.status === 'active';
  return (
    <div className="container page">
      <div className={ok ? 'verify verify--ok' : 'verify verify--bad'}>
        <span className="eyebrow">{t('verify.title')}</span>
        <span className="verify__icon"><Icon name={ok ? 'check-circle' : 'alert'} /></span>
        <h1>{t(`verify.${c.status === 'active' ? 'valid' : c.status ?? 'none'}` as 'verify.valid')}</h1>
        <dl>
          <div><dt>{t('reg.name')}</dt><dd>{c.name}</dd></div>
          <div><dt>{t('card.memberNo')}</dt><dd dir="ltr">{c.member_no ?? '—'}</dd></div>
          {c.company && <div><dt>{t('verify.company')}</dt><dd>{c.company}</dd></div>}
          {c.expires_at && <div><dt>{t('card.validThru')}</dt><dd>{formatDate(c.expires_at, lang)}</dd></div>}
        </dl>
        <small>{t('verify.checkedAt', { time: formatTime(new Date().toISOString(), lang) })}</small>
      </div>
    </div>
  );
}
