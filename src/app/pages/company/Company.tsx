// Company portal: buy memberships, invite employees (one by one, Excel, or a shared link), free a
// seat, add seats, renew, invoices and company details. Employees' service use is never shown here.
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Alert, TextField } from '../../components/Field';
import { Modal, useConfirm } from '../../components/Modal';
import { Spinner } from '../../components/PageLoader';
import { EmptyState, Skeleton } from '../../components/States';
import { useToast } from '../../components/Toast';
import { daysLeft, formatDate, formatMoney } from '../../lib/format';
import { startPayment } from '../account/Checkout';
import { usePricing, type PublicPricing } from '../../lib/pricing';

type Overview = {
  company: { id: string; company_no: string; legal_name: string; card_name: string; cr_number: string; vat_number: string; city: string; address: string; email_domain: string | null };
  contract: { id: string; status: 'pending' | 'active' | 'cancelled'; seats: number; starts_at: string | null; expires_at: string | null; expired: boolean; join_token: string | null; used: number; reserved: number } | null;
  members: { membership_id: string; user_id: string; full_name: string; email: string; phone: string; member_no: string | null; assigned_at: string }[];
  invites: { id: string; email: string; full_name: string; phone: string; created_at: string }[];
  orders: { id: string; order_no: string; type: string; quantity: number; total: number; status: string; payment_url: string | null; paid_at: string | null; created_at: string }[];
};
type Quote = { total: number; subtotal: number; vat_amount: number; unit_price: number; discount_pct: number; months: number | null; online: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export default function Company() {
  const { t, lang } = useT();
  const { account } = useAuth();
  const companyId = account?.companies[0]?.id;
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [modal, setModal] = useState<null | 'invite' | 'buy' | 'add' | 'renew' | 'details'>(null);

  const ov = useQuery({
    queryKey: ['company', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('company_overview', { p_company: companyId! });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });
  const pricing = usePricing();
  const refresh = () => qc.invalidateQueries({ queryKey: ['company', companyId] });

  if (!companyId) return null;
  if (ov.isLoading || !ov.data) return <div className="container page"><Skeleton rows={4} /></div>;
  const { company, contract, members, invites, orders } = ov.data;
  const active = contract?.status === 'active' && !contract.expired;
  const free = contract ? contract.seats - contract.used - contract.reserved : 0;
  const openQuote = orders.find((o) => o.status === 'quote');
  const payable = orders.find((o) => o.status === 'pending' && o.type === 'company_new');

  const release = async (m: Overview['members'][number]) => {
    if (!(await confirm({ title: t('co.release'), message: t('co.releaseConfirm', { name: m.full_name || m.email }), confirm: t('co.release'), cancel: t('common.cancel'), danger: true }))) return;
    const { error } = await supabase.rpc('company_release_seat', { p_membership: m.membership_id });
    if (error) return toast(t('common.error'), 'error');
    refresh();
  };
  const revoke = async (id: string) => {
    const { error } = await supabase.rpc('company_revoke_invite', { p_invite: id });
    if (error) return toast(t('common.error'), 'error');
    refresh();
  };
  const resend = async (id: string) => {
    const { error } = await supabase.rpc('company_resend_invite', { p_invite: id });
    toast(error ? t('auth.rateLimited') : t('co.saved'), error ? 'error' : 'success');
  };
  const toggleLink = async (on: boolean) => {
    const { error } = await supabase.rpc('company_set_join_link', { p_contract: contract!.id, p_on: on });
    if (error) return toast(t('common.error'), 'error');
    refresh();
  };
  const joinUrl = contract?.join_token ? `${location.origin}/join/link/${contract.join_token}` : '';

  return (
    <div className="container page company">
      <header className="acct-head">
        <span className="eyebrow" dir="ltr">{company.company_no}</span>
        <h1>{company.legal_name}</h1>
        <button type="button" className="link-arrow" onClick={() => setModal('details')}>
          <Icon name="edit" /> {t('co.details')}
        </button>
      </header>

      {!active ? (
        <div className="acct-note acct-note--pay">
          <div>
            <strong>{openQuote ? t('co.pendingContract') : contract?.expired ? t('account.expiredTitle') : t('co.noContract')}</strong>
            <p>{openQuote ? t('co.pendingLead') : t('co.noContractLead')}</p>
          </div>
          {payable?.payment_url ? (
            <a className="btn btn-gold btn-lg" href={payable.payment_url}>{t('co.payLink')} {formatMoney(payable.total)} {t('common.sar')}</a>
          ) : contract?.expired ? (
            <button type="button" className="btn btn-gold btn-lg" onClick={() => setModal('renew')}>{t('co.renew')}</button>
          ) : !openQuote ? (
            <button type="button" className="btn btn-gold btn-lg" onClick={() => setModal('buy')}>{t('co.qty')}</button>
          ) : null}
        </div>
      ) : (
        <section className="co-stats">
          <Stat label={t('co.seats')} value={contract!.seats} />
          <Stat label={t('co.used')} value={contract!.used} />
          <Stat label={t('co.reserved')} value={contract!.reserved} />
          <Stat label={t('co.free')} value={Math.max(0, free)} accent />
          <div className="co-stat co-stat--date">
            <span>{t('co.expires')}</span>
            <strong>{formatDate(contract!.expires_at, lang)}</strong>
            <small>{t('account.daysLeft', { n: daysLeft(contract!.expires_at!) })}</small>
          </div>
        </section>
      )}

      {active && (
        <div className="co-actions">
          <button type="button" className="btn btn-gold" onClick={() => setModal('invite')} disabled={free <= 0}>
            <Icon name="send" /> {t('co.invite')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setModal('add')}><Icon name="plus" /> {t('co.addSeats')}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setModal('renew')}><Icon name="refresh" /> {t('co.renew')}</button>
        </div>
      )}

      {active && (
        <section className="co-panel">
          <div className="co-panel__head">
            <div>
              <h2>{t('co.joinLink')}</h2>
              <p>{t('co.joinLinkLead')}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleLink(!contract!.join_token)}>
              {contract!.join_token ? t('co.joinLinkOff') : t('co.joinLinkOn')}
            </button>
          </div>
          {joinUrl && (
            <div className="co-link">
              <code dir="ltr">{joinUrl}</code>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(joinUrl).then(() => toast(t('common.copied')))}>
                <Icon name="copy" /> {t('co.copy')}
              </button>
            </div>
          )}
        </section>
      )}

      {contract && (
        <section className="co-panel">
          <div className="co-panel__head"><h2>{t('co.members')} <span className="count">{members.length}</span></h2></div>
          {!members.length ? (
            <EmptyState icon="users" title={t('co.noMembers')} />
          ) : (
            <div className="lux-table">
              <table>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.membership_id}>
                      <td><strong>{m.full_name || '—'}</strong><small dir="ltr">{m.email}</small></td>
                      <td dir="ltr" className="mono">{m.member_no}</td>
                      <td>{formatDate(m.assigned_at, lang)}</td>
                      <td className="end"><button type="button" className="btn btn-ghost btn-sm" onClick={() => release(m)}>{t('co.release')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {invites.length > 0 && (
        <section className="co-panel">
          <div className="co-panel__head"><h2>{t('co.invites')} <span className="count">{invites.length}</span></h2></div>
          <div className="lux-table">
            <table>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.full_name || '—'}</strong><small dir="ltr">{i.email}</small></td>
                    <td>{formatDate(i.created_at, lang)}</td>
                    <td className="end">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => resend(i.id)}>{t('co.resend')}</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => revoke(i.id)}>{t('co.revoke')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section className="co-panel">
          <div className="co-panel__head"><h2>{t('co.orders')}</h2></div>
          <div className="lux-table">
            <table>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td dir="ltr" className="mono">{o.order_no}</td>
                    <td>{o.quantity} × {t('co.seats')}</td>
                    <td>{formatMoney(o.total)} {t('common.sar')}</td>
                    <td><span className={`badge badge--${o.status}`}>{t(`pay.${o.status}` as 'pay.paid')}</span></td>
                    <td className="end">
                      {o.status === 'pending' && o.payment_url && <a className="btn btn-gold btn-sm" href={o.payment_url}>{t('co.payLink')}</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal === 'invite' && contract && <InviteModal contractId={contract.id} free={free} onClose={() => setModal(null)} onDone={refresh} />}
      {(modal === 'buy' || modal === 'add' || modal === 'renew') && pricing.data && (
        <BuyModal
          type={modal === 'buy' ? 'company_new' : modal === 'add' ? 'company_add_seats' : 'company_renew'}
          companyId={companyId}
          contract={contract}
          pricing={pricing.data}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal === 'details' && <DetailsModal company={company} onClose={() => setModal(null)} onDone={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={accent ? 'co-stat co-stat--accent' : 'co-stat'}>
      <span>{label}</span>
      <strong className="num">{value}</strong>
    </div>
  );
}

// ---------------------------------------------------------------- Buy / add seats / renew
function BuyModal({ type, companyId, contract, pricing, onClose, onDone }: {
  type: 'company_new' | 'company_add_seats' | 'company_renew';
  companyId: string;
  contract: Overview['contract'];
  pricing: PublicPricing;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const toast = useToast();
  const min = type === 'company_new' ? pricing.company_min_seats : type === 'company_renew' ? contract?.seats ?? 1 : 1;
  const [qty, setQty] = useState(min);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const quote = useQuery({
    queryKey: ['co-quote', type, qty, contract?.id],
    enabled: qty >= min,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('quote_price', { p_type: type, p_quantity: qty, p_contract: contract?.id ?? undefined });
      if (error) throw error;
      return data as unknown as Quote;
    },
  });

  const submit = async (requestQuote: boolean) => {
    setBusy(true);
    setError('');
    const { data, error } = await supabase.rpc('create_order', {
      p_type: type, p_quantity: qty, p_company: companyId, p_contract: contract?.id ?? undefined, p_request_quote: requestQuote,
    });
    if (error) {
      setBusy(false);
      return setError(t('common.error'));
    }
    const order = data as { id: string; status: string };
    if (order.status === 'quote') {
      toast(t('co.quoteSent'));
      onDone();
      return onClose();
    }
    try {
      await startPayment(order.id);
    } catch {
      setBusy(false);
      setError(t('checkout.unavailable'));
      onDone();
    }
  };

  const q = quote.data;
  const title = type === 'company_new' ? t('co.qty') : type === 'company_add_seats' ? t('co.addSeats') : t('co.renew');
  const lead = type === 'company_add_seats' && q?.months ? t('co.addSeatsLead', { m: q.months }) : type === 'company_renew' ? t('co.renewLead') : type === 'company_new' ? t('co.minSeats', { n: pricing.company_min_seats }) : undefined;

  return (
    <Modal open title={title} lead={lead} onClose={onClose} closeLabel={t('common.close')}>
      <div className="buy">
        <div className="buy__qty">
          <button type="button" className="btn btn-ghost" onClick={() => setQty((n) => Math.max(min, n - 1))} aria-label="-">−</button>
          <input type="number" min={min} value={qty} onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))} aria-label={t('co.qty')} />
          <button type="button" className="btn btn-ghost" onClick={() => setQty((n) => n + 1)} aria-label="+">+</button>
        </div>
        {qty < min ? (
          <p className="buy__warn">{t('co.minSeats', { n: min })}</p>
        ) : !q ? (
          <div className="auth-center" style={{ minHeight: 120 }}><Spinner /></div>
        ) : (
          <dl className="checkout__totals">
            <div><dt>{t('co.perSeat')}</dt><dd>{formatMoney(q.unit_price)} {t('common.sar')} {q.discount_pct > 0 && <em className="badge badge--active">{t('co.discount', { n: q.discount_pct })}</em>}</dd></div>
            <div><dt>{t('checkout.subtotal')}</dt><dd>{formatMoney(q.subtotal)} {t('common.sar')}</dd></div>
            <div><dt>{t('checkout.vat')}</dt><dd>{formatMoney(q.vat_amount)} {t('common.sar')}</dd></div>
            <div className="checkout__total"><dt>{t('checkout.total')}</dt><dd><span className="num">{formatMoney(q.total)}</span> {t('common.sar')}</dd></div>
          </dl>
        )}
        {q && !q.online && <p className="buy__note">{t('co.overOnline', { n: pricing.company_online_max })}</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="buy__actions">
          {q?.online && (
            <button type="button" className="btn btn-gold btn-lg" disabled={busy || qty < min} onClick={() => submit(false)}>
              {busy ? <Spinner small /> : <><Icon name="lock" /> {t('co.payNow')}</>}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-lg" disabled={busy || qty < min} onClick={() => submit(true)}>{t('co.requestQuote')}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Invite
type Person = { email: string; full_name: string; phone: string };

function InviteModal({ contractId, free, onClose, onDone }: { contractId: string; free: number; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [tab, setTab] = useState<'one' | 'excel'>('one');
  const [one, setOne] = useState<Person>({ email: '', full_name: '', phone: '' });
  const [rows, setRows] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ invited: number; skipped: { email: string; reason: string }[] } | null>(null);
  const [error, setError] = useState('');

  const readExcel = async (file: File) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer());
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }).slice(1);
    // Columns by content: the cell with an @ is the email, a long digit run is the phone, the rest the name.
    setRows(
      data
        .map((r) => r.map((c) => String(c).trim()))
        .filter((r) => r.some(Boolean))
        .map((r) => ({
          email: r.find((c) => c.includes('@')) ?? '',
          phone: r.find((c) => /^\+?[\d\s-]{9,}$/.test(c)) ?? '',
          full_name: r.find((c) => c && !c.includes('@') && !/^\+?[\d\s-]{9,}$/.test(c)) ?? '',
        })),
    );
  };

  const template = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['الاسم / Name', 'البريد / Email', 'الجوال / Mobile'], ['', '', '']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'luxury-club-employees.xlsx');
  };

  const send = async () => {
    const people = tab === 'one' ? [one] : rows;
    if (tab === 'one' && !EMAIL_RE.test(one.email.trim())) return setError(t('common.invalidEmail'));
    setBusy(true);
    setError('');
    const { data, error } = await supabase.rpc('company_invite', { p_contract: contractId, p_people: people });
    setBusy(false);
    if (error) return setError(t('common.error'));
    setResult(data as unknown as { invited: number; skipped: { email: string; reason: string }[] });
    onDone();
  };

  const invalid = useMemo(() => rows.filter((r) => !EMAIL_RE.test(r.email)).length, [rows]);

  return (
    <Modal open wide title={t('co.invite')} lead={t('co.inviteLead')} onClose={onClose} closeLabel={t('common.close')}>
      {result ? (
        <div className="invite-result">
          <p><Icon name="check-circle" /> {t('co.invited', { n: result.invited })}</p>
          {result.skipped.length > 0 && (
            <>
              <p>{t('co.skipped', { n: result.skipped.length })}</p>
              <ul>
                {result.skipped.map((s) => (
                  <li key={s.email}><span dir="ltr">{s.email || '—'}</span> · {t(`co.reason.${s.reason}` as 'co.reason.no_seats')}</li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>{t('common.back')}</button>
        </div>
      ) : (
        <div className="invite">
          <div className="seg">
            <button type="button" className={tab === 'one' ? 'is-on' : ''} onClick={() => setTab('one')}>{t('co.inviteOne')}</button>
            <button type="button" className={tab === 'excel' ? 'is-on' : ''} onClick={() => setTab('excel')}>{t('co.inviteExcel')}</button>
          </div>
          {tab === 'one' ? (
            <div className="ui-form">
              <TextField label={t('reg.name')} icon="user" value={one.full_name} onChange={(e) => setOne({ ...one, full_name: e.target.value })} />
              <TextField label={t('common.email')} icon="mail" type="email" dir="ltr" value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} />
              <TextField label={t('reg.phone')} icon="phone" type="tel" dir="ltr" optional={t('common.optional')} value={one.phone} onChange={(e) => setOne({ ...one, phone: e.target.value })} />
            </div>
          ) : (
            <div className="ui-form">
              <p className="muted">{t('co.excelHint')} <button type="button" className="link-button" onClick={template}>{t('co.excelTemplate')}</button></p>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && readExcel(e.target.files[0])} />
              {rows.length > 0 && (
                <p>
                  {t('co.excelRows', { n: rows.length })}
                  {invalid > 0 && <> · <span className="text-danger">{invalid} {t('co.reason.invalid_email')}</span></>}
                  {rows.length > free && <> · <span className="text-danger">{t('co.reason.no_seats')} ({free})</span></>}
                </p>
              )}
            </div>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <button type="button" className="btn btn-gold btn-lg btn-block" onClick={send} disabled={busy || (tab === 'excel' && !rows.length)}>
            {busy ? <Spinner small /> : <><Icon name="send" /> {t('co.sendInvites')}</>}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Company details
function DetailsModal({ company, onClose, onDone }: { company: Overview['company']; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [v, setV] = useState(company);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof Overview['company'], label: string, extra: Record<string, unknown> = {}): ReactNode => (
    <TextField label={label} value={(v[k] as string) ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...extra} />
  );
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('company_update', {
      p_company: company.id, p_card_name: v.card_name, p_cr_number: v.cr_number, p_vat_number: v.vat_number,
      p_city: v.city, p_address: v.address, p_email_domain: v.email_domain ?? '',
    });
    setBusy(false);
    if (error) return toast(t('common.error'), 'error');
    toast(t('co.saved'));
    onDone();
    onClose();
  };
  return (
    <Modal open title={t('co.details')} onClose={onClose} closeLabel={t('common.close')}
      footer={<button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner small /> : t('common.save')}</button>}>
      <div className="ui-form">
        {field('card_name', t('reg.cardName'), { maxLength: 40, hint: t('reg.cardNameHint') })}
        <div className="ui-grid">
          {field('cr_number', t('reg.cr'), { dir: 'ltr' })}
          {field('vat_number', t('reg.vat'), { dir: 'ltr' })}
        </div>
        <div className="ui-grid">
          {field('city', t('reg.city'))}
          {field('address', lang_address())}
        </div>
        {field('email_domain', t('co.domain'), { dir: 'ltr', hint: t('co.domainHint') })}
      </div>
    </Modal>
  );
}

function lang_address() {
  return document.documentElement.lang === 'en' ? 'Address' : 'العنوان';
}
