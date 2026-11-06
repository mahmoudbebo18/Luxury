import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Every .html file in the root (Arabic) and in en/ (English) is a page. app.html is the React platform.
const htmlIn = (dir: string) =>
  existsSync(resolve(root, dir)) ? readdirSync(resolve(root, dir)).filter((f) => f.endsWith('.html')) : [];
const pages = [
  ...htmlIn('.').map((f) => f.replace(/\.html$/, '')),
  ...htmlIn('en').map((f) => `en/${f.replace(/\.html$/, '')}`),
];

// Dev-server mirror of Cloudflare Pages: platform routes are served by app.html (public/_redirects),
// and pages are reachable without ".html" like in production.
const appRoutes = /^\/(login|register|forgot|reset|check-email|join|checkout|payment|account|company|v|admin)(\/|$|\?)/;
function spaFallback(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url ?? '';
    const [path, query = ''] = url.split(/(?=[?#])/);
    if (appRoutes.test(url)) req.url = '/app.html';
    else if (path !== '/' && !path.includes('.') && !path.startsWith('/@') && !path.startsWith('/node_modules')) {
      const clean = path.replace(/\/$/, '');
      const file = existsSync(resolve(root, `.${clean}.html`)) ? `${clean}.html` : `${clean}/index.html`;
      if (existsSync(resolve(root, `.${file}`))) req.url = file + query;
    }
    next();
  };
  return {
    name: 'luxury-spa-fallback',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

// Shared header/footer: <!-- @include header-ar --> is replaced by src/partials/header-ar.html
function htmlPartials(): Plugin {
  const dir = resolve(root, 'src/partials');
  return {
    name: 'luxury-html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_m, name: string) =>
          readFileSync(resolve(dir, `${name}.html`), 'utf-8'),
        ),
    },
    handleHotUpdate({ file, server }) {
      if (file.replaceAll('\\', '/').includes('/src/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  plugins: [htmlPartials(), react(), spaFallback()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
