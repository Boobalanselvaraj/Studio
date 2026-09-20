import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Image, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export function CustomerLayout({ branding = { brand_name: 'Studio Gallery', logo_url: null } }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Studio-Branded Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.brand_name} className="h-8 max-w-[120px] object-contain" />
            ) : (
              <div className="flex items-center gap-2 font-bold text-lg text-foreground">
                <Image className="w-5 h-5 text-brand-primary" />
                <span>{branding.brand_name || 'Studio Gallery'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/login"
              className="text-xs text-muted hover:text-foreground px-3 py-1.5 rounded hover:bg-surface-2 transition-colors"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </header>

      {/* Gallery Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <Outlet />
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Powered by {branding.brand_name || 'StudioFlow'}
      </footer>
    </div>
  );
}
