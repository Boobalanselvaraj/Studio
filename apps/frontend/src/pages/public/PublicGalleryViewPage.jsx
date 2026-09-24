import {MediaBrowser} from '../../components/gallery/MediaBrowser';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Image as ImageIcon,
  Clock,
  Radio,
  Loader2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
} from 'lucide-react';
import { publicGalleryApi } from '../../api/services';

export function PublicGalleryViewPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAlbumIndex, setSelectedAlbumIndex] = useState(0);
  const [previewAssetIndex, setPreviewAssetIndex] = useState(null);

  const fetchGallery = async () => {
    try {
      const res = await publicGalleryApi.getSharedGallery(token);
      setData(res);
      setError('');
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'This gallery link is invalid, expired, or has been revoked by the studio.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [token]);

  // Live real-time updates via SSE
  useEffect(() => {
    if (!token || error) return;

    const streamUrl = `/api/public/shares/${token}/live-stream`;
    const es = new EventSource(streamUrl);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'refresh') {
          fetchGallery();
        }
      } catch (_) {}
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [token, error]);

  const activeAlbum = data?.albums?.[selectedAlbumIndex] || data?.albums?.[0];
  const assets = activeAlbum?.assets || [];

  const handlePrev = () => {
    if (previewAssetIndex > 0) {
      setPreviewAssetIndex(previewAssetIndex - 1);
    }
  };

  const handleNext = () => {
    if (previewAssetIndex < assets.length - 1) {
      setPreviewAssetIndex(previewAssetIndex + 1);
    }
  };

  // Keyboard navigation for preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (previewAssetIndex === null) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setPreviewAssetIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAssetIndex, assets.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-1 text-muted">
        <Loader2 size={36} className="animate-spin text-brand-primary mb-3" />
        <p className="text-sm">Loading gallery collection…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-1 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Gallery Unavailable</h1>
        <p className="text-muted max-w-md mb-6">{error}</p>
        <span className="text-xs text-muted">
          If you believe this is an error, please contact your photographer for a new link.
        </span>
      </div>
    );
  }

  const primaryColor = data.branding?.primary_color || '#3B82F6';

  return (
    <div className="min-h-screen bg-surface-1 text-foreground">
      {/* Top Header */}
      <header className="border-b border-border bg-surface-2/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {data.studio_name ? data.studio_name.slice(0, 2).toUpperCase() : 'ST'}
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">{data.studio_name}</h1>
            <span className="text-xs text-muted flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Shared Client Gallery · View-Only
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          {data.expires_at && (
            <div className="flex items-center gap-1 bg-surface-1 px-3 py-1.5 rounded-md border border-border">
              <Clock size={13} />
              <span>Expires {new Date(data.expires_at).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <Radio size={14} className="animate-pulse" />
            <span className="hidden sm:inline">Live Stream Connected</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Album Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-2">{activeAlbum.title}</h2>
          {activeAlbum.description && (
            <p className="text-muted text-sm max-w-2xl">{activeAlbum.description}</p>
          )}

          {/* Multiple Albums Selector if applicable */}
          {data.albums.length > 1 && (
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
              {data.albums.map((alb, idx) => (
                <button
                  key={alb.id}
                  type="button"
                  onClick={() => setSelectedAlbumIndex(idx)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedAlbumIndex === idx
                      ? 'bg-foreground text-background shadow'
                      : 'bg-surface-2 text-muted hover:text-foreground'
                  }`}
                >
                  {alb.title} ({alb.photosCount})
                </button>
              ))}
            </div>
          )}
        </div>

        <MediaBrowser assets={assets} canDownload={false}/>
      </main>

      {/* Fullscreen Photo Lightbox Modal */}
      {previewAssetIndex !== null && assets[previewAssetIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 select-none">
          {/* Modal Top Bar */}
          <div className="w-full flex items-center justify-between text-white/80 py-2">
            <span className="text-sm font-medium truncate max-w-sm">
              {assets[previewAssetIndex].filename}
            </span>
            <div className="flex items-center gap-3">
              {assets[previewAssetIndex].downloadUrl && (
                <a
                  href={assets[previewAssetIndex].downloadUrl}
                  download={assets[previewAssetIndex].filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors"
                  title="Download High-Res Original"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              )}
              <span className="text-xs text-white/60">
                {previewAssetIndex + 1} / {assets.length}
              </span>
              <button
                type="button"
                onClick={() => setPreviewAssetIndex(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Image Display Area */}
          <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
            {previewAssetIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur z-10"
                title="Previous (Left Arrow)"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img
              src={assets[previewAssetIndex].thumbnailUrl}
              alt={assets[previewAssetIndex].filename}
              className="max-h-full max-w-full object-contain rounded shadow-2xl transition-all duration-150"
            />

            {previewAssetIndex < assets.length - 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur z-10"
                title="Next (Right Arrow)"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Caption */}
          <div className="w-full text-center py-2 text-xs text-white/50">
            View-Only · High Resolution Preview
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicGalleryViewPage;
