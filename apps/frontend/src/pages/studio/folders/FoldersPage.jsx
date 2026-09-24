import { MediaBrowser, MediaViewer } from '../../../components/gallery/MediaBrowser';
import { ShareQr } from '../../../components/gallery/ShareQr';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Folder,
  Plus,
  ArrowUpRight,
  Search,
  Trash2,
  ChevronRight,
  ChevronDown,
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
  HardDrive,
  Server,
  Radio,
  Layers,
  SlidersHorizontal,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
  Clock,
  Sparkles,
  Grid,
  List,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading, Photo } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/toast';
import { Select } from '../../../components/ui/select';
import { foldersApi, sharesApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function FoldersPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  // Active view tab: 'folders' | 'tree' | 'live'
  const [activeTab, setActiveTab] = useState('tree');

  // Folders view state
  const [renameAsset,setRenameAsset]=useState(null);
  const [removeAsset,setRemoveAsset]=useState(null);
  const [renameFolder,setRenameFolder]=useState(null);
  const [targetFolder,setTargetFolder]=useState('');
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

  // Guest share link state
  const [shareModal, setShareModal] = useState(false);
  const [shareExpiresHours, setShareExpiresHours] = useState(72);
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Folder deletion modal state
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [deleteFolderModal, setDeleteFolderModal] = useState(false);
  const [deleteFolderBusy, setDeleteFolderBusy] = useState(false);

  // Server & Camera Explorer state
  const [explorerData, setExplorerData] = useState({
    assets: [],
    providers: [],
    cameras: [],
    albums: [],
    customers: [],
  });
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [treeFilterType, setTreeFilterType] = useState('all'); // 'all' | 'provider' | 'camera' | 'album'
  const [treeFilterId, setTreeFilterId] = useState(null);
  const [treeExpanded, setTreeExpanded] = useState({ servers: true, cameras: true, albums: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  // Batch assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignAlbumId, setAssignAlbumId] = useState('');
  const [assignNewAlbumTitle, setAssignNewAlbumTitle] = useState('');
  const [assignCustomerId, setAssignCustomerId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

  // Live ingest stream state
  const [autoRefreshLive, setAutoRefreshLive] = useState(true);
  const [lastLivePoll, setLastLivePoll] = useState(new Date());

  // Load standard folders tree
  const loadTree = async () => {
    try {
      setLoading(true);
      const data = await foldersApi.getTree();
      if (Array.isArray(data)) {
        setTree(data);
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

  // Load server & camera explorer data
  const loadExplorerData = async () => {
    try {
      setExplorerLoading(true);
      const data = await foldersApi.getServerExplorer();
      if (data) {
        setExplorerData(data);
        setLastLivePoll(new Date());
      }
    } catch (err) {
      console.warn('Failed to load server explorer data:', err);
    } finally {
      setExplorerLoading(false);
    }
  };

  const handleSyncStorage = async () => {
    try {
      setSyncing(true);
      await Promise.allSettled([loadTree(), loadExplorerData()]);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadTree();
    loadExplorerData();
  }, [currentStudio?.id]);

  // Live Auto-Refresh polling when on 'live' tab
  useEffect(() => {
    if (!autoRefreshLive || activeTab !== 'live') return;
    const interval = setInterval(() => {
      loadExplorerData();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefreshLive, activeTab]);

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
      toast.error(err.response?.data?.error || 'Failed to create guest share link');
      setShareModal(false);
    } finally {
      setShareBusy(false);
    }
  };

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
      toast.success('Folder created successfully');
      loadTree();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  };

  const triggerDeleteFolder = (folder) => {
    setFolderToDelete(folder);
    setDeleteFolderModal(true);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      setDeleteFolderBusy(true);
      await foldersApi.delete(folderToDelete.id);
      if (selectedFolder?.id === folderToDelete.id) {
        setSelectedFolder(null);
      }
      setDeleteFolderModal(false);
      setFolderToDelete(null);
      toast.success('Folder deleted successfully');
      loadTree();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete folder');
    } finally {
      setDeleteFolderBusy(false);
    }
  };

  const formatFileSize = (bytes) => {
    const num = Number(bytes || 0);
    if (!num) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return (num / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  // Filter explorer assets based on tree node, search, and format
  const filteredAssets = useMemo(() => {
    return (explorerData.assets || []).filter((asset) => {
      // Tree Filter
      if (treeFilterType === 'provider' && treeFilterId) {
        if (asset.storage_provider?.id !== treeFilterId) return false;
      } else if (treeFilterType === 'camera' && treeFilterId) {
        if (asset.camera?.id !== treeFilterId) return false;
      } else if (treeFilterType === 'album' && treeFilterId) {
        if (!asset.albums?.some((a) => a.id === treeFilterId)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = asset.filename.toLowerCase().includes(q);
        const matchCam = asset.camera?.name?.toLowerCase().includes(q);
        const matchServer = asset.storage_provider?.name?.toLowerCase().includes(q);
        if (!matchName && !matchCam && !matchServer) return false;
      }

      // Format Filter
      if (formatFilter !== 'all') {
        const ext = asset.filename.split('.').pop()?.toLowerCase() || '';
        if (formatFilter === 'raw') {
          if (!['arw', 'cr2', 'cr3', 'nef', 'dng', 'raw', 'orf'].includes(ext)) return false;
        } else if (formatFilter === 'jpg') {
          if (!['jpg', 'jpeg'].includes(ext)) return false;
        } else if (formatFilter === 'png') {
          if (ext !== 'png') return false;
        }
      }

      return true;
    });
  }, [explorerData.assets, treeFilterType, treeFilterId, searchQuery, formatFilter]);

  // Handle batch selection
  const toggleSelectAsset = (id) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedAssetIds.length === filteredAssets.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(filteredAssets.map((a) => a.id));
    }
  };

  // Handle batch assignment
  const handleBatchAssign = async (e) => {
    e.preventDefault();
    if (selectedAssetIds.length === 0) return;
    if (!assignAlbumId && !assignNewAlbumTitle.trim()) {
      toast.warning('Please select an existing shoot album or enter a new album title.');
      return;
    }

    try {
      setAssignBusy(true);
      const res = await foldersApi.batchAssignAssets({
        asset_ids: selectedAssetIds,
        album_id: assignAlbumId || undefined,
        new_album_title: assignNewAlbumTitle.trim() || undefined,
        customer_id: assignCustomerId || undefined,
      });

      toast.success(res.message || 'Files assigned successfully!');
      setAssignModalOpen(false);
      setSelectedAssetIds([]);
      setAssignNewAlbumTitle('');

      loadExplorerData();
      loadTree();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign photos');
    } finally {
      setAssignBusy(false);
    }
  };

  // Compute storage and camera summary metrics
  const totalStorageBytes = useMemo(() => {
    return (explorerData.assets || []).reduce(
      (acc, a) => acc + Number(a.file_size_bytes || 0),
      0
    );
  }, [explorerData.assets]);

  const activeDisplayFolders = selectedFolder
    ? selectedFolder.children || []
    : tree;

  const filteredFolders = activeDisplayFolders.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="page-enter space-y-6">
      <PageHeading
        eyebrow="STUDIO DIGITAL ASSET MANAGEMENT"
        title="File Server & Media Explorer"
        description="Unified storage tree, camera tethering live feeds, and client gallery routing."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncStorage}
            disabled={syncing || loading}
            title="Scan physical camera storage & external servers for new photos"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Storage'}
          </Button>

          {activeTab === 'folders' && (
            <Button onClick={() => setOpenModal(true)}>
              <Plus size={16} />
              New folder
            </Button>
          )}

          {selectedAssetIds.length > 0 && (
            <Button
              className="bg-brand-primary text-white hover:opacity-95 shadow-md animate-pulse"
              onClick={() => setAssignModalOpen(true)}
            >
              <UserCheck size={16} className="mr-1.5" />
              Assign {selectedAssetIds.length} Photos
            </Button>
          )}
        </div>
      </PageHeading>

      {/* Main Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'tree'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-2'
            }`}
          >
            <Server size={16} />
            <span>File Server & Camera Tree</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'tree' ? 'bg-white/20 text-white' : 'bg-surface-muted text-muted'
              }`}
            >
              {explorerData.assets?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'live'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-2'
            }`}
          >
            <Radio size={16} className={activeTab === 'live' ? 'animate-pulse text-amber-300' : ''} />
            <span>Live Camera Ingest Feed</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('folders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'folders'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface-2'
            }`}
          >
            <FolderOpen size={16} />
            <span>Studio Folders & Collections</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'folders' ? 'bg-white/20 text-white' : 'bg-surface-muted text-muted'
              }`}
            >
              {allFolders.length}
            </span>
          </button>
        </div>

        {/* Global Storage Quick Badge */}
        <div className="hidden md:flex items-center gap-3 text-xs text-muted bg-surface-muted px-3 py-1.5 rounded-lg border border-border">
          <span className="flex items-center gap-1.5">
            <HardDrive size={14} className="text-brand-primary" />
            Total Stored: <strong>{formatFileSize(totalStorageBytes)}</strong>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Camera size={14} className="text-emerald-500" />
            Active Cameras: <strong>{explorerData.cameras?.filter((c) => c.is_active).length || 0}</strong>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FILE SERVER & CAMERA TREE EXPLORER                                 */}
      {/* ========================================================================= */}
      {activeTab === 'tree' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDEBAR: Interactive Server & Camera Tree View */}
          <div className="lg:col-span-4 panel p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Server size={16} className="text-brand-primary" />
                Storage Server & Device Hierarchy
              </h3>
              <button
                onClick={loadExplorerData}
                disabled={explorerLoading}
                className="text-xs text-muted hover:text-brand-primary p-1 rounded"
                title="Refresh tree"
              >
                <RefreshCw size={13} className={explorerLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-1">
              {/* Root "All Files" */}
              <div
                onClick={() => {
                  setTreeFilterType('all');
                  setTreeFilterId(null);
                }}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
                  treeFilterType === 'all'
                    ? 'bg-brand-primary/10 text-brand-primary font-bold border border-brand-primary/30'
                    : 'text-foreground hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-brand-primary" />
                  <span>All Media Files</span>
                </div>
                <span className="text-xs bg-surface-muted px-2 py-0.5 rounded-full text-muted">
                  {explorerData.assets?.length || 0}
                </span>
              </div>

              {/* SECTION: Connected Storage Servers / External Nodes */}
              <div className="pt-3">
                <div
                  onClick={() => setTreeExpanded((p) => ({ ...p, servers: !p.servers }))}
                  className="flex items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <HardDrive size={13} className="text-indigo-400" />
                    External Storage Nodes ({explorerData.providers?.length || 0})
                  </span>
                  {treeExpanded.servers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                {treeExpanded.servers && (
                  <div className="space-y-1 pl-2 pt-1">
                    {(!explorerData.providers || explorerData.providers.length === 0) && (
                      <Link
                        to="/studio/storage"
                        className="flex items-center gap-1.5 p-2 rounded-lg text-xs text-muted hover:text-brand-primary hover:bg-surface-2 transition-colors border border-dashed border-border"
                      >
                        <Plus size={13} />
                        <span>Connect MinIO, Wasabi, S3</span>
                      </Link>
                    )}

                    {explorerData.providers?.map((prov) => {
                      const count = (explorerData.assets || []).filter(
                        (a) => a.storage_provider?.id === prov.id
                      ).length;

                      return (
                        <div
                          key={prov.id}
                          onClick={() => {
                            setTreeFilterType('provider');
                            setTreeFilterId(prov.id);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            treeFilterType === 'provider' && treeFilterId === prov.id
                              ? 'bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/30'
                              : 'text-foreground hover:bg-surface-2'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                prov.health === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                            />
                            <span className="truncate">{prov.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1 rounded bg-surface-muted text-muted">
                              {prov.backend}
                            </span>
                          </div>
                          <span className="text-xs bg-surface-muted px-1.5 py-0.5 rounded text-muted">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION: Connected Tethered Cameras */}
              <div className="pt-3">
                <div
                  onClick={() => setTreeExpanded((p) => ({ ...p, cameras: !p.cameras }))}
                  className="flex items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Camera size={13} className="text-emerald-500" />
                    Wi-Fi Cameras & Tethering ({explorerData.cameras?.length || 0})
                  </span>
                  {treeExpanded.cameras ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                {treeExpanded.cameras && (
                  <div className="space-y-1 pl-2 pt-1">
                    {explorerData.cameras?.map((cam) => {
                      const count = (explorerData.assets || []).filter(
                        (a) => a.camera?.id === cam.id
                      ).length;

                      return (
                        <div
                          key={cam.id}
                          onClick={() => {
                            setTreeFilterType('camera');
                            setTreeFilterId(cam.id);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            treeFilterType === 'camera' && treeFilterId === cam.id
                              ? 'bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/30'
                              : 'text-foreground hover:bg-surface-2'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                cam.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                              }`}
                            />
                            <span className="truncate">{cam.name}</span>
                            <span className="text-[10px] text-muted truncate">({cam.model})</span>
                          </div>
                          <span className="text-xs bg-surface-muted px-1.5 py-0.5 rounded text-muted">
                            {count}
                          </span>
                        </div>
                      );
                    })}

                    {explorerData.cameras?.length === 0 && (
                      <p className="text-xs text-muted italic px-2 py-1">No cameras registered yet.</p>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: Shoot Albums */}
              <div className="pt-3">
                <div
                  onClick={() => setTreeExpanded((p) => ({ ...p, albums: !p.albums }))}
                  className="flex items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen size={13} className="text-amber-500" />
                    Shoot Collections ({explorerData.albums?.length || 0})
                  </span>
                  {treeExpanded.albums ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                {treeExpanded.albums && (
                  <div className="space-y-1 pl-2 pt-1 max-h-48 overflow-y-auto">
                    {explorerData.albums?.map((alb) => (
                      <div
                        key={alb.id}
                        onClick={() => {
                          setTreeFilterType('album');
                          setTreeFilterId(alb.id);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          treeFilterType === 'album' && treeFilterId === alb.id
                            ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30'
                            : 'text-foreground hover:bg-surface-2'
                        }`}
                      >
                        <span className="truncate">📁 {alb.title}</span>
                        {alb.is_published && (
                          <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-600 font-semibold">
                            Published
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Helper / Server purchase info */}
            <div className="p-3 bg-surface-muted rounded-xl border border-border text-xs space-y-1.5">
              <div className="font-semibold flex items-center gap-1 text-foreground">
                <Server size={13} className="text-brand-primary" /> External Servers Managed
              </div>
              <p className="text-muted text-[11px] leading-relaxed">
                Connect external Wasabi, MinIO, or SFTP servers in Storage Settings. Files uploaded from tethered cameras are indexed here in real time.
              </p>
              <Link
                to="/studio/storage"
                className="inline-flex items-center gap-1 text-brand-primary font-semibold hover:underline text-[11px]"
              >
                Configure Storage Servers <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>

          {/* RIGHT STAGE: Files Grid / Explorer List */}
          <div className="lg:col-span-8 space-y-4">
            {/* Explorer Toolbar */}
            <div className="panel p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    {treeFilterType === 'all' && 'All Ingested Photos & Media'}
                    {treeFilterType === 'provider' && `Server: ${treeFilterId}`}
                    {treeFilterType === 'camera' && `Camera Source: ${treeFilterId}`}
                    {treeFilterType === 'album' && `Shoot Album: ${treeFilterId}`}
                  </span>
                  <span className="text-xs bg-surface-muted px-2 py-0.5 rounded-full text-muted">
                    {filteredAssets.length} item(s)
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* View mode toggle */}
                  <div className="flex items-center bg-surface-muted p-0.5 rounded-lg border border-border">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded ${
                        viewMode === 'grid' ? 'bg-surface-2 text-foreground shadow-sm' : 'text-muted'
                      }`}
                      title="Grid View"
                    >
                      <Grid size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded ${
                        viewMode === 'table' ? 'bg-surface-2 text-foreground shadow-sm' : 'text-muted'
                      }`}
                      title="List View"
                    >
                      <List size={15} />
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllFiltered}
                    disabled={filteredAssets.length === 0}
                  >
                    {selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0 ? (
                      <>
                        <CheckSquare size={14} className="mr-1 text-brand-primary" /> Deselect All
                      </>
                    ) : (
                      <>
                        <Square size={14} className="mr-1" /> Select All ({filteredAssets.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-border">
                <div className="relative flex-1 w-full">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search file name, camera model, or storage host…"
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter size={14} className="text-muted" />
                  <select
                    value={formatFilter}
                    onChange={(e) => setFormatFilter(e.target.value)}
                    className="text-xs bg-surface-2 px-2.5 py-1.5 rounded-lg border border-border text-foreground"
                  >
                    <option value="all">All File Formats</option>
                    <option value="raw">RAW Only (ARW, CR3, NEF)</option>
                    <option value="jpg">JPEG / JPG</option>
                    <option value="png">PNG</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Batch Action Floating Header when files selected */}
            {selectedAssetIds.length > 0 && (
              <div className="p-3 bg-brand-primary/10 border border-brand-primary/30 rounded-xl flex items-center justify-between gap-3 text-xs text-brand-primary animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>
                    <strong>{selectedAssetIds.length}</strong> photo(s) selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-brand-primary text-white hover:opacity-95"
                    onClick={() => setAssignModalOpen(true)}
                  >
                    <UserCheck size={14} className="mr-1" />
                    Assign to Client & Shoot Album
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAssetIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Files Main View */}
            <MediaBrowser assets={filteredAssets} selectedIds={selectedAssetIds} onSelect={toggleSelectAsset} onRename={setRenameAsset} onRemove={setRemoveAsset}/>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE CAMERA INGEST STREAM                                          */}
      {/* ========================================================================= */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Live Ingest Status Bar */}
          <div className="panel p-5 bg-surface-2 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <Radio size={24} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">Live Wi-Fi Camera Ingest Listener</h3>
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 font-bold uppercase tracking-wider">
                    ● SFTPGo Active : 2022
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Listening for direct FTP/SFTP photo streams from Sony, Canon, and Nikon cameras over local Wi-Fi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshLive}
                  onChange={(e) => setAutoRefreshLive(e.target.checked)}
                  className="rounded text-brand-primary"
                />
                Auto-poll (every 6s)
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={loadExplorerData}
                disabled={explorerLoading}
              >
                <RefreshCw size={14} className={explorerLoading ? 'animate-spin mr-1' : 'mr-1'} />
                Poll Now
              </Button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="panel p-4 space-y-1">
              <p className="text-xs text-muted">Active Tethered Cameras</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-foreground">
                  {explorerData.cameras?.filter((c) => c.is_active).length || 0}
                </h3>
                <Camera size={20} className="text-emerald-500" />
              </div>
              <p className="text-[11px] text-muted">Ready for Wi-Fi transmission</p>
            </div>

            <div className="panel p-4 space-y-1">
              <p className="text-xs text-muted">Total Camera Frames Ingested</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-foreground">
                  {explorerData.assets?.length || 0}
                </h3>
                <UploadCloud size={20} className="text-brand-primary" />
              </div>
              <p className="text-[11px] text-muted">Auto-indexed in studio storage</p>
            </div>

            <div className="panel p-4 space-y-1">
              <p className="text-xs text-muted">Storage Consumed</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-foreground">
                  {formatFileSize(totalStorageBytes)}
                </h3>
                <HardDrive size={20} className="text-indigo-500" />
              </div>
              <p className="text-[11px] text-muted">Across connected external storage</p>
            </div>

            <div className="panel p-4 space-y-1">
              <p className="text-xs text-muted">Last Ingest Scan</p>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">
                  {lastLivePoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </h3>
                <Clock size={20} className="text-amber-500" />
              </div>
              <p className="text-[11px] text-muted">Auto-refreshed via webhook</p>
            </div>
          </div>

          {/* Recent Ingest Stream Feed */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">Live Photos Stream Feed</h3>
                <p className="text-xs text-muted">
                  Photos appear here in real time as the photographer shoots on location or in-studio.
                </p>
              </div>

              {selectedAssetIds.length > 0 && (
                <Button
                  size="sm"
                  className="bg-brand-primary text-white"
                  onClick={() => setAssignModalOpen(true)}
                >
                  <UserCheck size={14} className="mr-1.5" />
                  Assign {selectedAssetIds.length} to Client Gallery
                </Button>
              )}
            </div>

            {explorerData.assets?.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Camera size={36} className="text-muted mx-auto opacity-50" />
                <h4 className="font-bold text-foreground">Waiting for live camera frames…</h4>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Take a photo on your tethered camera or simulate an upload to port 2022 to see live arrivals.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {explorerData.assets?.slice(0, 15).map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-border bg-surface-2 hover:border-brand-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectAsset(asset.id)}
                          className="rounded"
                        />
                        <img
                          src={asset.url}
                          alt={asset.filename}
                          className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0 cursor-pointer"
                          onClick={() => setLightboxAsset(asset)}
                        />
                        <div className="min-w-0">
                          <p
                            className="font-semibold text-xs text-foreground truncate cursor-pointer hover:text-brand-primary"
                            onClick={() => setLightboxAsset(asset)}
                          >
                            {asset.filename}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap mt-0.5">
                            <span>{formatFileSize(asset.file_size_bytes)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <Camera size={11} /> {asset.camera?.name || 'Wi-Fi Direct'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-indigo-600 font-medium">
                              <Server size={11} /> {asset.storage_provider?.name || 'Direct Ingest'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="text-[11px] text-muted">
                          {new Date(asset.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAssetIds([asset.id]);
                            setAssignModalOpen(true);
                          }}
                        >
                          <UserCheck size={13} className="mr-1" />
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLightboxAsset(asset)}
                        >
                          <Eye size={13} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STUDIO FOLDERS & DIRECTORIES (Original View)                       */}
      {/* ========================================================================= */}
      {activeTab === 'folders' && (
        <div className="space-y-6">
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
                      onClick={() => triggerDeleteFolder(selectedFolder)}
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
                  <div className="panel-heading p-0 mb-4 flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FolderOpen size={20} className="text-brand-primary" />
                        {selectedFolder.name}
                      </h2>
                      <p className="text-xs text-muted mt-0.5">
                        {selectedFolder.assets?.length || 0} live camera frames detected · Created on{' '}
                        {new Date(selectedFolder.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await foldersApi.publishGallery(selectedFolder.id);
                            toast.success(res.message || 'Published to client galleries successfully!');
                          } catch (err) {
                            toast.error(err.response?.data?.error || 'Failed to publish gallery');
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
                      <Link
                        className="button-primary text-xs flex items-center gap-1 py-1.5 px-3 rounded-lg"
                        to="/customer/galleries"
                      >
                        View in Client Portal
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>

                  <Button variant="outline" onClick={()=>setRenameFolder({...selectedFolder})}>Rename collection</Button>
                  <MediaBrowser assets={selectedFolder.assets || []} onRename={setRenameAsset} onRemove={setRemoveAsset}/>

                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH ASSIGN PHOTOS TO SHOOT & CLIENT                              */}
      {/* ========================================================================= */}
      <Modal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        title="Assign Photos to Shoot & Client Gallery"
        description={`Organize ${selectedAssetIds.length} selected photo(s) into an album and grant customer access.`}
      >
        <form className="form-stack space-y-4" onSubmit={handleBatchAssign}>
          {assignSuccessMsg ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-emerald-600 space-y-1">
              <CheckCircle2 size={28} className="mx-auto" />
              <p className="font-bold text-sm">{assignSuccessMsg}</p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-surface-muted rounded-lg border border-border text-xs text-muted flex items-center justify-between">
                <span>Selected Photo Batch:</span>
                <strong className="text-foreground">{selectedAssetIds.length} file(s)</strong>
              </div>

              <label>Folder collection<select value={targetFolder} onChange={e=>setTargetFolder(e.target.value)}><option value="">Choose folder</option>{allFolders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><Button type="button" disabled={!targetFolder||assignBusy} onClick={async()=>{try{setAssignBusy(true);await foldersApi.addFolderAssets(targetFolder,selectedAssetIds);toast.success('Added to folder collection');setAssignModalOpen(false);setSelectedAssetIds([]);await loadTree();}catch(e){toast.error(e.response?.data?.error||'Could not add files');}finally{setAssignBusy(false);}}}>Add selected files to collection</Button>
              {/* Album Selection or Creation */}
              <label className="text-xs font-semibold text-foreground">
                Shoot Album / Collection
                <Select
                  value={assignAlbumId}
                  onChange={(e) => {
                    setAssignAlbumId(e.target.value);
                    if (e.target.value) setAssignNewAlbumTitle('');
                  }}
                  placeholder="Select an existing shoot album…"
                  options={[
                    { value: '', label: 'Select existing album or create below' },
                    ...(explorerData.albums || []).map((alb) => ({
                      value: alb.id,
                      label: `📁 ${alb.title}`,
                    })),
                  ]}
                />
              </label>

              <div className="text-center text-xs text-muted font-bold uppercase">— OR CREATE NEW SHOOT ALBUM —</div>

              <label className="text-xs font-semibold text-foreground">
                New Shoot Album Title
                <input
                  type="text"
                  placeholder="e.g. 2026 Smith Wedding - High Res"
                  value={assignNewAlbumTitle}
                  onChange={(e) => {
                    setAssignNewAlbumTitle(e.target.value);
                    if (e.target.value) setAssignAlbumId('');
                  }}
                  className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
                />
              </label>

              {/* Customer Client Selection */}
              <label className="text-xs font-semibold text-foreground">
                Assign to Client (Optional)
                <Select
                  value={assignCustomerId}
                  onChange={(e) => setAssignCustomerId(e.target.value)}
                  placeholder="Grant access to client…"
                  options={[
                    { value: '', label: 'None (Studio Internal Library Only)' },
                    ...(explorerData.customers || []).map((cust) => ({
                      value: cust.id,
                      label: `👤 ${cust.name} (${cust.email})`,
                    })),
                  ]}
                />
              </label>

              <div className="modal-actions pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={assignBusy}
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={assignBusy}>
                  {assignBusy ? <Loader2 size={16} className="animate-spin" /> : 'Assign Photos Now'}
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: LIGHTBOX PHOTO PREVIEW                                             */}
      {/* ========================================================================= */}
      <Modal open={!!renameAsset} onOpenChange={open=>!open&&setRenameAsset(null)} title="Rename file" description="Update the display name in your library."><form className="form-stack" onSubmit={async e=>{e.preventDefault();try{await foldersApi.updateAsset(renameAsset.id,{filename:renameAsset.filename});setRenameAsset(null);await Promise.all([loadTree(),loadExplorerData()]);}catch(e){toast.error(e.response?.data?.error||'Could not rename file');}}}><label>Filename<input required maxLength={255} value={renameAsset?.filename||''} onChange={e=>setRenameAsset({...renameAsset,filename:e.target.value})}/></label><Button type="submit">Save name</Button></form></Modal>
      <Modal open={!!renameFolder} onOpenChange={open=>!open&&setRenameFolder(null)} title="Rename collection" description="Give this collection a clear name."><form className="form-stack" onSubmit={async e=>{e.preventDefault();try{await foldersApi.update(renameFolder.id,{name:renameFolder.name});setRenameFolder(null);await loadTree();}catch(e){toast.error(e.response?.data?.error||'Could not rename collection');}}}><label>Name<input required value={renameFolder?.name||''} onChange={e=>setRenameFolder({...renameFolder,name:e.target.value})}/></label><Button type="submit">Save name</Button></form></Modal>
      <ConfirmModal open={!!removeAsset} onOpenChange={open=>!open&&setRemoveAsset(null)} title="Remove file from library?" description="This hides the file from all galleries. The original remains in external storage." confirmText="Remove file" variant="danger" onConfirm={async()=>{try{await foldersApi.deleteAsset(removeAsset);setRemoveAsset(null);await Promise.all([loadTree(),loadExplorerData()]);}catch(e){toast.error(e.response?.data?.error||'Could not remove file');}}}/>
      <MediaViewer selected={lightboxAsset} assets={selectedFolder?.assets || explorerData.assets} onClose={()=>setLightboxAsset(null)}/>

      {/* ========================================================================= */}
      {/* MODAL: CREATE FOLDER                                                      */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL: SHARE GUEST LINK                                                   */}
      {/* ========================================================================= */}
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

              <ShareQr url={generatedShareUrl} title={selectedFolder?.name}/>
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

      {/* Delete Folder Confirm Modal */}
      <ConfirmModal
        open={deleteFolderModal}
        onOpenChange={setDeleteFolderModal}
        title={`Delete folder "${folderToDelete?.name || ''}"?`}
        description="This will remove the folder organization from your studio workspace. Photos will remain in your storage library and won't be deleted."
        confirmText="Delete Folder"
        variant="danger"
        loading={deleteFolderBusy}
        onConfirm={confirmDeleteFolder}
      />
    </div>
  );
}
