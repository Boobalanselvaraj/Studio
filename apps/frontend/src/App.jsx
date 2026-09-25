import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { StudioLayout } from './layouts/StudioLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import { ToastContainer } from './components/ui/toast';

const AlbumsPage = lazy(() => import('./pages/studio/albums/AlbumsPage').then(m => ({default:m.AlbumsPage})));
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
const SupportTicketsPage = lazy(() => import('./pages/super-admin/SupportTicketsPage').then(module => ({ default: module.SupportTicketsPage })));
const StorageServersPage = lazy(() => import('./pages/super-admin/StorageServersPage').then(module => ({ default: module.StorageServersPage })));
const BillingPlansPage = lazy(() => import('./pages/super-admin/BillingPlansPage').then(module => ({ default: module.BillingPlansPage })));
const CustomerGalleriesPage = lazy(() => import('./pages/customer/CustomerGalleriesPage').then(module => ({ default: module.CustomerGalleriesPage })));
const GalleryViewPage = lazy(() => import('./pages/customer/GalleryViewPage').then(module => ({ default: module.GalleryViewPage })));
const PublicGalleryViewPage = lazy(() => import('./pages/public/PublicGalleryViewPage').then(module => ({ default: module.PublicGalleryViewPage })));

import { useAuthStore } from './stores/authStore';
import { initBrandColor } from './theme/brandColor';

function Guard({children,admin=false,studio=false}) {
 const {user,isInitialized,currentStudio}=useAuthStore();
 if(!isInitialized)return <div role="status">Loading account…</div>;
 if(!user)return <Navigate to="/login" replace/>;
 if(admin && !user.is_super_admin)return <Navigate to="/studio" replace/>;
 if(studio && !currentStudio)return <Navigate to={user.is_super_admin?'/admin':'/customer/galleries'} replace/>;
 return children;
}
export function App() {
  React.useEffect(() => {
    initBrandColor();
    useAuthStore.getState().initAuth();
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="studio-theme">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<div className="app-loading" role="status">Opening your workspace…</div>}>
          <Routes>
            {/* Public Shared Gallery Link (Bearer view without login) */}
            <Route path="/shared/:token" element={<PublicGalleryViewPage />} />

            {/* Public / Auth */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* Studio Management Zone */}
            <Route path="/studio" element={<Guard studio><StudioLayout /></Guard>}>
              <Route index element={<Navigate to="/studio/dashboard" replace />} />
              <Route path="dashboard" element={<StudioDashboardPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="events/:id" element={<EventDetailPage />} />
              <Route path="folders" element={<FoldersPage />} />
              <Route path="albums" element={<AlbumsPage />} />
              <Route path="cameras" element={<CamerasPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="storage" element={<StorageSettingsPage />} />
              <Route path="branding" element={<BrandingSettingsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="support" element={<SupportTicketsPage studio />} />
            </Route>

            {/* Super Admin Zone */}
            <Route path="/admin" element={<Guard admin><AdminLayout /></Guard>}>
              <Route index element={<Navigate to="/admin/studios" replace />} />
              <Route path="studios" element={<AdminDashboardPage />} />
              <Route path="storage-servers" element={<StorageServersPage />} />
              <Route path="support" element={<SupportTicketsPage />} />
              <Route path="billing-plans" element={<BillingPlansPage />} />
            </Route>

            {/* Customer Portal Zone */}
            <Route path="/" element={<Guard><CustomerLayout /></Guard>}>
              <Route index element={<Navigate to="/customer/galleries" replace />} />
              <Route path="customer/galleries" element={<CustomerGalleriesPage />} />
              <Route path="gallery/:albumId" element={<GalleryViewPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
