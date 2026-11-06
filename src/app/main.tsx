// Platform entry (React). Placeholder until phase 2 (accounts, company portal, admin).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '../scss/site.scss';

function ComingSoon() {
  return (
    <main className="section" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: '1.5rem', justifyItems: 'center' }}>
        <a className="brand" href="/" aria-label="The Luxury Club">
          <svg style={{ width: 180 }} aria-hidden="true"><use href="/imgs/icons.svg#logo" /></svg>
        </a>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>المنصة قيد الإعداد</h1>
        <a className="btn btn-ghost" href="/">العودة للرئيسية</a>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ComingSoon />
  </StrictMode>,
);
