// Seat calculator on the business page. Mirrors quote_price('company_new', n) in SQL: the order itself
// is always priced by the server, this only shows the number before sign-up.
// Pricing comes with the page (build time) and is refreshed from public_pricing() in case it changed since.

interface Pricing {
  price_individual: number;
  vat_rate: number;
  company_tiers: { min: number; discount: number }[];
  company_min_seats: number;
  company_online_max: number;
}

const root = document.querySelector<HTMLElement>('[data-calc]');

if (root) {
  let pricing = JSON.parse(root.querySelector('[data-pricing]')?.textContent ?? '{}') as Pricing;
  const input = root.querySelector<HTMLInputElement>('[data-seats]')!;
  const range = root.querySelector<HTMLInputElement>('[data-range]')!;
  const out = (k: string) => root.querySelector<HTMLElement>(`[data-out="${k}"]`)!;
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const render = () => {
    const p = pricing;
    const min = p.company_min_seats;
    const raw = Math.floor(Number(input.value));
    const qty = Number.isFinite(raw) && raw > 0 ? raw : min;
    const below = qty < min;
    const n = Math.max(qty, min);
    const discount = p.company_tiers.filter((t) => t.min <= n).reduce((d, t) => Math.max(d, Number(t.discount)), 0);
    const unit = round2(p.price_individual * (1 - discount / 100));
    const total = round2(unit * n);
    const subtotal = round2(total / (1 + p.vat_rate));

    out('total').textContent = fmt(total);
    out('unit').textContent = fmt(unit);
    out('discount').textContent = fmt(discount);
    out('subtotal').textContent = fmt(subtotal);
    out('vat').textContent = fmt(round2(total - subtotal));
    out('vat_pct').textContent = fmt(round2(p.vat_rate * 100));
    root.querySelector<HTMLElement>('[data-row="discount"]')!.hidden = discount <= 0;
    root.querySelector<HTMLElement>('[data-note="min"]')!.hidden = !below;
    root.querySelector<HTMLElement>('[data-note="quote"]')!.hidden = n <= p.company_online_max;
    range.value = String(Math.min(n, Number(range.max)));
  };

  const set = (v: number) => {
    input.value = String(Math.min(1000, Math.max(pricing.company_min_seats, Math.round(v))));
    render();
  };

  input.addEventListener('input', render);
  input.addEventListener('change', () => set(Number(input.value) || pricing.company_min_seats));
  range.addEventListener('input', () => set(Number(range.value)));
  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) =>
    b.addEventListener('click', () => set(Number(input.value) + Number(b.dataset.step))),
  );
  render();

  // Fresh prices, if the admin changed them after this page was built.
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  fetch(`${url}/rest/v1/rpc/public_pricing`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((fresh: Pricing | null) => {
      if (!fresh) return;
      pricing = { ...fresh, price_individual: Number(fresh.price_individual), vat_rate: Number(fresh.vat_rate) };
      input.min = range.min = String(pricing.company_min_seats);
      render();
    })
    .catch(() => undefined);
}
