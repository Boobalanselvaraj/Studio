import React, { useEffect, useState } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Aperture,
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  FolderOpen,
  Camera,
  Users,
  HardDrive,
  Palette,
  CreditCard,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  ArrowUpRight,
  Search,
  Building2,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { Modal } from '../components/ui/modal';
import { Select } from '../components/ui/select';
import { useAuthStore } from '../stores/authStore';
import { studioApi, eventsApi } from '../api/services';
import { applyBrandColor } from '../theme/brandColor';

const nav = [
  ['Overview', '/studio/dashboard', LayoutDashboard],
  ['Events & shoots', '/studio/events', CalendarCheck],
  ['Calendar', '/studio/calendar', CalendarDays],
  ['Photo library', '/studio/folders', FolderOpen],
  ['Albums', '/studio/albums', FolderOpen],
  ['Customers', '/studio/customers', Users],
  ['Cameras & sync', '/studio/cameras', Camera],
];

const settings = [
  ['Storage', '/studio/storage', HardDrive],
  ['Branding', '/studio/branding', Palette],
  ['Support tickets', '/studio/support', CreditCard],
    ['Billing & usage', '/studio/billing', CreditCard],
];

export function StudioLayout() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const studios = useAuthStore((s) => s.studios);
  const currentStudio = useAuthStore((s) => s.currentStudio);
  const setCurrentStudio = useAuthStore((s) => s.setCurrentStudio);
  const logout = useAuthStore((s) => s.logout);

  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [eventCount, setEventCount] = useState(0);
  const [eventsList, setEventsList] = useState([]);
  const [brandInfo, setBrandInfo] = useState({ brand_name: 'StudioFlow Workspace', primary_color: '#3B82F6' });

  useEffect(() => {
    setMobile(false);
    setSearch(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadStudioData = async () => {
    try {
      const [branding, events] = await Promise.allSettled([
        studioApi.getBranding(),
        eventsApi.list(),
      ]);

      if (branding.status === 'fulfilled' && branding.value) {
        setBrandInfo(branding.value);
        if (branding.value.primary_color) {
          applyBrandColor(branding.value.primary_color);
        }
      }

      if (events.status === 'fulfilled' && Array.isArray(events.value)) {
        setEventsList(events.value);
        setEventCount(events.value.length);
      }
    } catch (e) {
      console.warn('Could not load studio data in layout:', e);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, [currentStudio?.id]);

  const active = [...nav, ...settings].find(([, path]) => location.pathname.startsWith(path));

  const getInitials = (name) => {
    if (!name) return 'SW';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNav = (items) =>
    items.map(([label, path, Icon]) => (
      <NavLink
        key={path}
        to={path}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <Icon size={18} strokeWidth={1.7} />
        <span>{label}</span>
        {label === 'Events & shoots' && <span className="nav-count">{eventCount}</span>}
      </NavLink>
    ));

  const displayName = brandInfo?.brand_name || currentStudio?.name || 'StudioFlow';
  const studioInitials = getInitials(displayName);
  const userInitials = getInitials(user?.full_name || 'Studio Member');

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}

      <aside className={`workspace-sidebar ${mobile ? 'is-open' : ''}`}>
        <Link to="/studio/dashboard" className="wordmark">
          <span className="brand-mark">
            <Aperture size={24} />
          </span>
          studioflow<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={18} />
        </button>

        <div className="studio-identity">
          <span className="studio-avatar">{studioInitials}</span>
          <div className="flex-1 overflow-hidden">
            <strong>{displayName}</strong>
            <span>{currentStudio?.role ? currentStudio.role.replace('_', ' ') : 'Photography workspace'}</span>
          </div>
          {studios && studios.length > 1 && (
            <div className="w-28 min-w-[100px] shrink-0">
              <Select
                aria-label="Switch studio"
                value={currentStudio?.id || ''}
                onChange={(e) => {
                  const selected = studios.find((s) => s.id === e.target.value);
                  if (selected) setCurrentStudio(selected);
                }}
                className="text-xs py-1"
                options={studios.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              />
            </div>
          )}
          {(!studios || studios.length <= 1) && <span className="plan-tag">LIVE</span>}
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace">{renderNav(nav)}</nav>

        <div className="nav-label settings-label">MANAGE</div>
        <nav aria-label="Settings">{renderNav(settings)}</nav>

        <div className="sidebar-bottom">
          <div className="storage-mini">
            <div>
              <HardDrive size={15} />
              <strong>{user?.is_super_admin ? 'Admin Studio' : 'Connected workspace'}</strong>
            </div>
            <p>{currentStudio ? `Connected to ${currentStudio.name}` : 'Explore your studio workspace.'}</p>
            <Link to="/customer/galleries">
              View client experience
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="sidebar-account">
            <span className="account-avatar">{userInitials}</span>
            <div className="flex-1 overflow-hidden">
              <strong className="truncate block">{user?.full_name || 'Studio Member'}</strong>
              <span className="truncate block">{user?.email || 'Active session'}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
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
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{active?.[0] || 'Event details'}</strong>
          </div>

          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>Ctrl K</kbd>
            </button>

            <button
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() =>
                setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
              }
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <span className="topbar-avatar" title={user?.full_name || 'Member'}>
                {userInitials}
              </span>
              <button
                className="button-ghost text-xs flex items-center gap-1 py-1 px-2 rounded border border-border text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleLogout}
                title="Sign out of Studio"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="workspace-content">
          <Outlet context={{ refreshLayoutData: loadStudioData }} />
        </main>

        <footer className="workspace-footer">
          <span>Made for the moments that matter.</span>
          <span>
            StudioFlow <span className="footer-dot">●</span> Multi-Tenant Studio Platform
          </span>
        </footer>
      </div>

      <Modal
        open={search}
        onOpenChange={setSearch}
        title="Find your next moment"
        description="Search pages and shoots in this workspace."
      >
        <input
          className="search-input"
          aria-label="Search pages and events"
          placeholder="Search shoots by title or location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="search-results">
          {[...nav, ...settings]
            .filter(([label]) => label.toLowerCase().includes(query.toLowerCase()))
            .map(([label, path, Icon]) => (
              <Link to={path} key={path} onClick={() => setSearch(false)}>
                <Icon size={17} />
                {label}
                <ChevronRight size={15} />
              </Link>
            ))}
          {eventsList
            .filter(
              (e) =>
                e.title.toLowerCase().includes(query.toLowerCase()) ||
                (e.location && e.location.toLowerCase().includes(query.toLowerCase()))
            )
            .map((e) => (
              <Link
                to={`/studio/events/${e.id}`}
                key={e.id}
                onClick={() => setSearch(false)}
              >
                <CalendarCheck size={17} />
                <span className="flex-1 truncate">{e.title}</span>
                <small className="text-muted mr-2">{e.status}</small>
                <ChevronRight size={15} />
              </Link>
            ))}
        </div>
      </Modal>
    </div>
  );
}
