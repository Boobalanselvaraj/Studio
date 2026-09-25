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
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Info,
  Sparkles,
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
  const [ownershipFilter, setOwnershipFilter] = useState('all');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  // Credentials inspection modal for Platform servers
  const [credentialsModal, setCredentialsModal] = useState(false);
  const [activeCredsServer, setActiveCredsServer] = useState(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Create Form State
  // providerType: 'platform' (Platform-bought & assigned) vs 'studio_owned' (Studio's own server)
  const [providerType, setProviderType] = useState('platform');
  const [name, setName] = useState('');
  const [backend, setBackend] = useState('s3');
  const [targetStudioId, setTargetStudioId] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Platform Cost & Renewal tracking state (Only for platform-bought servers)
  const [platformMonthlyCost, setPlatformMonthlyCost] = useState('');
  const [platformRenewalPeriod, setPlatformRenewalPeriod] = useState('monthly');
  const [platformRenewalDate, setPlatformRenewalDate] = useState('');
  const [platformCapacityGb, setPlatformCapacityGb] = useState('');
  const [platformNotes, setPlatformNotes] = useState('');

  // Edit Form State
  const [editProviderType, setEditProviderType] = useState('platform');
  const [editName, setEditName] = useState('');
  const [editBackend, setEditBackend] = useState('s3');
  const [editStudioId, setEditStudioId] = useState('');
  const [editEndpoint, setEditEndpoint] = useState('');
  const [editBucket, setEditBucket] = useState('');
  const [editRegion, setEditRegion] = useState('us-east-1');
  const [editAccessKey, setEditAccessKey] = useState('');
  const [editSecretKey, setEditSecretKey] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const [editPlatformMonthlyCost, setEditPlatformMonthlyCost] = useState('');
  const [editPlatformRenewalPeriod, setEditPlatformRenewalPeriod] = useState('monthly');
  const [editPlatformRenewalDate, setEditPlatformRenewalDate] = useState('');
  const [editPlatformCapacityGb, setEditPlatformCapacityGb] = useState('');
  const [editPlatformNotes, setEditPlatformNotes] = useState('');

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

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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

      const isPlatformManaged = providerType === 'platform';

      await adminApi.createStorageServer({
        studio_id: targetStudioId,
        name: name.trim(),
        backend,
        is_default: isDefault,
        credentials,
        provider_type: isPlatformManaged ? 'platform' : 'studio_owned',
        platform_monthly_cost: isPlatformManaged && platformMonthlyCost ? Number(platformMonthlyCost) : undefined,
        platform_renewal_period: isPlatformManaged ? platformRenewalPeriod : undefined,
        platform_renewal_date: isPlatformManaged && platformRenewalDate ? new Date(platformRenewalDate).toISOString() : undefined,
        platform_capacity_gb: isPlatformManaged && platformCapacityGb ? Number(platformCapacityGb) : undefined,
        platform_notes: isPlatformManaged ? platformNotes.trim() || undefined : undefined,
      });

      toast.success(
        isPlatformManaged
          ? `Platform Server "${name}" created with credentials and assigned successfully!`
          : `Studio-Owned Server "${name}" registered with basic connection details!`
      );
      setCreateModal(false);
      setName('');
      setEndpoint('');
      setBucket('');
      setAccessKey('');
      setSecretKey('');
      setPlatformMonthlyCost('');
      setPlatformRenewalDate('');
      setPlatformCapacityGb('');
      setPlatformNotes('');
      setProviderType('platform');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create storage server');
    } finally {
      setBusy(false);
    }
  };

  const openEditServer = (srv) => {
    setSelectedServer(srv);
    const isPlatform = srv.provider_type === 'platform' || srv.is_platform_managed;
    setEditProviderType(isPlatform ? 'platform' : 'studio_owned');
    setEditName(srv.name || '');
    setEditBackend(srv.backend || 's3');
    setEditStudioId(srv.studio_id || '');
    setEditEnabled(srv.is_enabled !== false);
    setEditEndpoint(srv.credentials?.endpoint || '');
    setEditBucket(srv.credentials?.bucket || '');
    setEditRegion(srv.credentials?.region || 'us-east-1');
    setEditAccessKey(srv.credentials?.accessKey || '');
    setEditSecretKey('');
    setEditPlatformMonthlyCost(srv.platform_monthly_cost ?? '');
    setEditPlatformRenewalPeriod(srv.platform_renewal_period || 'monthly');
    setEditPlatformRenewalDate(srv.platform_renewal_date ? new Date(srv.platform_renewal_date).toISOString().slice(0, 10) : '');
    setEditPlatformCapacityGb(srv.platform_capacity_gb ?? '');
    setEditPlatformNotes(srv.platform_notes || '');
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

      const isPlatformManaged = editProviderType === 'platform';

      await adminApi.updateStorageServer(selectedServer.id, {
        name: editName.trim(),
        backend: editBackend,
        studio_id: editStudioId,
        provider_type: isPlatformManaged ? 'platform' : 'studio_owned',
        is_enabled: editEnabled,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
        platform_monthly_cost: isPlatformManaged && editPlatformMonthlyCost !== '' ? Number(editPlatformMonthlyCost) : null,
        platform_renewal_period: isPlatformManaged ? editPlatformRenewalPeriod || 'monthly' : null,
        platform_renewal_date: isPlatformManaged && editPlatformRenewalDate ? new Date(editPlatformRenewalDate).toISOString() : null,
        platform_capacity_gb: isPlatformManaged && editPlatformCapacityGb !== '' ? Number(editPlatformCapacityGb) : null,
        platform_notes: isPlatformManaged ? editPlatformNotes.trim() || null : null,
      });

      toast.success('Server configuration updated successfully');
      setEditModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update server');
    } finally {
      setBusy(false);
    }
  };

  const openCredentialsModal = (srv) => {
    setActiveCredsServer(srv);
    setShowSecretKey(false);
    setCopiedKey(null);
    setCredentialsModal(true);
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
  const platformServersCount = servers.filter((s) => s.provider_type === 'platform' || s.is_platform_managed).length;
  const studioOwnedCount = servers.filter((s) => s.provider_type === 'studio_owned' || !s.is_platform_managed).length;
  const assignedCount = servers.filter((s) => s.studio_id).length;
  const healthyCount = servers.filter((s) => s.health === 'ok' || s.is_enabled).length;

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((srv) => {
      const isPlatform = srv.provider_type === 'platform' || srv.is_platform_managed;
      if (ownershipFilter === 'platform' && !isPlatform) return false;
      if (ownershipFilter === 'studio_owned' && isPlatform) return false;
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
  }, [servers, backendFilter, studioFilter, ownershipFilter, query]);

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
            Manage external storage nodes (Wasabi, MinIO, AWS S3, SFTP), credentials, and studio allocations.
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
            onClick={() => {
              setProviderType('platform');
              setCreateModal(true);
            }}
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
              Total Fleet Servers
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
              Platform-Assigned
              <KeyRound size={16} className="text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{platformServersCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Bought by us · Credentials managed</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Studio-Owned (BYO)
              <Building2 size={16} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{studioOwnedCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Bought by studio · Basic details</p>
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
          {/* Ownership Filter */}
          <Select
            aria-label="Filter by Server Ownership"
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            searchable={false}
            className="w-48 text-xs"
            options={[
              { value: 'all', label: 'All Ownership Types' },
              { value: 'platform', label: '🟣 Platform-Assigned (Full)' },
              { value: 'studio_owned', label: '🟢 Studio-Owned (Basic)' },
            ]}
          />

          {/* Backend Filter */}
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

          {/* Studio Filter */}
          <Select
            aria-label="Filter by Studio"
            value={studioFilter}
            onChange={(e) => setStudioFilter(e.target.value)}
            searchable={studios.length >= 7}
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
                <TableHead className="font-semibold text-xs text-muted">Ownership Model</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Provider / Backend</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Assigned Studio</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Server Details & Credentials</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Platform Cost / Renewal</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Stored Media</TableHead>
                <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted text-xs">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-brand-primary" />
                    Loading storage servers fleet…
                  </TableCell>
                </TableRow>
              ) : filteredServers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted text-xs">
                    <Server size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No storage servers found</p>
                    <p className="text-[11px] mt-0.5">Click "Add Storage Server" to register a new platform or studio server.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServers.map((srv) => {
                  const isPlatformManaged = srv.provider_type === 'platform' || srv.is_platform_managed;

                  return (
                    <TableRow key={srv.id} className="border-border hover:bg-surface-2/60 transition-colors">
                      {/* Name & ID */}
                      <TableCell className="font-medium text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                              srv.health === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'
                            }`}
                            title={`Health: ${srv.health || 'untested'}`}
                          />
                          <div>
                            <div className="font-semibold flex items-center gap-1.5">
                              <span>{srv.name}</span>
                              {srv.is_default && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 text-brand-primary border-brand-primary/30">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted font-mono">{srv.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Ownership Model Badge */}
                      <TableCell>
                        {isPlatformManaged ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/25">
                              <ShieldCheck size={11} /> Platform-Assigned
                            </span>
                            <div className="text-[10px] text-muted">Bought & managed by us</div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">
                              <Building2 size={11} /> Studio-Owned (BYO)
                            </span>
                            <div className="text-[10px] text-muted">Bought by studio</div>
                          </div>
                        )}
                      </TableCell>

                      {/* Backend Provider */}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                        >
                          {srv.backend}
                        </Badge>
                      </TableCell>

                      {/* Studio Allocation */}
                      <TableCell>
                        {srv.studio ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <Building2 size={13} className="text-brand-primary shrink-0" />
                            <span>{srv.studio.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">Available in Fleet</span>
                        )}
                      </TableCell>

                      {/* Details & Credentials Column (Full for Platform, Basic for Studio-Owned) */}
                      <TableCell className="text-xs">
                        {isPlatformManaged ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 flex items-center gap-1 font-semibold"
                                onClick={() => openCredentialsModal(srv)}
                              >
                                <KeyRound size={11} />
                                View Credentials
                              </Button>
                              {srv.credentials?.bucket && (
                                <span className="text-[10px] font-mono text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border truncate max-w-[120px]" title={srv.credentials.bucket}>
                                  {srv.credentials.bucket}
                                </span>
                              )}
                            </div>
                            {srv.credentials?.endpoint && (
                              <div className="text-[10px] font-mono text-muted truncate max-w-[190px]" title={srv.credentials.endpoint}>
                                🌐 {srv.credentials.endpoint}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Studio-Owned: Show basic details only (no credentials exposed)
                          <div className="space-y-0.5 text-muted">
                            <div className="text-[11px] font-medium text-foreground flex items-center gap-1">
                              <span>Basic Reference Only</span>
                            </div>
                            {srv.credentials?.endpoint ? (
                              <div className="text-[10px] font-mono truncate max-w-[180px]" title={srv.credentials.endpoint}>
                                Endpoint: {srv.credentials.endpoint}
                              </div>
                            ) : (
                              <div className="text-[10px] italic">Endpoint: Studio configured</div>
                            )}
                            {srv.credentials?.bucket && (
                              <div className="text-[10px] font-mono truncate max-w-[180px]" title={srv.credentials.bucket}>
                                Bucket: {srv.credentials.bucket}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Platform Cost & Renewal Column */}
                      <TableCell className="text-xs">
                        {isPlatformManaged ? (
                          srv.platform_monthly_cost ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-foreground">
                                ₹{Number(srv.platform_monthly_cost).toLocaleString()}
                                <span className="text-[10px] text-muted font-normal">/{srv.platform_renewal_period || 'mo'}</span>
                              </div>
                              {srv.platform_renewal_date && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted">
                                    {new Date(srv.platform_renewal_date).toLocaleDateString()}
                                  </span>
                                  {(() => {
                                    const diffDays = Math.ceil((new Date(srv.platform_renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
                                    if (diffDays >= 0 && diffDays <= 7) {
                                      return (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                          Renews Soon
                                        </span>
                                      );
                                    }
                                    if (diffDays < 0) {
                                      return (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                          Expired
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                              {srv.platform_capacity_gb && (
                                <div className="text-[10px] text-muted">
                                  Capacity: {srv.platform_capacity_gb} GB
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted text-[11px] italic">Cost not set</span>
                          )
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-muted font-medium">Studio-Paid</span>
                            <div className="text-[10px] text-muted italic">No platform billing</div>
                          </div>
                        )}
                      </TableCell>

                      {/* Stored Media */}
                      <TableCell className="text-xs text-muted font-medium">
                        {srv._count?.assets || 0} assets · {srv._count?.cameras || 0} cameras
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                            title="Edit server configuration"
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: View Credentials (Platform-Managed Servers) */}
      <Modal
        open={credentialsModal}
        onOpenChange={setCredentialsModal}
        title={
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-purple-600" />
            <span>Platform Server Credentials & Access Keys</span>
          </div>
        }
        description="Encrypted credentials and connection keys for platform-provisioned storage nodes assigned to studio tenants."
      >
        {activeCredsServer && (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  {activeCredsServer.name}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {activeCredsServer.backend}
                </Badge>
              </div>
              <p className="text-[11px] text-muted">
                Assigned to: <strong className="text-foreground">{activeCredsServer.studio?.name || 'Unassigned'}</strong>
              </p>
            </div>

            <div className="space-y-3 bg-surface-2 p-3.5 rounded-xl border border-border">
              {/* Endpoint */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                  Endpoint / Host URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={activeCredsServer.credentials?.endpoint || 'Standard AWS S3 / Direct'}
                    className="flex-1 text-xs font-mono bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  />
                  {activeCredsServer.credentials?.endpoint && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs shrink-0"
                      onClick={() => handleCopy(activeCredsServer.credentials?.endpoint, 'Endpoint')}
                    >
                      {copiedKey === 'Endpoint' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Bucket */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                  Bucket Name / Root Path
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={activeCredsServer.credentials?.bucket || 'Default bucket'}
                    className="flex-1 text-xs font-mono bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  />
                  {activeCredsServer.credentials?.bucket && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs shrink-0"
                      onClick={() => handleCopy(activeCredsServer.credentials?.bucket, 'Bucket')}
                    >
                      {copiedKey === 'Bucket' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Region */}
              {activeCredsServer.credentials?.region && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Region
                  </label>
                  <input
                    readOnly
                    value={activeCredsServer.credentials?.region}
                    className="w-full text-xs font-mono bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  />
                </div>
              )}

              {/* Access Key / Username */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                  Access Key ID / Username
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={activeCredsServer.credentials?.accessKey || 'None configured'}
                    className="flex-1 text-xs font-mono bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  />
                  {activeCredsServer.credentials?.accessKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs shrink-0"
                      onClick={() => handleCopy(activeCredsServer.credentials?.accessKey, 'Access Key')}
                    >
                      {copiedKey === 'Access Key' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Secret Key / Password with Reveal Toggle */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Secret Access Key / Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="text-[11px] text-brand-primary hover:underline flex items-center gap-1"
                  >
                    {showSecretKey ? (
                      <>
                        <EyeOff size={12} /> Hide Secret
                      </>
                    ) : (
                      <>
                        <Eye size={12} /> Reveal Secret
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type={showSecretKey ? 'text' : 'password'}
                    value={activeCredsServer.credentials?.secretKey || '••••••••••••••••'}
                    className="flex-1 text-xs font-mono bg-surface-1 border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                  />
                  {activeCredsServer.credentials?.secretKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs shrink-0"
                      onClick={() => handleCopy(activeCredsServer.credentials?.secretKey, 'Secret Key')}
                    >
                      {copiedKey === 'Secret Key' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Host / Vendor Notes */}
              {activeCredsServer.platform_notes && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[11px] font-semibold text-muted block mb-1">Internal Vendor / Account Notes</span>
                  <p className="text-xs bg-surface-1 p-2 rounded-lg border border-border text-foreground">
                    {activeCredsServer.platform_notes}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions pt-2">
              <Button onClick={() => setCredentialsModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

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
        description="Provision a platform server with full credentials or register a studio-bought server with basic details."
      >
        <form onSubmit={handleCreateServer} className="space-y-4 pt-1">
          {/* Dynamic Ownership Switcher */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Server Ownership & Origin *
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-2 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setProviderType('platform')}
                className={`flex flex-col items-start p-2.5 rounded-lg text-left transition-all ${
                  providerType === 'platform'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <KeyRound size={13} />
                  <span>1. Platform-Assigned</span>
                </div>
                <span className={`text-[10px] mt-0.5 ${providerType === 'platform' ? 'text-purple-100' : 'text-muted'}`}>
                  We bought & manage credentials
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProviderType('studio_owned')}
                className={`flex flex-col items-start p-2.5 rounded-lg text-left transition-all ${
                  providerType === 'studio_owned'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Building2 size={13} />
                  <span>2. Studio-Owned (BYO)</span>
                </div>
                <span className={`text-[10px] mt-0.5 ${providerType === 'studio_owned' ? 'text-emerald-100' : 'text-muted'}`}>
                  Studio bought own server
                </span>
              </button>
            </div>
          </div>

          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">Server Friendly Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Wasabi EU Production Cluster"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">Storage Provider Type *</label>
              <Select
                value={backend}
                onChange={(e) => setBackend(e.target.value)}
                searchable={false}
                options={[
                  { value: 's3', label: 'AWS S3' },
                  { value: 'wasabi', label: 'Wasabi Hot Cloud Storage' },
                  { value: 'minio', label: 'MinIO Self-Hosted S3' },
                  { value: 'sftp', label: 'Dedicated SFTP Node' },
                  { value: 'ftp', label: 'FTP Storage Server' },
                ]}
              />
            </div>
          </div>

          {/* Assigned Studio Tenant */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">Assign to Studio Tenant *</label>
            <Select
              value={targetStudioId}
              onChange={(e) => setTargetStudioId(e.target.value)}
              placeholder="Select Studio..."
              searchable={studios.length >= 7}
              options={studios.map((s) => ({
                value: s.id,
                label: `🏢 ${s.name} (${s.id.slice(0, 8)})`,
              }))}
            />
          </div>

          {/* Connection Details Section */}
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                {providerType === 'platform' ? 'Platform Credentials & Connection' : 'Basic Connection Details'}
              </p>
              <span className="text-[10px] text-muted">
                {providerType === 'platform' ? 'Full credentials saved & decrypted for admin' : 'Basic endpoint & bucket only'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground block">Endpoint / Host URL</label>
                <input
                  type="text"
                  placeholder="e.g. s3.eu-central-1.wasabisys.com"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground block">Bucket Name / Root Path</label>
                <input
                  type="text"
                  placeholder="e.g. studio-assets-vault"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground block">Region</label>
                <input
                  type="text"
                  placeholder="e.g. us-east-1"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
                />
              </div>

              {providerType === 'platform' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">Access Key ID *</label>
                    <input
                      type="text"
                      placeholder="API Key or Username"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">Secret Key / Password *</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center p-2 rounded-lg bg-surface-2 border border-border text-[11px] text-muted">
                  <Info size={14} className="mr-1.5 shrink-0 text-emerald-500" />
                  <span>Studio-owned servers do not expose superadmin credentials. Connection keys are managed directly by the studio.</span>
                </div>
              )}
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

          {/* Platform Cost & Renewal Section (Only for platform-bought servers) */}
          {providerType === 'platform' ? (
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Platform Cost & Renewal (Super Admin Only)
                </p>
                <span className="text-[10px] text-purple-600 font-medium">Platform-Managed Node</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Monthly Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1500"
                    value={platformMonthlyCost}
                    onChange={(e) => setPlatformMonthlyCost(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Renewal Cycle</label>
                  <Select
                    value={platformRenewalPeriod}
                    onChange={(e) => setPlatformRenewalPeriod(e.target.value)}
                    searchable={false}
                    options={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly' },
                      { value: 'yearly', label: 'Yearly' },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Next Renewal Date</label>
                  <input
                    type="date"
                    value={platformRenewalDate}
                    onChange={(e) => setPlatformRenewalDate(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Disk Size / Allocation (GB)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={platformCapacityGb}
                    onChange={(e) => setPlatformCapacityGb(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Internal Vendor / Host Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Hetzner VPS #4829 or Wasabi sub-account"
                    value={platformNotes}
                    onChange={(e) => setPlatformNotes(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-border pt-3">
              <div className="p-3 bg-surface-2 border border-border rounded-xl flex items-center gap-2 text-xs text-muted">
                <Info size={15} className="text-emerald-600 shrink-0" />
                <span>
                  Studio-Owned Storage: Platform renewal costs and billing cycles do not apply as this node was purchased directly by the studio.
                </span>
              </div>
            </div>
          )}

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
        description="Update server configuration, ownership model, credentials, or reassign to a different studio tenant."
      >
        <form onSubmit={handleUpdateServer} className="space-y-4 pt-1">
          {/* Ownership Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Server Ownership Model *
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-2 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setEditProviderType('platform')}
                className={`flex flex-col items-start p-2 rounded-lg text-left transition-all ${
                  editProviderType === 'platform'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <KeyRound size={13} />
                  <span>Platform-Assigned</span>
                </div>
                <span className={`text-[10px] ${editProviderType === 'platform' ? 'text-purple-100' : 'text-muted'}`}>
                  Full credentials & costs
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEditProviderType('studio_owned')}
                className={`flex flex-col items-start p-2 rounded-lg text-left transition-all ${
                  editProviderType === 'studio_owned'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Building2 size={13} />
                  <span>Studio-Owned (BYO)</span>
                </div>
                <span className={`text-[10px] ${editProviderType === 'studio_owned' ? 'text-emerald-100' : 'text-muted'}`}>
                  Basic details only
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">Server Friendly Name *</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">Provider Backend *</label>
              <Select
                value={editBackend}
                onChange={(e) => setEditBackend(e.target.value)}
                searchable={false}
                options={[
                  { value: 's3', label: 'AWS S3' },
                  { value: 'wasabi', label: 'Wasabi Hot Cloud Storage' },
                  { value: 'minio', label: 'MinIO Self-Hosted S3' },
                  { value: 'sftp', label: 'Dedicated SFTP Node' },
                  { value: 'ftp', label: 'FTP Storage Server' },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">Assigned Studio Tenant</label>
            <Select
              value={editStudioId}
              onChange={(e) => setEditStudioId(e.target.value)}
              searchable={studios.length >= 7}
              options={studios.map((s) => ({
                value: s.id,
                label: `🏢 ${s.name} (${s.id.slice(0, 8)})`,
              }))}
            />
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">
              {editProviderType === 'platform' ? 'Update Credentials (Optional)' : 'Connection Details'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground block">Endpoint / Host URL</label>
                <input
                  type="text"
                  placeholder="New Endpoint (leave blank to keep)"
                  value={editEndpoint}
                  onChange={(e) => setEditEndpoint(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground block">Bucket Name / Root Path</label>
                <input
                  type="text"
                  placeholder="New Bucket Name"
                  value={editBucket}
                  onChange={(e) => setEditBucket(e.target.value)}
                  className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                />
              </div>
            </div>

            {editProviderType === 'platform' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">New Access Key</label>
                  <input
                    type="text"
                    placeholder="Leave blank to keep current"
                    value={editAccessKey}
                    onChange={(e) => setEditAccessKey(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">New Secret Key</label>
                  <input
                    type="password"
                    placeholder="•••••••••••• (leave blank to keep)"
                    value={editSecretKey}
                    onChange={(e) => setEditSecretKey(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                  />
                </div>
              </div>
            ) : null}

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

          {editProviderType === 'platform' ? (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Platform Cost & Renewal (Super Admin Only)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Monthly Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1500"
                    value={editPlatformMonthlyCost}
                    onChange={(e) => setEditPlatformMonthlyCost(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Renewal Cycle</label>
                  <Select
                    value={editPlatformRenewalPeriod}
                    onChange={(e) => setEditPlatformRenewalPeriod(e.target.value)}
                    searchable={false}
                    options={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly' },
                      { value: 'yearly', label: 'Yearly' },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Next Renewal Date</label>
                  <input
                    type="date"
                    value={editPlatformRenewalDate}
                    onChange={(e) => setEditPlatformRenewalDate(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Disk Size / Allocation (GB)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={editPlatformCapacityGb}
                    onChange={(e) => setEditPlatformCapacityGb(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground block">Internal Vendor / Host Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Hetzner VPS #4829 or Wasabi sub-account"
                    value={editPlatformNotes}
                    onChange={(e) => setEditPlatformNotes(e.target.value)}
                    className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
                  />
                </div>
              </div>
            </div>
          ) : null}

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
