import React, { useState, useEffect } from 'react';
import { Download, Heart, CheckCircle2 } from 'lucide-react';
import { MediaBrowser } from './MediaBrowser';
import { Button } from '../ui/button';
import { customerPortalApi } from '../../api/services';
import { toast } from '../ui/toast';

export function CustomerGallery({ assets = [], galleryId, canDownload = true, canFavorite = true, initialFavorites = [] }) {
  const [favorites, setFavorites] = useState(() => {
    const fromAssets = (assets || []).filter((a) => a.is_favorite).map((a) => a.id);
    if (fromAssets.length > 0) return fromAssets;
    if (initialFavorites && initialFavorites.length > 0) return initialFavorites;
    try {
      return JSON.parse(localStorage.getItem('studioflow-favorites-' + galleryId)) || [];
    } catch {
      return [];
    }
  });

  const [only, setOnly] = useState(false);

  // Keep in sync if assets change or load with is_favorite flags
  useEffect(() => {
    const fromAssets = (assets || []).filter((a) => a.is_favorite).map((a) => a.id);
    if (fromAssets.length > 0) {
      setFavorites((prev) => Array.from(new Set([...prev, ...fromAssets])));
    }
  }, [assets]);

  const toggle = async (id) => {
    const isCurrentlyFav = favorites.includes(id);
    const nextState = !isCurrentlyFav;
    const nextFavorites = isCurrentlyFav
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];

    // Optimistic UI state
    setFavorites(nextFavorites);
    try {
      localStorage.setItem('studioflow-favorites-' + galleryId, JSON.stringify(nextFavorites));
    } catch {}

    // Persist to backend database so Studio sees client favorites in real-time!
    try {
      await customerPortalApi.toggleFavorite(galleryId, id, nextState);
      if (nextState) {
        toast.success('Added to favorites! The studio can see your selection.');
      }
    } catch (err) {
      console.warn('Could not sync favorite to server:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="gallery-toolbar flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-wrap">
          {canDownload && (
            <>
              <a
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:opacity-90 transition-all shadow-sm"
                href={customerPortalApi.getDownloadUrl(galleryId, false)}
                download
              >
                <Download size={14} />
                <span>Download Album (ZIP)</span>
              </a>

              {favorites.length > 0 && (
                <a
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm"
                  href={customerPortalApi.getDownloadUrl(galleryId, true)}
                  download
                  title="Download only your favorited photos as a ZIP archive"
                >
                  <Heart size={14} className="fill-current text-white" />
                  <span>Download Favorites ({favorites.length})</span>
                </a>
              )}
            </>
          )}
        </div>

        {canFavorite && (
          <div className="flex items-center gap-2">
            {favorites.length > 0 && (
              <span className="text-xs text-muted font-medium hidden sm:inline">
                {favorites.length} photo(s) selected
              </span>
            )}
            <Button
              type="button"
              variant={only ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setOnly(!only)}
              className={`text-xs h-9 ${only ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}
            >
              <Heart size={14} className={only || favorites.length > 0 ? 'fill-current text-rose-500' : ''} />
              <span>{only ? 'Show All Photos' : `My Favorites (${favorites.length})`}</span>
            </Button>
          </div>
        )}
      </div>

      <MediaBrowser
        assets={only ? assets.filter((a) => favorites.includes(a.id)) : assets}
        canDownload={canDownload}
        favoriteIds={favorites}
        onFavorite={canFavorite ? toggle : undefined}
      />
    </div>
  );
}
