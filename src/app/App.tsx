import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LangProvider, useT } from './i18n';
import { AuthProvider, RequireAdmin, RequireAuth, RequireCompanyAdmin, RequireMember } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Modal';
import { EmptyState } from './components/States';
import { PageLoader } from './components/PageLoader';
import { AppLayout } from './layout/AppLayout';
import { AuthLayout } from './pages/auth/AuthShell';
import { ScrollToTop } from './layout/ScrollToTop';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Forgot = lazy(() => import('./pages/auth/Forgot'));
const Reset = lazy(() => import('./pages/auth/Reset'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const Dashboard = lazy(() => import('./pages/account/Dashboard'));
const Checkout = lazy(() => import('./pages/account/Checkout'));
const PaymentResult = lazy(() => import('./pages/account/PaymentResult'));
const Payments = lazy(() => import('./pages/account/Payments'));
const Profile = lazy(() => import('./pages/account/Profile'));
const MemberServices = lazy(() => import('./pages/account/Services'));
const Join = lazy(() => import('./pages/account/Join'));
const Verify = lazy(() => import('./pages/account/Verify'));
const Company = lazy(() => import('./pages/company/Company'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

function NotFound() {
  const { t, lang } = useT();
  return (
    <div className="container page">
      <EmptyState
        icon="search"
        title={t('common.notFound')}
        action={<a className="btn btn-primary btn-sm" href={lang === 'en' ? '/en/' : '/'}>{t('common.home')}</a>}
      >
        {t('common.notFoundLead')}
      </EmptyState>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <LangProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/register/business" element={<Register />} />
                    <Route path="/forgot" element={<Forgot />} />
                    <Route path="/reset" element={<Reset />} />
                  </Route>
                  <Route element={<AppLayout />}>
                    <Route path="/account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
                      <Route index element={<RequireMember><Dashboard /></RequireMember>} />
                      <Route path="services" element={<RequireMember><MemberServices /></RequireMember>} />
                      <Route path="payments" element={<RequireMember><Payments /></RequireMember>} />
                      <Route path="profile" element={<Profile />} />
                    </Route>
                    <Route path="/checkout" element={<RequireMember><Checkout /></RequireMember>} />
                    <Route path="/payment/result" element={<RequireAuth><PaymentResult /></RequireAuth>} />
                    <Route path="/join/:token" element={<Join kind="invite" />} />
                    <Route path="/join/link/:token" element={<Join kind="link" />} />
                    <Route path="/company" element={<RequireCompanyAdmin><Company /></RequireCompanyAdmin>} />
                    <Route path="/v/:code" element={<Verify />} />
                    <Route path="/app" element={<Navigate to="/account" replace />} />
                    <Route path="/app.html" element={<Navigate to="/account" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="/admin/*" element={<RequireAdmin><AdminApp /></RequireAdmin>} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
