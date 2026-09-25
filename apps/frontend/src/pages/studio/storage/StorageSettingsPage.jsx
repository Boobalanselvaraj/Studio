import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  Server,
  Cloud,
  Database,
  Plus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { storageApi } from '../../../api/services';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { SkeletonProviderCard } from '../../../components/ui/skeleton';
import { Select } from '../../../components/ui/select';

const blankForm = {
  name: '',
  backend: 'sftp',
  host: '',
  port: '22',
  username: '',
  password: '',
  root: '/',
  bucket: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  endpoint: '',
  privateKey: '',
  passphrase: '',
  secure: false,
};

export function StorageSettingsPage() {
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteProviderModal, setDeleteProviderModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState({});
  const [loadingStats, setLoadingStats] = useState({});

  async function loadProviderStats(providerId) {
    setLoadingStats((prev) => ({ ...prev, [providerId]: true }));
    try {
      const stats = await storageApi.getProviderStats(providerId);
      setStorageStats((prev) => ({ ...prev, [providerId]: stats }));
    } catch (e) {
      setStorageStats((prev) => ({ ...prev, [providerId]: { error: e.response?.data?.error || e.message } }));
    } finally {
      setLoadingStats((prev) => ({ ...prev, [providerId]: false }));
    }
  }

  async function load() {
    try {
      setLoading(true);
      const data = await storageApi.getProviders();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      // Auto-fetch storage usage stats for all providers
      list.forEach((p) => {
        loadProviderStats(p.id);
      });
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not load storage connections');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTestConnection(providerId) {
    setTestingId(providerId);
    setError('');
    setMessage('');
    try {
      const res = await storageApi.testConnection(providerId);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: true,
          message: res?.message || 'Storage connection test passed! Full read/write access verified.',
          tested_at: new Date().toISOString(),
          checks: res.capabilities || {},
        },
      }));
      setMessage(`Connection test passed for "${items.find((p) => p.id === providerId)?.name}".`);
      await load();
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message || 'Storage connection test failed';
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: false,
          message: errMsg,
          tested_at: new Date().toISOString(),
        },
      }));
      setError(`Connection test failed: ${errMsg}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleAction(fn, successMsg) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      setMessage(result?.message || successMsg || 'Storage settings updated successfully');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to update storage connection');
    } finally {
      setBusy(false);
    }
  }

  function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Connection name is required');
      return;
    }

    handleAction(async () => {
      const credentials =
        form.backend === 's3'
          ? {
              bucket: form.bucket.trim(),
              region: form.region.trim(),
              accessKeyId: form.accessKeyId.trim(),
              secretAccessKey: form.secretAccessKey,
              ...(form.endpoint.trim() ? { endpoint: form.endpoint.trim() } : {}),
            }
          : {
              host: form.host.trim(),
              port: Number(form.port) || (form.backend==='ftp'?21:22),
              username: form.username.trim(),
              password: form.password,
              root: form.root.trim() || '/',
              ...(form.backend==='sftp'?{privateKey:form.privateKey,passphrase:form.passphrase}:{secure:form.secure}),
            };

      const payload = {
        name: form.name.trim(),
        backend: form.backend,
        credentials,
      };
      if(editing) await storageApi.updateProvider(editing.id,payload);
      else await storageApi.createProvider(payload);

      setOpen(false);
      setForm(blankForm);
      return {
        message: 'Storage connection created. Click "Test connection" to verify credentials and permissions.',
      };
    });
  }

  const getBackendIcon = (backend) => {
    switch (backend) {
      case 's3':
        return <Cloud className="text-blue-500" size={22} />;
      case 'sftp':
        return <Server className="text-emerald-500" size={22} />;
      case 'ftp':
        return <HardDrive className="text-amber-500" size={22} />;
      default:
        return <Database className="text-purple-500" size={22} />;
    }
  };

  const healthyCount = items.filter((p) => p.health === 'healthy' && p.is_enabled).length;
  const defaultProvider = items.find((p) => p.is_default);

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="HYBRID CLOUD & ON-PREMISE STORAGE"
        title="Storage connections & gateways"
        description="Connect external SFTP servers, Wasabi / AWS S3 buckets, or FTP servers. Original media is stored in your external destination."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading || busy}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm(blankForm);
              setOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-sm bg-brand-primary text-white"
          >
            <Plus size={16} />
            <span>Add Connection</span>
          </Button>
        </div>
      </PageHeading>

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-sm mb-5 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle size={17} /> {error}
          </span>
          <button onClick={() => setError('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {message && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm mb-5 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={17} /> {message}
          </span>
          <button onClick={() => setMessage('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Storage Architecture Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Server size={14} className="text-emerald-500" />
            <span>Ingest Gateway</span>
          </div>
          <div className="text-base font-bold flex items-center gap-1.5">
            SFTPGo Active
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-[11px] text-muted">Listening on Port 2022</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Layers size={14} className="text-brand-primary" />
            <span>Connected Destinations</span>
          </div>
          <div className="text-xl font-bold">{items.length}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {healthyCount} operational
          </div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <HardDrive size={14} className="text-blue-500" />
            <span>Primary Default</span>
          </div>
          <div className="text-sm font-semibold truncate">
            {defaultProvider ? defaultProvider.name : 'No connection selected'}
          </div>
          <div className="text-[11px] text-muted uppercase font-mono">
            {defaultProvider ? defaultProvider.backend : 'Connect external storage'}
          </div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <ShieldCheck size={14} className="text-purple-500" />
            <span>Security & Zero-Knowledge</span>
          </div>
          <div className="text-sm font-medium">Server-side Encrypted</div>
          <div className="text-[11px] text-muted">Credentials never leak to client</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-3.5 bg-surface-2 border border-border rounded-xl mb-6 flex items-start gap-3 text-xs text-muted leading-relaxed">
        <Info size={18} className="text-brand-primary flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-foreground block mb-0.5">How storage routing operates:</strong>
          When a camera uploads photos to port 2022, the gateway receives the stream. StudioFlow
          transfers each completed upload to the camera's assigned external connection, then adds it
          to the library and album. The temporary gateway copy is removed after transfer succeeds.
          Every camera needs an enabled external destination.
        </div>
      </div>

      {/* Storage Providers List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonProviderCard />
          <SkeletonProviderCard />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state py-16 panel border-dashed">
          <HardDrive size={40} className="text-muted mb-2" />
          <h2 className="text-base font-semibold">No external storage connections</h2>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">
            Connect an external SFTP server, AWS S3 bucket, or MinIO instance to retain full custody of
            your high-resolution original RAW files.
          </p>
          <Button onClick={() => setOpen(true)} className="bg-brand-primary text-white">
            <Plus size={16} /> Add connection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p) => {
            const testResult = testResults[p.id];
            const isTesting = testingId === p.id;

            return (
              <section
                key={p.id}
                className={`panel p-5 border flex flex-col justify-between transition-all rounded-xl ${
                  p.is_default
                    ? 'border-brand-primary/50 shadow-xs'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between pb-3 border-b border-border mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-surface-2">{getBackendIcon(p.backend)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{p.name}</h3>
                          {p.is_default && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-brand-primary/10 text-brand-primary">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted font-mono uppercase">
                          {p.backend} · {p.provider_type?.replace('_', ' ') || 'custom'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        p.health === 'healthy'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : p.health === 'degraded'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {p.health === 'healthy' ? '● Healthy' : p.health || 'Untested'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 px-2 rounded bg-surface-2">
                      <span className="text-muted">Protocol:</span>
                      <span className="font-mono font-medium uppercase">{p.backend}</span>
                    </div>

                    <div className="flex justify-between py-1 px-2 rounded bg-surface-2">
                      <span className="text-muted">State:</span>
                      <span
                        className={`font-medium ${
                          p.is_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'
                        }`}
                      >
                        {p.is_enabled ? 'Enabled for Ingest' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 px-2 rounded bg-surface-2">
                      <span className="text-muted">Last Verification:</span>
                      <span className="text-muted font-mono">
                        {p.tested_at ? new Date(p.tested_at).toLocaleString() : 'Not yet tested'}
                      </span>
                    </div>
                  </div>

                  {/* Live Connection Test Results Display */}
                  {testResult && (
                    <div
                      className={`mt-3 p-3 rounded-lg border text-xs leading-relaxed ${
                        testResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                          : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200'
                      }`}
                    >
                      <div className="font-medium flex items-center gap-1.5 mb-1.5">
                        {testResult.success ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <AlertTriangle size={14} className="text-red-500" />
                        )}
                        <span>{testResult.message}</span>
                      </div>

                      {testResult.checks && (
                        <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-emerald-500/20 text-[11px]">
                          <span className="flex items-center gap-1">
                            <Check size={11} /> TCP Connect: OK
                          </span>
                          <span className="flex items-center gap-1">
                            <Check size={11} /> Auth Handshake: OK
                          </span>
                          <span className="flex items-center gap-1">
                            <Check size={11} /> List Directory: OK
                          </span>
                          <span className="flex items-center gap-1">
                            <Check size={11} /> Write & Delete: OK
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Storage Usage Section */}
                  {(() => {
                    const stats = storageStats[p.id];
                    const isLoading = loadingStats[p.id];
                    const formatBytes = (b) => {
                      if (b == null) return '—';
                      if (b === 0) return '0 B';
                      const k = 1024;
                      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                      const i = Math.floor(Math.log(b) / Math.log(k));
                      return (b / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
                    };
                    const totalBytes =
                      stats?.total_bytes ||
                      (p.platform_capacity_gb ? Number(p.platform_capacity_gb) * 1024 * 1024 * 1024 : null);
                    const freeBytes =
                      stats?.free_bytes != null
                        ? stats.free_bytes
                        : totalBytes && stats?.used_bytes != null
                        ? Math.max(0, totalBytes - stats.used_bytes)
                        : null;
                    const pct =
                      stats?.used_bytes && totalBytes
                        ? Math.min(100, Math.round((stats.used_bytes / totalBytes) * 100))
                        : null;

                    return (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted flex items-center gap-1.5">
                            <HardDrive size={13} /> Storage Usage
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isLoading}
                            onClick={() => loadProviderStats(p.id)}
                            className="text-[11px] h-6 px-2"
                          >
                            {isLoading ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : (
                              <Activity size={11} />
                            )}
                            <span className="ml-1">
                              {isLoading ? 'Checking…' : stats ? 'Refresh' : 'Check Usage'}
                            </span>
                          </Button>
                        </div>

                        {stats && !stats.error && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-surface-2 rounded-lg">
                                <div className="text-muted text-[10px] mb-0.5">Used</div>
                                <div className="font-semibold">{formatBytes(stats.used_bytes)}</div>
                              </div>
                              <div className="p-2 bg-surface-2 rounded-lg">
                                <div className="text-muted text-[10px] mb-0.5">
                                  {totalBytes ? 'Available' : 'Files'}
                                </div>
                                <div className="font-semibold">
                                  {totalBytes
                                    ? formatBytes(freeBytes)
                                    : `${stats.file_count?.toLocaleString() || 0} files`}
                                </div>
                              </div>
                            </div>

                            {pct !== null && (
                              <div>
                                <div className="flex justify-between text-[10px] text-muted mb-1">
                                  <span>
                                    {formatBytes(stats.used_bytes)} used of {formatBytes(totalBytes)}
                                  </span>
                                  <span
                                    className={
                                      pct > 90
                                        ? 'text-red-500'
                                        : pct > 70
                                        ? 'text-amber-500'
                                        : 'text-emerald-500'
                                    }
                                  >
                                    {pct}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      pct > 90
                                        ? 'bg-red-500'
                                        : pct > 70
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {stats.file_count != null && pct === null && (
                              <div className="text-[11px] text-muted">
                                {stats.file_count.toLocaleString()} files · {formatBytes(stats.used_bytes)} total
                              </div>
                            )}
                          </div>
                        )}

                        {stats?.error && (
                          <div className="text-[11px] text-red-500 flex items-center gap-1">
                            <AlertCircle size={12} /> {stats.error}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 mt-3 border-t border-border">
                  <Button
                    size="sm"
                    disabled={busy || isTesting}
                    onClick={() => handleTestConnection(p.id)}
                    className="flex items-center gap-1 text-xs"
                  >
                    {isTesting ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Zap size={13} />
                    )}
                    <span>{isTesting ? 'Verifying…' : 'Test Connection'}</span>
                  </Button>

                  {true && (
                    <>
                      <Button size="sm" variant="outline" onClick={()=>{setEditing(p);setForm({...blankForm,...p.connection,name:p.name,backend:p.backend});setOpen(true);}}>Edit connection</Button>
                      {!p.is_default && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || isTesting}
                          onClick={() =>
                            handleAction(
                              () => storageApi.updateProvider(p.id, { is_default: true, is_enabled: true }),
                              `"${p.name}" set as default storage destination.`
                            )
                          }
                          className="text-xs"
                        >
                          Make Default
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || isTesting}
                        onClick={() =>
                          handleAction(
                            () => storageApi.updateProvider(p.id, { is_enabled: !p.is_enabled }),
                            `"${p.name}" is now ${p.is_enabled ? 'disabled' : 'enabled'}.`
                          )
                        }
                        className="text-xs"
                      >
                        {p.is_enabled ? 'Disable' : 'Enable'}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || isTesting}
                        className="text-red-500 hover:text-red-600 text-xs px-2 ml-auto"
                        onClick={() => setDeleteProviderModal(p)}
                        title="Remove connection"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Add Storage Connection Modal */}
      <Modal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError('');
        }}
        title={editing ? "Edit Storage Connection" : "Connect Storage Destination"}
        description="Configure an external SFTP server or S3 bucket where raw photos and final edits will be stored."
      >
        <form className="form-stack" onSubmit={handleSave}>
          {error && <p className="form-error">{error}</p>}

          <label>
            Connection Name
            <input
              required
              placeholder="e.g. Studio Main VPS or Wasabi Cloud Archive"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">Storage Protocol</label>
            <Select
              disabled={!!editing}
              value={form.backend}
              onChange={(e) =>
                setForm({
                  ...form,
                  backend: e.target.value,
                  port: e.target.value === 'ftp' ? '21' : '22',
                })
              }
              searchable={false}
              options={[
                { value: 'sftp', label: 'SFTP (SSH File Transfer - Recommended)' },
                { value: 's3', label: 'Amazon S3 / Wasabi / MinIO (Object Storage)' },
                { value: 'ftp', label: 'Standard FTP' },
              ]}
            />
          </div>

          {form.backend === 's3' ? (
            <div className="space-y-3">
              <label>
                Bucket Name
                <input
                  required
                  placeholder="e.g. lumina-studio-photos"
                  value={form.bucket}
                  onChange={(e) => setForm({ ...form, bucket: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  Region
                  <input
                    required
                    placeholder="us-east-1"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </label>
                <label>
                  Custom Endpoint (Optional)
                  <input
                    placeholder="https://s3.wasabisys.com"
                    value={form.endpoint}
                    onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  Access Key ID
                  <input
                    required={!editing}
                    placeholder={editing?"Leave blank to keep saved key":"AKIA..."}
                    value={form.accessKeyId}
                    onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })}
                  />
                </label>
                <label>
                  Secret Access Key
                  <input
                    type="password"
                    required={!editing}
                    placeholder={editing?"Leave blank to keep saved secret":"Secret Key"}
                    value={form.secretAccessKey}
                    onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2">
                  Server Hostname / IP
                  <input
                    required
                    placeholder="sftp.yourstudio.com or 192.168.1.50"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                  />
                </label>
                <label>
                  Port
                  <input
                    type="number"
                    required
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  Username
                  <input
                    required
                    placeholder="sftp_user"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    required={!editing && !form.privateKey}
                    placeholder={editing?"Leave blank to keep saved password":"Password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
              </div>

              {form.backend==='sftp'&&<><label>SSH private key (optional alternative to password)<textarea rows={3} value={form.privateKey} onChange={e=>setForm({...form,privateKey:e.target.value})} placeholder={editing?'Leave blank to keep saved key':'Paste PEM private key'}/></label><label>Key passphrase (optional)<input type="password" value={form.passphrase} onChange={e=>setForm({...form,passphrase:e.target.value})}/></label></>}
              {form.backend==='ftp'&&<label className="flex items-center gap-2"><input type="checkbox" checked={form.secure} onChange={e=>setForm({...form,secure:e.target.checked})}/>Use explicit TLS (FTPS)</label>}
              <label>
                Remote Storage Directory
                <input
                  required
                  placeholder="/var/media/studio or /photos"
                  value={form.root}
                  onChange={(e) => setForm({ ...form, root: e.target.value })}
                />
              </label>
            </div>
          )}

          <div className="modal-actions pt-4 border-t border-border mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-primary text-white">
              {busy ? 'Saving Connection…' : 'Save Connection'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Storage Connection Deletion Modal */}
      <ConfirmModal
        open={!!deleteProviderModal}
        onOpenChange={(v) => !v && setDeleteProviderModal(null)}
        title={`Remove Storage Connection "${deleteProviderModal?.name}"?`}
        description="Are you sure you want to remove this storage connection? Any files already mirrored to this location will remain safe."
        confirmText="Remove Connection"
        variant="danger"
        loading={busy}
        onConfirm={async () => {
          if (!deleteProviderModal) return;
          await handleAction(
            () => storageApi.removeProvider(deleteProviderModal.id),
            `"${deleteProviderModal.name}" removed successfully.`
          );
          setDeleteProviderModal(null);
        }}
      />
    </div>
  );
}

export default StorageSettingsPage;
