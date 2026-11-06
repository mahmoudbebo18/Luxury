// Admin panel routes (/admin/*). Club admins only (RequireAdmin in App.tsx; every RPC checks again).
import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { EmptyState } from '../../components/States';

const Overview = lazy(() => import('./Overview'));
const Members = lazy(() => import('./Members'));
const MemberDetail = lazy(() => import('./MemberDetail'));
const Companies = lazy(() => import('./Companies'));
const CompanyDetail = lazy(() => import('./CompanyDetail'));
const Payments = lazy(() => import('./Payments'));
const Services = lazy(() => import('./Services'));
const Emails = lazy(() => import('./Emails'));
const Content = lazy(() => import('./Content'));
const Settings = lazy(() => import('./Settings'));

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Overview />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberDetail />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={<CompanyDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="services" element={<Services />} />
        <Route path="emails" element={<Emails />} />
        <Route path="content" element={<Content />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<EmptyState icon="search" title="الصفحة غير موجودة" />} />
      </Route>
    </Routes>
  );
}
