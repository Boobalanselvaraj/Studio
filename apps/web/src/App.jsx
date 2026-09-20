import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { StudioLayout } from './layouts/StudioLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { CustomerLayout } from './layouts/CustomerLayout';

// Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(module => ({ default: module.LoginPage })));
const StudioDashboardPage = lazy(() => import('./pages/studio/dashboard/StudioDashboardPage').then(module => ({ default: module.StudioDashboardPage })));
const CalendarPage = lazy(() => import('./pages/studio/calendar/CalendarPage').then(module => ({ default: module.CalendarPage })));
const EventsPage = lazy(() => import('./pages/studio/events/EventsPage').then(module => ({ default: module.EventsPage })));
const EventDetailPage = lazy(() => import('./pages/studio/events/EventDetailPage').then(module => ({ default: module.EventDetailPage })));
const FoldersPage = lazy(() => import('./pages/studio/folders/FoldersPage').then(module => ({ default: module.FoldersPage })));
const CamerasPage = lazy(() => import('./pages/studio/cameras/CamerasPage').then(module => ({ default: module.CamerasPage })));
const CustomersPage = lazy(() => import('./pages/studio/customers/CustomersPage').then(module => ({ default: module.CustomersPage })));
const StorageSettingsPage = lazy(() => import('./pages/studio/storage/StorageSettingsPage').then(module => ({ default: module.StorageSettingsPage })));
const BrandingSettingsPage = lazy(() => import('./pages/studio/branding/BrandingSettingsPage').then(module => ({ default: module.BrandingSettingsPage })));
const BillingPage = lazy(() => import('./pages/studio/billing/BillingPage').then(module => ({ default: module.BillingPage })));
const AdminDashboardPage = lazy(() => import('./pages/super-admin/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
const BillingPlansPage = lazy(() => import('./pages/super-admin/BillingPlansPage').then(module => ({ default: module.BillingPlansPage })));
const CustomerGalleriesPage = lazy(() => import('./pages/customer/CustomerGalleriesPage').then(module => ({ default: module.CustomerGalleriesPage })));
const GalleryViewPage = lazy(() => import('./pages/customer/GalleryViewPage').then(module => ({ default: module.GalleryViewPage })));

import { useAuthStore } from './stores/authStore';

export function App() {
  React.useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="studio-theme">
      <BrowserRouter>
        <Suspense fallback={<div className="app-loading" role="status">Opening your workspace…</div>}><Routes>
          {/* Public / Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Studio Management Zone */}
          <Route path="/studio" element={<StudioLayout />}>
            <Route index element={<Navigate to="/studio/dashboard" replace />} />
            <Route path="dashboard" element={<StudioDashboardPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            <Route path="folders" element={<FoldersPage />} />
            <Route path="cameras" element={<CamerasPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="storage" element={<StorageSettingsPage />} />
            <Route path="branding" element={<BrandingSettingsPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>

          {/* Super Admin Zone */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/studios" replace />} />
            <Route path="studios" element={<AdminDashboardPage />} />
            <Route path="billing-plans" element={<BillingPlansPage />} />
          </Route>

          {/* Customer Portal Zone */}
          <Route path="/" element={<CustomerLayout />}>
            <Route index element={<Navigate to="/customer/galleries" replace />} />
            <Route path="customer/galleries" element={<CustomerGalleriesPage />} />
            <Route path="gallery/:albumId" element={<GalleryViewPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes></Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;


