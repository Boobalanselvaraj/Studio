import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Aperture, Moon, Sun, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { studioApi } from '../api/services';
import { applyBrandColor } from '../theme/brandColor';

export function CustomerLayout() {
  const { theme, setTheme } = useTheme();
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
  return (
    <div className="client-shell">
      <header className="client-header">
        <Link to="/customer/galleries" className="client-brand">
          <Aperture size={27} />
          <span>{brand.name}</span>
        </Link>
        <div>
          <span className="client-preview-label">CLIENT GALLERY</span>
          <button
            className="icon-button"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
            }
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link className="text-link" to="/studio/dashboard">
            Studio Workspace
            <ArrowUpRight size={15} />
          </Link>
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
