import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  CreditCard,
  ArrowUpRight,
  Menu,
  X,
  Sun,
  Moon,
  Aperture,
  LogOut,
  User,
  Receipt,
  HardDrive,
  LifeBuoy,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../stores/authStore';

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => setOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'SA';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="workspace-shell admin-shell">
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`workspace-sidebar ${open ? 'is-open' : ''}`}>
        <Link to="/admin/studios" className="wordmark">
          <span className="brand-mark">
            <Aperture size={24} />
          </span>
          studioflow<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>

        <div className="studio-identity">
          <ShieldCheck size={26} className="text-brand-primary" />
          <div className="flex-1 overflow-hidden">
            <strong>Platform Control</strong>
            <span className="text-xs text-muted block">Super Admin Portal</span>
          </div>
          <span className="plan-tag">SUPER ADMIN</span>
        </div>

        <div className="nav-label">PLATFORM</div>
        <nav aria-label="Administration">
          {[
            ['Studios & Tenants', '/admin/studios', Building2],
            ['Storage Servers', '/admin/storage-servers', HardDrive],
            ['Support & Requests', '/admin/support', LifeBuoy],
            ['Billing & Invoices', '/admin/billing-plans', Receipt],
          ].map(([name, path, Icon]) => (
            <NavLink
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              to={path}
              key={path}
            >
              <Icon size={18} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <span className="account-avatar">{getInitials(user?.full_name)}</span>
            <div className="flex-1 overflow-hidden">
              <strong className="truncate block">{user?.full_name || 'Super Admin'}</strong>
              <span className="truncate block text-xs text-muted">{user?.email || 'admin@photostudio.io'}</span>
            </div>
            <button
              className="icon-button text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              aria-label="Sign out"
              title="Sign out of Super Admin"
              onClick={handleLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="topbar-breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <ShieldCheck size={18} className="text-brand-primary" />
            <strong>Platform Administration</strong>
          </div>

          <div className="topbar-actions flex items-center gap-2">
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() =>
                setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
              }
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <span className="topbar-avatar" title={user?.email || 'Super Admin'}>
                {getInitials(user?.full_name)}
              </span>
              <button
                className="button-ghost text-xs flex items-center gap-1.5 py-1 px-2.5 rounded border border-border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>

        <footer className="workspace-footer">
          <span>StudioFlow · Multi-Tenant Platform Master Console</span>
          <span>Super Admin Active Session</span>
        </footer>
      </div>
    </div>
  );
}

export default AdminLayout;
