import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Aperture, Moon, Sun, ArrowUpRight, LogOut, User } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { studioApi } from '../api/services';
import { applyBrandColor } from '../theme/brandColor';
import { useAuthStore } from '../stores/authStore';

export function CustomerLayout() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const studios = useAuthStore((s) => s.studios);
  const logout = useAuthStore((s) => s.logout);

  const [brand, setBrand] = useState({ name: 'StudioFlow Gallery', color: '#3B82F6' });

  useEffect(() => {
    async function loadBrand() {
      try {
        const data = await studioApi.getBranding();
        if (data) {
          const color = data.primary_color || '#3B82F6';
          setBrand({
            name: data.brand_name || 'Studio Gallery',
            color,
          });
          applyBrandColor(color);
        }
      } catch (err) {
        // Fallback to default
      }
    }
    loadBrand();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'CL';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="client-shell">
      <header className="client-header">
        <Link to="/customer/galleries" className="client-brand">
          <Aperture size={27} />
          <span>{brand.name}</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="client-preview-label hidden sm:inline-block">CLIENT GALLERY</span>

          <button
            className="icon-button"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
            }
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Show studio workspace jump if user has studio permissions */}
          {(user?.is_super_admin || (studios && studios.length > 0)) && (
            <Link className="text-link text-xs flex items-center gap-1" to="/studio/dashboard">
              Studio Workspace
              <ArrowUpRight size={14} />
            </Link>
          )}

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <span className="topbar-avatar text-xs" title={user?.email || 'Client'}>
              {getInitials(user?.full_name)}
            </span>
            <span className="text-xs font-medium hidden md:inline-block max-w-[120px] truncate">
              {user?.full_name || user?.email || 'Client'}
            </span>
            <button
              className="button-ghost text-xs flex items-center gap-1 py-1 px-2 rounded border border-border text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={handleLogout}
              title="Sign out of Client Gallery"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="client-main">
        <Outlet />
      </main>

      <footer className="client-footer">
        <Aperture size={21} />
        <p>Made with care. Meant to be kept.</p>
        <span>
          {brand.name} · High-Resolution Client Portal
        </span>
      </footer>
    </div>
  );
}

export default CustomerLayout;
