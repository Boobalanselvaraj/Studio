import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Download,
  Maximize,
  Minimize,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  FileImage,
  Video,
  Heart,
} from 'lucide-react';
import { Button } from '../ui/button';

export const mediaUrl = (a) => a?.url || a?.thumbnailUrl || `/api/studio/folders/assets/${a?.id}/view`;

export function MediaViewer({
  assets = [],
  selected,
  onClose,
  canDownload = true,
  favoriteIds = [],
  onFavorite,
}) {
  const [current, setCurrent] = useState(selected);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    setCurrent(selected);
    setZoom(false);
  }, [selected]);

  const position = assets.findIndex((a) => a.id === current?.id);

  const move = (delta) => {
    if (assets.length) {
      setCurrent(assets[(position + delta + assets.length) % assets.length]);
      setZoom(false);
    }
  };

  if (!selected || !current) return null;
  const isVideo = current.mime_type?.startsWith('video/');
  const ext = current.filename?.split('.').pop()?.toUpperCase() || 'FILE';
  const sizeMb = (Number(current.file_size_bytes || 0) / (1024 * 1024)).toFixed(1);
  const isFav = favoriteIds.includes(current.id);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="media-overlay bg-black/90 backdrop-blur-sm" />
        <Dialog.Content
          className="media-viewer fixed inset-0 z-[101] flex flex-col text-white bg-[#090d14]/95 select-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') move(-1);
            if (e.key === 'ArrowRight') move(1);
          }}
          aria-describedby={undefined}
        >
          {/* Top Control Bar */}
          <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-[#0d121c]/80 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <Dialog.Title className="text-sm font-semibold truncate text-white">
                {current.filename}
              </Dialog.Title>
              <span className="shrink-0 text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                {ext} · {sizeMb} MB
              </span>
              {isFav && !onFavorite && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full">
                  <Heart size={11} className="fill-current text-rose-500" />
                  Client Pick
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onFavorite && (
                <button
                  type="button"
                  onClick={() => onFavorite(current.id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                    isFav
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white/10 text-zinc-300 hover:text-white hover:bg-white/20'
                  }`}
                  title={isFav ? 'Remove from favorites' : 'Mark as favorite'}
                >
                  <Heart size={13} className={isFav ? 'fill-current' : ''} />
                  <span>{isFav ? 'Favorited' : 'Favorite'}</span>
                </button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setZoom(!zoom)}
                className="h-8 px-3 text-xs bg-white/5 border-white/15 text-white hover:bg-white/15 hover:text-white"
                title={zoom ? 'Fit to window' : 'View original size'}
              >
                {zoom ? <Minimize size={13} className="mr-1.5" /> : <Maximize size={13} className="mr-1.5" />}
                {zoom ? 'Fit View' : 'Zoom 100%'}
              </Button>

              {canDownload && (
                <a
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold bg-brand-primary text-white hover:opacity-90 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  href={`${mediaUrl(current)}${mediaUrl(current).includes('?') ? '&' : '?'}download=true`}
                  download={current.filename}
                  title={`Download ${current.filename}`}
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              )}

              <Dialog.Close
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors"
                aria-label="Close viewer"
              >
                <X size={15} />
              </Dialog.Close>
            </div>
          </header>

          {/* Media Stage Canvas */}
          <div className={`media-stage flex-1 overflow-auto p-4 flex items-center justify-center ${zoom ? 'is-zoomed' : ''}`}>
            {isVideo ? (
              <video key={current.id} src={mediaUrl(current)} controls autoPlay className="max-h-[calc(100vh-140px)] rounded-lg shadow-2xl" />
            ) : (
              <img
                src={mediaUrl(current)}
                alt={current.filename}
                className="max-h-[calc(100vh-140px)] max-w-full object-contain rounded-lg shadow-2xl transition-transform"
                onError={(e) => {
                  e.currentTarget.alt = 'Preview unavailable for this format. Use Download to view.';
                }}
              />
            )}
          </div>

          {/* Bottom Navigation Bar */}
          <footer className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#0d121c]/80 backdrop-blur-md text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={assets.length < 2}
              onClick={() => move(-1)}
              className="h-8 px-3 text-xs bg-white/5 border-white/15 text-white hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft size={14} className="mr-1" />
              Previous
            </Button>

            <div className="flex items-center gap-2 text-zinc-400 font-medium">
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white font-semibold">
                {position + 1} of {assets.length}
              </span>
              <span className="hidden sm:inline text-zinc-500">•</span>
              <span className="hidden sm:inline">{current.mime_type || 'Media File'}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={assets.length < 2}
              onClick={() => move(1)}
              className="h-8 px-3 text-xs bg-white/5 border-white/15 text-white hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} className="ml-1" />
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MediaBrowser({
  assets = [],
  onCover,
  onRemove,
  onRename,
  onSelect,
  selectedIds = [],
  children,
  canDownload = true,
  favoriteIds = [],
  onFavorite,
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('masonry');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(
    () => assets.filter((a) => a?.filename?.toLowerCase().includes(query.toLowerCase())),
    [assets, query]
  );

  const perPage = 60;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pages);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const visible = useMemo(
    () => filtered.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filtered, currentPage]
  );

  // Pagination pill numbers generator
  const pageNumbers = useMemo(() => {
    if (pages <= 7) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', pages];
    }
    if (currentPage >= pages - 3) {
      return [1, '...', pages - 4, pages - 3, pages - 2, pages - 1, pages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', pages];
  }, [pages, currentPage]);

  const startItem = filtered.length === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, filtered.length);

  return (
    <section className="media-browser space-y-4">
      {/* Search & Layout View Modes */}
      <div className="media-toolbar flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl border border-border">
        <input
          aria-label="Search files"
          className="search-input flex-1 min-w-[200px] text-xs px-3 py-2 bg-surface rounded-lg border border-border focus:ring-1 focus:ring-brand-primary"
          placeholder="Search filenames across this collection…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
          {[
            { id: 'masonry', label: 'Mixed Grid' },
            { id: 'grid', label: 'Grid' },
            { id: 'large', label: 'Large' },
            { id: 'list', label: 'List' },
          ].map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => setMode(v.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                mode === v.id
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground hover:bg-surface-2'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {children}

      {/* Grid of Media Items */}
      <div className={`media-items media-${mode}`}>
        {visible.map((a) => {
          const isSelected = selectedIds.includes(a.id);
          const isVid = a.mime_type?.startsWith('video/');
          const extBadge = a.filename?.split('.').pop()?.toUpperCase() || 'FILE';
          const isFav = favoriteIds.includes(a.id);

          return (
            <article
              key={a.id}
              className={`media-item group relative transition-all ${
                isSelected ? 'ring-2 ring-brand-primary border-brand-primary/50' : ''
              }`}
            >
              <button
                type="button"
                className="media-preview relative block w-full overflow-hidden focus:outline-none"
                onClick={() => setSelected(a)}
                aria-label={`View ${a.filename}`}
              >
                {isVid ? (
                  <video src={mediaUrl(a)} preload="none" className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={mediaUrl(a)}
                    alt={a.filename}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
                <span className="absolute top-2 left-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                  {extBadge}
                </span>

                {/* Prominent Favorite Badge */}
                {isFav && (
                  <span className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-md">
                    <Heart size={10} className="fill-current" />
                    Favorite
                  </span>
                )}

                <span className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="p-2 rounded-full bg-black/70 text-white shadow-lg">
                    <Eye size={16} />
                  </span>
                </span>
              </button>

              <div className="media-caption p-3 flex flex-col justify-between gap-2 bg-surface">
                <strong className="text-xs truncate block text-foreground" title={a.filename}>
                  {a.filename}
                </strong>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
                  <div className="flex items-center gap-2">
                    {onSelect && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-muted hover:text-foreground font-medium">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelect(a.id)}
                          className="rounded border-border text-brand-primary focus:ring-brand-primary h-3.5 w-3.5"
                        />
                        <span>Select</span>
                      </label>
                    )}

                    {onFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFavorite(a.id);
                        }}
                        className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                          isFav ? 'text-rose-500' : 'text-muted hover:text-rose-500'
                        }`}
                        title={isFav ? 'Remove from favorites' : 'Mark as favorite'}
                      >
                        <Heart size={14} className={isFav ? 'fill-current text-rose-500' : ''} />
                        <span>{isFav ? 'Favorited' : 'Favorite'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onCover && (
                      <button
                        type="button"
                        onClick={() => onCover(a.id)}
                        className="text-brand-primary hover:underline text-[11px] font-semibold"
                      >
                        Set cover
                      </button>
                    )}
                    {onRename && (
                      <button
                        type="button"
                        onClick={() => onRename(a)}
                        className="text-muted hover:text-foreground text-[11px]"
                      >
                        Rename
                      </button>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(a.id)}
                        className="text-rose-500 hover:text-rose-600 text-[11px]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="p-12 text-center text-muted bg-surface rounded-xl border border-dashed border-border space-y-2">
          <FileImage size={32} className="mx-auto text-muted/60" />
          <p className="font-semibold text-sm">No files found matching your search</p>
          <p className="text-xs text-muted">Try clearing the search query or uploading new files.</p>
        </div>
      )}

      {/* Modern, Perfectly Aligned Pagination Bar */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2 px-1 border-t border-border">
          <div className="text-xs text-muted">
            Showing <span className="font-semibold text-foreground">{startItem}</span> to{' '}
            <span className="font-semibold text-foreground">{endItem}</span> of{' '}
            <span className="font-semibold text-foreground">{filtered.length.toLocaleString()}</span> files
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="h-8 px-2.5 text-xs flex items-center gap-1"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-xs text-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-all ${
                      currentPage === p
                        ? 'bg-brand-primary text-white shadow-sm font-bold'
                        : 'text-muted hover:text-foreground hover:bg-surface-2'
                    }`}
                    aria-current={currentPage === p ? 'page' : undefined}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
              className="h-8 px-2.5 text-xs flex items-center gap-1"
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <MediaViewer
        canDownload={canDownload}
        assets={filtered}
        selected={selected}
        onClose={() => setSelected(null)}
        favoriteIds={favoriteIds}
        onFavorite={onFavorite}
      />
    </section>
  );
}
