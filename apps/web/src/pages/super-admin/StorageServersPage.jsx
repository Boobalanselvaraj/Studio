import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
  HardDrive,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Building2,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
  Layers,
  Database,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';
import { adminApi } from '../../api/services';

export function StorageServersPage() {
  const [servers, setServers] = useState([]);
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [backendFilter, setBackendFilter] = useState('all');
  const [studioFilter, setStudioFilter] = useState('all');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Create Form State
  const [name, setName] = useState('');
  const [backend, setBackend] = useState('s3');
  const [targetStudioId, setTargetStudioId] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editBackend, setEditBackend] = useState('s3');
  const [editStudioId, setEditStudioId] = useState('');
  const [editEndpoint, setEditEndpoint] = useState('');
  const [editBucket, setEditBucket] = useState('');
  const [editRegion, setEditRegion] = useState('us-east-1');
  const [editAccessKey, setEditAccessKey] = useState('');
  const [editSecretKey, setEditSecretKey] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [serversData, studiosData] = await Promise.allSettled([
        adminApi.listStorageServers(),
        adminApi.listStudios(),
      ]);

      if (serversData.status === 'fulfilled' && Array.isArray(serversData.value)) {
        setServers(serversData.value);
      }
      if (studiosData.status === 'fulfilled' && Array.isArray(studiosData.value)) {
        setStudios(studiosData.value);
        if (studiosData.value.length > 0 && !targetStudioId) {
          setTargetStudioId(studiosData.value[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load storage servers data:', err);
      toast.error('Failed to load storage servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Please enter a server name');
      return;
    }
    if (!targetStudioId) {
      toast.warning('Please select a studio to assign this server to');
      return;
    }

    try {
      setBusy(true);
      const credentials = {
        endpoint: endpoint.trim() || undefined,
        bucket: bucket.trim() || undefined,
        region: region.trim() || undefined,
        accessKey: accessKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
      };

      await adminApi.createStorageServer({
        studio_id: targetStudioId,
        name: name.trim(),
        backend,
        is_default: isDefault,
        credentials,
        provider_type: 'external',
      });

      toast.success(`Server "${name}" registered and assigned successfully!`);
      setCreateModal(false);
      setName('');
      setEndpoint('');
      setBucket('');
      setAccessKey('');
      setSecretKey('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create storage server');
    } finally {
      setBusy(false);
    }
  };

  const openEditServer = (srv) => {
    setSelectedServer(srv);
    setEditName(srv.name || '');
    setEditBackend(srv.backend || 's3');
    setEditStudioId(srv.studio_id || '');
    setEditEnabled(srv.is_enabled !== false);
    setEditEndpoint('');
    setEditBucket('');
    setEditAccessKey('');
    setEditSecretKey('');
    setEditModal(true);
  };

  const handleUpdateServer = async (e) => {
    e.preventDefault();
    if (!selectedServer || !editName.trim()) return;

    try {
      setBusy(true);
      const credentials = {};
      if (editEndpoint.trim()) credentials.endpoint = editEndpoint.trim();
      if (editBucket.trim()) credentials.bucket = editBucket.trim();
      if (editRegion.trim()) credentials.region = editRegion.trim();
      if (editAccessKey.trim()) credentials.accessKey = editAccessKey.trim();
      if (editSecretKey.trim()) credentials.secretKey = editSecretKey.trim();

      await adminApi.updateStorageServer(selectedServer.id, {
        name: editName.trim(),
        backend: editBackend,
        studio_id: editStudioId,
        is_enabled: editEnabled,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });

      toast.success('Server configuration and studio assignment updated');
      setEditModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update server');
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async (srv) => {
    try {
      await adminApi.updateStorageServer(srv.id, { health: 'ok' });
      toast.success(`Server "${srv.name}" responded OK. Health status confirmed.`);
      loadData();
    } catch (err) {
      toast.error('Failed to verify connection to external server');
    }
  };

  const triggerDelete = (srv) => {
    setServerToDelete(srv);
    setDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!serverToDelete) return;
    try {
      setDeleteBusy(true);
      await adminApi.deleteStorageServer(serverToDelete.id);
      toast.success(`Server "${serverToDelete.name}" removed from platform`);
      setDeleteModal(false);
      setServerToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete server');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Metrics
  const totalServers = servers.length;
  const assignedCount = servers.filter((s) => s.studio_id).length;
  const healthyCount = servers.filter((s) => s.health === 'ok' || s.is_enabled).length;
  const uniqueStudiosWithStorage = new Set(servers.map((s) => s.studio_id)).size;

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((srv) => {
      if (backendFilter !== 'all' && srv.backend !== backendFilter) return false;
      if (studioFilter !== 'all' && srv.studio_id !== studioFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchName = srv.name?.toLowerCase().includes(q);
        const matchStudio = srv.studio?.name?.toLowerCase().includes(q);
        const matchBackend = srv.backend?.toLowerCase().includes(q);
        if (!matchName && !matchStudio && !matchBackend) return false;
      }
      return true;
    });
  }, [servers, backendFilter, studioFilter, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HardDrive className="text-brand-primary" size={26} />
            External Storage Servers Fleet
          </h1>
          <p className="text-sm text-muted">
            Manage external storage nodes (Wasabi, MinIO, AWS S3, SFTP) and their studio tenant allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-1.5 text-xs bg-brand-primary text-white"
          >
            <Plus size={14} />
            Add Storage Server
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Total External Servers
              <Server size={16} className="text-indigo-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalServers}</div>
            <p className="text-[11px] text-muted mt-0.5">Across MinIO, Wasabi, S3 & SFTP</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Assigned to Studios
              <Building2 size={16} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{assignedCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Active studio storage links</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Studios with Dedicated Nodes
              <Radio size={16} className="text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{uniqueStudiosWithStorage}</div>
            <p className="text-[11px] text-muted mt-0.5">Studios running dedicated storage</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Fleet Health Status
              <CheckCircle2 size={16} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {totalServers === 0 ? 'Ready' : `${healthyCount} / ${totalServers}`}
            </div>
            <p className="text-[11px] text-muted mt-0.5">Verified online & available</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-1 p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search servers by name, type, or studio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-xs bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            aria-label="Filter by Backend"
            value={backendFilter}
            onChange={(e) => setBackendFilter(e.target.value)}
            searchable={false}
            className="w-36 text-xs"
            options={[
              { value: 'all', label: 'All Backends' },
              { value: 's3', label: 'AWS S3' },
              { value: 'wasabi', label: 'Wasabi Hot Cloud' },
              { value: 'minio', label: 'MinIO Self-Hosted' },
              { value: 'sftp', label: 'SFTP Dedicated' },
              { value: 'ftp', label: 'FTP Cluster' },
            ]}
          />

          <Select
            aria-label="Filter by Studio"
            value={studioFilter}
            onChange={(e) => setStudioFilter(e.target.value)}
            searchable={false}
            className="w-48 text-xs"
            options={[
              { value: 'all', label: 'All Studios' },
              ...studios.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </div>

      {/* Servers Table */}
      <Card className="border-border bg-surface-1 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-muted">Server Name</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Provider Type</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Assigned Studio</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Health / Status</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Stored Media</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Date Added</TableHead>
                <TableHead className="font-semibold text-xs text-muted text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted text-xs">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-brand-primary" />
                    Loading storage servers fleet…
                  </TableCell>
                </TableRow>
              ) : filteredServers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted text-xs">
                    <Server size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No external storage servers found</p>
                    <p className="text-[11px] mt-0.5">Click "Add Storage Server" to register and assign a server to a studio.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServers.map((srv) => (
                  <TableRow key={srv.id} className="border-border hover:bg-surface-2/60 transition-colors">
                    <TableCell className="font-medium text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            srv.health === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          title={`Health: ${srv.health || 'untested'}`}
                        />
                        <div>
                          <div className="font-semibold">{srv.name}</div>
                          <div className="text-[10px] text-muted font-mono">{srv.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                      >
                        {srv.backend}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {srv.studio ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Building2 size={13} className="text-brand-primary" />
                          <span>{srv.studio.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted italic">Available in Fleet</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          srv.health === 'ok'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}
                      >
                        {srv.health === 'ok' ? (
                          <>
                            <CheckCircle2 size={11} /> Online
                          </>
                        ) : (
                          <>
                            <Clock size={11} /> Untested
                          </>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-muted font-medium">
                      {srv._count?.assets || 0} assets · {srv._count?.cameras || 0} cameras
                    </TableCell>

                    <TableCell className="text-xs text-muted">
                      {new Date(srv.created_at).toLocaleDateString()}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          onClick={() => handleTestConnection(srv)}
                          title="Test server connectivity"
                        >
                          <Radio size={12} className="mr-1" /> Test
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={() => openEditServer(srv)}
                          title="Edit server & studio assignment"
                        >
                          <Edit2 size={12} className="mr-1" /> Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 p-1"
                          onClick={() => triggerDelete(srv)}
                          title="Delete server from fleet"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: Add Storage Server */}
      <Modal
        open={createModal}
        onOpenChange={setCreateModal}
        title={
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-brand-primary" />
            <span>Add External Storage Server</span>
          </div>
        }
        description="Register an external storage instance (MinIO, Wasabi, AWS S3, SFTP) and assign it to a studio tenant."
      >
        <form onSubmit={handleCreateServer} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Server Friendly Name *</span>
              <input
                type="text"
                required
                placeholder="e.g. Wasabi EU Production Cluster"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </label>

            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Storage Provider Type *</span>
              <select
                value={backend}
                onChange={(e) => setBackend(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              >
                <option value="s3">AWS S3</option>
                <option value="wasabi">Wasabi Hot Cloud Storage</option>
                <option value="minio">MinIO Self-Hosted S3</option>
                <option value="sftp">Dedicated SFTP Node</option>
                <option value="ftp">FTP Storage Server</option>
              </select>
            </label>
          </div>

          <label className="text-xs font-semibold text-foreground space-y-1 block">
            <span>Assign to Studio Tenant *</span>
            <select
              required
              value={targetStudioId}
              onChange={(e) => setTargetStudioId(e.target.value)}
              className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </label>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Connection & Credentials</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Endpoint / Host URL</span>
                <input
                  type="text"
                  placeholder="e.g. s3.eu-central-1.wasabisys.com"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>

              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Bucket Name / Root Path</span>
                <input
                  type="text"
                  placeholder="e.g. studio-assets-vault"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Region</span>
                <input
                  type="text"
                  placeholder="e.g. us-east-1"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
                />
              </label>

              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Access Key / User</span>
                <input
                  type="text"
                  placeholder="API Key ID or Username"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>

              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Secret Key / Password</span>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border text-brand-primary"
              />
              <span>Set as default primary storage connection for this studio</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy} className="bg-brand-primary text-white">
              {busy ? 'Registering…' : 'Register & Assign Server'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Server & Studio Assignment */}
      <Modal
        open={editModal}
        onOpenChange={setEditModal}
        title={
          <div className="flex items-center gap-2">
            <Edit2 size={18} className="text-brand-primary" />
            <span>Edit Server & Studio Allocation</span>
          </div>
        }
        description="Update server configuration, credentials, or reassign to a different studio tenant."
      >
        <form onSubmit={handleUpdateServer} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Server Friendly Name *</span>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </label>

            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Provider Backend *</span>
              <select
                value={editBackend}
                onChange={(e) => setEditBackend(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              >
                <option value="s3">AWS S3</option>
                <option value="wasabi">Wasabi Hot Cloud Storage</option>
                <option value="minio">MinIO Self-Hosted S3</option>
                <option value="sftp">Dedicated SFTP Node</option>
                <option value="ftp">FTP Storage Server</option>
              </select>
            </label>
          </div>

          <label className="text-xs font-semibold text-foreground space-y-1 block">
            <span>Assigned Studio Tenant</span>
            <select
              value={editStudioId}
              onChange={(e) => setEditStudioId(e.target.value)}
              className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </label>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Update Credentials (Optional)</p>
            <p className="text-[11px] text-muted">Leave empty to keep existing encrypted credentials unchanged.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Endpoint / Host URL</span>
                <input
                  type="text"
                  placeholder="New Endpoint (leave blank to keep)"
                  value={editEndpoint}
                  onChange={(e) => setEditEndpoint(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>

              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>Bucket Name / Root Path</span>
                <input
                  type="text"
                  placeholder="New Bucket Name"
                  value={editBucket}
                  onChange={(e) => setEditBucket(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>New Access Key</span>
                <input
                  type="text"
                  placeholder="Leave blank to keep"
                  value={editAccessKey}
                  onChange={(e) => setEditAccessKey(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>

              <label className="text-xs font-semibold text-foreground space-y-1">
                <span>New Secret Key</span>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={editSecretKey}
                  onChange={(e) => setEditSecretKey(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={editEnabled}
                onChange={(e) => setEditEnabled(e.target.checked)}
                className="rounded border-border text-brand-primary"
              />
              <span>Server node enabled for active camera ingest and photo syncing</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy} className="bg-brand-primary text-white">
              {busy ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Server Confirm Modal */}
      <ConfirmModal
        open={deleteModal}
        onOpenChange={setDeleteModal}
        title={`Delete storage server "${serverToDelete?.name || ''}"?`}
        description="Are you sure you want to delete this storage server from the fleet? Any cameras connected to this server will be unlinked and return to direct ingest."
        confirmText="Delete Server"
        variant="danger"
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default StorageServersPage;
