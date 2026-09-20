import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Building2, CreditCard, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export function AdminLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { label: 'Studios Management', path: '/admin/studios', icon: Building2 },
    { label: 'Billing Plans', path: '/admin/billing-plans', icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border bg-surface flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
            <span className="font-bold text-base">Super Admin</span>
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

        <div className="p-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded hover:bg-surface-2 text-muted hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link to="/login" className="flex items-center gap-2 text-xs text-muted hover:text-status-danger">
            <LogOut className="w-4 h-4" /> Exit
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
