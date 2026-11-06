// The digital membership card (same look as the card on the public pages), with the QR that opens
// the verification page (/v/:code) for service providers.
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Account } from '../auth/AuthProvider';
import { useT } from '../i18n';

function mmYY(iso: string) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', month: '2-digit', year: '2-digit' }).formatToParts(d);
  return `${p.find((x) => x.type === 'month')?.value} / ${p.find((x) => x.type === 'year')?.value}`;
}

export const verifyUrl = (code: string) => `${location.origin}/v/${code}`;

export const MemberCard = forwardRef<HTMLDivElement, { account: Account; withQr?: boolean }>(function MemberCard({ account, withQr = true }, ref) {
  const { t } = useT();
  const m = account.membership;
  const corporate = m?.kind === 'corporate';
  return (
    <div ref={ref} className={account.status === 'active' ? 'member-card member-card--app' : 'member-card member-card--app is-inactive'}>
      <div className="member-card__top">
        <svg className="member-card__logo" aria-hidden="true"><use href="/imgs/icons.svg#logo" /></svg>
        <span className="member-card__tier">{corporate ? 'Corporate' : 'Member'}</span>
      </div>
      {withQr && account.status === 'active' ? (
        <span className="member-card__qr" aria-label={t('account.qrHint')}>
          <QRCodeSVG value={verifyUrl(account.member_code)} size={64} bgColor="transparent" fgColor="#ecdcb8" level="M" />
        </span>
      ) : (
        <span className="member-card__chip" />
      )}
      <div className="member-card__bottom">
        <div>
          {corporate && m?.company && <div className="member-card__company">{m.company}</div>}
          <div className="member-card__name">{account.full_name.toUpperCase()}</div>
          <div className="member-card__no">{account.member_no?.replace('-', ' · ') ?? '—'}</div>
        </div>
        {m && (
          <div className="member-card__exp">
            Valid thru<span>{mmYY(m.expires_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
});
