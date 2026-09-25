import React, { useState, useMemo, useEffect } from 'react';
import {
  HardDrive,
  Server,
  Camera,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
  Filter,
  Grid,
  List,
  CheckSquare,
  Square,
  Eye,
  Download,
  Calendar,
  Clock,
  Sparkles,
  ArrowUp,
  FileImage,
  Video,
  X,
  Plus,
  RefreshCw,
  FolderPlus,
  UserCheck,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { ConfirmModal } from '../ui/ConfirmModal';
import { foldersApi } from '../../api/services';
import { mediaUrl, MediaViewer } from './MediaBrowser';

// Helper to format bytes into readable sizes
export function formatFileSize(bytes) {
  const num = Number(bytes || 0);
  if (!num) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return (num / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

/**
 * Parses path segments from object_key or original_path.
 * E.g. "Studios/Lumina/Cameras/Sony-A7IV/2026-09-24/DSC001.JPG"
 * returns ["Studios", "Lumina", "Cameras", "Sony-A7IV", "2026-09-24"]
 */
function extractPathFolders(keyOrPath) {
  if (!keyOrPath) return [];
  const normalized = keyOrPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const parts = normalized.split('/');
  // Remove filename if last part has an extension
  if (parts.length > 0 && parts[parts.length - 1].includes('.')) {
    parts.pop();
  }
  return parts;
}

export function StorageTreeExplorer({
  assets = [],
  providers = [],
  cameras = [],
  albums = [],
  folders = [],
  initialCameraId = null,
  selectedIds = [],
  onSelectId,
  onSelectMultiple,
  onClearSelection,
  onConfirmSelection,
  selectionMode = false, // If true, acts as a picker inside Album Modal
  actionLabel = 'Use Selected Photos',
  onCreateAlbumFromSelection,
  onAssignFromSelection,
  canDownload = true,
  isLoading = false,
  onRefresh,
}) {
  // Navigation active node:
  // type: 'all' | 'provider' | 'provider_folder' | 'camera' | 'camera_date' | 'folder' | 'album'
  const [activeNode, setActiveNode] = useState({
    type: 'all',
    id: null,
    path: '',
    name: 'All Media Files',
  });

  // Expanded nodes map
  const [expandedSections, setExpandedSections] = useState({
    servers: true,
    cameras: true,
    folders: true,
    albums: false,
  });
  const [expandedFolders, setExpandedFolders] = useState({});

  // View & Filter states
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [treeSearchQuery, setTreeSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('all'); // 'all' | 'raw' | 'jpg' | 'png' | 'video'
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'name_asc' | 'size_desc'
  const [page, setPage] = useState(1);
  const [lightboxAsset, setLightboxAsset] = useState(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);

  // Deletion modals state
  const [deleteAssetModal, setDeleteAssetModal] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(false);
  const [deleteFolderModal, setDeleteFolderModal] = useState(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // React to initialCameraId if passed
  useEffect(() => {
    if (initialCameraId && cameras.length > 0) {
      const cam = cameras.find((c) => c.id === initialCameraId);
      if (cam) {
        setActiveNode({
          type: 'camera',
          id: cam.id,
          name: cam.name,
        });
        setExpandedSections((prev) => ({ ...prev, cameras: true }));
        setExpandedFolders((prev) => ({ ...prev, [`cam_root_${cam.id}`]: true }));
      }
    }
  }, [initialCameraId, cameras]);

  // Toggle folder expansion
  const toggleFolderExpand = (folderKey, e) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  // Build directory tree per storage provider from assets
  const providerFolderTrees = useMemo(() => {
    const trees = {};
    providers.forEach((p) => {
      trees[p.id] = { name: p.name, subfolders: {}, totalCount: 0 };
    });

    assets.forEach((asset) => {
      const pId = asset.storage_provider?.id || 'local';
      if (!trees[pId]) {
        trees[pId] = {
          name: asset.storage_provider?.name || 'Local Storage',
          subfolders: {},
          totalCount: 0,
        };
      }
      trees[pId].totalCount++;

      const folderParts = extractPathFolders(asset.object_key || asset.original_path);
      let curr = trees[pId].subfolders;
      let pathAccum = '';

      folderParts.forEach((part) => {
        pathAccum = pathAccum ? `${pathAccum}/${part}` : part;
        if (!curr[part]) {
          curr[part] = {
            name: part,
            path: pathAccum,
            providerId: pId,
            subfolders: {},
            count: 0,
          };
        }
        curr[part].count++;
        curr = curr[part].subfolders;
      });
    });

    return trees;
  }, [providers, assets]);

  // Build camera session dates tree
  const cameraSessionsTree = useMemo(() => {
    const camTree = {};
    cameras.forEach((c) => {
      camTree[c.id] = { camera: c, dates: {}, totalCount: 0 };
    });

    assets.forEach((asset) => {
      if (asset.camera?.id) {
        const cId = asset.camera.id;
        if (!camTree[cId]) {
          camTree[cId] = { camera: asset.camera, dates: {}, totalCount: 0 };
        }
        camTree[cId].totalCount++;

        // Extract date YYYY-MM-DD
        const dateStr = asset.created_at ? asset.created_at.slice(0, 10) : 'Uncategorized';
        camTree[cId].dates[dateStr] = (camTree[cId].dates[dateStr] || 0) + 1;
      }
    });

    return camTree;
  }, [cameras, assets]);

  // Filter assets matching the selected tree node
  const scopedAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (activeNode.type === 'all') return true;

      if (activeNode.type === 'provider') {
        return asset.storage_provider?.id === activeNode.id;
      }

      if (activeNode.type === 'provider_folder') {
        if (asset.storage_provider?.id !== activeNode.providerId) return false;
        const assetPath = (asset.object_key || asset.original_path || '').replace(/\\/g, '/');
        return assetPath.includes(activeNode.path);
      }

      if (activeNode.type === 'camera') {
        return asset.camera?.id === activeNode.id;
      }

      if (activeNode.type === 'camera_date') {
        if (asset.camera?.id !== activeNode.cameraId) return false;
        return asset.created_at?.startsWith(activeNode.date);
      }

      if (activeNode.type === 'folder') {
        return (
          asset.folders?.some((f) => f.id === activeNode.id) ||
          asset.folder_id === activeNode.id
        );
      }

      if (activeNode.type === 'album') {
        return asset.albums?.some((a) => a.id === activeNode.id);
      }

      return true;
    });
  }, [assets, activeNode]);

  // Apply search query, format filter, and sorting on scoped assets
  const filteredAndSortedAssets = useMemo(() => {
    let result = scopedAssets.filter((asset) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = asset.filename.toLowerCase().includes(q);
        const matchPath = (asset.object_key || asset.original_path || '').toLowerCase().includes(q);
        if (!matchName && !matchPath) return false;
      }

      // Format filter
      if (formatFilter !== 'all') {
        const ext = asset.filename.split('.').pop()?.toLowerCase() || '';
        const isRaw = ['arw', 'cr2', 'cr3', 'nef', 'dng', 'raw', 'orf'].includes(ext);
        const isJpg = ['jpg', 'jpeg'].includes(ext);
        const isPng = ext === 'png';
        const isVid = asset.mime_type?.startsWith('video/') || ['mp4', 'mov'].includes(ext);

        if (formatFilter === 'raw' && !isRaw) return false;
        if (formatFilter === 'jpg' && !isJpg) return false;
        if (formatFilter === 'png' && !isPng) return false;
        if (formatFilter === 'video' && !isVid) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.filename.localeCompare(b.filename);
      if (sortBy === 'name_desc') return b.filename.localeCompare(a.filename);
      if (sortBy === 'size_desc') return Number(b.file_size_bytes || 0) - Number(a.file_size_bytes || 0);
      if (sortBy === 'size_asc') return Number(a.file_size_bytes || 0) - Number(b.file_size_bytes || 0);
      if (sortBy === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
      // default: date_desc
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [scopedAssets, searchQuery, formatFilter, sortBy]);

  // Scoped folder pagination (60 items per page)
  const perPage = 60;
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedAssets.length / perPage));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [activeNode, searchQuery, formatFilter, sortBy]);

  const displayedAssets = useMemo(() => {
    return filteredAndSortedAssets.slice((currentPage - 1) * perPage, currentPage * perPage);
  }, [filteredAndSortedAssets, currentPage]);

  // Total storage metrics for active folder
  const currentFolderBytes = useMemo(() => {
    return scopedAssets.reduce((sum, a) => sum + Number(a.file_size_bytes || 0), 0);
  }, [scopedAssets]);

  // Selection toggle handlers
  const handleToggleSelect = (id) => {
    if (onSelectId) onSelectId(id);
  };

  const handleSelectAllInFolder = () => {
    const idsInFolder = filteredAndSortedAssets.map((a) => a.id);
    const allSelected = idsInFolder.every((id) => selectedIds.includes(id));
    if (allSelected) {
      // Remove folder items
      const next = selectedIds.filter((id) => !idsInFolder.includes(id));
      if (onSelectMultiple) onSelectMultiple(next);
    } else {
      // Add missing folder items
      const next = Array.from(new Set([...selectedIds, ...idsInFolder]));
      if (onSelectMultiple) onSelectMultiple(next);
    }
  };

  // Check if all files in current folder are selected
  const isAllFolderSelected =
    filteredAndSortedAssets.length > 0 &&
    filteredAndSortedAssets.every((a) => selectedIds.includes(a.id));

  // Breadcrumbs generator
  const breadcrumbs = useMemo(() => {
    const list = [{ label: 'Studio Root', node: { type: 'all', name: 'All Media Files' } }];

    if (activeNode.type === 'provider') {
      list.push({ label: activeNode.name, node: activeNode });
    } else if (activeNode.type === 'provider_folder') {
      const prov = providers.find((p) => p.id === activeNode.providerId);
      list.push({
        label: prov?.name || 'Server Node',
        node: { type: 'provider', id: activeNode.providerId, name: prov?.name },
      });
      const parts = activeNode.path.split('/');
      let accum = '';
      parts.forEach((part) => {
        accum = accum ? `${accum}/${part}` : part;
        list.push({
          label: part,
          node: {
            type: 'provider_folder',
            providerId: activeNode.providerId,
            path: accum,
            name: part,
          },
        });
      });
    } else if (activeNode.type === 'camera') {
      list.push({ label: activeNode.name, node: activeNode });
    } else if (activeNode.type === 'camera_date') {
      const cam = cameras.find((c) => c.id === activeNode.cameraId);
      list.push({
        label: cam?.name || 'Camera',
        node: { type: 'camera', id: activeNode.cameraId, name: cam?.name },
      });
      list.push({ label: activeNode.date, node: activeNode });
    } else if (activeNode.type === 'folder' || activeNode.type === 'album') {
      list.push({ label: activeNode.name, node: activeNode });
    }

    return list;
  }, [activeNode, providers, cameras]);

  // Render recursive directory subfolder branch
  const renderFolderBranch = (folderMap, providerId, depth = 0) => {
    return Object.entries(folderMap).map(([name, node]) => {
      const folderKey = `prov_${providerId}_${node.path}`;
      const isExpanded = !!expandedFolders[folderKey];
      const hasChildren = Object.keys(node.subfolders).length > 0;
      const isActive =
        activeNode.type === 'provider_folder' &&
        activeNode.providerId === providerId &&
        activeNode.path === node.path;

      return (
        <div key={folderKey} className="space-y-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
          <div
            onClick={() =>
              setActiveNode({
                type: 'provider_folder',
                providerId,
                path: node.path,
                name: node.name,
              })
            }
            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors group ${
              isActive
                ? 'bg-brand-primary/10 text-brand-primary font-bold border border-brand-primary/30'
                : 'text-foreground hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleFolderExpand(folderKey, e)}
                  className="p-0.5 rounded hover:bg-surface-muted text-muted hover:text-foreground"
                >
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              {isExpanded ? (
                <FolderOpen size={13} className="text-amber-400 shrink-0" />
              ) : (
                <Folder size={13} className="text-amber-400 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            <span className="text-[10px] bg-surface-muted px-1.5 py-0.2 rounded text-muted font-mono shrink-0">
              {node.count}
            </span>
          </div>

          {hasChildren && isExpanded && (
            <div>{renderFolderBranch(node.subfolders, providerId, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="storage-tree-explorer flex flex-col rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
      {/* ========================================================================= */}
      {/* DUAL PANE: FILEZILLA / WINSCP WORKSTATION                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* ======================================================================= */}
        {/* LEFT PANE: STORAGE SERVER & DIRECTORY HIERARCHY TREE                   */}
        {/* ======================================================================= */}
        <aside className="lg:col-span-4 border-r border-border bg-surface-2/60 flex flex-col h-full max-h-[720px] overflow-hidden">
          {/* Tree Header & Quick Search */}
          <div className="p-3 border-b border-border space-y-2.5 bg-surface-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Server size={14} className="text-brand-primary" />
                Storage Tree & Shoots
              </span>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-1 rounded hover:bg-surface text-muted hover:text-foreground transition-colors"
                  title="Refresh storage tree"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Filter servers & shoots…"
                value={treeSearchQuery}
                onChange={(e) => setTreeSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-2.5 py-1.5 bg-surface rounded-md border border-border focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Tree Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
            {/* Root: All Media Files */}
            <div
              onClick={() => setActiveNode({ type: 'all', id: null, name: 'All Media Files' })}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs font-semibold transition-all ${
                activeNode.type === 'all'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-foreground hover:bg-surface'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers size={14} />
                <span>Entire Studio Library</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeNode.type === 'all' ? 'bg-white/20 text-white' : 'bg-surface-muted text-muted'
                }`}
              >
                {assets.length}
              </span>
            </div>

            {/* SECTION 1: Connected Storage Servers (SFTP, Wasabi S3, MinIO) */}
            <div className="space-y-1">
              <div
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, servers: !prev.servers }))
                }
                className="flex items-center justify-between px-1.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <HardDrive size={13} className="text-indigo-400" />
                  Storage Servers ({providers.length})
                </span>
                {expandedSections.servers ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>

              {expandedSections.servers && (
                <div className="space-y-1 pl-1">
                  {providers.map((prov) => {
                    const treeData = providerFolderTrees[prov.id] || { subfolders: {}, totalCount: 0 };
                    const provKey = `prov_root_${prov.id}`;
                    const isProvExpanded = !!expandedFolders[provKey];
                    const hasSubfolders = Object.keys(treeData.subfolders).length > 0;
                    const isActive = activeNode.type === 'provider' && activeNode.id === prov.id;

                    return (
                      <div key={prov.id} className="space-y-0.5">
                        <div
                          onClick={() =>
                            setActiveNode({
                              type: 'provider',
                              id: prov.id,
                              name: prov.name,
                            })
                          }
                          className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                            isActive
                              ? 'bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/30'
                              : 'text-foreground hover:bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {hasSubfolders ? (
                              <button
                                type="button"
                                onClick={(e) => toggleFolderExpand(provKey, e)}
                                className="p-0.5 rounded hover:bg-surface-muted text-muted"
                              >
                                {isProvExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            ) : (
                              <span className="w-3.5" />
                            )}
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                prov.health === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                            />
                            <span className="truncate">{prov.name}</span>
                            <span className="text-[9px] uppercase font-mono px-1 rounded bg-surface-muted text-muted">
                              {prov.backend}
                            </span>
                          </div>
                          <span className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-muted font-mono shrink-0">
                            {treeData.totalCount}
                          </span>
                        </div>

                        {/* Expandable subdirectories inside this storage provider */}
                        {hasSubfolders && isProvExpanded && (
                          <div className="pl-3 border-l border-border/60 ml-2 space-y-0.5">
                            {renderFolderBranch(treeData.subfolders, prov.id, 0)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: Tethered Wi-Fi Cameras */}
            <div className="space-y-1">
              <div
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, cameras: !prev.cameras }))
                }
                className="flex items-center justify-between px-1.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Camera size={13} className="text-emerald-500" />
                  Tethered Cameras ({cameras.length})
                </span>
                {expandedSections.cameras ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>

              {expandedSections.cameras && (
                <div className="space-y-1 pl-1">
                  {cameras.map((cam) => {
                    const camData = cameraSessionsTree[cam.id] || { dates: {}, totalCount: 0 };
                    const camKey = `cam_root_${cam.id}`;
                    const isCamExpanded = !!expandedFolders[camKey];
                    const hasDates = Object.keys(camData.dates).length > 0;
                    const isActive = activeNode.type === 'camera' && activeNode.id === cam.id;

                    return (
                      <div key={cam.id} className="space-y-0.5">
                        <div
                          onClick={() =>
                            setActiveNode({
                              type: 'camera',
                              id: cam.id,
                              name: cam.name,
                            })
                          }
                          className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/30'
                              : 'text-foreground hover:bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {hasDates ? (
                              <button
                                type="button"
                                onClick={(e) => toggleFolderExpand(camKey, e)}
                                className="p-0.5 rounded hover:bg-surface-muted text-muted"
                              >
                                {isCamExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            ) : (
                              <span className="w-3.5" />
                            )}
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                cam.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                              }`}
                            />
                            <span className="truncate">{cam.name}</span>
                          </div>
                          <span className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-muted font-mono shrink-0">
                            {camData.totalCount}
                          </span>
                        </div>

                        {/* Expandable shoot dates for this camera */}
                        {hasDates && isCamExpanded && (
                          <div className="pl-4 border-l border-border/60 ml-2 space-y-0.5">
                            {Object.entries(camData.dates).map(([dateStr, count]) => {
                              const isDateActive =
                                activeNode.type === 'camera_date' &&
                                activeNode.cameraId === cam.id &&
                                activeNode.date === dateStr;

                              return (
                                <div
                                  key={dateStr}
                                  onClick={() =>
                                    setActiveNode({
                                      type: 'camera_date',
                                      cameraId: cam.id,
                                      date: dateStr,
                                      name: `${cam.name} (${dateStr})`,
                                    })
                                  }
                                  className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                                    isDateActive
                                      ? 'bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/30'
                                      : 'text-muted hover:text-foreground hover:bg-surface'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Calendar size={12} className="text-emerald-500 shrink-0" />
                                    <span className="truncate font-mono text-[11px]">{dateStr}</span>
                                  </div>
                                  <span className="text-[10px] bg-surface-muted px-1.5 py-0.2 rounded font-mono text-muted">
                                    {count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: Studio Custom Folders */}
            <div className="space-y-1">
              <div
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, folders: !prev.folders }))
                }
                className="flex items-center justify-between px-1.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <FolderOpen size={13} className="text-amber-500" />
                  Studio Collections ({folders.length})
                </span>
                {expandedSections.folders ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>

              {expandedSections.folders && (
                <div className="space-y-0.5 pl-1">
                  {folders.map((f) => {
                    const count = assets.filter((a) => a.folders?.some((af) => af.id === f.id)).length;
                    const isActive = activeNode.type === 'folder' && activeNode.id === f.id;

                    return (
                      <div
                        key={f.id}
                        onClick={() =>
                          setActiveNode({
                            type: 'folder',
                            id: f.id,
                            name: f.name,
                          })
                        }
                        className={`group/folder flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30'
                            : 'text-foreground hover:bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Folder size={13} className="text-amber-400 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-muted font-mono">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteFolderModal(f);
                            }}
                            className="opacity-0 group-hover/folder:opacity-100 p-0.5 rounded text-muted hover:text-red-500 transition-opacity"
                            title="Delete folder"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 4: Shoot Albums */}
            <div className="space-y-1">
              <div
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, albums: !prev.albums }))
                }
                className="flex items-center justify-between px-1.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted cursor-pointer hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-purple-400" />
                  Existing Albums ({albums.length})
                </span>
                {expandedSections.albums ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>

              {expandedSections.albums && (
                <div className="space-y-0.5 pl-1 max-h-36 overflow-y-auto">
                  {albums.map((alb) => {
                    const count = assets.filter((a) => a.albums?.some((aa) => aa.id === alb.id)).length;
                    const isActive = activeNode.type === 'album' && activeNode.id === alb.id;

                    return (
                      <div
                        key={alb.id}
                        onClick={() =>
                          setActiveNode({
                            type: 'album',
                            id: alb.id,
                            name: alb.title,
                          })
                        }
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                          isActive
                            ? 'bg-purple-500/10 text-purple-500 font-bold border border-purple-500/30'
                            : 'text-foreground hover:bg-surface'
                        }`}
                      >
                        <span className="truncate">📁 {alb.title}</span>
                        <span className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-muted font-mono shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ======================================================================= */}
        {/* RIGHT PANE: SCOPED FILES EXPLORER (WINSCP / FILEZILLA DETAIL STAGE)   */}
        {/* ======================================================================= */}
        <main className="lg:col-span-8 flex flex-col h-full bg-surface">
          {/* WINSCP REMOTE PATH BREADCRUMB BAR */}
          <div className="p-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3">
            {/* Breadcrumb Path Trail */}
            <div className="flex items-center gap-1.5 text-xs overflow-x-auto min-w-0 py-0.5">
              <span className="text-muted font-mono font-semibold uppercase text-[10px] shrink-0">
                Remote:
              </span>
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-muted">/</span>}
                  <button
                    type="button"
                    onClick={() => setActiveNode(bc.node)}
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors shrink-0 ${
                      idx === breadcrumbs.length - 1
                        ? 'bg-brand-primary/10 text-brand-primary font-bold'
                        : 'text-muted hover:text-foreground hover:bg-surface-2'
                    }`}
                  >
                    {bc.label}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Folder Metrics & Select All */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted font-mono">
                {scopedAssets.length} file(s) · {formatFileSize(currentFolderBytes)}
              </span>

              <button
                type="button"
                onClick={handleSelectAllInFolder}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-border text-foreground transition-all"
                title={isAllFolderSelected ? 'Deselect all in folder' : 'Select all in folder'}
              >
                {isAllFolderSelected ? <CheckSquare size={13} className="text-brand-primary" /> : <Square size={13} />}
                <span>{isAllFolderSelected ? 'Deselect Folder' : 'Select All in Folder'}</span>
              </button>
            </div>
          </div>

          {/* EXPLORER ACTION TOOLBAR (Search, Formats, Sort, View Modes) */}
          <div className="p-3 border-b border-border bg-surface-2/40 flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Search files in this folder…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-3 py-1.5 bg-surface rounded-lg border border-border focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Format Filter Pills */}
            <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'raw', label: 'RAW' },
                { id: 'jpg', label: 'JPEG' },
                { id: 'png', label: 'PNG' },
                { id: 'video', label: 'Video' },
              ].map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setFormatFilter(f.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    formatFilter === f.id
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="w-36">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs"
                options={[
                  { value: 'date_desc', label: 'Newest First' },
                  { value: 'date_asc', label: 'Oldest First' },
                  { value: 'name_asc', label: 'Name (A–Z)' },
                  { value: 'name_desc', label: 'Name (Z–A)' },
                  { value: 'size_desc', label: 'Largest Size' },
                  { value: 'size_asc', label: 'Smallest Size' },
                ]}
              />
            </div>

            {/* View Mode Toggle (Grid vs FileZilla Table) */}
            <div className="flex items-center bg-surface p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
                title="Grid Thumbnail View"
              >
                <Grid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'table'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
                title="FileZilla / WinSCP Detailed List View"
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {/* STAGE CANVAS: GRID OR FILEZILLA TABLE */}
          <div className="flex-1 overflow-y-auto p-4 min-h-[360px]">
            {filteredAndSortedAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted border border-dashed border-border rounded-xl space-y-2 h-full">
                <FileImage size={36} className="text-muted/50" />
                <p className="text-sm font-semibold text-foreground">No media files in this directory</p>
                <p className="text-xs text-muted max-w-sm">
                  Switch to another server, shoot date, or folder from the left hierarchy tree, or adjust your search filter.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {displayedAssets.map((asset) => {
                  const isSelected = selectedIds.includes(asset.id);
                  const isVid = asset.mime_type?.startsWith('video/');
                  const ext = asset.filename.split('.').pop()?.toUpperCase() || 'FILE';

                  return (
                    <article
                      key={asset.id}
                      onClick={() => handleToggleSelect(asset.id)}
                      className={`group relative rounded-xl border overflow-hidden bg-surface transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'border-brand-primary ring-2 ring-brand-primary shadow-md'
                          : 'border-border hover:border-brand-primary/50'
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div className="relative aspect-square w-full bg-surface-2 overflow-hidden">
                        {isVid ? (
                          <video
                            src={mediaUrl(asset)}
                            preload="none"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={mediaUrl(asset)}
                            alt={asset.filename}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-sm">
                            {ext}
                          </span>
                        </div>

                        {/* Selection Checkbox */}
                        <div className="absolute top-2 right-2">
                          <span
                            className={`flex items-center justify-center h-5 w-5 rounded-md transition-all ${
                              isSelected
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'bg-black/50 text-white/70 group-hover:bg-black/80'
                            }`}
                          >
                            {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                          </span>
                        </div>

                        {/* Hover Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteAssetModal(asset);
                          }}
                          className="absolute top-2 right-8 p-1 rounded-md bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                          title="Delete file"
                        >
                          <Trash2 size={12} />
                        </button>

                        {/* Hover Quick Lightbox Preview */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxAsset(asset);
                          }}
                          className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                          title="Open preview"
                        >
                          <Eye size={13} />
                        </button>
                      </div>

                      {/* Info Caption */}
                      <div className="p-2 space-y-1 bg-surface">
                        <strong
                          className="text-xs truncate block text-foreground font-medium"
                          title={asset.filename}
                        >
                          {asset.filename}
                        </strong>
                        <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                          <span>{formatFileSize(asset.file_size_bytes)}</span>
                          <span className="truncate max-w-[80px]">
                            {asset.camera?.name || asset.storage_provider?.name || 'Local'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* FILEZILLA / WINSCP DETAILED TABLE VIEW */
              <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-2 text-muted border-b border-border text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-2.5 w-10 text-center">
                        <button
                          type="button"
                          onClick={handleSelectAllInFolder}
                          className="flex items-center justify-center mx-auto"
                        >
                          {isAllFolderSelected ? (
                            <CheckSquare size={14} className="text-brand-primary" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </th>
                      <th className="p-2.5 font-bold">Filename</th>
                      <th className="p-2.5 font-bold">Ext</th>
                      <th className="p-2.5 font-bold">Size</th>
                      <th className="p-2.5 font-bold hidden md:table-cell">Storage Node</th>
                      <th className="p-2.5 font-bold hidden lg:table-cell">Camera Source</th>
                      <th className="p-2.5 font-bold hidden sm:table-cell">Date Modified</th>
                      <th className="p-2.5 font-bold text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayedAssets.map((asset) => {
                      const isSelected = selectedIds.includes(asset.id);
                      const isVid = asset.mime_type?.startsWith('video/');
                      const ext = asset.filename.split('.').pop()?.toUpperCase() || 'FILE';

                      return (
                        <tr
                          key={asset.id}
                          onClick={() => handleToggleSelect(asset.id)}
                          className={`hover:bg-surface-2/70 cursor-pointer transition-colors ${
                            isSelected ? 'bg-brand-primary/5 font-medium' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <span className="flex items-center justify-center">
                              {isSelected ? (
                                <CheckSquare size={14} className="text-brand-primary" />
                              ) : (
                                <Square size={14} className="text-muted" />
                              )}
                            </span>
                          </td>
                          <td className="p-2.5 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {isVid ? (
                                <Video size={14} className="text-indigo-400 shrink-0" />
                              ) : (
                                <FileImage size={14} className="text-amber-500 shrink-0" />
                              )}
                              <span className="truncate max-w-[240px]" title={asset.filename}>
                                {asset.filename}
                              </span>
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-[10px] text-muted">{ext}</td>
                          <td className="p-2.5 font-mono text-muted">
                            {formatFileSize(asset.file_size_bytes)}
                          </td>
                          <td className="p-2.5 hidden md:table-cell text-muted">
                            <span className="truncate block max-w-[130px]">
                              {asset.storage_provider?.name || 'Local Gateway'}
                            </span>
                          </td>
                          <td className="p-2.5 hidden lg:table-cell text-muted">
                            <span className="truncate block max-w-[130px]">
                              {asset.camera?.name || '—'}
                            </span>
                          </td>
                          <td className="p-2.5 hidden sm:table-cell text-muted font-mono text-[11px]">
                            {asset.created_at ? asset.created_at.slice(0, 16).replace('T', ' ') : '—'}
                          </td>
                          <td className="p-2.5 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxAsset(asset);
                                }}
                                className="p-1 rounded hover:bg-surface text-muted hover:text-foreground"
                                title="Preview"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteAssetModal(asset);
                                }}
                                className="p-1 rounded hover:bg-surface text-muted hover:text-red-500"
                                title="Delete file"
                              >
                                <Trash2 size={13} />
                              </button>
                              {canDownload && (
                                <a
                                  href={`${mediaUrl(asset)}${mediaUrl(asset).includes('?') ? '&' : '?'}download=true`}
                                  download={asset.filename}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded hover:bg-surface text-muted hover:text-brand-primary"
                                  title="Download original"
                                >
                                  <Download size={13} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SCOPED FOLDER PAGINATION BAR */}
          {filteredAndSortedAssets.length > 0 && (
            <div className="p-3 border-t border-border bg-surface flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-muted">
                Showing{' '}
                <strong className="text-foreground">
                  {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredAndSortedAssets.length)}
                </strong>{' '}
                of <strong className="text-foreground">{filteredAndSortedAssets.length}</strong> items in this shoot
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="h-7 px-2.5 text-xs"
                >
                  Previous
                </Button>
                <span className="px-2 font-mono text-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="h-7 px-2.5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* PERSISTENT SELECTION DOCK: CROSS-FOLDER CURATION TRAY                     */}
      {/* ========================================================================= */}
      {selectedIds.length > 0 && (
        <div className="selection-dock bg-surface-2 border-t-2 border-brand-primary p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-primary animate-ping" />
              <span>{selectedIds.length} photo(s) selected</span>
            </span>

            <button
              type="button"
              onClick={() => setReviewDrawerOpen(!reviewDrawerOpen)}
              className="text-xs text-brand-primary hover:underline font-semibold"
            >
              {reviewDrawerOpen ? 'Hide Preview' : 'Review Selected'}
            </button>

            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-muted hover:text-rose-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* If in picker mode (inside Album modal), provide the confirm button */}
            {selectionMode && onConfirmSelection && (
              <Button
                type="button"
                className="bg-brand-primary text-white hover:opacity-95 shadow-sm text-xs py-1.5"
                onClick={() => onConfirmSelection(selectedIds)}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {actionLabel} ({selectedIds.length})
              </Button>
            )}

            {/* Standalone actions when used on FoldersPage */}
            {!selectionMode && onCreateAlbumFromSelection && (
              <Button
                type="button"
                className="bg-brand-primary text-white hover:opacity-95 shadow-sm text-xs py-1.5"
                onClick={() => onCreateAlbumFromSelection(selectedIds)}
              >
                <Plus size={14} className="mr-1.5" />
                Create Shoot Album ({selectedIds.length})
              </Button>
            )}

            {!selectionMode && onAssignFromSelection && (
              <Button
                type="button"
                variant="outline"
                className="text-xs py-1.5"
                onClick={() => onAssignFromSelection(selectedIds)}
              >
                <UserCheck size={14} className="mr-1.5" />
                Assign to Client
              </Button>
            )}
          </div>

          {/* Expandable Review Selected Drawer */}
          {reviewDrawerOpen && (
            <div className="w-full pt-3 border-t border-border mt-2 grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-2 max-h-28 overflow-y-auto">
              {selectedIds.map((id) => {
                const asset = assets.find((a) => a.id === id);
                if (!asset) return null;
                return (
                  <div key={id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-surface">
                    <img
                      src={mediaUrl(asset)}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(id)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      title="Remove from selection"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Preview */}
      <MediaViewer
        canDownload={canDownload}
        assets={filteredAndSortedAssets}
        selected={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
      />

      {/* Delete Asset Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteAssetModal)}
        onOpenChange={(v) => !v && setDeleteAssetModal(null)}
        title={`Delete "${deleteAssetModal?.filename}"?`}
        description="This will permanently remove this file from your studio library and storage destination. This action cannot be undone."
        confirmText="Delete File"
        variant="danger"
        loading={deletingAsset}
        onConfirm={async () => {
          setDeletingAsset(true);
          try {
            await foldersApi.deleteAsset(deleteAssetModal.id);
            setDeleteAssetModal(null);
            onRefresh?.();
          } catch (err) {
            console.error('Failed to delete asset:', err);
          } finally {
            setDeletingAsset(false);
          }
        }}
      />

      {/* Delete Folder Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteFolderModal)}
        onOpenChange={(v) => !v && setDeleteFolderModal(null)}
        title={`Delete Folder "${deleteFolderModal?.name}"?`}
        description="This will remove the folder collection. Your original media files will remain safely in your storage."
        confirmText="Delete Folder"
        variant="danger"
        loading={deletingFolder}
        onConfirm={async () => {
          setDeletingFolder(true);
          try {
            await foldersApi.delete(deleteFolderModal.id);
            setDeleteFolderModal(null);
            onRefresh?.();
          } catch (err) {
            console.error('Failed to delete folder:', err);
          } finally {
            setDeletingFolder(false);
          }
        }}
      />
    </div>
  );
}
