import { MediaBrowser } from '../../../components/gallery/MediaBrowser';
import { ShareQr } from '../../../components/gallery/ShareQr';
import { StorageTreeExplorer } from '../../../components/gallery/StorageTreeExplorer';
import React, { useEffect, useState, useMemo } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Edit3,
  Share2,
  ExternalLink,
  Eye,
  CheckCircle2,
  Image as ImageIcon,
  Lock,
  Globe,
  Download,
  Copy,
  Check,
  X,
  FileImage,
  RefreshCw,
  Loader2,
  ShieldCheck,
  UserCheck,
  Clock,
  Sparkles,
  ArrowUpRight,
  Rocket,
  EyeOff,
  Info,
  Server,
  HardDrive,
  Camera,
  Heart,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/toast';
import { Select } from '../../../components/ui/select';
import { albumsApi, foldersApi, customersApi, sharesApi, triggerFileDownload } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function AlbumsPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [albums, setAlbums] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [explorerData, setExplorerData] = useState({
    assets: [],
    providers: [],
    cameras: [],
    albums: [],
    folders: [],
  });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [manageAssetsModal, setManageAssetsModal] = useState(false);
  const [addPhotosModal, setAddPhotosModal] = useState(false);
  const [studioFavoritesOnly, setStudioFavoritesOnly] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [publishModal, setPublishModal] = useState(false);
  const [publishAlbum, setPublishAlbum] = useState(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishAssignCustomerId, setPublishAssignCustomerId] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [lightboxAsset, setLightboxAsset] = useState(null);

  const [activeAlbum, setActiveAlbum] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPublished, setFormPublished] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  // Share Modal states (2 Types of Gallery Access)
  const [shareTab, setShareTab] = useState('private'); // 'private' | 'token'
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [canShare,setCanShare]=useState(false);
  const [canDownload, setCanDownload] = useState(true);
  const [canFavorite, setCanFavorite] = useState(true);
  const [tokenExpiresHours, setTokenExpiresHours] = useState(72);
  const [generatedGuestUrl, setGeneratedGuestUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [albumRes, treeRes, custRes] = await Promise.allSettled([
        albumsApi.list(),
        foldersApi.getServerExplorer(),
        customersApi.list(),
      ]);

      if (albumRes.status === 'fulfilled' && Array.isArray(albumRes.value)) {
        setAlbums(albumRes.value);
        if (activeAlbum) {
          const fresh = albumRes.value.find((a) => a.id === activeAlbum.id);
          if (fresh) setActiveAlbum(fresh);
        }
      }

      if (treeRes.status === 'fulfilled' && treeRes.value) {
        setExplorerData(treeRes.value);
        setAvailableAssets(treeRes.value.assets || []);
      }

      if (custRes.status === 'fulfilled' && Array.isArray(custRes.value)) {
        setCustomers(custRes.value);
      }
    } catch (err) {
      console.warn('Error loading albums data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStudio?.id]);

  // Create Album
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setBusy(true);
      const created = await albumsApi.create({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        is_published: formPublished,
        asset_ids: selectedAssetIds,
      });

      setCreateModal(false);
      setFormTitle('');
      setFormDescription('');
      setSelectedAssetIds([]);
      toast.success(`Album '${created.title}' created successfully.`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create album');
    } finally {
      setBusy(false);
    }
  };

  // Edit Album
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!activeAlbum || !formTitle.trim()) return;

    try {
      setBusy(true);
      await albumsApi.update(activeAlbum.id, {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        is_published: formPublished,
      });

      setEditModal(false);
      toast.success(`Album '${formTitle}' updated.`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update album');
    } finally {
      setBusy(false);
    }
  };

  // Delete Album
  const handleDeleteConfirm = async () => {
    if (!activeAlbum) return;
    try {
      setBusy(true);
      await albumsApi.delete(activeAlbum.id);
      setDeleteModal(false);
      toast.success(`Album '${activeAlbum.title}' was deleted.`);
      setActiveAlbum(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete album');
    } finally {
      setBusy(false);
    }
  };

  // Remove photo from album
  const handleRemoveAsset = async (assetId) => {
    if (!activeAlbum) return;
    try {
      await albumsApi.removeAsset(activeAlbum.id, assetId);
      toast.success('Photo removed from album.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove photo');
    }
  };

  // Set Cover Photo
  const handleSetCover = async (assetId) => {
    if (!activeAlbum) return;
    try {
      await albumsApi.update(activeAlbum.id, { cover_asset_id: assetId });
      toast.success('Cover photo updated.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update cover photo');
    }
  };

  // Add more photos to existing album
  const handleAddPhotosToAlbum = async (assetIds) => {
    if (!activeAlbum || !assetIds.length) return;
    try {
      await albumsApi.addAssets(activeAlbum.id, assetIds);
      toast.success('Photos added to album.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add photos');
    }
  };

  // Client favorite IDs in activeAlbum
  const albumClientFavoriteIds = useMemo(() => {
    return (activeAlbum?.album_assets || [])
      .filter((aa) => aa.is_favorite)
      .map((aa) => aa.asset_id);
  }, [activeAlbum]);

  const displayedModalAssets = useMemo(() => {
    const all = (activeAlbum?.album_assets || []).map((aa) => aa.asset).filter(Boolean);
    if (!studioFavoritesOnly) return all;
    return all.filter((a) => albumClientFavoriteIds.includes(a.id));
  }, [activeAlbum, studioFavoritesOnly, albumClientFavoriteIds]);

  const handleCopyFavoriteFilenames = (onlyFavorites = true) => {
    const list = (activeAlbum?.album_assets || [])
      .filter((aa) => !onlyFavorites || aa.is_favorite)
      .map((aa) => aa.asset?.original_filename || aa.asset?.filename)
      .filter(Boolean);

    if (list.length === 0) {
      toast.info(onlyFavorites ? 'No favorite photos to copy.' : 'No photos to copy.');
      return;
    }

    navigator.clipboard.writeText(list.join('\n'));
    toast.success(`Copied ${list.length} filename(s) to clipboard!`);
  };

  const handleExportZip = async (album, favoritesOnly = false) => {
    const targetAlbum = album || activeAlbum;
    if (!targetAlbum) return;

    const favCount = (targetAlbum.album_assets || []).filter((aa) => aa.is_favorite).length;
    const totalCount = targetAlbum.album_assets?.length || 0;

    if (favoritesOnly && favCount === 0) {
      toast.info('No client favorites to export in this album.');
      return;
    }
    if (!favoritesOnly && totalCount === 0) {
      toast.info('This album has no photos to export.');
      return;
    }

    try {
      setExportBusy(true);
      toast.info(
        favoritesOnly
          ? `Preparing ZIP export of ${favCount} client favorite photo(s)...`
          : `Preparing ZIP export of all ${totalCount} photo(s)...`
      );
      const blob = await albumsApi.downloadZip(targetAlbum.id, favoritesOnly);
      const filename = `${targetAlbum.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${favoritesOnly ? 'favorites' : 'full'}.zip`;
      triggerFileDownload(blob, filename);
      toast.success(favoritesOnly ? 'Favorites ZIP downloaded!' : 'Full album ZIP downloaded!');
    } catch (err) {
      console.warn('Blob export error, trying direct stream:', err);
      try {
        const directUrl = albumsApi.getDownloadUrl(targetAlbum.id, favoritesOnly);
        window.open(directUrl, '_blank');
      } catch {
        toast.error(err.response?.data?.error || 'Failed to export album ZIP');
      }
    } finally {
      setExportBusy(false);
    }
  };

  // Toggle publication status (Draft vs Published)
  const handleTogglePublish = async (album, targetPublished) => {
    if (!album) return;
    try {
      setPublishBusy(true);
      await albumsApi.update(album.id, { is_published: targetPublished });
      toast.success(
        targetPublished
          ? `🎉 '${album.title}' is now Published & live for clients!`
          : `🔒 '${album.title}' reverted to Draft mode (hidden from clients).`
      );
      if (publishAlbum && publishAlbum.id === album.id) {
        setPublishAlbum((prev) => ({ ...prev, is_published: targetPublished }));
      }
      if (activeAlbum && activeAlbum.id === album.id) {
        setActiveAlbum((prev) => ({ ...prev, is_published: targetPublished }));
      }
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update publication status');
    } finally {
      setPublishBusy(false);
    }
  };

  // Quick grant client access directly inside the Publish Modal
  const handlePublishGrantClient = async () => {
    if (!publishAlbum || !publishAssignCustomerId) return;
    try {
      setPublishBusy(true);
      await customersApi.shareAlbum({
        album_id: publishAlbum.id,
        customer_id: publishAssignCustomerId,
        can_share: false,
        can_download: true,
        can_favorite: true,
      });
      toast.success('Client granted access to this album!');
      setPublishAssignCustomerId('');
      const fresh = await albumsApi.getById(publishAlbum.id);
      if (fresh) setPublishAlbum(fresh);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to grant client access');
    } finally {
      setPublishBusy(false);
    }
  };

  // Share Handler (Type 1: Private Account Access)
  const handleGrantPrivateAccess = async (e) => {
    e.preventDefault();
    if (!activeAlbum || !selectedCustomerId) return;

    try {
      setBusy(true);
      await customersApi.shareAlbum({
        album_id: activeAlbum.id,
        customer_id: selectedCustomerId,
        can_share: canShare,
        can_download: canDownload,
        can_favorite: canFavorite,
      });

      toast.success('Private client gallery access granted.');
      setShareModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to grant client access');
    } finally {
      setBusy(false);
    }
  };

  // Share Handler (Type 2: Expiring Token Link)
  const handleGenerateGuestLink = async () => {
    if (!activeAlbum) return;
    try {
      setBusy(true);
      setGeneratedGuestUrl('');
      const res = await sharesApi.createShare({
        album_id: activeAlbum.id,
        expires_in_hours: tokenExpiresHours,
      });
      setGeneratedGuestUrl(res.share_url);
      toast.success('Expiring guest link generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate guest link');
    } finally {
      setBusy(false);
    }
  };

  const filteredAlbums = useMemo(() => {
    return albums.filter((a) => {
      const matchQ =
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(query.toLowerCase()));
      if (!matchQ) return false;

      if (statusFilter === 'published') return a.is_published;
      if (statusFilter === 'draft') return !a.is_published;
      return true;
    });
  }, [albums, query, statusFilter]);

  const formatFileSize = (bytes) => {
    const num = Number(bytes || 0);
    if (!num) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return (num / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  return (
    <div className="page-enter space-y-6">
      <PageHeading
        eyebrow="CLIENT PROOFING & SHOWCASES"
        title="Albums & Client Galleries"
        description="Curate photo sets, customize client proofing portals, and issue private or guest links."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
          <Button
            className="bg-brand-primary text-white"
            onClick={() => {
              setFormTitle('');
              setFormDescription('');
              setFormPublished(true);
              setSelectedAssetIds([]);
              setCreateModal(true);
            }}
          >
            <Plus size={16} className="mr-1" />
            Create Album
          </Button>
        </div>
      </PageHeading>

      {/* Global Feedback Banner */}
      {feedbackMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-600 animate-in fade-in duration-200">
          <CheckCircle2 size={16} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="panel p-4 space-y-1">
          <p className="text-xs text-muted">Total Collections</p>
          <h3 className="text-2xl font-bold text-foreground">{albums.length}</h3>
          <p className="text-[11px] text-muted">Curated shoot sets</p>
        </div>
        <div className="panel p-4 space-y-1">
          <p className="text-xs text-muted">Published to Clients</p>
          <h3 className="text-2xl font-bold text-emerald-600">
            {albums.filter((a) => a.is_published).length}
          </h3>
          <p className="text-[11px] text-muted">Active client portals</p>
        </div>
        <div className="panel p-4 space-y-1">
          <p className="text-xs text-muted">Private Client Accounts</p>
          <h3 className="text-2xl font-bold text-indigo-600">{customers.length}</h3>
          <p className="text-[11px] text-muted">Registered studio clients</p>
        </div>
        <div className="panel p-4 space-y-1">
          <p className="text-xs text-muted">Draft / Unlisted</p>
          <h3 className="text-2xl font-bold text-amber-500">
            {albums.filter((a) => !a.is_published).length}
          </h3>
          <p className="text-[11px] text-muted">Internal editing mode</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="panel p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-border overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            All Collections ({albums.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('published')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              statusFilter === 'published'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted hover:text-emerald-600'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Published ({albums.filter((a) => a.is_published).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              statusFilter === 'draft'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Lock size={12} className="text-amber-500" />
            Drafts ({albums.filter((a) => !a.is_published).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search album title, event, or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      {/* Albums Grid */}
      {loading ? (
        <div className="py-20 text-center text-muted flex items-center justify-center gap-2">
          <Loader2 size={24} className="animate-spin text-brand-primary" />
          <span>Loading studio albums…</span>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <FolderOpen size={40} className="text-muted mx-auto opacity-50" />
          <h4 className="text-base font-bold text-foreground">No albums found</h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {statusFilter === 'published'
              ? 'No published albums yet. Select a draft album and click Publish to make it live for clients.'
              : statusFilter === 'draft'
              ? 'No draft albums. All your albums are currently published and live.'
              : 'Create an album to organize photos into a beautiful presentation for your clients.'}
          </p>
          <Button
            size="sm"
            className="bg-brand-primary text-white"
            onClick={() => setCreateModal(true)}
          >
            <Plus size={14} className="mr-1" />
            Create First Album
          </Button>
        </div>
      ) : (
        <div className="album-editorial-grid">
          {filteredAlbums.map((album) => {
            const photoCount = album.album_assets?.length || 0;
            const favCount = (album.album_assets || []).filter((aa) => aa.is_favorite).length;
            const coverAsset =
              album.album_assets?.find((aa) => aa.asset_id === album.cover_asset_id)?.asset ||
              album.album_assets?.[0]?.asset;
            const coverUrl = coverAsset ? `/api/studio/folders/assets/${coverAsset.id}/view` : null;
            const clientCount = album.album_customers?.length || 0;

            return (
              <div
                key={album.id}
                className="panel overflow-hidden border border-border flex flex-col group hover:border-brand-primary/40 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {/* Album Cover Art */}
                <div
                  className="aspect-[16/10] w-full bg-surface-muted relative overflow-hidden cursor-pointer"
                  onClick={() => {
                    setActiveAlbum(album);
                    setSelectedAssetIds([]);
                    setStudioFavoritesOnly(false);
                    setManageAssetsModal(true);
                  }}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted">
                      <ImageIcon size={32} className="opacity-40 mb-1" />
                      <span className="text-xs">No photos in album</span>
                    </div>
                  )}

                  {/* Interactive Status Tag */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPublishAlbum(album);
                      setPublishModal(true);
                    }}
                    className={`absolute top-2.5 right-2.5 text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-md flex items-center gap-1.5 transition-all ${
                      album.is_published
                        ? 'bg-emerald-500/95 hover:bg-emerald-600 text-white'
                        : 'bg-zinc-900/85 hover:bg-zinc-800 text-zinc-300 border border-white/10'
                    }`}
                    title="Click to manage publishing & client visibility"
                  >
                    {album.is_published ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>Live · Published</span>
                      </>
                    ) : (
                      <>
                        <Lock size={11} className="text-amber-400" />
                        <span>Draft · Private</span>
                      </>
                    )}
                  </button>

                  {/* Quick Photo & Favorites Count Badges */}
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-md">
                      {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                    </span>
                    {favCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-600/90 text-white backdrop-blur-md flex items-center gap-1 shadow-sm">
                        <Heart size={10} className="fill-current text-white" />
                        {favCount} {favCount === 1 ? 'Favorite' : 'Favorites'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3
                      className="font-bold text-base text-foreground truncate cursor-pointer hover:text-brand-primary"
                      onClick={() => {
                        setActiveAlbum(album);
                        setStudioFavoritesOnly(false);
                        setManageAssetsModal(true);
                      }}
                    >
                      {album.title}
                    </h3>
                    <p className="text-xs text-muted line-clamp-2 mt-1">
                      {album.description || 'No description added yet.'}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border text-xs text-muted">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <UserCheck size={13} className="text-indigo-500" />
                        Clients with access:
                      </span>
                      <strong className="text-foreground">{clientCount}</strong>
                    </div>

                    {favCount > 0 && (
                      <div className="flex items-center justify-between text-rose-500 bg-rose-500/10 px-2 py-1 rounded">
                        <span className="flex items-center gap-1 font-medium">
                          <Heart size={12} className="fill-current text-rose-500" />
                          Client Proofing Picks:
                        </span>
                        <span className="font-bold">{favCount} selected</span>
                      </div>
                    )}

                    {clientCount > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                        {album.album_customers.map((ac) => (
                          <span
                            key={ac.customer_id}
                            className="inline-block text-[10px] bg-surface-muted px-1.5 py-0.5 rounded truncate max-w-[120px]"
                          >
                            👤 {ac.customer?.user?.full_name || 'Client'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="pt-2 flex items-center justify-between gap-1 border-t border-border flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Manage and organize album photos"
                        onClick={() => {
                          setActiveAlbum(album);
                          setStudioFavoritesOnly(false);
                          setManageAssetsModal(true);
                        }}
                      >
                        <Eye size={13} className="mr-1" />
                        Photos ({photoCount})
                      </Button>

                      {/* Primary 1-Click Publish / Visibility Status Button */}
                      {album.is_published ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10 font-semibold"
                          title="Published to clients. Click to view settings or unpublish."
                          onClick={() => {
                            setPublishAlbum(album);
                            setPublishModal(true);
                          }}
                        >
                          <CheckCircle2 size={13} className="mr-1 text-emerald-500" />
                          Live Status
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                          title="Make this album visible to assigned clients"
                          onClick={() => {
                            setPublishAlbum(album);
                            setPublishModal(true);
                          }}
                        >
                          <Rocket size={13} className="mr-1" />
                          Publish
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        title="Share album with client"
                        onClick={() => {
                          setActiveAlbum(album);
                          setGeneratedGuestUrl('');
                          setShareModal(true);
                        }}
                      >
                        <Share2 size={13} className="mr-1 text-brand-primary" />
                        Share
                      </Button>

                      {/* Export Full Album ZIP */}
                      <Button
                        size="sm"
                        variant="outline"
                        title="Download full album as ZIP"
                        disabled={photoCount === 0 || exportBusy}
                        onClick={() => handleExportZip(album, false)}
                      >
                        <Download size={13} className="mr-1" />
                        Export
                      </Button>

                      {/* Export Client Favorites ZIP directly from card if available */}
                      {favCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-semibold"
                          title={`Export ${favCount} client favorite photo(s) as ZIP`}
                          disabled={exportBusy}
                          onClick={() => handleExportZip(album, true)}
                        >
                          <Heart size={12} className="mr-1 fill-current text-rose-500" />
                          Favs ({favCount})
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Edit album metadata"
                        onClick={() => {
                          setActiveAlbum(album);
                          setFormTitle(album.title);
                          setFormDescription(album.description || '');
                          setFormPublished(album.is_published);
                          setEditModal(true);
                        }}
                      >
                        <Edit3 size={14} />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Delete album"
                        onClick={() => {
                          setActiveAlbum(album);
                          setDeleteModal(true);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE ALBUM                                                       */}
      {/* ========================================================================= */}
      <Modal
        size="wide"
        open={createModal}
        onOpenChange={setCreateModal}
        title="Create New Shoot Album"
        description="Assemble photos into a showcase gallery for your clients."
      >
        <form onSubmit={handleCreate} className="form-stack space-y-4">
          <label className="text-xs font-semibold text-foreground">
            Album Title *
            <input
              required
              maxLength={100}
              placeholder="e.g. 2026 Smith Wedding - Highlights"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          <label className="text-xs font-semibold text-foreground">
            Description (Optional)
            <textarea
              rows={2}
              maxLength={250}
              placeholder="Private photo proofing and selection gallery for the couple and family."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          {/* Publication Status Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Publication Status *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormPublished(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !formPublished
                    ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary'
                    : 'border-border bg-surface-2 hover:border-border-hover'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <Lock size={14} className={!formPublished ? 'text-amber-500' : 'text-muted'} />
                  <span>Draft Mode (Private)</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  Keep private to studio staff while uploading and curating photos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormPublished(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formPublished
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                    : 'border-border bg-surface-2 hover:border-border-hover'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <Globe size={14} className={formPublished ? 'text-emerald-600' : 'text-muted'} />
                  <span>Publish Immediately (Live)</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  Make live immediately. Assigned clients can view and proof photos in their portal.
                </p>
              </button>
            </div>
          </div>

          {/* FileZilla / WinSCP Style Multi-Storage & Folder Tree Selection */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <Server size={14} className="text-brand-primary" />
                Select Shoot Photos from Storage Servers & Cameras
              </span>
              <span className="text-xs text-muted font-medium">
                {selectedAssetIds.length} photo(s) selected
              </span>
            </div>

            <StorageTreeExplorer
              assets={availableAssets}
              providers={explorerData.providers || []}
              cameras={explorerData.cameras || []}
              albums={albums}
              folders={explorerData.folders || []}
              selectedIds={selectedAssetIds}
              onSelectId={(id) =>
                setSelectedAssetIds((ids) =>
                  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
                )
              }
              onSelectMultiple={(ids) => setSelectedAssetIds(ids)}
              onClearSelection={() => setSelectedAssetIds([])}
              selectionMode={true}
              actionLabel="Ready to Create Album"
            />
          </div>

          <div className="modal-actions pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !formTitle.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Create Album'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDIT ALBUM                                                         */}
      {/* ========================================================================= */}
      <Modal
        open={editModal}
        onOpenChange={setEditModal}
        title="Edit Album Settings"
        description="Update album title, description, or publication status."
      >
        <form onSubmit={handleEdit} className="form-stack space-y-4">
          <label className="text-xs font-semibold text-foreground">
            Album Title *
            <input
              required
              maxLength={100}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          <label className="text-xs font-semibold text-foreground">
            Description
            <textarea
              rows={3}
              maxLength={250}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          {/* Publication Status Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Publication Status *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormPublished(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !formPublished
                    ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary'
                    : 'border-border bg-surface-2 hover:border-border-hover'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <Lock size={14} className={!formPublished ? 'text-amber-500' : 'text-muted'} />
                  <span>Draft Mode (Private)</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  Take offline. Hidden from client portal while making edits.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormPublished(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formPublished
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                    : 'border-border bg-surface-2 hover:border-border-hover'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <Globe size={14} className={formPublished ? 'text-emerald-600' : 'text-muted'} />
                  <span>Published (Live to Clients)</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  Active in client portal. Assigned clients can sign in and proof.
                </p>
              </button>
            </div>
          </div>

          <div className="modal-actions pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !formTitle.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: MANAGE ALBUM ASSETS & PHOTOS                                       */}
      {/* ========================================================================= */}
      <Modal
        size="wide"
        open={manageAssetsModal}
        onOpenChange={setManageAssetsModal}
        title={activeAlbum ? `📁 ${activeAlbum.title}` : 'Album Photos'}
        description={`Manage ${activeAlbum?.album_assets?.length || 0} photo(s) in this gallery.`}
      >
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-border flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-surface-muted px-2.5 py-1 rounded-full text-muted font-medium">
                {(activeAlbum?.album_assets || []).length} photo(s) in album
              </span>
              {activeAlbum?.is_published ? (
                <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-full font-medium">
                  🟢 Published Live
                </span>
              ) : (
                <span className="text-xs bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full font-medium">
                  🔒 Draft Mode
                </span>
              )}
              {albumClientFavoriteIds.length > 0 && (
                <span className="text-xs bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                  <Heart size={12} className="fill-current text-rose-500" />
                  {albumClientFavoriteIds.length} Client Pick{albumClientFavoriteIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {albumClientFavoriteIds.length > 0 && (
                <>
                  <div className="flex items-center rounded-lg border border-border bg-surface-muted p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStudioFavoritesOnly(false)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        !studioFavoritesOnly
                          ? 'bg-background shadow-xs text-foreground font-semibold'
                          : 'text-muted hover:text-foreground'
                      }`}
                    >
                      All ({(activeAlbum?.album_assets || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioFavoritesOnly(true)}
                      className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                        studioFavoritesOnly
                          ? 'bg-rose-500 text-white font-semibold shadow-xs'
                          : 'text-rose-500 hover:text-rose-600'
                      }`}
                    >
                      <Heart size={11} className="fill-current" />
                      Client Picks ({albumClientFavoriteIds.length})
                    </button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1.5 border-dashed"
                    title="Copy filenames of client-selected favorites to clipboard (ideal for Lightroom / Capture One)"
                    onClick={() => handleCopyFavoriteFilenames(true)}
                  >
                    <Copy size={13} className="mr-1" />
                    Copy Fav Names
                  </Button>
                </>
              )}

              {/* Export Full Album (ZIP) */}
              <Button
                size="sm"
                variant="outline"
                className="text-xs py-1.5"
                disabled={exportBusy || !(activeAlbum?.album_assets || []).length}
                title="Download full album as a ZIP archive"
                onClick={() => handleExportZip(activeAlbum, false)}
              >
                {exportBusy ? (
                  <Loader2 size={13} className="animate-spin mr-1" />
                ) : (
                  <Download size={13} className="mr-1" />
                )}
                Export Full ({(activeAlbum?.album_assets || []).length})
              </Button>

              {/* Export Favorites Only (ZIP) */}
              {albumClientFavoriteIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs py-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-semibold"
                  disabled={exportBusy}
                  title="Download only client favorited photos as a ZIP archive"
                  onClick={() => handleExportZip(activeAlbum, true)}
                >
                  <Heart size={12} className="mr-1 fill-current text-rose-500" />
                  Export Favs ({albumClientFavoriteIds.length})
                </Button>
              )}

              <Button
                size="sm"
                className="bg-brand-primary text-white hover:opacity-90 text-xs py-1.5"
                onClick={() => {
                  setSelectedAssetIds([]);
                  setAddPhotosModal(true);
                }}
              >
                <Plus size={14} className="mr-1" />
                Add Photos from Storage
              </Button>
            </div>
          </div>

          {/* Clean Album Photos View */}
          <MediaBrowser
            assets={displayedModalAssets}
            favoriteIds={albumClientFavoriteIds}
            onCover={handleSetCover}
            onRemove={handleRemoveAsset}
          />

          <div className="modal-actions pt-2">
            <Button onClick={() => setManageAssetsModal(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ADD PHOTOS TO ALBUM FROM STORAGE / SHOOT TREE                     */}
      {/* ========================================================================= */}
      <Modal
        size="wide"
        open={addPhotosModal}
        onOpenChange={setAddPhotosModal}
        title={activeAlbum ? `Add Photos to "${activeAlbum.title}"` : 'Add Photos to Album'}
        description="Browse your storage servers, tethered cameras, and shoot folders to add photos to this album."
      >
        <div className="space-y-4">
          <StorageTreeExplorer
            assets={availableAssets.filter(
              (a) => !activeAlbum?.album_assets?.some((aa) => aa.asset_id === a.id)
            )}
            providers={explorerData.providers || []}
            cameras={explorerData.cameras || []}
            albums={albums}
            folders={explorerData.folders || []}
            selectedIds={selectedAssetIds}
            onSelectId={(id) =>
              setSelectedAssetIds((ids) =>
                ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
              )
            }
            onSelectMultiple={(ids) => setSelectedAssetIds(ids)}
            onClearSelection={() => setSelectedAssetIds([])}
            selectionMode={true}
            actionLabel="Add to This Album"
            onConfirmSelection={async (ids) => {
              await handleAddPhotosToAlbum(ids);
              setSelectedAssetIds([]);
              setAddPhotosModal(false);
            }}
          />

          <div className="modal-actions pt-2">
            <Button variant="outline" onClick={() => setAddPhotosModal(false)}>
              Cancel
            </Button>
            {selectedAssetIds.length > 0 && (
              <Button
                disabled={busy}
                onClick={async () => {
                  await handleAddPhotosToAlbum(selectedAssetIds);
                  setSelectedAssetIds([]);
                  setAddPhotosModal(false);
                }}
              >
                Add {selectedAssetIds.length} Photos to Album
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: SHARE GALLERY (2 ACCESS TYPES: PRIVATE ACCOUNT vs EXPIRING TOKEN)  */}
      {/* ========================================================================= */}
      <Modal
        open={shareModal}
        onOpenChange={setShareModal}
        title="Share Gallery with Clients"
        description="Choose between private client portal access or an expiring public guest link."
      >
        <div className="space-y-4">
          {/* Draft Notice & 1-Click Publish Banner */}
          {activeAlbum && !activeAlbum.is_published && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
              <div className="space-y-0.5">
                <div className="font-semibold text-amber-600 flex items-center gap-1.5">
                  <Lock size={14} />
                  <span>Album is currently in Draft mode</span>
                </div>
                <p className="text-[11px] text-muted">
                  Clients won't be able to view photos in their portal until you publish this album.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs py-1"
                disabled={busy}
                onClick={async () => {
                  await handleTogglePublish(activeAlbum, true);
                }}
              >
                <Rocket size={13} className="mr-1" />
                Publish Now
              </Button>
            </div>
          )}

          {/* Access Type Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-muted rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setShareTab('private')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                shareTab === 'private'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Lock size={14} />
              <span>1. Private Client Account</span>
            </button>
            <button
              type="button"
              onClick={() => setShareTab('token')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                shareTab === 'token'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Globe size={14} />
              <span>2. Expiring Guest Link</span>
            </button>
          </div>

          {/* TAB 1: PRIVATE CLIENT ACCOUNT ACCESS */}
          {shareTab === 'private' && (
            <form onSubmit={handleGrantPrivateAccess} className="space-y-4 pt-1">
              <label className="text-xs font-semibold text-foreground">
                Select Registered Client *
                <Select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  placeholder="Choose client from studio roster…"
                  options={[
                    { value: '', label: 'Select client…' },
                    ...customers.map((c) => ({
                      value: c.id,
                      label: `👤 ${c.full_name || 'Client'} (${c.email})`,
                    })),
                  ]}
                />
              </label>

              <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-2">
                <p className="text-xs font-semibold text-foreground">Client Permissions</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={canShare} onChange={e=>setCanShare(e.target.checked)}/>Allow customer to create a guest link and QR code</label>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canDownload}
                      onChange={(e) => setCanDownload(e.target.checked)}
                      className="rounded text-brand-primary"
                    />
                    <span>Allow High-Resolution Single & Full Album ZIP Downloads</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canFavorite}
                      onChange={(e) => setCanFavorite(e.target.checked)}
                      className="rounded text-brand-primary"
                    />
                    <span>Allow Favoriting & Proofing Shortlists</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setShareModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !selectedCustomerId}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : 'Grant Private Access'}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: EXPIRING TOKEN-BASED GUEST LINK */}
          {shareTab === 'token' && (
            <div className="space-y-4 pt-1">
              <label className="text-xs font-semibold text-foreground">
                Link Expiration Window
                <Select
                  value={String(tokenExpiresHours)}
                  onChange={(e) => setTokenExpiresHours(Number(e.target.value))}
                  disabled={!!generatedGuestUrl}
                  options={[
                    { value: '24', label: '24 Hours (1 Day - Quick Review)' },
                    { value: '72', label: '72 Hours (3 Days - Weekend Proofing)' },
                    { value: '168', label: '7 Days (1 Week - Standard Sharing)' },
                    { value: '720', label: '30 Days (1 Month - Full Project Window)' },
                  ]}
                />
              </label>

              {generatedGuestUrl ? (
                <div className="space-y-3 p-3 bg-surface-muted rounded-xl border border-border">
                  <p className="text-xs font-semibold text-foreground">Active Guest Link (View & Proof)</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={generatedGuestUrl}
                      className="font-mono text-xs flex-1 bg-surface-2 p-2 rounded-lg border border-border text-foreground"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedGuestUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <ShareQr url={generatedGuestUrl} title={activeAlbum?.title}/>
                  <p className="text-[11px] text-muted">
                    Guests can view photos and favorite them. Link expires automatically in {tokenExpiresHours} hours.
                  </p>
                </div>
              ) : (
                <div className="modal-actions pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShareModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateGuestLink} disabled={busy}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : 'Generate Secure Link'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: PUBLISH & CLIENT VISIBILITY SETTINGS                               */}
      {/* ========================================================================= */}
      <Modal
        size="wide"
        open={publishModal}
        onOpenChange={setPublishModal}
        title={publishAlbum ? `Visibility & Client Access · ${publishAlbum.title}` : 'Publish Album'}
        description="Control client visibility, manage private client accounts, and issue proofing access."
      >
        {publishAlbum && (
          <div className="space-y-5">
            {/* Status Hero Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                publishAlbum.is_published
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-zinc-800/40 border-border'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      publishAlbum.is_published
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {publishAlbum.is_published ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Live & Published
                      </>
                    ) : (
                      <>
                        <Lock size={11} className="text-amber-400" />
                        Draft Mode (Private)
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {publishAlbum.album_assets?.length || 0} Photographs
                  </span>
                </div>
                <h4 className="text-base font-bold text-foreground">{publishAlbum.title}</h4>
                <p className="text-xs text-muted leading-relaxed">
                  {publishAlbum.is_published
                    ? 'This collection is actively published. Assigned clients can log in to their portal to view and proof photos.'
                    : 'This collection is private. Only studio staff can view and organize it. Clients cannot see photos until you publish.'}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {publishAlbum.is_published ? (
                  <Button
                    variant="outline"
                    className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                    disabled={publishBusy}
                    onClick={() => handleTogglePublish(publishAlbum, false)}
                  >
                    {publishBusy ? <Loader2 size={13} className="animate-spin mr-1" /> : <Lock size={13} className="mr-1" />}
                    Unpublish to Draft
                  </Button>
                ) : (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md"
                    disabled={publishBusy}
                    onClick={() => handleTogglePublish(publishAlbum, true)}
                  >
                    {publishBusy ? <Loader2 size={13} className="animate-spin mr-1" /> : <Rocket size={13} className="mr-1" />}
                    Publish to Clients Now
                  </Button>
                )}
              </div>
            </div>

            {/* Publication State Comparison Cards */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Publication Status</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => !publishAlbum.is_published || handleTogglePublish(publishAlbum, false)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    !publishAlbum.is_published
                      ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary'
                      : 'border-border bg-surface-2 hover:border-border-hover opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-xs text-foreground">
                      <Lock size={14} className={!publishAlbum.is_published ? 'text-amber-500' : 'text-muted'} />
                      Draft Mode (Studio Private)
                    </span>
                    {!publishAlbum.is_published && (
                      <span className="text-[10px] font-bold bg-brand-primary text-white px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <ul className="text-[11px] text-muted mt-2 space-y-1">
                    <li className="flex items-center gap-1.5">✓ Safe internal space for culling & editing</li>
                    <li className="flex items-center gap-1.5">✗ Hidden from all client logins</li>
                    <li className="flex items-center gap-1.5">✗ Guest links return inactive status</li>
                  </ul>
                </button>

                <button
                  type="button"
                  onClick={() => publishAlbum.is_published || handleTogglePublish(publishAlbum, true)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    publishAlbum.is_published
                      ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                      : 'border-border bg-surface-2 hover:border-border-hover opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-xs text-foreground">
                      <Globe size={14} className={publishAlbum.is_published ? 'text-emerald-600' : 'text-muted'} />
                      Published (Client Portal Live)
                    </span>
                    {publishAlbum.is_published && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <ul className="text-[11px] text-muted mt-2 space-y-1">
                    <li className="flex items-center gap-1.5">✓ Visible in Client Portal for assigned clients</li>
                    <li className="flex items-center gap-1.5">✓ High-res single & batch ZIP downloads enabled</li>
                    <li className="flex items-center gap-1.5">✓ Live Wi-Fi camera frames appear in real time</li>
                  </ul>
                </button>
              </div>
            </div>

            {/* Who Can View This Album (Client Accounts) */}
            <div className="panel p-4 space-y-3 bg-surface-2 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <UserCheck size={14} className="text-indigo-500" />
                    Clients with Portal Access ({publishAlbum.album_customers?.length || 0})
                  </h4>
                  <p className="text-[11px] text-muted">
                    Assigned clients can sign in to view this gallery in their private portal.
                  </p>
                </div>
              </div>

              {publishAlbum.album_customers?.length > 0 ? (
                <div className="space-y-2">
                  {publishAlbum.album_customers.map((ac) => (
                    <div
                      key={ac.customer_id}
                      className="p-2.5 bg-surface-muted rounded-lg border border-border flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-[11px]">
                          {ac.customer?.user?.full_name?.[0]?.toUpperCase() || 'C'}
                        </span>
                        <div>
                          <strong className="text-foreground">{ac.customer?.user?.full_name || 'Client'}</strong>
                          <span className="text-muted text-[11px] ml-2">({ac.customer?.user?.email})</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                        Access Granted
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-surface-muted/50 rounded-lg text-center text-xs text-muted">
                  No clients have been assigned yet. Add a client below so they can view this album.
                </div>
              )}

              {/* Quick Client Assignment */}
              <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center gap-2">
                <div className="flex-1 w-full">
                  <Select
                    value={publishAssignCustomerId}
                    onChange={(e) => setPublishAssignCustomerId(e.target.value)}
                    placeholder="Assign another client to this gallery…"
                    options={[
                      { value: '', label: 'Select client to grant access…' },
                      ...customers
                        .filter(
                          (c) =>
                            !publishAlbum.album_customers?.some(
                              (ac) => ac.customer_id === c.id || ac.customer?.user_id === c.user_id
                            )
                        )
                        .map((c) => ({
                          value: c.id,
                          label: `👤 ${c.full_name || 'Client'} (${c.email})`,
                        })),
                    ]}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={publishBusy || !publishAssignCustomerId}
                  onClick={handlePublishGrantClient}
                  className="w-full sm:w-auto text-xs shrink-0"
                >
                  {publishBusy ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
                  Assign Client
                </Button>
              </div>
            </div>

            {/* Quick Links & Preview Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link
                  to="/customer/galleries"
                  target="_blank"
                  className="button-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg w-full sm:w-auto justify-center"
                >
                  <Eye size={13} />
                  Client Portal View
                  <ArrowUpRight size={13} />
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto text-xs"
                  onClick={() => {
                    setActiveAlbum(publishAlbum);
                    setPublishModal(false);
                    setGeneratedGuestUrl('');
                    setShareModal(true);
                  }}
                >
                  <Share2 size={13} className="mr-1 text-brand-primary" />
                  Generate Guest Pass
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setPublishModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM ALBUM DELETION (NO BROWSER CONFIRM)                        */}
      {/* ========================================================================= */}
      <ConfirmModal
        open={deleteModal}
        onOpenChange={setDeleteModal}
        title={`Delete Album '${activeAlbum?.title}'?`}
        description="Are you sure you want to permanently delete this album? Photos in your storage library will not be deleted, but client access will be removed."
        confirmText="Delete Album"
        variant="danger"
        loading={busy}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
