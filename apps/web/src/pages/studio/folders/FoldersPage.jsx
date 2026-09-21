import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Folder,
  Plus,
  ArrowUpRight,
  Image as ImageIcon,
  Search,
  Trash2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Download,
  Eye,
  Camera,
  X,
  FileImage,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading, Photo } from '../../../components/workspace/shared';
import { photos } from '../../../data/workspace';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { foldersApi, sharesApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function FoldersPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [lightboxAsset, setLightboxAsset] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#3B82F6');
  const [parentFolderId, setParentFolderId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const [shareModal, setShareModal] = useState(false);
  const [shareExpiresHours, setShareExpiresHours] = useState(72);
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreatePublicLink = async (folder) => {
    try {
      setShareBusy(true);
      setGeneratedShareUrl('');
      setShareModal(true);
      const pubRes = await foldersApi.publishGallery(folder.id);
      const albumId = pubRes.album_id;
      const shareRes = await sharesApi.createShare({
        album_id: albumId,
        expires_in_hours: shareExpiresHours,
      });
      setGeneratedShareUrl(shareRes.share_url);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create guest share link');
      setShareModal(false);
    } finally {
      setShareBusy(false);
    }
  };

  const loadTree = async () => {
    try {
      setLoading(true);
      const data = await foldersApi.getTree();
      if (Array.isArray(data)) {
        setTree(data);
        // If current folder was selected, keep it updated with fresh assets
        if (selectedFolder) {
          const fresh = flattenFolders(data).find((f) => f.id === selectedFolder.id);
          if (fresh) setSelectedFolder(fresh);
        }
      }
    } catch (err) {
      console.warn('Folders tree load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncStorage = async () => {
    try {
      setSyncing(true);
      await loadTree();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, [currentStudio?.id]);

  const flattenFolders = (nodes) => {
    let result = [];
    nodes.forEach((n) => {
      result.push(n);
      if (n.children && n.children.length > 0) {
        result = result.concat(flattenFolders(n.children));
      }
    });
    return result;
  };

  const allFolders = flattenFolders(tree);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    try {
      setBusy(true);
      await foldersApi.create({
        name: folderName.trim(),
        color: folderColor,
        parent_folder_id: parentFolderId || undefined,
      });

      setFolderName('');
      setParentFolderId('');
      setOpenModal(false);
      loadTree();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder?')) return;
    try {
      await foldersApi.delete(folderId);
      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
      }
      loadTree();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  const formatFileSize = (bytes) => {
    const num = Number(bytes || 0);
    if (!num) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return (num / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  const activeDisplayFolders = selectedFolder
    ? selectedFolder.children || []
    : tree;

  const filteredFolders = activeDisplayFolders.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="EVERY FRAME IN ITS PLACE"
        title="Your creative library"
        description="Auto-synced with camera Wi-Fi tethering and local storage."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncStorage}
            disabled={syncing || loading}
            title="Scan physical camera storage for new photos"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Scanning...' : 'Sync Storage'}
          </Button>
          <Button onClick={() => setOpenModal(true)}>
            <Plus size={16} />
            New folder
          </Button>
        </div>
      </PageHeading>

      <div className="filter-toolbar">
        <div className="library-tabs">
          <button
            className={!selectedFolder ? 'selected' : ''}
            onClick={() => setSelectedFolder(null)}
          >
            All folders <span>{allFolders.length}</span>
          </button>
          {selectedFolder && (
            <span className="flex items-center gap-1">
              / <strong>{selectedFolder.name}</strong>
            </span>
          )}
        </div>

        <label className="inline-search">
          <Search size={16} />
          <input
            aria-label="Search collections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a folder or collection…"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading studio storage & media…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Breadcrumb back navigation if in a subfolder */}
          {selectedFolder && (
            <div className="flex items-center justify-between panel p-4">
              <div className="flex items-center gap-2">
                <button
                  className="text-link text-sm font-medium"
                  onClick={() => setSelectedFolder(null)}
                >
                  Root Library
                </button>
                <ChevronRight size={14} className="text-muted" />
                <span className="font-semibold text-foreground">{selectedFolder.name}</span>
                <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface-muted">
                  {selectedFolder.assets?.length || 0} photo(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncStorage}
                  disabled={syncing}
                >
                  <RefreshCw size={14} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => handleDelete(selectedFolder.id)}
                >
                  <Trash2 size={14} className="mr-1" /> Delete Folder
                </Button>
              </div>
            </div>
          )}

          {/* Folder Grid */}
          <div className="library-grid">
            {filteredFolders.map((f) => {
              const subCount = f.children?.length || 0;
              const photoCount = f.assets?.length || f.items_count || 0;
              const coverImage = f.assets?.[0]?.url || photos.landscape;

              return (
                <div
                  className="library-folder panel text-left cursor-pointer relative group"
                  key={f.id}
                  onClick={() => setSelectedFolder(f)}
                >
                  <div
                    className="library-folder-cover"
                    style={{ borderTop: `3px solid ${f.color || '#3B82F6'}` }}
                  >
                    <Photo src={coverImage} alt={f.name} />
                    <span>
                      <FolderOpen size={18} />
                    </span>
                  </div>
                  <div className="library-folder-info">
                    <h2>
                      {f.name}
                      <ArrowUpRight size={16} />
                    </h2>
                    <p>
                      {subCount > 0 ? `${subCount} subfolders · ` : ''}
                      {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                    </p>
                    <small style={{ color: f.color || 'var(--brand-primary)' }}>
                      ● {f.name.startsWith('2026') ? 'Camera Direct Ingest' : 'Studio Storage'}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredFolders.length === 0 && !selectedFolder && (
            <div className="empty-state py-12">
              <Folder size={32} className="text-muted mb-2" />
              <h2>No folders in this directory</h2>
              <p className="text-sm text-muted mb-4">
                Take a shot with your camera or create a folder to organize your shoots.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleSyncStorage} disabled={syncing}>
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  Scan Storage
                </Button>
                <Button onClick={() => setOpenModal(true)}>
                  <Plus size={16} /> New folder
                </Button>
              </div>
            </div>
          )}

          {/* Folder Details & Real Photos Grid */}
          {selectedFolder && (
            <section className="panel p-6 mt-6">
              <div className="panel-heading p-0 mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FolderOpen size={20} className="text-brand-primary" />
                    {selectedFolder.name}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    {selectedFolder.assets?.length || 0} live camera frames detected · Created on {new Date(selectedFolder.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await foldersApi.publishGallery(selectedFolder.id);
                        alert(res.message || 'Published to client galleries successfully!');
                      } catch (err) {
                        alert(err.response?.data?.error || 'Failed to publish gallery');
                      }
                    }}
                  >
                    <ArrowUpRight size={14} className="mr-1 text-brand-primary" />
                    Publish to Client Gallery
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreatePublicLink(selectedFolder)}
                    disabled={shareBusy}
                  >
                    <Share2 size={14} className="mr-1 text-brand-primary" />
                    Share Guest Link
                  </Button>
                  <Link className="button-primary text-xs flex items-center gap-1 py-1.5 px-3 rounded-lg" to="/customer/galleries">
                    View in Client Portal
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>

              {selectedFolder.assets && selectedFolder.assets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {selectedFolder.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="group relative rounded-xl overflow-hidden border border-border bg-surface-muted hover:border-brand-primary/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                      onClick={() => setLightboxAsset(asset)}
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-black/5 relative">
                        <img
                          src={asset.url}
                          alt={asset.filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white">
                            <Eye size={18} />
                          </span>
                        </div>
                        <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                          {asset.filename.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>

                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-foreground truncate" title={asset.filename}>
                          {asset.filename}
                        </p>
                        <div className="flex justify-between items-center text-[11px] text-muted mt-1">
                          <span>{formatFileSize(asset.file_size_bytes)}</span>
                          <span>{new Date(asset.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-12 border border-dashed border-border rounded-xl">
                  <FileImage size={36} className="text-muted mb-2 opacity-50" />
                  <h3 className="font-semibold text-base mb-1">No photos in this folder yet</h3>
                  <p className="text-xs text-muted max-w-md mx-auto mb-4">
                    Take a shot on your camera or save images to <code>storage/studios/{selectedFolder.name}</code> to sync them instantly.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleSyncStorage} disabled={syncing}>
                    <RefreshCw size={14} className={syncing ? 'animate-spin mr-1.5' : 'mr-1.5'} />
                    Check for New Photos
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {lightboxAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxAsset(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
            <a
              href={lightboxAsset.url}
              download={lightboxAsset.filename}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download original image"
            >
              <Download size={18} />
            </a>
            <button
              onClick={() => setLightboxAsset(null)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div
            className="max-w-5xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxAsset.url}
              alt={lightboxAsset.filename}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-4 text-center text-white">
              <h3 className="font-semibold text-base">{lightboxAsset.filename}</h3>
              <p className="text-xs text-white/70 mt-1">
                {formatFileSize(lightboxAsset.file_size_bytes)} · {lightboxAsset.mime_type}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      <Modal
        open={openModal}
        onOpenChange={setOpenModal}
        title="A new home for your work"
        description="Create a directory in your studio storage hierarchy."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          <label>
            Folder name
            <input
              required
              maxLength={80}
              placeholder="e.g. 2026 Weddings"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
          </label>

          <label>
            Parent Folder (optional)
            <Select
              value={parentFolderId}
              onChange={(e) => setParentFolderId(e.target.value)}
              placeholder="Root folder (No parent)…"
              searchable={allFolders.length >= 3}
              options={[
                { value: '', label: '📁 Root (No Parent Directory)', description: 'Create as a top-level workspace album' },
                ...allFolders.map((f) => ({
                  value: f.id,
                  label: `📁 ${f.name}`,
                  description: `Path: /${f.name}`,
                })),
              ]}
            />
          </label>

          <label>
            Folder Accent Color
            <div className="brand-color-input">
              <input
                type="color"
                value={folderColor}
                onChange={(e) => setFolderColor(e.target.value)}
              />
              <input
                type="text"
                value={folderColor}
                onChange={(e) => setFolderColor(e.target.value)}
                pattern="#[0-9a-fA-F]{6}"
              />
            </div>
          </label>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Create folder'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Share Guest Link Modal */}
      <Modal
        open={shareModal}
        onOpenChange={(v) => {
          setShareModal(v);
          if (!v) {
            setGeneratedShareUrl('');
            setCopied(false);
          }
        }}
        title="Public Guest Gallery Link"
        description="Generate an expiring, view-only guest link for clients and guests without requiring login."
      >
        <div className="space-y-4">
          <label>
            Link Expiration Duration
            <Select
              value={String(shareExpiresHours)}
              onChange={(e) => setShareExpiresHours(Number(e.target.value))}
              disabled={!!generatedShareUrl}
              options={[
                { value: '24', label: '24 Hours (1 Day)', description: 'Quick sharing for immediate proofing' },
                { value: '72', label: '72 Hours (3 Days - Recommended)', description: 'Standard weekend client review window' },
                { value: '168', label: '7 Days (1 Week)', description: 'Extended guest access window' },
                { value: '720', label: '30 Days (1 Month)', description: 'Long term gallery access' },
              ]}
            />
          </label>

          {shareBusy ? (
            <div className="py-6 flex items-center justify-center gap-2 text-muted text-xs">
              <Loader2 size={16} className="animate-spin text-brand-primary" />
              Generating secure guest link…
            </div>
          ) : generatedShareUrl ? (
            <div className="space-y-3 pt-2">
              <label className="text-xs text-muted">Guest Link (View-Only)</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  className="font-mono text-xs flex-1 bg-surface-2 p-2 rounded border border-border"
                  value={generatedShareUrl}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedShareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <p className="text-xs text-muted">
                Guests can view high-resolution photos and receive live real-time updates. Original file downloads and account access are blocked.
              </p>
            </div>
          ) : (
            <div className="flex justify-end pt-2">
              <Button onClick={() => selectedFolder && handleCreatePublicLink(selectedFolder)}>
                Generate Link
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
