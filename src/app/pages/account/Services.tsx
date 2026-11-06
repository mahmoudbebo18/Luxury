// Member services: what each membership service covers, how to request it, and the request itself
// (an email from the member's own mailbox, a WhatsApp chat with a ready message, or a platform page).
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth, type Account as Profile } from '../../auth/AuthProvider';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import {
  anchorOf,
  emailParts,
  formatWhatsapp,
  mailtoUrl,
  pick,
  pickList,
  webMailUrls,
  whatsappUrl,
  type MemberService,
} from '../../lib/services';

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * Math.min(i, 6), duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
});

const logRequest = (id: string, channel: 'email' | 'whatsapp') => {
  supabase.rpc('log_service_request', { p_service_id: id, p_channel: channel }).then(() => undefined);
};

export default function Services() {
  const { t, lang } = useT();
  const { account: profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const chips = useRef<HTMLDivElement>(null);

  const list = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_services');
      if (error) throw error;
      return (data ?? []) as unknown as MemberService[];
    },
  });

  const services = list.data ?? [];
  const active = profile?.status === 'active';
  // The filter lives in the hash (#roadside), so the services page can link straight to one
  // service and a refresh keeps it.
  const hash = decodeURIComponent(location.hash.slice(1));
  const selected = services.find((s) => anchorOf(s) === hash) ?? null;
  const shown = selected ? [selected] : services;

  const choose = (anchor: string | null) => {
    navigate({ hash: anchor ?? '' }, { replace: true });
    // If the filters are stuck under the header, bring the list's start back into view.
    const top = chips.current ? chips.current.getBoundingClientRect().top + window.scrollY - 80 : 0;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="container page">
      <motion.header className="dash-hello" {...rise(0)}>
        <div>
          <span className="dash-chip"><Icon name="sparkle" />{t('nav.myServices')}</span>
          <h1>{t('svc.title')}</h1>
          <p>{t('svc.lead')}</p>
        </div>
      </motion.header>

      {profile && !active && (
        <motion.div className="dash-alert dash-alert--expired act-inactive" {...rise(1)}>
          <Icon name="alert" />
          <div>
            <p>{t('svc.inactive')}</p>
            <Link className="btn btn-sm btn-gold" to="/checkout">
              {t('account.renew')}
            </Link>
          </div>
        </motion.div>
      )}

      {list.isLoading ? (
        <Skeleton rows={3} height={240} />
      ) : list.isError ? (
        <ErrorState message={t('common.error')} onRetry={() => list.refetch()} retryLabel={t('common.retry')} />
      ) : !services.length ? (
        <div className="surface"><EmptyState icon="sparkle" title={t('svc.emptyTitle')}>{t('svc.empty')}</EmptyState></div>
      ) : (
        <>
          <motion.div className="svc-chips" ref={chips} role="group" aria-label={t('svc.filter')} {...rise(1)}>
            <button type="button" className={selected ? undefined : 'is-on'} aria-pressed={!selected} onClick={() => choose(null)}>
              <Icon name="list" />
              {t('svc.all')}
              <em>{services.length}</em>
            </button>
            {services.map((s) => (
              <button key={s.id} type="button" className={selected?.id === s.id ? 'is-on' : undefined} aria-pressed={selected?.id === s.id} onClick={() => choose(anchorOf(s))}>
                <Icon name={s.icon} />
                {pick(s, 'title', lang)}
              </button>
            ))}
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selected?.id ?? 'all'}
              className={selected ? 'svcs svcs--single' : 'svcs'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {shown.map((s, i) => (
                <ServiceCard key={s.id} s={s} i={i} n={services.indexOf(s)} profile={profile ?? null} active={active} />
              ))}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function ServiceCard({ s, i, n, profile, active }: { s: MemberService; i: number; n: number; profile: Profile | null; active: boolean }) {
  const { t, lang } = useT();
  const title = pick(s, 'title', lang);
  const summary = pick(s, 'summary', lang);
  const how = pick(s, 'how', lang);
  const features = pickList(s, lang);
  const hasAction = !!(s.email || s.whatsapp);
  const usedUp = !!s.quota && s.used >= s.quota;

  return (
    <motion.article className="svc" {...rise(i)}>
      <div className="svc-media">
        <span className="svc-media-blank"><Icon name={s.icon} /></span>
        <span className="svc-num" aria-hidden="true">{String(n + 1).padStart(2, '0')}</span>
      </div>
      <div className="svc-body">
        <span className="svc-icon"><Icon name={s.icon} /></span>
        <h2>{title}</h2>
        {summary && <p>{summary}</p>}
        {!!features.length && (
          <ul className="svc-features">
            {features.map((f) => <li key={f}><Icon name="check" />{f}</li>)}
          </ul>
        )}
      </div>
      {(how || hasAction || s.has_contact) && (
        <section className="svc-request" aria-label={t('svc.howTitle')}>
          <h3><Icon name="info" />{t('svc.howTitle')}</h3>
          {how && <p className="pre-line">{how}</p>}
          <p className="svc-quota">
            <Icon name="shield" />
            {s.quota ? t('svc.remaining', { left: Math.max(0, s.quota - s.used), quota: s.quota }) : t('svc.unlimited')}
          </p>
          {usedUp ? (
            <p className="svc-locked"><Icon name="lock" />{t('svc.usedUp')}</p>
          ) : s.has_contact && !active ? (
            <p className="svc-locked"><Icon name="lock" />{t('svc.locked')}</p>
          ) : (
            profile && (
              <>
                {s.whatsapp && <WhatsappAction s={s} title={title} profile={profile} />}
                {s.email && <EmailAction s={s} title={title} profile={profile} />}
              </>
            )
          )}
        </section>
      )}
    </motion.article>
  );
}

const memberOf = (p: Profile) => ({ full_name: p.full_name, member_no: p.member_no ?? '', phone: p.phone, company: p.membership?.company ?? null });

type LocState =
  | { status: 'idle' | 'locating' | 'denied' | 'failed' | 'unsupported' }
  | { status: 'ok'; url: string; accuracy: number };

// Geolocation only works on https (and localhost), not on a plain-http LAN address.
const canLocate = () => 'geolocation' in navigator && window.isSecureContext;

function locate(): Promise<LocState> {
  return new Promise((resolve) => {
    if (!canLocate()) return resolve({ status: 'unsupported' });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        status: 'ok',
        url: `https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`,
        accuracy: Math.round(p.coords.accuracy),
      }),
      (e) => resolve({ status: e.code === e.PERMISSION_DENIED ? 'denied' : 'failed' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

function WhatsappAction({ s, title, profile }: { s: MemberService; title: string; profile: Profile }) {
  const { t, lang } = useT();
  const [asking, setAsking] = useState(false);
  const plain = whatsappUrl(s.whatsapp!, title, pick(s, 'message', lang), memberOf(profile), lang);

  return (
    <div className="svc-channel">
      {s.ask_location ? (
        <button type="button" className="btn btn-wa btn-block" onClick={() => setAsking(true)}>
          <Icon name="whatsapp" />
          {t('svc.whatsapp')}
        </button>
      ) : (
        <a className="btn btn-wa btn-block" href={plain} target="_blank" rel="noopener" onClick={() => logRequest(s.id, 'whatsapp')}>
          <Icon name="whatsapp" />
          {t('svc.whatsapp')}
        </a>
      )}
      <small className="svc-channel-hint">
        {s.ask_location ? t('svc.whatsappLocHint') : t('svc.whatsappHint')} <span dir="ltr">{formatWhatsapp(s.whatsapp!)}</span>
      </small>
      {s.ask_location && <LocationDialog open={asking} s={s} title={title} profile={profile} onClose={() => setAsking(false)} />}
    </div>
  );
}

/**
 * Our own step before the browser's permission prompt: explains why the location is needed, asks
 * for it only when the member taps "Share my location", and opens WhatsApp (a real link, so no
 * blank tab and no popup blocker) only once the location is known or the member skips it.
 */
function LocationDialog({ open, s, title, profile, onClose }: { open: boolean; s: MemberService; title: string; profile: Profile; onClose: () => void }) {
  const { t, lang } = useT();
  const [loc, setLoc] = useState<LocState>({ status: 'idle' });
  const extra = pick(s, 'message', lang);
  const url = (where?: string) => whatsappUrl(s.whatsapp!, title, extra, memberOf(profile), lang, where);

  const share = async () => {
    setLoc({ status: 'locating' });
    setLoc(await locate());
  };

  // On open: a refused permission is shown right away; an already granted one is used directly.
  useEffect(() => {
    if (!open || loc.status === 'ok') return;
    if (!canLocate()) return setLoc({ status: 'unsupported' });
    let live = true;
    navigator.permissions?.query({ name: 'geolocation' }).then(
      (p) => {
        if (!live) return;
        if (p.state === 'denied') setLoc({ status: 'denied' });
        else if (p.state === 'granted') share();
        else setLoc({ status: 'idle' });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close after the click has opened the link (closing inside the handler would remove the link first).
  const sent = () => {
    logRequest(s.id, 'whatsapp');
    setTimeout(onClose, 0);
  };

  return (
    <Modal
      open={open}
      title={t('svc.locTitle')}
      lead={t('svc.locLead')}
      icon="pin"
      onClose={onClose}
      closeLabel={t('common.cancel')}
      footer={
        <div className="ui-modal-actions">
          {loc.status === 'ok' ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={share}><Icon name="refresh" />{t('svc.locAgain')}</button>
              <a className="btn btn-wa" href={url(loc.url)} target="_blank" rel="noopener" onClick={sent} data-autofocus>
                <Icon name="whatsapp" />
                {t('svc.locOpen')}
              </a>
            </>
          ) : loc.status === 'unsupported' ? (
            <a className="btn btn-wa" href={url()} target="_blank" rel="noopener" onClick={sent}>
              <Icon name="whatsapp" />
              {t('svc.locSkip')}
            </a>
          ) : (
            <>
              <a className="btn btn-ghost" href={url()} target="_blank" rel="noopener" onClick={sent}>{t('svc.locSkip')}</a>
              <button type="button" className="btn btn-primary" onClick={share} disabled={loc.status === 'locating'} data-autofocus>
                {loc.status === 'locating' ? <Spinner small /> : <Icon name={loc.status === 'idle' ? 'pin' : 'refresh'} />}
                {loc.status === 'locating' ? t('svc.locating') : loc.status === 'idle' ? t('svc.locShare') : t('svc.locRetry')}
              </button>
            </>
          )}
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={loc.status}
          className={`loc-state loc-state--${loc.status}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <span className="loc-state-icon">
            {loc.status === 'locating' ? <Spinner /> : <Icon name={loc.status === 'ok' ? 'check-circle' : loc.status === 'idle' ? 'pin' : 'alert'} />}
          </span>
          {loc.status === 'ok' ? (
            <div>
              <strong>{t('svc.locOk')}</strong>
              <p>{t('svc.locAccuracy', { n: loc.accuracy })} · <a href={loc.url} target="_blank" rel="noopener">{t('svc.locMap')}</a></p>
            </div>
          ) : loc.status === 'denied' ? (
            <div><strong>{t('svc.locDenied')}</strong><p>{t('svc.locDeniedHow')}</p></div>
          ) : loc.status === 'failed' ? (
            <div><strong>{t('svc.locFailed')}</strong><p>{t('svc.locFailedHow')}</p></div>
          ) : loc.status === 'unsupported' ? (
            <div><strong>{t('svc.locFailed')}</strong><p>{t('svc.locUnsupported')}</p></div>
          ) : loc.status === 'locating' ? (
            <div><strong>{t('svc.locating')}</strong><p>{t('svc.locWait')}</p></div>
          ) : (
            <div><strong>{t('svc.locIdleTitle')}</strong><p>{t('svc.locIdle')}</p></div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

function EmailAction({ s, title, profile }: { s: MemberService; title: string; profile: Profile }) {
  const { t, lang } = useT();
  const toast = useToast();
  const { subject, body } = emailParts(title, pick(s, 'message', lang), memberOf(profile), lang);
  const web = webMailUrls(s.email!, subject, body);
  const log = () => logRequest(s.id, 'email');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.email!);
      toast(t('common.copied'));
    } catch {
      toast(s.email!);
    }
  };

  return (
    <div className="svc-channel">
      <a className="btn btn-primary btn-block" href={mailtoUrl(s.email!, subject, body)} onClick={log}>
        <Icon name="mail" />
        {t('svc.email')}
      </a>
      <div className="svc-mail-alt">
        <button type="button" className="svc-mail-to" onClick={copy} title={t('svc.copyEmail')}>
          <span dir="ltr">{s.email}</span>
          <Icon name="copy" />
        </button>
        <span className="svc-mail-web">
          {t('svc.openIn')}
          <a href={web.gmail} target="_blank" rel="noopener" onClick={log}>Gmail</a>
          <a href={web.outlook} target="_blank" rel="noopener" onClick={log}>Outlook</a>
        </span>
      </div>
      <small className="svc-channel-hint">{t('svc.emailHint')}</small>
    </div>
  );
}
