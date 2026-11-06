// Account overview tab: the membership (days left, the year's progress, renewal), the card with its
// QR, quick service buttons, the latest payment and the member's details at a glance.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { MemberCard, verifyUrl } from '../../components/MemberCard';
import { daysLeft, formatDate, formatMoney } from '../../lib/format';
import { anchorOf, pick } from '../../lib/services';
import { methodLabel, orderLabel, statusLabel, useMyOrders, useMyServices } from './shared';

export default function Dashboard() {
  const { t, lang } = useT();
  const { account } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const services = useMyServices();
  const orders = useMyOrders();

  if (!account) return null;
  const m = account.membership;
  const isCompanyAdmin = account.companies.length > 0;
  const company = account.companies[0];
  const hasMembership = account.status !== 'none';
  const active = account.status === 'active';
  const left = m ? daysLeft(m.expires_at) : 0;
  const span = m ? new Date(m.expires_at).getTime() - new Date(m.starts_at).getTime() : 1;
  const pct = m ? Math.min(100, Math.max(0, Math.round(((Date.now() - new Date(m.starts_at).getTime()) / span) * 100))) : 100;
  const lastPaid = orders.data?.find((o) => o.status === 'paid');

  const saveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `luxury-club-${account.member_no ?? 'card'}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ov">
      {account.status === 'suspended' && (
        <div className="acct-note acct-note--warn">
          <div>
            <strong>{t('account.suspendedTitle')}</strong>
            <p>{t('account.suspendedLead')}</p>
          </div>
        </div>
      )}

      {isCompanyAdmin && (
        <div className="acct-note acct-note--company">
          <span className="acct-note__icon"><Icon name="building" /></span>
          <div>
            <strong>{t('account.companyTitle', { company: company.name })}</strong>
            <p>{account.status === 'none' ? t('account.businessNoMember') : t('account.companyLead')}</p>
          </div>
          <Link className="btn btn-primary" to="/company">{t('account.companyBtn')}</Link>
        </div>
      )}

      {!hasMembership && !isCompanyAdmin && (
        <section className="acct-note acct-note--pay ov-join">
          <div>
            <strong>{t('account.payTitle')}</strong>
            <p>{t('account.payLead')}</p>
          </div>
          <Link className="btn btn-gold btn-lg" to="/checkout">
            {t('account.payBtn')} <Icon name="arrow" className="icon-flip" />
          </Link>
        </section>
      )}

      {hasMembership && (
        <div className="ov-top">
          <section className="ov-panel ov-membership">
            <header className="ov-panel__head">
              <h2>{t('acc.membership')}</h2>
              <span className={`badge badge--${account.status}`}>{t(`status.${account.status}`)}</span>
            </header>

            <div className="ov-days">
              <strong>{left}</strong>
              <span>{t('acc.daysLeft')}</span>
            </div>
            <div className="ov-progress" role="img" aria-label={t('acc.yearProgress', { pct })}>
              <span style={{ inlineSize: `${pct}%` }} />
            </div>
            {m && (
              <div className="ov-progress__ends">
                <span>{formatDate(m.starts_at, lang)}</span>
                <span>{formatDate(m.expires_at, lang)}</span>
              </div>
            )}

            <dl className="ov-facts">
              <div>
                <dt>{t('acc.memberNo')}</dt>
                <dd dir="ltr">{account.member_no ?? '—'}</dd>
              </div>
              <div>
                <dt>{t('acc.kind')}</dt>
                <dd>{m?.kind === 'corporate' && m.company ? t('acc.kind.corporate', { company: m.company }) : t('acc.kind.individual')}</dd>
              </div>
              {m ? (
                <div>
                  <dt>{t('acc.expires')}</dt>
                  <dd>{formatDate(m.expires_at, lang)}</dd>
                </div>
              ) : (
                account.last_expires_at && (
                  <div>
                    <dt>{t('acc.ended')}</dt>
                    <dd>{formatDate(account.last_expires_at, lang)}</dd>
                  </div>
                )
              )}
            </dl>

            <div className="ov-renew">
              {account.next_starts_at ? (
                <p className="acct-hint"><Icon name="check-circle" /> {t('account.nextYear', { date: formatDate(account.next_starts_at, lang) })}</p>
              ) : account.status === 'expired' ? (
                <>
                  <p>{t('account.expiredLead')}</p>
                  <Link className="btn btn-gold" to="/checkout">{t('account.renew')}</Link>
                </>
              ) : m?.kind === 'corporate' ? (
                <p><Icon name="building" /> {t('acc.corporateRenew')}</p>
              ) : left <= 60 ? (
                <>
                  <p>{t('account.renewEarlyHint')}</p>
                  <Link className="btn btn-gold" to="/checkout">{t('account.renewEarly')}</Link>
                </>
              ) : (
                <p><Icon name="info" /> {t('acc.renewLater')}</p>
              )}
            </div>
          </section>

          <section className="acct-card ov-card">
            <MemberCard ref={cardRef} account={account} />
            <div className="acct-card__actions">
              {active && (
                <button type="button" className="btn btn-primary" onClick={() => setQrOpen(true)}>
                  <Icon name="qr" /> {t('account.showQr')}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={saveImage} disabled={saving}>
                <Icon name="download" /> {saving ? t('account.saving') : t('account.saveImage')}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="ov-section">
        <div className="acct-section-head">
          <h2>{hasMembership ? t('account.services') : t('acc.includes')}</h2>
          {hasMembership ? (
            <Link className="link-arrow" to="/account/services">{t('account.allServices')} <Icon name="arrow" className="icon-flip" /></Link>
          ) : (
            <p className="muted">{t('acc.includesLead')}</p>
          )}
        </div>
        <div className="acct-services__grid">
          {(services.data ?? []).map((s) => {
            const body = (
              <>
                <span className="acct-svc__icon"><Icon name={s.icon} /></span>
                <strong>{pick(s, 'title', lang)}</strong>
                <small>
                  {active
                    ? s.quota
                      ? t('svc.remaining', { left: Math.max(0, s.quota - s.used), quota: s.quota })
                      : t('svc.unlimited')
                    : pick(s, 'summary', lang) || t('acc.locked')}
                </small>
                {active ? (
                  <span className="acct-svc__go">{t('acc.request')} <Icon name="arrow" className="icon-flip" /></span>
                ) : (
                  <span className="acct-svc__go is-locked"><Icon name="lock" /> {t('acc.locked')}</span>
                )}
              </>
            );
            return active ? (
              <Link key={s.id} to={`/account/services#${anchorOf(s)}`} className="acct-svc">{body}</Link>
            ) : (
              <div key={s.id} className="acct-svc acct-svc--static">{body}</div>
            );
          })}
        </div>
      </section>

      <div className="ov-bottom">
        <section className="ov-panel">
          <header className="ov-panel__head">
            <h2>{t('acc.lastPayment')}</h2>
            <Link className="link-arrow" to="/account/payments">{t('acc.allPayments')} <Icon name="arrow" className="icon-flip" /></Link>
          </header>
          {lastPaid ? (
            <div className="ov-pay">
              <span className="ov-pay__icon"><Icon name="receipt" /></span>
              <div className="ov-pay__main">
                <strong>{t(orderLabel(lastPaid), { n: lastPaid.quantity })}</strong>
                <small dir="ltr" className="mono">{lastPaid.order_no}</small>
              </div>
              <div className="ov-pay__amount">
                <strong>{formatMoney(lastPaid.total)} <small>{t('common.sar')}</small></strong>
                <span className={`badge badge--${lastPaid.status}`}>{t(statusLabel(lastPaid))}</span>
              </div>
              <dl className="ov-details ov-pay__facts">
                <div><dt><Icon name="calendar" />{t('pay.paidOn')}</dt><dd>{formatDate(lastPaid.paid_at ?? lastPaid.created_at, lang)}</dd></div>
                {lastPaid.method && <div><dt><Icon name="wallet" />{t('pay.method')}</dt><dd>{t(methodLabel(lastPaid)!)}</dd></div>}
                {lastPaid.mf_payment_id && <div><dt><Icon name="hash" />{t('pay.ref')}</dt><dd dir="ltr" className="mono">{lastPaid.mf_payment_id}</dd></div>}
              </dl>
              <Link className="btn btn-ghost btn-sm ov-pay__receipt" to={`/account/payments?receipt=${lastPaid.id}`}>
                <Icon name="file" /> {t('pay.receipt')}
              </Link>
            </div>
          ) : (
            <p className="muted ov-empty">{orders.isLoading ? t('common.loading') : t('pay.empty')}</p>
          )}
        </section>

        <section className="ov-panel">
          <header className="ov-panel__head">
            <h2>{t('acc.yourDetails')}</h2>
            <Link className="link-arrow" to="/account/profile"><Icon name="edit" /> {t('acc.edit')}</Link>
          </header>
          <dl className="ov-details">
            <div><dt><Icon name="user" />{t('profile.name')}</dt><dd>{account.full_name}</dd></div>
            <div><dt><Icon name="mail" />{t('common.email')}</dt><dd dir="ltr">{account.email}</dd></div>
            <div><dt><Icon name="phone" />{t('profile.phone')}</dt><dd dir="ltr">{account.phone || '—'}</dd></div>
            <div><dt><Icon name="pin" />{t('acc.city')}</dt><dd>{account.city || '—'}</dd></div>
            <div><dt><Icon name="globe" />{t('acc.mailLang')}</dt><dd>{account.lang === 'en' ? 'English' : 'العربية'}</dd></div>
          </dl>
        </section>
      </div>

      <Modal open={qrOpen} title={t('account.showQr')} onClose={() => setQrOpen(false)} closeLabel={t('common.close')}>
        <div className="qr-big">
          <QRCodeSVG value={verifyUrl(account.member_code)} size={240} level="M" />
          <strong dir="ltr">{account.member_no}</strong>
          <p>{t('account.qrHint')}</p>
        </div>
      </Modal>
    </div>
  );
}
