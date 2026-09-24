import api from '../../api/client';
import {ShareQr} from '../../components/gallery/ShareQr';
import {Button} from '../../components/ui/button';
import {toast} from '../../components/ui/toast';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, Radio, CheckCircle2 } from 'lucide-react';
import { CustomerGallery } from '../../components/gallery/CustomerGallery';
import { photos } from '../../data/workspace';
import { fallbackCollections } from './CustomerGalleriesPage';
import { customerPortalApi } from '../../api/services';

export function GalleryViewPage() {
  const { albumId } = useParams();
  const [shareUrl,setShareUrl]=useState('');
  const [shareBusy,setShareBusy]=useState(false);
  const [collection, setCollection] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newShotNotification, setNewShotNotification] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const notificationTimerRef = useRef(null);

  const fetchCollectionData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let found = null;
      try {
        found = await customerPortalApi.getAlbumById(albumId);
      } catch {
        const data = await customerPortalApi.getMyGalleries();
        if (Array.isArray(data)) {
          found = data.find((g) => g.id === albumId);
        }
      }

      if (!found) {
        found = fallbackCollections.find((g) => g.id === albumId);
      }

      if (found) {
        setCollection(found);
        if (Array.isArray(found.assets) && found.assets.length > 0) {
          setAssets(
            found.assets.map((a) => ({
              ...a,
              id: a.id,
              filename: a.filename,
              is_favorite: Boolean(a.is_favorite),
              thumbnailUrl: a.thumbnailUrl || `/api/customer/assets/${a.id}/view`,
            }))
          );
        } else if (Array.isArray(found.album_assets) && found.album_assets.length > 0) {
          setAssets(
            found.album_assets
              .filter((aa) => aa.asset)
              .map((aa) => ({
                id: aa.asset.id,
                filename: aa.asset.filename,
                is_favorite: Boolean(aa.is_favorite),
                thumbnailUrl: `/api/customer/assets/${aa.asset.id}/view`,
              }))
          );
        }
      }
    } catch (err) {
      if (!silent) {
        setCollection(fallbackCollections.find((g) => g.id === albumId) || null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    setShareUrl('');setAssets([]);setCollection(null);
    fetchCollectionData(false);
  }, [albumId]);

  // Real-time SSE Stream + Background Refresh
  useEffect(() => {
    let eventSource = null;

    try {
      // Connect to SSE stream
      eventSource = new EventSource(`/api/customer/albums/live-stream?album_id=${albumId}`);

      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.event === 'refresh') {
            fetchCollectionData(true);
            setNewShotNotification('📷 Live shoot update received');
            if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
            notificationTimerRef.current = setTimeout(() => setNewShotNotification(null), 4000);
          } else if (data.event === 'new_photo' && data.asset) {
            // New photo shot detected on camera!
            const newAssetItem = {
              id: data.asset.id,
              filename: data.asset.filename,
              thumbnailUrl: data.asset.thumbnailUrl || `/api/customer/assets/${data.asset.id}/view`,
            };

            setAssets((prev) => {
              if (prev.some((a) => a.id === newAssetItem.id || a.filename === newAssetItem.filename)) {
                return prev;
              }
              return [newAssetItem, ...prev];
            });

            // Trigger notification banner
            setNewShotNotification(`📷 New photograph received: ${data.asset.filename}`);
            if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
            notificationTimerRef.current = setTimeout(() => {
              setNewShotNotification(null);
            }, 5000);
          }
        } catch (err) {
          console.warn('SSE message parse note:', err);
        }
      };

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (err) {
      console.warn('SSE connection init note:', err);
    }

    // High-frequency 3s background polling fallback for tethering reliability
    const pollInterval = setInterval(() => {
      fetchCollectionData(true);
    }, 30000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [albumId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 text-muted">
        <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
        <span>Opening live gallery collection…</span>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="empty-state py-16">
        <h1>Collection not found</h1>
        <p className="mb-4">This collection may not be published or shared yet.</p>
        <Link className="button-outline" to="/customer/galleries">
          Back to collections
        </Link>
      </div>
    );
  }

  const displayAssets = assets;

  const subtitle =
    collection.subtitle ||
    `${collection.brand_name || collection.studio_name || 'Studio'} · ${displayAssets.length} Photographs`;

  const dateHeading =
    collection.date ||
    (collection.created_at
      ? new Date(collection.created_at).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : 'LIVE COLLECTION');

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <Link className="back-link mb-0" to="/customer/galleries">
          <ArrowLeft size={15} />
          All collections
        </Link>

        {/* Live Ingest Status Indicator */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Camera Sync Active
          </span>
        </div>
      </div>

      {/* Floating Instant Ingest Notification */}
      {newShotNotification && (
        <div className="fixed top-6 right-6 z-50 bg-brand-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={16} />
          {newShotNotification}
        </div>
      )}

      <div className="collection-intro gallery-intro">
        <p className="eyebrow flex items-center gap-1.5">
          <Sparkles size={13} className="text-brand-primary" /> {dateHeading.toUpperCase()}
        </p>
        <h1>{collection.title}</h1>
        <p>{subtitle}</p>
      </div>

      {collection.can_share && <div className="panel p-5 mb-6"><Button disabled={shareBusy} onClick={async()=>{try{setShareBusy(true);const {data}=await api.post('/customer/albums/'+albumId+'/share');setShareUrl(data.share_url);}catch(e){toast.error(e.response?.data?.error||'Could not share album');}finally{setShareBusy(false);}}}>Create guest link & QR</Button>{shareUrl&&<><a className="block break-all mt-3" href={shareUrl}>{shareUrl}</a><ShareQr url={shareUrl} title={collection.title}/></>}</div>}
      <CustomerGallery
        canDownload={collection.can_download}
        canFavorite={collection.can_favorite}
        key={albumId}
        galleryId={albumId}
        assets={displayAssets}
        initialFavorites={collection.favorites || []}
      />
    </>
  );
}
