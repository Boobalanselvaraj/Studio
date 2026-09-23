import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Aperture, Check, ArrowUpRight, Loader2 } from 'lucide-react';
import { photos } from '../../../data/workspace';
import { PageHeading, Photo } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { studioApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';
import { applyBrandColor } from '../../../theme/brandColor';

export function BrandingSettingsPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);
  const outletContext = useOutletContext();

  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [logoUrl, setLogoUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleColorChange = (newColor) => {
    setPrimaryColor(newColor);
    setSaved(false);
    applyBrandColor(newColor);
  };

  const loadBranding = async () => {
    try {
      setLoading(true);
      const data = await studioApi.getBranding();
      if (data) {
        setBrandName(data.brand_name || currentStudio?.name || '');
        const color = data.primary_color || '#3B82F6';
        setPrimaryColor(color);
        applyBrandColor(color);
        setLogoUrl(data.logo_url || '');
      }
    } catch (err) {
      console.warn('Branding load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, [currentStudio?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      await studioApi.updateBranding({
        brand_name: brandName.trim(),
        primary_color: primaryColor,
        logo_url: logoUrl || undefined,
      });

      applyBrandColor(primaryColor);
      setSaved(true);
      outletContext?.refreshLayoutData?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save brand preferences');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="MAKE IT UNMISTAKABLY YOURS"
        title="Your studio, your signature."
        description="Give your client experience a personal touch."
      />

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading branding preferences…</span>
        </div>
      ) : (
        <div className="branding-grid">
          <section className="panel p-7">
            <h2>Studio identity</h2>
            <p className="text-xs text-muted mt-2 mb-7">
              Fine-tune the details that make your brand memorable.
            </p>

            <form className="form-stack" onSubmit={handleSubmit}>
              {error && <p className="form-error">{error}</p>}

              <label>
                Studio / Brand Name
                <input
                  required
                  maxLength={60}
                  pattern=".*\S.*"
                  value={brandName}
                  onChange={(e) => {
                    setBrandName(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. Lumina Creative Studios"
                />
              </label>

              <label>
                Signature Brand Color
                <div className="brand-color-input">
                  <input
                    aria-label="Pick signature color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                  />
                  <input
                    aria-label="Hex color code"
                    required
                    pattern="#[0-9a-fA-F]{6}"
                    value={primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                  />
                </div>
              </label>

              <div className="brand-swatches">
                {['#3B82F6', '#23745d', '#2c5273', '#78627f', '#97634c', '#10B981'].map((c) => (
                  <button
                    type="button"
                    aria-label={`Use ${c} color`}
                    key={c}
                    style={{ background: c }}
                    onClick={() => handleColorChange(c)}
                  >
                    {primaryColor === c && <Check size={14} />}
                  </button>
                ))}
              </div>

              <label>
                Logo Image URL (optional)
                <input
                  type="url"
                  placeholder="https://your-domain.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value);
                    setSaved(false);
                  }}
                />
              </label>

              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : 'Save brand preferences'}
              </Button>

              {saved && (
                <p role="status" className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Saved. Your client galleries and studio interface now use this signature branding.
                </p>
              )}
            </form>
          </section>

          <section className="panel brand-preview">
            <div className="brand-preview-label">
              <span>LIVE CLIENT PREVIEW</span>
              <Link to="/customer/galleries" className="text-link">
                Open gallery
                <ArrowUpRight size={15} />
              </Link>
            </div>

            <div
              className="brand-preview-header"
              style={{
                color: /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#3B82F6',
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={brandName} className="h-6 w-auto object-contain mr-2" />
              ) : (
                <Aperture size={24} />
              )}
              {brandName || 'Your studio'}
            </div>

            <div className="brand-preview-photo">
              <Photo src={photos.wedding} alt="Wedding gallery preview" />
              <div>
                <span>A COLLECTION BY {(brandName || 'STUDIO').toUpperCase()}</span>
                <h2>
                  The beginning
                  <br />
                  of always.
                </h2>
              </div>
            </div>

            <p>Beautiful moments. A distinctly personal experience.</p>
          </section>
        </div>
      )}
    </div>
  );
}
