import React, { useState, useEffect } from 'react';
import {
  Camera,
  Plus,
  Copy,
  Check,
  Cable,
  Radio,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { camerasApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function CamerasPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const loadCameras = async () => {
    try {
      setLoading(true);
      const data = await camerasApi.list();
      if (Array.isArray(data)) {
        setCameras(data);
      }
    } catch (err) {
      console.warn('Cameras load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, [currentStudio?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      setError('Please fill in name, SFTP username, and password.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await camerasApi.create({
        name: formName.trim(),
        model: formModel.trim() || undefined,
        sftpgo_username: formUsername.trim(),
        sftpgo_password: formPassword.trim(),
      });

      setFormName('');
      setFormModel('');
      setFormUsername('');
      setFormPassword('');
      setOpenModal(false);
      loadCameras();
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
    } catch (err) {
      console.error('Failed to toggle camera status:', err);
      loadCameras();
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="FROM CAMERA TO COLLECTION"
        title="Cameras & sync"
        description="A smooth handoff from capturing the moment to creating the final story."
      >
        <Button onClick={() => setOpenModal(true)}>
          <Plus size={16} />
          Add camera
        </Button>
      </PageHeading>

      <div className="sync-banner">
        <span className="sync-icon">
          <Cable size={24} />
        </span>
        <div>
          <h2>Less transferring. More creating.</h2>
          <p>
            Connect your tethered cameras and SFTP memory cards straight into your studio media pipeline.
          </p>
        </div>
        <span className="neutral-tag">Live Sync Engine</span>
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
            Provision your first studio camera or SFTP account to begin automatic uploads.
          </p>
          <Button onClick={() => setOpenModal(true)}>
            <Plus size={16} /> Add camera
          </Button>
        </div>
      ) : (
        <div className="camera-grid">
          {cameras.map((d) => (
            <section className="panel camera-card" key={d.id}>
              <div className="camera-illustration">
                <Camera size={64} strokeWidth={1} />
              </div>
              <div className="camera-card-content">
                <span className="eyebrow">{d.model || 'STUDIO CAMERA'}</span>
                <h2>{d.name}</h2>
                <p>Username: <code>{d.sftpgo_username}</code></p>
                <div
                  className={`camera-state ${
                    d.is_active ? 'text-green-600' : 'text-muted'
                  }`}
                >
                  <Radio size={14} className={d.is_active ? 'animate-pulse' : ''} />
                  {d.is_active ? 'Live Sync Active' : 'Sync Inactive'}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
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
                </div>
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
        description="Creates an SFTP upload credential for Wi-Fi transmitters, CamRanger, or memory card sync."
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
            SFTPGo username
            <input
              required
              maxLength={60}
              placeholder="e.g. cam_studio_01"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
            />
          </label>
          <label>
            SFTPGo password
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
              <strong>SFTP Port</strong>
              <span className="font-mono text-xs">2022</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong>Username</strong>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span>{selected.sftpgo_username}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => copyToClipboard(selected.sftpgo_username, 'user')}
                >
                  {copied === 'user' ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
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
          <p><strong>Testing with Physical Wi-Fi Camera:</strong> Connect your camera to the same Wi-Fi and use your computer's local IP address (e.g. <code>192.168.1.xxx</code>).</p>
        </div>
      </Modal>
    </div>
  );
}
