import React, { useState, useEffect } from 'react';
import { Heart, ChevronLeft, ChevronRight, ExternalLink, Download, Image as ImageIcon } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Photo } from '../workspace/shared';

export function CustomerGallery({ assets = [], galleryId = 'preview' }) {
  const [selected, setSelected] = useState(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`studioflow-favorites-${galleryId}`)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(`studioflow-favorites-${galleryId}`, JSON.stringify(favorites));
  }, [favorites, galleryId]);

  const visible = onlyFavorites ? assets.filter((a) => favorites.includes(a.id)) : assets;

  const toggle = (id) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
    );
  };

  const step = (direction) => {
    const index = assets.findIndex((a) => a.id === selected?.id);
    setSelected(assets[(index + direction + assets.length) % assets.length]);
  };

  useEffect(() => {
    if (!selected) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected, assets]);

  return (
    <>
      <div className="gallery-toolbar flex items-center justify-between mb-6">
        <span className="text-sm font-medium text-muted">{visible.length} photographs</span>
        <button
          type="button"
          className={`button-outline flex items-center gap-2 text-xs font-semibold ${
            onlyFavorites ? 'favorites-active border-rose-500 text-rose-500 bg-rose-500/10' : ''
          }`}
          aria-pressed={onlyFavorites}
          onClick={() => setOnlyFavorites((v) => !v)}
        >
          <Heart size={15} fill={onlyFavorites ? 'currentColor' : 'none'} />
          {onlyFavorites ? 'Show all photos' : `Favorites (${favorites.length})`}
        </button>
      </div>

      <div className="photo-masonry">
        {visible.map((asset) => (
          <article key={asset.id} className="gallery-photo group relative rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              className="gallery-open w-full text-left"
              onClick={() => setSelected(asset)}
              aria-label={`View ${asset.filename}`}
            >
              <Photo src={asset.thumbnailUrl} alt={asset.filename} />
            </button>
            <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <a
                href={`${asset.thumbnailUrl}?download=true`}
                download={asset.filename}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur transition-colors"
                title="Download photo"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={15} />
              </a>
              <button
                type="button"
                className={`favorite-button p-2 rounded-full backdrop-blur transition-colors ${
                  favorites.includes(asset.id)
                    ? 'is-favorite bg-rose-600 text-white'
                    : 'bg-black/50 hover:bg-black/80 text-white'
                }`}
                aria-label={`Favorite ${asset.filename}`}
                aria-pressed={favorites.includes(asset.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(asset.id);
                }}
              >
                <Heart size={15} fill={favorites.includes(asset.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-state py-16 text-center">
          <Heart size={36} className="mx-auto mb-3 text-muted" />
          <h2 className="text-lg font-semibold mb-1">Your favorites start here</h2>
          <p className="text-sm text-muted">Tap the heart on any photograph to save it to your shortlist.</p>
        </div>
      )}

      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.filename || 'Photograph'}
        description="Use left/right arrows to browse. Tap download to save the full original."
      >
        {selected && (
          <>
            <Photo className="lightbox-photo rounded-lg max-h-[70vh] object-contain mx-auto" src={selected.thumbnailUrl} alt={selected.filename} />
            <div className="lightbox-controls flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                className="icon-button p-2 rounded-lg border border-border hover:bg-surface-2 transition-colors"
                onClick={() => step(-1)}
                aria-label="Previous photograph"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className={`icon-button p-2 rounded-lg border border-border transition-colors ${
                  favorites.includes(selected.id) ? 'text-rose-500 bg-rose-500/10' : 'hover:bg-surface-2'
                }`}
                aria-label="Toggle favorite"
                aria-pressed={favorites.includes(selected.id)}
                onClick={() => toggle(selected.id)}
              >
                <Heart size={20} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
              </button>
              <a
                className="icon-button p-2 rounded-lg border border-border hover:bg-surface-2 text-brand-primary transition-colors"
                href={`${selected.thumbnailUrl}?download=true`}
                download={selected.filename}
                target="_blank"
                rel="noreferrer"
                aria-label="Download full photograph"
                title="Download full original"
              >
                <Download size={20} />
              </a>
              <a
                className="icon-button p-2 rounded-lg border border-border hover:bg-surface-2 transition-colors"
                href={selected.thumbnailUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open full photograph in new tab"
                title="Open in new tab"
              >
                <ExternalLink size={20} />
              </a>
              <button
                type="button"
                className="icon-button p-2 rounded-lg border border-border hover:bg-surface-2 transition-colors"
                onClick={() => step(1)}
                aria-label="Next photograph"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
