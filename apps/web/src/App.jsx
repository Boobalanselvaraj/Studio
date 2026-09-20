import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { StudioLayout } from './layouts/StudioLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { CustomerLayout } from './layouts/CustomerLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { StudioDashboardPage } from './pages/studio/dashboard/StudioDashboardPage';
import { EventsPage } from './pages/studio/events/EventsPage';
import { EventDetailPage } from './pages/studio/events/EventDetailPage';
import { FoldersPage } from './pages/studio/folders/FoldersPage';
import { CamerasPage } from './pages/studio/cameras/CamerasPage';
import { CustomersPage } from './pages/studio/customers/CustomersPage';
import { StorageSettingsPage } from './pages/studio/storage/StorageSettingsPage';
import { BrandingSettingsPage } from './pages/studio/branding/BrandingSettingsPage';
import { BillingPage } from './pages/studio/billing/BillingPage';
import { AdminDashboardPage } from './pages/super-admin/AdminDashboardPage';
import { BillingPlansPage } from './pages/super-admin/BillingPlansPage';
import { CustomerGalleriesPage } from './pages/customer/CustomerGalleriesPage';
import { GalleryViewPage } from './pages/customer/GalleryViewPage';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="studio-theme">
      <BrowserRouter>
        <Routes>
          {/* Public / Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Studio Management Zone */}
          <Route path="/studio" element={<StudioLayout />}>
            <Route index element={<Navigate to="/studio/dashboard" replace />} />
            <Route path="dashboard" element={<StudioDashboardPage />} />
            <Route path="events" element={<EventsPage />} />
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
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
