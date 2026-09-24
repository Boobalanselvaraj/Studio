import { MediaBrowser } from '../../../components/gallery/MediaBrowser';
import { ShareQr } from '../../../components/gallery/ShareQr';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/toast';
import { Select } from '../../../components/ui/select';
import { albumsApi, foldersApi, customersApi, sharesApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function AlbumsPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [albums, setAlbums] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [manageAssetsModal, setManageAssetsModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
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

      if(treeRes.status === 'fulfilled') setAvailableAssets(treeRes.value.assets || []);

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
      <div className="panel p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search album title, event, or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-surface-2 px-3 py-1.5 rounded-lg border border-border text-foreground"
          >
            <option value="all">All Statuses ({albums.length})</option>
            <option value="published">Published Only</option>
            <option value="draft">Drafts Only</option>
          </select>
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
            Create an album to organize photos into a beautiful presentation for your clients.
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

                  {/* Status Tag */}
                  <span
                    className={`absolute top-2.5 right-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm ${
                      album.is_published
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-zinc-800/80 text-white/80'
                    }`}
                  >
                    {album.is_published ? '● Published' : 'Draft'}
                  </span>

                  {/* Quick Photo Count Badge */}
                  <span className="absolute bottom-2.5 left-2.5 text-[11px] font-semibold px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-md">
                    {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                  </span>
                </div>

                {/* Info Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3
                      className="font-bold text-base text-foreground truncate cursor-pointer hover:text-brand-primary"
                      onClick={() => {
                        setActiveAlbum(album);
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
                  <div className="pt-2 flex items-center justify-between gap-1 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Manage and organize album photos"
                        onClick={() => {
                          setActiveAlbum(album);
                          setManageAssetsModal(true);
                        }}
                      >
                        <Eye size={13} className="mr-1" />
                        Photos ({photoCount})
                      </Button>

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

          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={formPublished}
              onChange={(e) => setFormPublished(e.target.checked)}
              className="rounded text-brand-primary"
            />
            <span>Publish immediately (visible to assigned clients)</span>
          </label>

          {/* Quick Photo Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>Select Initial Photos ({selectedAssetIds.length})</span>
              <button
                type="button"
                className="text-brand-primary hover:underline text-[11px]"
                onClick={() => {
                  if (selectedAssetIds.length === availableAssets.length) {
                    setSelectedAssetIds([]);
                  } else {
                    setSelectedAssetIds(availableAssets.map((a) => a.id));
                  }
                }}
              >
                {selectedAssetIds.length === availableAssets.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <MediaBrowser assets={availableAssets} selectedIds={selectedAssetIds} onSelect={id=>setSelectedAssetIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id])}/>
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

          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={formPublished}
              onChange={(e) => setFormPublished(e.target.checked)}
              className="rounded text-brand-primary"
            />
            <span>Published (Visible to clients)</span>
          </label>

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
          <MediaBrowser assets={(activeAlbum?.album_assets || []).map(aa=>aa.asset).filter(Boolean)} onCover={handleSetCover} onRemove={handleRemoveAsset}/>
          <details><summary className="cursor-pointer font-semibold">Add photos from library</summary><MediaBrowser assets={availableAssets.filter(a=>!activeAlbum?.album_assets?.some(aa=>aa.asset_id===a.id))} selectedIds={selectedAssetIds} onSelect={id=>setSelectedAssetIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id])}/><Button disabled={!selectedAssetIds.length} onClick={async()=>{await handleAddPhotosToAlbum(selectedAssetIds);setSelectedAssetIds([]);}}>Add selected photos</Button></details>
          <div className="modal-actions pt-2">
            <Button onClick={() => setManageAssetsModal(false)}>Close</Button>
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
