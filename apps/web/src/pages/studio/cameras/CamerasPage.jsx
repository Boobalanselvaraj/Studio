import React, { useState, useEffect } from 'react';
import {
  Camera,
  Plus,
  Copy,
  Check,
  Cable,
  Radio,
  Loader2,
  HardDrive,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { camerasApi, storageApi, billingApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function CamerasPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [cameras, setCameras] = useState([]);
  const [providers, setProviders] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [cams, provs, usg] = await Promise.allSettled([
        camerasApi.list(),
        storageApi.getProviders(),
        billingApi.getUsage(),
      ]);

      if (cams.status === 'fulfilled' && Array.isArray(cams.value)) {
        setCameras(cams.value);
      }
      if (provs.status === 'fulfilled' && Array.isArray(provs.value)) {
        setProviders(provs.value);
        if (provs.value.length > 0 && !formDestination) {
          const def = provs.value.find((p) => p.is_default) || provs.value[0];
          setFormDestination(def.id);
        }
      }
      if (usg.status === 'fulfilled' && usg.value) {
        setUsage(usg.value);
      }
    } catch (err) {
      console.warn('Cameras load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStudio?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      setError('Please fill in camera name, upload username, and password.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await camerasApi.create({
        name: formName.trim(),
        model: formModel.trim() || undefined,
        storage_provider_id: formDestination || undefined,
        upload_username: formUsername.trim(),
        upload_password: formPassword.trim(),
      });

      setFormName('');
      setFormModel('');
      setFormUsername('');
      setFormPassword('');
      setOpenModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create camera sync profile');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (camera) => {
    try {
      setCameras((prev) =>
        prev.map((c) =>
          c.id === camera.id ? { ...c, is_active: !camera.is_active } : c
        )
      );
      await camerasApi.toggleStatus(camera.id, !camera.is_active);
      loadData();
    } catch (err) {
      console.error('Failed to toggle camera status:', err);
      loadData();
    }
  };

  const handleRetire = async (camera) => {
    if (!window.confirm(`Retire camera '${camera.name}'? This will free its quota slot permanently while keeping all historical photos safe.`)) {
      return;
    }
    try {
      await camerasApi.retire(camera.id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to retire camera');
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const cameraLimit = usage?.cameras?.limit ?? 5;
  const reservedSlots = usage?.cameras?.reserved ?? cameras.filter((c) => c.lifecycle !== 'retired').length;
  const remainingSlots = Math.max(0, cameraLimit - reservedSlots);

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="FROM CAMERA TO COLLECTION"
        title="Cameras & sync"
        description="A smooth handoff from capturing the moment to creating the final story."
      >
        <Button onClick={() => setOpenModal(true)} disabled={remainingSlots <= 0}>
          <Plus size={16} />
          Add camera
        </Button>
      </PageHeading>

      {/* Camera Quota and Sync Banner */}
      <div className="sync-banner flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="sync-icon">
            <Cable size={24} />
          </span>
          <div>
            <h2>Less transferring. More creating.</h2>
            <p>
              Connect your tethered cameras and memory card uploads straight into your studio media pipeline.
            </p>
          </div>
        </div>

        {/* Allocation Slot Pill */}
        <div className="bg-surface-1 border border-border px-3.5 py-2 rounded-lg text-right">
          <div className="text-xs text-muted">Allocated Slots</div>
          <div className="text-sm font-semibold">
            {reservedSlots} / {cameraLimit} Used
            <span className="text-xs font-normal text-muted ml-1.5">
              ({remainingSlots} available)
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading cameras…</span>
        </div>
      ) : cameras.length === 0 ? (
        <div className="empty-state py-16">
          <Camera size={40} className="text-muted mb-2" />
          <h2>No cameras connected</h2>
          <p className="text-sm text-muted mb-4">
            Provision your first studio camera profile to begin automatic ingest.
          </p>
          <Button onClick={() => setOpenModal(true)} disabled={remainingSlots <= 0}>
            <Plus size={16} /> Add camera
          </Button>
        </div>
      ) : (
        <div className="camera-grid">
          {cameras.map((d) => (
            <section
              className={`panel camera-card ${
                d.lifecycle === 'retired' ? 'opacity-60 bg-surface-2' : ''
              }`}
              key={d.id}
            >
              <div className="camera-illustration">
                <Camera size={64} strokeWidth={1} />
              </div>
              <div className="camera-card-content">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{d.model || 'STUDIO CAMERA'}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${
                      d.lifecycle === 'ready'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                        : d.lifecycle === 'retired'
                        ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {d.lifecycle}
                  </span>
                </div>

                <h2>{d.name}</h2>
                <p>Username: <code>{d.upload_username || d.sftpgo_username}</code></p>
                {d.storage_provider && (
                  <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    <HardDrive size={12} />
                    <span>{d.storage_provider.name} ({d.storage_provider.backend.toUpperCase()})</span>
                  </p>
                )}

                <div
                  className={`camera-state mt-2 ${
                    d.is_active ? 'text-green-600' : 'text-muted'
                  }`}
                >
                  <Radio size={14} className={d.is_active ? 'animate-pulse' : ''} />
                  {d.is_active ? 'Live Ingest Active' : 'Ingest Inactive'}
                </div>

                {d.lifecycle !== 'retired' ? (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelected(d)}
                    >
                      Connection details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(d)}
                      title={d.is_active ? 'Deactivate sync' : 'Activate sync'}
                    >
                      {d.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleRetire(d)}
                      title="Retire camera and release quota slot"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-muted">
                    Slot released on {new Date(d.retired_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      <Modal
        open={openModal}
        onOpenChange={(v) => {
          setOpenModal(v);
          if (!v) setError('');
        }}
        title="Provision a new camera"
        description="Creates an upload profile for Wi-Fi transmitters, CamRanger, FTP, or memory card sync."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          {error && <p className="form-error">{error}</p>}
          <label>
            Camera name
            <input
              required
              maxLength={80}
              placeholder="e.g. Studio Sony A7 IV - Primary"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </label>
          <label>
            Camera model / identifier
            <input
              maxLength={80}
              placeholder="e.g. Sony ILCE-7M4 / Canon EOS R5"
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
            />
          </label>
          <label>
            Storage Destination
            <Select
              value={formDestination}
              onChange={(e) => setFormDestination(e.target.value)}
              placeholder="Select destination storage connection…"
              searchable={true}
              options={providers.map((p) => ({
                value: p.id,
                label: p.name,
                description: `${p.backend.toUpperCase()} · ${p.provider_type.replace('_', ' ')}`,
                badge: p.backend === 's3' ? 'pill-blue' : p.backend === 'sftp' ? 'pill-emerald' : 'pill-amber',
              }))}
            />
          </label>
          <label>
            Upload Username
            <input
              required
              maxLength={60}
              placeholder="e.g. cam_studio_01"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
            />
          </label>
          <label>
            Upload Password
            <input
              type="password"
              required
              minLength={6}
              placeholder="Enter secure transfer password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
            />
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
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Provision Camera'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Connection Details Modal */}
      <Modal
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.name || 'Camera Connection'}
        description="Configure your camera's Wi-Fi FTP/SFTP upload settings with these parameters."
      >
        {selected && (
          <div className="connection-details space-y-3">
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Protocol</strong>
              <span className="font-mono text-xs">SFTP / SSH File Transfer</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Server Host</strong>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span>{window.location.hostname || 'localhost'}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => copyToClipboard(window.location.hostname || 'localhost', 'host')}
                >
                  {copied === 'host' ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Port</strong>
              <span className="font-mono text-xs">2022</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Username</strong>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span>{selected.upload_username || selected.sftpgo_username}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => copyToClipboard(selected.upload_username || selected.sftpgo_username, 'user')}
                >
                  {copied === 'user' ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Destination Storage</strong>
              <span className="text-xs">
                {selected.storage_provider?.name || 'Default Studio Storage'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Status</strong>
              <span className={selected.is_active ? 'text-green-600 font-medium' : 'text-muted'}>
                {selected.is_active ? '● Active & Ready' : '○ Disabled'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <strong>Last Sync</strong>
              <span className="text-xs text-muted">
                {selected.last_sync_at
                  ? new Date(selected.last_sync_at).toLocaleString()
                  : 'No uploads detected yet'}
              </span>
            </div>
          </div>
        )}
        <div className="mt-4 p-2.5 bg-surface-2 rounded text-xs text-muted space-y-1">
          <p><strong>Testing on Localhost:</strong> Use host <code>localhost</code> and port <code>2022</code>.</p>
          <p><strong>Testing with Physical Wi-Fi Camera:</strong> Connect your camera to the same Wi-Fi and use your computer's local IP address.</p>
        </div>
      </Modal>
    </div>
  );
}

export default CamerasPage;
