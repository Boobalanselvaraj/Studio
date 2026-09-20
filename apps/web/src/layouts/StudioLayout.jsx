import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  FolderTree, 
  Camera, 
  Users, 
  HardDrive, 
  Palette, 
  CreditCard,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export function StudioLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { label: 'Dashboard', path: '/studio/dashboard', icon: LayoutDashboard },
    { label: 'Events & Shoots', path: '/studio/events', icon: CalendarCheck },
    { label: 'Folders & Files', path: '/studio/folders', icon: FolderTree },
    { label: 'Cameras & SFTP', path: '/studio/cameras', icon: Camera },
    { label: 'Customers', path: '/studio/customers', icon: Users },
    { label: 'Storage Config', path: '/studio/storage', icon: HardDrive },
    { label: 'Branding & Theme', path: '/studio/branding', icon: Palette },
    { label: 'Billing & Usage', path: '/studio/billing', icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-border">
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-brand-primary to-purple-600 bg-clip-text text-transparent">
              StudioFlow
            </h1>
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-primary text-brand-primary-foreground shadow-sm'
                      : 'text-muted hover:text-foreground hover:bg-surface-2'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            to="/login"
            className="flex items-center gap-2 text-xs text-muted hover:text-status-danger p-2 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </Link>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
