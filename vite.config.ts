import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { renderMarkdown } from './src/lib/markdown';

const root = import.meta.dirname;
const SITE = 'https://the-luxury-club.com';

// Every .html file in the root (Arabic) and in en/ (English) is a page. app.html is the React platform.
const htmlIn = (dir: string) =>
  existsSync(resolve(root, dir)) ? readdirSync(resolve(root, dir)).filter((f) => f.endsWith('.html')) : [];
const pages = [
  ...htmlIn('.').map((f) => f.replace(/\.html$/, '')),
  ...htmlIn('en').map((f) => `en/${f.replace(/\.html$/, '')}`),
];

// Dev-server mirror of Cloudflare Pages: platform routes are served by app.html (public/_redirects),
// pages are reachable without ".html", and anything else gets the 404 page (en/404 under /en/).
const appRoutes = /^\/(login|register|forgot|reset|check-email|join|checkout|payment|account|company|v|admin|app)(\/|$|\?)/;
function spaFallback(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url ?? '';
    const [path, query = ''] = url.split(/(?=[?#])/);
    if (appRoutes.test(url)) req.url = '/app.html';
    else if (path !== '/' && !path.includes('.') && !path.startsWith('/@') && !path.startsWith('/node_modules')) {
      const clean = path.replace(/\/$/, '');
      const file = existsSync(resolve(root, `.${clean}.html`)) ? `${clean}.html` : `${clean}/index.html`;
      if (existsSync(resolve(root, `.${file}`))) req.url = file + query;
      else req.url = path.startsWith('/en/') ? '/en/404.html' : '/404.html';
    }
    next();
  };
  return {
    name: 'luxury-spa-fallback',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

// ---------------------------------------------------------------- Site content from Supabase
// Legal pages (site_pages, Markdown) and prices (public_pricing) are read at build time with the
// publishable key, so the public pages stay static HTML. Saving in the admin triggers a rebuild.
interface SitePage {
  slug: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  version: number;
  updated_at: string;
}
interface Pricing {
  price_individual: number;
  vat_rate: number;
  company_tiers: { min: number; discount: number }[];
  company_min_seats: number;
  company_online_max: number;
  bank_transfer: boolean;
  terms_version: number;
}
interface SiteData {
  pricing: Pricing;
  pages: Record<string, SitePage>;
}

const FALLBACK: SiteData = {
  pricing: {
    price_individual: 699,
    vat_rate: 0.15,
    company_tiers: [{ min: 1, discount: 0 }],
    company_min_seats: 5,
    company_online_max: 50,
    bank_transfer: true,
    terms_version: 1,
  },
  pages: {},
};

async function fetchSiteData(env: Record<string, string>): Promise<SiteData> {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  const [p, s] = await Promise.all([
    fetch(`${url}/rest/v1/rpc/public_pricing`, { method: 'POST', headers, body: '{}' }),
    fetch(`${url}/rest/v1/site_pages?select=slug,title_ar,title_en,body_ar,body_en,version,updated_at`, { headers }),
  ]);
  if (!p.ok || !s.ok) throw new Error(`Supabase answered ${p.status} / ${s.status}`);
  const pricing = (await p.json()) as Pricing;
  const rows = (await s.json()) as SitePage[];
  return {
    pricing: {
      ...pricing,
      price_individual: Number(pricing.price_individual),
      vat_rate: Number(pricing.vat_rate),
    },
    pages: Object.fromEntries(rows.map((r) => [r.slug, r])),
  };
}

// "/" , "/services", "/en/", "/en/services"; null for pages that are not public (app, 404).
function pagePath(file: string): { path: string; alt: string; lang: 'ar' | 'en'; name: string } {
  const rel = relative(root, file).replaceAll('\\', '/').replace(/\.html$/, '');
  const lang = rel.startsWith('en/') ? 'en' : 'ar';
  const name = rel.replace(/^en\//, '');
  const arPath = name === 'index' ? '/' : `/${name}`;
  const enPath = name === 'index' ? '/en/' : `/en/${name}`;
  const isNotFound = name === '404';
  return {
    name,
    lang,
    path: lang === 'ar' ? arPath : enPath,
    alt: isNotFound ? (lang === 'ar' ? '/en/' : '/') : lang === 'ar' ? enPath : arPath,
  };
}

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const round2 = (n: number) => Math.round(n * 100) / 100;

const dateLabel = (iso: string, lang: 'ar' | 'en') =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(iso));

function legalArticle(page: SitePage | undefined, lang: 'ar' | 'en'): string {
  if (!page) return '';
  const body = lang === 'ar' ? page.body_ar : page.body_en;
  const { html, headings } = renderMarkdown(body);
  const t =
    lang === 'ar'
      ? { toc: 'في هذه الصفحة', updated: 'آخر تحديث', version: 'النسخة' }
      : { toc: 'On this page', updated: 'Last updated', version: 'Version' };
  const toc = headings.length
    ? `<nav class="legal__toc" aria-label="${t.toc}"><span>${t.toc}</span><ol>${headings
        .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
        .join('')}</ol></nav>`
    : '';
  return `<p class="legal__updated"><svg class="icon" aria-hidden="true"><use href="/imgs/icons.svg#i-calendar" /></svg>${t.updated}: <time datetime="${page.updated_at.slice(0, 10)}">${dateLabel(page.updated_at, lang)}</time> · ${t.version} <span class="num">${page.version}</span></p>
<div class="legal__grid">${toc}<article class="prose">${html}</article></div>`;
}

function sitePages(): Plugin {
  const partials = resolve(root, 'src/partials');
  let env: Record<string, string> = {};
  let isBuild = false;
  let cache: { at: number; data: Promise<SiteData> } | null = null;

  const data = () => {
    // One fetch per build; in dev refresh every 30 s so edits from the admin show up.
    if (cache && (isBuild || Date.now() - cache.at < 30_000)) return cache.data;
    const promise = fetchSiteData(env).catch((e: Error) => {
      if (isBuild) throw new Error(`[luxury-site] could not read site content: ${e.message}`);
      console.warn(`[luxury-site] ${e.message}: using fallback content`);
      return FALLBACK;
    });
    cache = { at: Date.now(), data: promise };
    return promise;
  };

  return {
    name: 'luxury-site-pages',
    config(_c, { command, mode }) {
      isBuild = command === 'build';
      env = loadEnv(mode, root, 'VITE_');
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        // Shared header/footer: <!-- @include header-ar --> is replaced by src/partials/header-ar.html
        html = html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_m, name: string) =>
          readFileSync(resolve(partials, `${name}.html`), 'utf-8'),
        );
        if (ctx.filename.endsWith('app.html')) return html;

        const { pricing, pages: legal } = await data();
        const page = pagePath(ctx.filename);
        const { lang } = page;
        const arUrl = `${SITE}${lang === 'ar' ? page.path : page.alt}`;
        const enUrl = `${SITE}${lang === 'en' ? page.path : page.alt}`;
        const price = pricing.price_individual;
        const sub = round2(price / (1 + pricing.vat_rate));

        const seo =
          page.name === '404'
            ? '<meta name="robots" content="noindex" />'
            : [
                `<link rel="canonical" href="${SITE}${page.path}" />`,
                `<link rel="alternate" hreflang="ar" href="${arUrl}" />`,
                `<link rel="alternate" hreflang="en" href="${enUrl}" />`,
                `<link rel="alternate" hreflang="x-default" href="${arUrl}" />`,
                `<meta property="og:url" content="${SITE}${page.path}" />`,
              ].join('\n    ');

        const tokens: Record<string, string> = {
          alt: page.alt,
          price: money(price),
          price_sub: sub.toFixed(2),
          price_vat: round2(price - sub).toFixed(2),
          vat_pct: money(round2(pricing.vat_rate * 100)),
          min_seats: String(pricing.company_min_seats),
          online_max: String(pricing.company_online_max),
          // Pricing for the seat calculator (business page), refreshed again in the browser.
          pricing_json: JSON.stringify(pricing).replace(/</g, '\\u003c'),
        };

        return html
          .replace(/<!--\s*@seo\s*-->/, seo)
          .replace(/<!--\s*@legal\s+([\w-]+)\s*-->/g, (_m, slug: string) => {
            if (!legal[slug] && isBuild) throw new Error(`[luxury-site] site_pages has no "${slug}"`);
            return legalArticle(legal[slug], lang);
          })
          .replace(/\{\{legal:([\w-]+):title\}\}/g, (_m, slug: string) => {
            const p = legal[slug];
            return p ? (lang === 'ar' ? p.title_ar : p.title_en) : slug;
          })
          .replace(/\{\{(\w+)\}\}/g, (m, k: string) => tokens[k] ?? m)
          // Mark the current page in the header and footer menus.
          .replace(new RegExp(`(<a [^>]*href="${page.path.replace(/\//g, '\\/')}")(?![^>]*aria-current)`, 'g'), (m, a: string) =>
            page.path === '/' || page.path === '/en/' ? m : `${a} aria-current="page"`,
          );
      },
    },
    async generateBundle() {
      // sitemap.xml: every public page, each with its other-language twin.
      const { pages: legal } = await data();
      const today = new Date().toISOString().slice(0, 10);
      const names = [...new Set(pages.map((p) => p.replace(/^en\//, '')))].filter((n) => n !== 'app' && n !== '404');
      const url = (n: string, lang: 'ar' | 'en') =>
        `${SITE}${lang === 'ar' ? (n === 'index' ? '/' : `/${n}`) : n === 'index' ? '/en/' : `/en/${n}`}`;
      const entries = names.flatMap((n) => {
        const lastmod = legal[n]?.updated_at.slice(0, 10) ?? today;
        const alts = (['ar', 'en'] as const)
          .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(n, l)}" />`)
          .join('\n');
        return (['ar', 'en'] as const).map(
          (l) => `  <url>\n    <loc>${url(n, l)}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alts}\n  </url>`,
        );
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
      });
    },
    handleHotUpdate({ file, server }) {
      if (file.replaceAll('\\', '/').includes('/src/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  plugins: [sitePages(), react(), spaFallback()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
