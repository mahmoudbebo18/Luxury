import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageLoader } from '../components/PageLoader';
import { Header } from './Header';
import { Footer } from './Footer';

export function AppLayout() {
  return (
    <>
      <Header />
      <main id="main" className="app-main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
