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
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  Wifi,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  UploadCloud,
  FileImage,
  Download,
  Image,
  CheckCircle2,
} from 'lucide-react';
import api from '../../../api/client';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/toast';
import { Select } from '../../../components/ui/select';
import { camerasApi, storageApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';


export function CamerasPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [albums, setAlbums] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState('sony');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formAlbum, setFormAlbum] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // View Photos Modal state
  const [viewPhotosCamera, setViewPhotosCamera] = useState(null);
  const [cameraAssets, setCameraAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Direct Upload Modal state
  const [uploadCamera, setUploadCamera] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenViewPhotos = async (cam) => {
    setViewPhotosCamera(cam);
    setLoadingAssets(true);
    try {
      const data = await camerasApi.getAssets(cam.id);
      setCameraAssets(data.assets || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load camera photos');
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleOpenUpload = (cam) => {
    setUploadCamera(cam);
    setUploadingFiles([]);
    setUploadProgress(0);
    setUploadSuccessCount(0);
  };

  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0 || !uploadCamera) return;
    const fileList = Array.from(files);
    setUploadingFiles(fileList);
    setUploadProgress(0);
    setIsUploading(true);
    let success = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        await camerasApi.uploadPhoto(uploadCamera.id, file);
        success++;
        setUploadSuccessCount(success);
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
      setUploadProgress(Math.round(((i + 1) / fileList.length) * 100));
    }

    setIsUploading(false);
    toast.success(`Successfully uploaded ${success} photos to ${uploadCamera.name}`);
    loadData();
    if (viewPhotosCamera?.id === uploadCamera.id) {
      handleOpenViewPhotos(uploadCamera);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [cams, provs, alb] = await Promise.allSettled([
        camerasApi.list(),
        storageApi.getProviders(),
        api.get('/studio/albums'),
      ]);

      if (cams.status === 'rejected') setError(cams.reason.response?.data?.error || 'Could not load cameras');
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
      if (alb.status === 'fulfilled' && Array.isArray(alb.value?.data)) {
        setAlbums(alb.value.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load camera sync profiles');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, [currentStudio?.id]);

  const generateCredentials = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const studioPrefix = (currentStudio?.name || 'cam')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 6);
    setFormUsername(`${studioPrefix}_cam_${randomSuffix}`);
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormPassword(pass);
  };

  const handleOpenRegister = () => {
    generateCredentials();
    setOpenModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      setError('Please fill in camera name, upload username, and password.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const created = await camerasApi.create({
        name: formName.trim(),
        model: formModel.trim() || undefined,
        storage_provider_id: formDestination || undefined,
        upload_username: formUsername.trim(),
        upload_password: formPassword,
      });

      if (formAlbum && created?.id) {
        try {
          await api.patch(`/studio/cameras/${created.id}/album`, { album_id: formAlbum });
        } catch (e) {
          console.warn('Could not link initial album:', e);
        }
      }

      setFormName('');
      setFormModel('');
      setFormUsername('');
      setFormPassword('');
      setFormAlbum('');
      setOpenModal(false);
      setSuccessMsg(`Camera "${formName.trim()}" registered successfully! Gateway profile active.`);
      setTimeout(() => setSuccessMsg(''), 5000);
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

  const [deleteModalCamera, setDeleteModalCamera] = useState(null);
  const [retireModalCamera, setRetireModalCamera] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteModalCamera) return;
    try {
      setActionBusy(true);
      await camerasApi.delete(deleteModalCamera.id);
      setSuccessMsg(`Camera "${deleteModalCamera.name}" was permanently deleted and slot released.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setDeleteModalCamera(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete camera');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmRetire = async () => {
    if (!retireModalCamera) return;
    try {
      setActionBusy(true);
      await camerasApi.retire(retireModalCamera.id);
      setSuccessMsg(`Camera "${retireModalCamera.name}" retired. Quota slot released.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setRetireModalCamera(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retire camera');
    } finally {
      setActionBusy(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const activeCamerasCount = cameras.filter((c) => c.is_active && c.lifecycle !== 'retired').length;
  const retiredCount = cameras.filter((c) => c.lifecycle === 'retired').length;


  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="TETHERING, CARD SYNC & LIVE INGEST"
        title="Cameras & sync"
        description="Register studio cameras, configure Wi-Fi/FTP tethering, and auto-route shots into albums."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5"
          >
            <HelpCircle size={15} />
            <span>Tethering Guide</span>
            {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>

          <Button
            onClick={handleOpenRegister}
            className="flex items-center gap-1.5 font-medium shadow-sm bg-brand-primary text-white hover:opacity-90"
          >
            <Plus size={16} />
            <span>Register New Camera</span>
          </Button>
        </div>
      </PageHeading>

      {error && !openModal && (
        <p role="alert" className="form-error mb-4">
          <AlertCircle size={16} className="inline mr-1.5" />
          {error}
        </p>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check size={16} /> {successMsg}
          </span>
          <button onClick={() => setSuccessMsg('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Camera size={14} className="text-brand-primary" />
            <span>Total Registered</span>
          </div>
          <div className="text-xl font-bold">{cameras.length}</div>
          <div className="text-[11px] text-muted">{cameras.filter(c => c.lifecycle !== 'retired').length} active profiles</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Radio size={14} className="text-emerald-500" />
            <span>Live Syncing</span>
          </div>
          <div className="text-xl font-bold flex items-center gap-2">
            {activeCamerasCount}
            {activeCamerasCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div className="text-[11px] text-muted">Ready for incoming shots</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Cable size={14} className="text-blue-500" />
            <span>Active Cameras</span>
          </div>
          <div className="text-xl font-bold">
            {cameras.filter(c => c.lifecycle !== 'retired').length}
          </div>
          <div className="text-[11px] text-muted">{retiredCount} retired</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Wifi size={14} className="text-purple-500" />
            <span>Ingest Gateway</span>
          </div>
          <div className="text-base font-semibold font-mono">Port 2022</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            SFTPGo Active
          </div>
        </div>
      </div>

      {/* Tethering & Setup Guide Card */}
      {showGuide && (
        <div className="panel p-5 mb-6 border border-brand-primary/30 bg-surface-1 shadow-sm rounded-xl">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-brand-primary/10 text-brand-primary">
                <Wifi size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold">Camera Wi-Fi / FTP Tethering Guide</h2>
                <p className="text-xs text-muted">
                  Transmit RAW or JPEG photos directly from your camera's shutter release to the cloud.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              Close Guide
            </button>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              ['sony', 'Sony Alpha (A7 IV, A7R V, A9, A1)'],
              ['canon', 'Canon EOS (R5, R6, R3)'],
              ['nikon', 'Nikon (Z8, Z9, WT)'],
              ['filezilla', 'PC/Mac / FileZilla / Hot Folder'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setGuideTab(id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  guideTab === id
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-surface-2 text-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted space-y-2 leading-relaxed bg-surface-2 p-3.5 rounded-lg border border-border">
            {guideTab === 'sony' && (
              <>
                <p>
                  <strong>1. Connect Wi-Fi:</strong> On your Sony camera, navigate to{' '}
                  <code>Menu → Network → Wi-Fi Connect → Access Point Settings</code> and join the same
                  network as the studio or studio router.
                </p>
                <p>
                  <strong>2. Add FTP Server:</strong> Navigate to{' '}
                  <code>Network → Transfer / Remote → FTP Transfer Function → Server Setting 1</code>.
                </p>
                <p>
                  <strong>3. Server Parameters:</strong> Set Host Name to your studio server IP or{' '}
                  <code>localhost</code>, Port to <code>2022</code>, Secure Protocol to{' '}
                  <code>SFTP / SSH</code>, and enter your Camera Username & Password below.
                </p>
                <p>
                  <strong>4. Auto-Transfer:</strong> Enable{' '}
                  <code>Auto FTP Transfer: ON</code>. Every shot you click will stream straight into your
                  selected album!
                </p>
              </>
            )}

            {guideTab === 'canon' && (
              <>
                <p>
                  <strong>1. Wireless Settings:</strong> Go to{' '}
                  <code>Menu → Network / Wrench → Communication settings → FTP Transfer</code>.
                </p>
                <p>
                  <strong>2. FTP Mode:</strong> Select <code>SFTP</code> or <code>FTP</code>. Enter the
                  Studio Gateway IP, Port <code>2022</code>, and credentials.
                </p>
                <p>
                  <strong>3. Transfer Options:</strong> Choose <code>Transfer with SET</code> or{' '}
                  <code>Automatic transfer after shooting</code>.
                </p>
              </>
            )}

            {guideTab === 'nikon' && (
              <>
                <p>
                  <strong>1. Connect to Network:</strong> Under <code>Network Menu</code>, select{' '}
                  <code>Connect to FTP Server → Add Profile</code>.
                </p>
                <p>
                  <strong>2. Gateway Setup:</strong> Host address: Studio IP, Port: <code>2022</code>,
                  Username & Password as configured.
                </p>
                <p>
                  <strong>3. Auto Send:</strong> Turn on <code>Auto Send</code> in Options.
                </p>
              </>
            )}

            {guideTab === 'filezilla' && (
              <>
                <p>
                  <strong>Test Ingest via FileZilla / Cyberduck:</strong>
                </p>
                <p>
                  Host: <code>sftp://localhost</code> · Port: <code>2022</code> · Username: Camera
                  upload username · Password: Camera password.
                </p>
                <p>
                  Drag any JPG, PNG, or RAW file into the root folder. StudioFlow will immediately ingest
                  it, index it, copy it to your storage provider, and route it to the chosen album!
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading cameras…</span>
        </div>
      ) : cameras.length === 0 ? (
        <div className="empty-state py-16 panel border-dashed">
          <div className="p-3 rounded-full bg-brand-primary/10 text-brand-primary inline-block mb-3">
            <Camera size={36} />
          </div>
          <h2 className="text-lg font-semibold">No cameras registered yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-5">
            Register your first studio camera profile to get dedicated Wi-Fi FTP credentials and start
            automatic live ingesting into your shoot albums.
          </p>
          <Button
            onClick={handleOpenRegister}
            className="flex items-center gap-1.5 shadow-sm bg-brand-primary text-white"
          >
            <Plus size={16} /> Register New Camera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((d) => (
            <section
              className={`panel camera-card flex flex-col justify-between border transition-all ${
                d.lifecycle === 'retired'
                  ? 'opacity-60 bg-surface-2 border-border'
                  : 'hover:border-brand-primary/40'
              }`}
              key={d.id}
            >
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface-2 text-brand-primary">
                      <Camera size={18} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm">{d.name}</h3>
                      <span className="text-[11px] text-muted uppercase font-mono">
                        {d.model || 'Studio Camera'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      d.lifecycle === 'ready'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                        : d.lifecycle === 'retired'
                        ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {d.lifecycle === 'ready' ? 'Ready & Linked' : d.lifecycle}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 px-2 rounded bg-surface-2">
                    <span className="text-muted">Username:</span>
                    <code className="font-mono font-medium text-foreground">
                      {d.upload_username || d.sftpgo_username}
                    </code>
                  </div>

                  {d.storage_provider && (
                    <div className="flex justify-between items-center py-1 px-2 rounded bg-surface-2">
                      <span className="text-muted">Destination:</span>
                      <span className="font-medium flex items-center gap-1">
                        <HardDrive size={12} className="text-blue-500" />
                        {d.storage_provider.name} ({d.storage_provider.backend.toUpperCase()})
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-1 px-2 rounded bg-surface-2">
                    <span className="text-muted">Live Ingest:</span>
                    <span
                      className={`flex items-center gap-1.5 font-medium ${
                        d.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'
                      }`}
                    >
                      <Radio size={12} className={d.is_active ? 'animate-pulse' : ''} />
                      {d.is_active ? 'Active & Listening' : 'Paused / Inactive'}
                    </span>
                  </div>

                  {/* Direct live album routing dropdown */}
                  <div className="pt-1">
                    <label className="text-[11px] font-medium text-muted block mb-1">
                      Route Photos To Album:
                    </label>
                    <select
                      value={d.album_id || ''}
                      disabled={d.lifecycle === 'retired'}
                      onChange={async (e) => {
                        try {
                          await api.patch('/studio/cameras/' + d.id + '/album', {
                            album_id: e.target.value || null,
                          });
                          loadData();
                        } catch (err) {
                          setError(err.response?.data?.error || 'Could not assign album');
                        }
                      }}
                      className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2 py-1.5 focus:border-brand-primary"
                    >
                      <option value="">Studio Media Library (Default)</option>
                      {albums.map((a) => (
                        <option key={a.id} value={a.id}>
                          📁 {a.title} {a.is_published ? '(Published)' : '(Draft)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border space-y-2">
                {d.lifecycle !== 'retired' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="text-xs bg-brand-primary text-white hover:opacity-95 shadow-sm"
                      onClick={() => handleOpenUpload(d)}
                    >
                      <UploadCloud size={14} className="mr-1.5" />
                      Upload Photos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleOpenViewPhotos(d)}
                    >
                      <Eye size={14} className="mr-1.5 text-brand-primary" />
                      View Photos
                    </Button>
                  </div>
                )}

                {d.lifecycle !== 'retired' ? (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setSelected(d)}
                    >
                      <KeyRound size={13} className="mr-1" />
                      Credentials
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2"
                      onClick={() => handleToggleActive(d)}
                    >
                      {d.is_active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-amber-500 hover:text-amber-600 text-xs px-2"
                      onClick={() => setRetireModalCamera(d)}
                      title="Retire camera to free quota slot"
                    >
                      Retire
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 text-xs px-2"
                      onClick={() => setDeleteModalCamera(d)}
                      title="Permanently delete camera"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-muted py-1">
                    <span>Slot released on {new Date(d.retired_at).toLocaleDateString()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 text-xs px-2"
                      onClick={() => setDeleteModalCamera(d)}
                      title="Delete record"
                    >
                      <Trash2 size={13} className="mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Register Camera Modal */}
      <Modal
        open={openModal}
        onOpenChange={(v) => {
          setOpenModal(v);
          if (!v) setError('');
        }}
        title="Register New Studio Camera"
        description="Creates an authenticated upload profile for Wi-Fi transmitters, CamRanger, FTP, or memory card sync."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          {error && <p className="form-error">{error}</p>}

          <label>
            Camera Name / Nickname
            <input
              required
              maxLength={80}
              placeholder="e.g. Studio Sony A7 IV - Primary"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </label>

          <label>
            Camera Model
            <input
              maxLength={80}
              placeholder="e.g. Sony ILCE-7M4 / Canon EOS R5"
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {['Sony A7 IV', 'Canon EOS R5', 'Nikon Z9', 'CamRanger 2', 'iPad Capture'].map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFormModel(m)}
                    className="text-[10px] px-2 py-0.5 rounded bg-surface-2 hover:bg-surface-3 border border-border text-muted"
                  >
                    + {m}
                  </button>
                )
              )}
            </div>
          </label>

          <label>
            Storage Destination (Optional)
            <Select
              value={formDestination}
              onChange={(e) => setFormDestination(e.target.value)}
              placeholder="Direct Camera Ingest (No External Server Bound)"
              searchable={true}
              options={[
                {
                  value: '',
                  label: '⚡ Direct Camera Ingest (No External Server Bound)',
                  description: 'Store directly in studio media library',
                },
                ...providers
                  .filter((p) => p.is_enabled)
                  .map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: `${p.backend.toUpperCase()} · ${p.provider_type.replace('_', ' ')}`,
                    badge:
                      p.backend === 's3'
                        ? 'pill-blue'
                        : p.backend === 'sftp'
                        ? 'pill-emerald'
                        : 'pill-amber',
                  })),
              ]}
            />
          </label>

          <label>
            Route Directly to Shoot Album (Optional)
            <select
              value={formAlbum}
              onChange={(e) => setFormAlbum(e.target.value)}
              className="w-full text-sm bg-surface-1 border border-border rounded-lg px-2.5 py-2"
            >
              <option value="">Studio Media Library (Default)</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  📁 {a.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              Upload Username
              <input
                required
                maxLength={60}
                placeholder="cam_studio_01"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </label>

            <label>
              Upload Password
              <div className="password-field">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Enter transfer password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
          </div>

          <div className="flex justify-between items-center text-xs text-muted pt-1">
            <button
              type="button"
              onClick={generateCredentials}
              className="text-brand-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} /> Regenerate random credentials
            </button>
          </div>

          <div className="modal-actions pt-4 border-t border-border mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-primary text-white">
              {busy ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
              Register & Activate Camera
            </Button>
          </div>
        </form>
      </Modal>

      {/* Connection Details Modal */}
      <Modal
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.name || 'Camera Connection Parameters'}
        description="Configure your camera's Wi-Fi FTP/SFTP transmitter settings with these credentials."
      >
        {selected && (
          <div className="connection-details space-y-2.5">
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong className="text-xs">Protocol</strong>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-2">
                SFTP (SSH File Transfer)
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong className="text-xs">Server Host / IP</strong>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span>{window.location.hostname || 'localhost'}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => copyToClipboard(window.location.hostname || 'localhost', 'host')}
                >
                  {copied === 'host' ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong className="text-xs">Port</strong>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span>2022</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => copyToClipboard('2022', 'port')}
                >
                  {copied === 'port' ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong className="text-xs">Username</strong>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span>{selected.upload_username || selected.sftpgo_username}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    copyToClipboard(selected.upload_username || selected.sftpgo_username, 'user')
                  }
                >
                  {copied === 'user' ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong className="text-xs">Destination Storage</strong>
              <span className="text-xs">
                {selected.storage_provider?.name || 'Default Studio Storage'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <strong className="text-xs">Status</strong>
              <span
                className={`text-xs font-medium ${
                  selected.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'
                }`}
              >
                {selected.is_active ? '● Active & Listening' : '○ Paused'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <strong className="text-xs">Last Ingest</strong>
              <span className="text-xs text-muted">
                {selected.last_sync_at
                  ? new Date(selected.last_sync_at).toLocaleString()
                  : 'No uploads detected yet'}
              </span>
            </div>

            <div className="mt-4 p-3 bg-surface-2 rounded-lg text-xs text-muted space-y-1.5 border border-border">
              <p>
                <strong>Testing from your computer:</strong> Use an SFTP client like FileZilla or
                Cyberduck with host <code>localhost</code> and port <code>2022</code>.
              </p>
              <p>
                <strong>Testing on physical camera:</strong> Join your studio Wi-Fi and input your
                computer's LAN IP address.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* View Camera Uploaded Photos Modal */}
      <Modal
        open={!!viewPhotosCamera}
        onOpenChange={(v) => !v && setViewPhotosCamera(null)}
        title={`${viewPhotosCamera?.name || 'Camera'} — Uploaded Photos (${cameraAssets.length})`}
        description={`View and manage all photos ingested by ${viewPhotosCamera?.name}. Destination: ${viewPhotosCamera?.storage_provider?.name || 'Default Storage'}.`}
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header Action Bar inside modal */}
          <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border">
            <div className="text-xs">
              <span className="text-muted">Total Ingested:</span>{' '}
              <strong className="text-foreground">{cameraAssets.length} photos</strong>
              <span className="text-muted mx-2">•</span>
              <span className="text-muted">Last sync:</span>{' '}
              <strong className="text-foreground">
                {viewPhotosCamera?.last_sync_at
                  ? new Date(viewPhotosCamera.last_sync_at).toLocaleTimeString()
                  : 'None yet'}
              </strong>
            </div>

            <Button
              size="sm"
              className="text-xs bg-brand-primary text-white"
              onClick={() => handleOpenUpload(viewPhotosCamera)}
            >
              <UploadCloud size={14} className="mr-1.5" />
              Upload Photos Now
            </Button>
          </div>

          {loadingAssets ? (
            <div className="flex justify-center items-center py-16 text-muted">
              <Loader2 size={24} className="animate-spin text-brand-primary mr-2" />
              <span className="text-xs">Loading photos from camera storage...</span>
            </div>
          ) : cameraAssets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl p-6">
              <div className="p-3 bg-surface-2 rounded-full inline-block mb-3 text-muted">
                <FileImage size={32} />
              </div>
              <h4 className="text-sm font-semibold mb-1">No Photos Uploaded Yet</h4>
              <p className="text-xs text-muted max-w-sm mx-auto mb-4">
                Photos taken on this camera over Wi-Fi, or uploaded directly from your computer or phone, will appear here immediately.
              </p>
              <Button
                size="sm"
                className="bg-brand-primary text-white text-xs"
                onClick={() => handleOpenUpload(viewPhotosCamera)}
              >
                <UploadCloud size={14} className="mr-1.5" />
                Upload First Photo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cameraAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-lg overflow-hidden border border-border bg-surface-1 shadow-sm hover:border-brand-primary/50 transition-all flex flex-col"
                >
                  <div className="aspect-square bg-surface-muted relative overflow-hidden flex items-center justify-center">
                    <img
                      src={asset.url}
                      alt={asset.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div class="flex flex-col items-center justify-center text-muted p-2 text-[10px]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Preview</span></div>';
                      }}
                    />

                    {/* Overlay Action on Hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white text-white hover:text-black transition-colors"
                        title="View high-res"
                      >
                        <Eye size={14} />
                      </a>
                      <a
                        href={`${asset.url}?download=true`}
                        download={asset.filename}
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white text-white hover:text-black transition-colors"
                        title="Download file"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>

                  <div className="p-2 text-[11px] space-y-0.5">
                    <p className="font-medium truncate" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <div className="flex justify-between text-muted text-[10px]">
                      <span>
                        {(Number(asset.file_size_bytes || 0) / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <span>
                        {new Date(asset.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Direct Wi-Fi & Web Camera Upload Modal */}
      <Modal
        open={!!uploadCamera}
        onOpenChange={(v) => !v && !isUploading && setUploadCamera(null)}
        title={`Direct Ingest to "${uploadCamera?.name || 'Camera'}"`}
        description={`Upload photos directly from your browser, SD card, or mobile phone into ${uploadCamera?.name}. Files stream straight to ${uploadCamera?.storage_provider?.name || 'configured storage'}.`}
      >
        <div className="space-y-4">
          {/* Destination Details pill */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2 text-xs border border-border">
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-brand-primary" />
              <span className="font-medium">{uploadCamera?.name}</span>
            </div>
            <div className="text-muted flex items-center gap-1">
              <HardDrive size={13} />
              <span>{uploadCamera?.storage_provider?.name || 'Default Storage'}</span>
            </div>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                handleFilesSelected(e.dataTransfer.files);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              isDragging
                ? 'border-brand-primary bg-brand-primary/10'
                : 'border-border hover:border-brand-primary/50 bg-surface-1'
            }`}
          >
            <input
              type="file"
              id="direct-camera-file-input"
              multiple
              accept="image/*,.cr2,.cr3,.nef,.arw,.dng"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
              }}
            />

            <label
              htmlFor="direct-camera-file-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-3"
            >
              <div className="p-4 rounded-full bg-brand-primary/10 text-brand-primary shadow-sm">
                <UploadCloud size={36} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Click to select photos or drag & drop here
                </p>
                <p className="text-xs text-muted mt-1">
                  Supports JPEG, PNG, WEBP, Canon RAW (.CR2, .CR3), Sony (.ARW), Nikon (.NEF)
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={isUploading}
                className="bg-brand-primary text-white text-xs shadow-sm"
                onClick={() => document.getElementById('direct-camera-file-input')?.click()}
              >
                Browse Files from SD Card or Laptop
              </Button>
            </label>
          </div>

          {/* Upload Progress Status */}
          {isUploading && (
            <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-2">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="flex items-center gap-1.5 text-brand-primary">
                  <Loader2 size={13} className="animate-spin" />
                  Uploading {uploadSuccessCount} of {uploadingFiles.length} files...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-primary h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadSuccessCount > 0 && !isUploading && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={16} />
                Successfully uploaded {uploadSuccessCount} photos!
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => {
                  setUploadCamera(null);
                  handleOpenViewPhotos(uploadCamera);
                }}
              >
                View Uploaded Photos
              </Button>
            </div>
          )}

          {/* Wi-Fi Companion / Mobile Ingest Tip */}
          <div className="p-3 rounded-xl bg-surface-2 border border-border text-xs text-muted space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Wifi size={14} className="text-emerald-500" />
              Wi-Fi Camera Upload:
            </p>
            <p>
              For wireless shooting with your Canon 200D or phone, open this page on your phone or laptop connected to the camera Wi-Fi and drop files directly, or use SFTP port <code>2022</code> with username <code>{uploadCamera?.upload_username || uploadCamera?.sftpgo_username}</code>.
            </p>
          </div>
        </div>
      </Modal>

      {/* Confirm Camera Deletion Modal (No Browser Inbuilt Confirm) */}
      <ConfirmModal
        open={!!deleteModalCamera}
        onOpenChange={(v) => !v && setDeleteModalCamera(null)}
        title={`Permanently Delete Camera "${deleteModalCamera?.name}"?`}
        description="This will permanently delete this camera upload profile and release its quota slot. Any historical photos already saved in your library remain safe."
        confirmText="Delete Camera"
        variant="danger"
        loading={actionBusy}
        onConfirm={handleConfirmDelete}
      />

      {/* Confirm Camera Retire Modal */}
      <ConfirmModal
        open={!!retireModalCamera}
        onOpenChange={(v) => !v && setRetireModalCamera(null)}
        title={`Retire Camera "${retireModalCamera?.name}"?`}
        description="Retiring this camera frees its active quota slot while keeping all historical shots and metadata intact."
        confirmText="Retire Camera"
        variant="warning"
        loading={actionBusy}
        onConfirm={handleConfirmRetire}
      />
    </div>
  );
}

export default CamerasPage;
