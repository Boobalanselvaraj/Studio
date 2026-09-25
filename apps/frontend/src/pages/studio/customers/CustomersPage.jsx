import { ShareQr } from '../../../components/gallery/ShareQr';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Users,
  ArrowUpRight,
  Mail,
  Phone,
  Image,
  Loader2,
  FolderOpen,
  Share2,
  Lock,
  Download,
  Heart,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Globe,
  Clock,
  UserCheck,
} from 'lucide-react';
import { toast } from '../../../components/ui/toast';
import api from '../../../api/client';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Select } from '../../../components/ui/select';
import { customersApi, sharesApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function CustomersPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [customers, setCustomers] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'with_galleries' | 'unassigned'

  // Modals
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [openShareModal, setOpenShareModal] = useState(false);
  const [openManageModal, setOpenManageModal] = useState(false);
  const [openGuestLinkModal, setOpenGuestLinkModal] = useState(false);
  const [deleteModalCustomer, setDeleteModalCustomer] = useState(null);
  const [unshareModalData, setUnshareModalData] = useState(null); // { customer, albumId, albumTitle }
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Forms
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [newTempPass, setNewTempPass] = useState('');

  // Register form
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Share form (Private Account Access)
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [canShare,setCanShare]=useState(false);
  const [canDownload, setCanDownload] = useState(true);
  const [canFavorite, setCanFavorite] = useState(true);

  // Expiring Guest Link Form
  const [guestLinkAlbumId, setGuestLinkAlbumId] = useState('');
  const [guestLinkExpiresHours, setGuestLinkExpiresHours] = useState(72);
  const [generatedGuestUrl, setGeneratedGuestUrl] = useState('');

  // Edit / Notes form
  const [editNotes, setEditNotes] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [custData, albData] = await Promise.allSettled([
        customersApi.list(),
        api.get('/studio/albums'),
      ]);

      if (custData.status === 'fulfilled' && Array.isArray(custData.value)) {
        setCustomers(custData.value);
        if (selectedCustomer) {
          const fresh = custData.value.find((c) => c.id === selectedCustomer.id);
          if (fresh) setSelectedCustomer(fresh);
        }
      }
      if (albData.status === 'fulfilled' && Array.isArray(albData.value?.data)) {
        setAlbums(albData.value.data);
        if (albData.value.data.length > 0 && !selectedAlbumId) {
          setSelectedAlbumId(albData.value.data[0].id);
        }
        if (albData.value.data.length > 0 && !guestLinkAlbumId) {
          setGuestLinkAlbumId(albData.value.data[0].id);
        }
      }
    } catch (err) {
      console.warn('Could not load clients and albums:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStudio?.id]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    try {
      setBusy(true);
      setError('');
      const created = await customersApi.create({
        password: formPassword || undefined,
        full_name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      setFormPassword('');
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormAddress('');
      setFormNotes('');
      setOpenRegisterModal(false);

      if (created?.temporary_password) {
        setNewTempPass(created.temporary_password);
      }
      setMessage(`Client ${created?.full_name || 'profile'} registered successfully.`);
      setTimeout(() => setMessage(''), 4000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register customer');
    } finally {
      setBusy(false);
    }
  };

  const handleShareAlbum = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedAlbumId) return;

    try {
      setBusy(true);
      setError('');
      await customersApi.shareAlbum({
        customer_id: selectedCustomer.id,
        album_id: selectedAlbumId,
        can_share: canShare,
        can_download: canDownload,
        can_favorite: canFavorite,
      });

      setOpenShareModal(false);
      setMessage(`Gallery assigned to ${selectedCustomer.full_name} with private portal access.`);
      setTimeout(() => setMessage(''), 4000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to grant gallery access');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateGuestLink = async (e) => {
    e.preventDefault();
    if (!guestLinkAlbumId) return;

    try {
      setBusy(true);
      setGeneratedGuestUrl('');
      const res = await sharesApi.createShare({
        album_id: guestLinkAlbumId,
        expires_in_hours: guestLinkExpiresHours,
      });
      setGeneratedGuestUrl(res.share_url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate guest link');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmUnshareAlbum = async () => {
    if (!unshareModalData) return;
    try {
      setBusy(true);
      await customersApi.unshareAlbum({
        customer_id: unshareModalData.customer.id,
        album_id: unshareModalData.albumId,
      });

      if (selectedCustomer && selectedCustomer.id === unshareModalData.customer.id) {
        setSelectedCustomer((prev) => ({
          ...prev,
          albums: (prev.albums || []).filter((a) => a.id !== unshareModalData.albumId),
          total_albums: Math.max(0, (prev.total_albums || 1) - 1),
        }));
      }

      setUnshareModalData(null);
      setMessage('Gallery access revoked.');
      setTimeout(() => setMessage(''), 3000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke access');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!deleteModalCustomer) return;
    try {
      setBusy(true);
      await customersApi.delete(deleteModalCustomer.id);
      setMessage(`Client "${deleteModalCustomer.full_name}" permanently removed.`);
      setTimeout(() => setMessage(''), 4000);
      setDeleteModalCustomer(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove customer');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCustomerNotes = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      setBusy(true);
      await customersApi.update(selectedCustomer.id, {
        notes: editNotes.trim() || undefined,
        phone: editPhone.trim() || undefined,
      });
      setOpenManageModal(false);
      setMessage(`Client profile updated.`);
      setTimeout(() => setMessage(''), 3000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update client');
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const textMatch = `${c.full_name || ''} ${c.email || ''} ${c.phone || ''} ${c.notes || ''}`
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!textMatch) return false;

      if (filterType === 'with_galleries') return (c.total_albums || 0) > 0;
      if (filterType === 'unassigned') return (c.total_albums || 0) === 0;
      return true;
    });
  }, [customers, query, filterType]);

  const totalDeliveredPhotos = customers.reduce((acc, c) => acc + (c.total_photos || 0), 0);
  const totalSharedGalleries = customers.reduce((acc, c) => acc + (c.total_albums || 0), 0);

  return (
    <div className="page-enter space-y-6">
      <PageHeading
        eyebrow="CLIENT RELATIONSHIPS & PRIVATE PORTALS"
        title="Clients & Customer Portals"
        description="Manage client accounts, grant private gallery login credentials, and issue expiring guest proofing links."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setGeneratedGuestUrl('');
              setOpenGuestLinkModal(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Globe size={15} />
            <span>Expiring Guest Link</span>
          </Button>

          <Button
            onClick={() => {
              setError('');
              setOpenRegisterModal(true);
            }}
            className="flex items-center gap-1.5 shadow-sm bg-brand-primary text-white"
          >
            <Plus size={16} />
            <span>Register Client</span>
          </Button>
        </div>
      </PageHeading>

      {/* Global Feedback Banner */}
      {message && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={17} /> {message}
          </span>
          <button onClick={() => setMessage('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle size={17} /> {error}
          </span>
          <button onClick={() => setError('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Temporary Password Credentials Callout */}
      {newTempPass && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <KeyRound size={18} />
            <span>Client Private Login Account Generated (Save & Share With Client)</span>
          </div>
          <p className="text-xs text-muted">
            The client can log in to view their private proofing galleries at <code>/customer/galleries</code> using their email and this password:
          </p>
          <div className="flex items-center gap-2">
            <code className="px-3 py-1.5 bg-surface-1 border border-border rounded font-mono font-bold text-sm">
              {newTempPass}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(newTempPass, 'temppass')}
              className="flex items-center gap-1 text-xs"
            >
              {copiedKey === 'temppass' ? (
                <Check size={13} className="text-emerald-500" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copiedKey === 'temppass' ? 'Copied' : 'Copy'}</span>
            </Button>
            <button
              onClick={() => setNewTempPass('')}
              className="text-xs text-muted hover:text-foreground ml-auto"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Users size={14} className="text-brand-primary" />
            <span>Total Clients</span>
          </div>
          <div className="text-xl font-bold">{customers.length}</div>
          <div className="text-[11px] text-muted">Registered accounts</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <FolderOpen size={14} className="text-emerald-500" />
            <span>Active Galleries</span>
          </div>
          <div className="text-xl font-bold">{totalSharedGalleries}</div>
          <div className="text-[11px] text-muted">Curated client albums</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <Image size={14} className="text-indigo-500" />
            <span>Delivered Photos</span>
          </div>
          <div className="text-xl font-bold">{totalDeliveredPhotos}</div>
          <div className="text-[11px] text-muted">Photos in client portals</div>
        </div>

        <div className="p-3.5 bg-surface-1 border border-border rounded-xl">
          <div className="text-xs text-muted font-medium flex items-center gap-1.5 mb-1">
            <ShieldCheck size={14} className="text-purple-500" />
            <span>Portal Security</span>
          </div>
          <div className="text-base font-semibold">Dual Mode</div>
          <div className="text-[11px] text-muted">Private login + guest links</div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="panel p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search clients by name, email, phone, or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            searchable={false}
            className="w-52 text-xs"
            options={[
              { value: 'all', label: `All Clients (${customers.length})` },
              { value: 'with_galleries', label: 'With Shared Galleries' },
              { value: 'unassigned', label: 'No Galleries Assigned' },
            ]}
          />
        </div>
      </div>

      {/* Customer Roster Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-muted flex items-center justify-center gap-2">
          <Loader2 size={24} className="animate-spin text-brand-primary" />
          <span>Loading client directory…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <Users size={40} className="text-muted mx-auto opacity-50" />
          <h4 className="text-base font-bold text-foreground">No clients found</h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Register your first client to grant private proofing portal access.
          </p>
          <Button
            size="sm"
            className="bg-brand-primary text-white"
            onClick={() => setOpenRegisterModal(true)}
          >
            <Plus size={14} className="mr-1" /> Register Client
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((cust) => {
            const hasGalleries = (cust.albums && cust.albums.length > 0) || (cust.total_albums || 0) > 0;
            return (
              <div
                key={cust.id}
                className="panel p-5 border border-border flex flex-col justify-between space-y-4 hover:border-brand-primary/40 transition-all duration-200 shadow-sm"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-border">
                    <div>
                      <h3 className="font-bold text-base text-foreground">{cust.full_name}</h3>
                      <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                        <Mail size={12} /> {cust.email}
                      </p>
                      {cust.phone && (
                        <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                          <Phone size={12} /> {cust.phone}
                        </p>
                      )}
                    </div>

                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-600">
                      Private Portal User
                    </span>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-surface-2 rounded-xl text-xs">
                    <div>
                      <span className="text-[11px] text-muted block">Delivered Photos</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 text-sm">
                        📸 {cust.total_photos || 0} photos
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted block">Assigned Galleries</span>
                      <strong className="text-foreground text-sm">
                        📁 {cust.total_albums || cust.albums?.length || 0} albums
                      </strong>
                    </div>
                  </div>

                  {/* Shared Galleries List */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                      Active Galleries
                    </span>
                    {cust.albums && cust.albums.length > 0 ? (
                      <div className="space-y-1">
                        {cust.albums.slice(0, 3).map((alb) => (
                          <div
                            key={alb.id}
                            className="p-2 bg-surface-muted rounded-lg border border-border flex items-center justify-between text-xs"
                          >
                            <span className="font-medium truncate max-w-[170px]">📁 {alb.title}</span>
                            <div className="flex items-center gap-1">
                              {alb.can_download && (
                                <span className="p-1 text-emerald-600" title="Downloads allowed">
                                  <Download size={12} />
                                </span>
                              )}
                              {alb.can_favorite && (
                                <span className="p-1 text-rose-500" title="Favoriting allowed">
                                  <Heart size={12} />
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {cust.albums.length > 3 && (
                          <span className="text-[11px] text-muted italic block text-right">
                            +{cust.albums.length - 3} more galleries
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted italic py-1">No albums assigned yet.</p>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setOpenShareModal(true);
                    }}
                  >
                    <Share2 size={13} className="mr-1 text-brand-primary" />
                    Assign Gallery
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setEditNotes(cust.notes || '');
                      setEditPhone(cust.phone || '');
                      setOpenManageModal(true);
                    }}
                  >
                    Manage
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 text-xs px-2"
                    onClick={() => setDeleteModalCustomer(cust)}
                    title="Remove client"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER CLIENT                                                    */}
      {/* ========================================================================= */}
      <Modal
        open={openRegisterModal}
        onOpenChange={setOpenRegisterModal}
        title="Register Client Profile"
        description="Creates an authenticated client account for private proofing portal access."
      >
        <form onSubmit={handleRegister} className="form-stack space-y-3">
          <label className="text-xs font-semibold text-foreground">
            Full Name *
            <input
              required
              maxLength={100}
              placeholder="e.g. Sarah Jenkins"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          <label className="text-xs font-semibold text-foreground">
            Email / Login Username *
            <input
              required
              type="email"
              maxLength={120}
              placeholder="client@example.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          <label className="text-xs font-semibold text-foreground">
            Portal Password (8–72 characters; leave blank to generate)
            <input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={formPassword} onChange={e=>setFormPassword(e.target.value)} className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border" />
          </label>
          <label className="text-xs font-semibold text-foreground">
            Phone Number (Optional)
            <input
              type="tel"
              maxLength={30}
              placeholder="+1 (555) 234-5678"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          <label className="text-xs font-semibold text-foreground">
            Client Notes (Internal)
            <textarea
              rows={2}
              placeholder="Couple wedding shoot, prefers natural lighting…"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-surface-2 border border-border"
            />
          </label>

          <div className="modal-actions pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpenRegisterModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !formName.trim() || !formEmail.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Register Client'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN GALLERY TO CLIENT (PRIVATE ACCOUNT ACCESS)                  */}
      {/* ========================================================================= */}
      <Modal
        size="wide"
        open={openShareModal}
        onOpenChange={setOpenShareModal}
        title={`Assign Gallery to ${selectedCustomer?.full_name || 'Client'}`}
        description="Grant secure gallery access with custom download and favoriting privileges."
      >
        <form onSubmit={handleShareAlbum} className="form-stack space-y-4">
          <fieldset><legend className="text-sm font-semibold mb-3">Choose a gallery</legend><div className="assignment-grid">{albums.map(alb=>{const cover=alb.album_assets?.find(aa=>aa.asset_id===alb.cover_asset_id)?.asset||alb.album_assets?.[0]?.asset;return <button type="button" className={selectedAlbumId===alb.id?'assignment-card is-selected':'assignment-card'} key={alb.id} onClick={()=>setSelectedAlbumId(alb.id)} aria-pressed={selectedAlbumId===alb.id}>{cover?<img loading="lazy" src={'/api/studio/folders/assets/'+cover.id+'/view'} alt=""/>:<div className="p-8 text-muted">No cover photo</div>}<span><strong>{alb.title}</strong><small>{alb.album_assets?.length||0} photos · {alb.is_published?'Published':'Draft'}</small></span></button>;})}</div>{!albums.length&&<p>Create an album before assigning a gallery.</p>}</fieldset>
          <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-2">
            <p className="text-xs font-semibold text-foreground">Client Privileges</p>
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
                <span>Allow Photo Favoriting & Proofing Shortlists</span>
              </label>
            </div>
          </div>

          <div className="modal-actions pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpenShareModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !selectedAlbumId}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Grant Private Access'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EXPIRING GUEST LINK GENERATOR (TOKEN-BASED ACCESS)                 */}
      {/* ========================================================================= */}
      <Modal
        open={openGuestLinkModal}
        onOpenChange={setOpenGuestLinkModal}
        title="Generate Expiring Guest Gallery Link"
        description="Create a secure, tokenized URL for clients or guests to view proofing galleries without creating an account."
      >
        <form onSubmit={handleGenerateGuestLink} className="space-y-4">
          <label className="text-xs font-semibold text-foreground">
            Select Gallery *
            <Select
              value={guestLinkAlbumId}
              onChange={(e) => setGuestLinkAlbumId(e.target.value)}
              placeholder="Select gallery…"
              options={albums.map((alb) => ({
                value: alb.id,
                label: `📁 ${alb.title}`,
              }))}
            />
          </label>

          <label className="text-xs font-semibold text-foreground">
            Expiration Window
            <Select
              value={String(guestLinkExpiresHours)}
              onChange={(e) => setGuestLinkExpiresHours(Number(e.target.value))}
              disabled={!!generatedGuestUrl}
              options={[
                { value: '24', label: '24 Hours (1 Day - Quick Client Proofing)' },
                { value: '72', label: '72 Hours (3 Days - Weekend Access)' },
                { value: '168', label: '7 Days (1 Week - Standard Sharing)' },
                { value: '720', label: '30 Days (1 Month - Extended Review)' },
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
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedGuestUrl);
                    setCopiedKey('guest');
                    setTimeout(() => setCopiedKey(''), 2000);
                  }}
                >
                  {copiedKey === 'guest' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                  {copiedKey === 'guest' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <ShareQr url={generatedGuestUrl}/>
              <p className="text-[11px] text-muted">
                Guests can view photos and favorite them. Link expires automatically in {guestLinkExpiresHours} hours.
              </p>
            </div>
          ) : (
            <div className="modal-actions pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenGuestLinkModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !guestLinkAlbumId}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : 'Generate Expiring Link'}
              </Button>
            </div>
          )}
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: MANAGE CLIENT GALLERIES & PROFILE                                  */}
      {/* ========================================================================= */}
      <Modal
        open={openManageModal}
        onOpenChange={setOpenManageModal}
        title={`Manage ${selectedCustomer?.full_name || 'Client'}`}
        description="Review assigned galleries and edit client contact details."
      >
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-2 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Email:</span>
                <span className="font-medium text-foreground">{selectedCustomer.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Accessible Photos:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  📸 {selectedCustomer.total_photos || 0} live photos
                </span>
              </div>
            </div>

            {/* Assigned Galleries List with Unshare Action */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted">
                Assigned Galleries ({selectedCustomer.albums?.length || 0})
              </h4>
              {selectedCustomer.albums && selectedCustomer.albums.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedCustomer.albums.map((alb) => (
                    <div
                      key={alb.id}
                      className="p-2.5 bg-surface-muted border border-border rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-foreground">{alb.title}</div>
                        <span className="text-[11px] text-muted">
                          {alb.assets_count || 0} photos ·{' '}
                          {alb.can_download ? 'Downloads allowed' : 'View only'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setUnshareModalData({
                            customer: selectedCustomer,
                            albumId: alb.id,
                            albumTitle: alb.title,
                          })
                        }
                        className="text-red-500 hover:underline text-xs"
                      >
                        Revoke Access
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">No galleries assigned to this client yet.</p>
              )}
            </div>

            {/* Edit Notes Form */}
            <form onSubmit={handleUpdateCustomerNotes} className="space-y-3 pt-3 border-t border-border">
              <label className="text-xs font-semibold text-foreground">
                Phone Number
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-surface-1 border border-border"
                />
              </label>

              <label className="text-xs font-semibold text-foreground">
                Internal Studio Notes
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-surface-1 border border-border"
                />
              </label>

              <div className="modal-actions pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenManageModal(false)}
                >
                  Close
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Details'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* CONFIRM MODAL: REVOKE GALLERY ACCESS (NO BROWSER CONFIRM)                 */}
      {/* ========================================================================= */}
      <ConfirmModal
        open={!!unshareModalData}
        onOpenChange={(v) => !v && setUnshareModalData(null)}
        title={`Revoke access to "${unshareModalData?.albumTitle}"?`}
        description={`Are you sure you want to remove access for client "${unshareModalData?.customer?.full_name}"? They will no longer be able to view or download this gallery.`}
        confirmText="Revoke Access"
        variant="danger"
        loading={busy}
        onConfirm={handleConfirmUnshareAlbum}
      />

      {/* ========================================================================= */}
      {/* CONFIRM MODAL: DELETE CUSTOMER (NO BROWSER CONFIRM)                       */}
      {/* ========================================================================= */}
      <ConfirmModal
        open={!!deleteModalCustomer}
        onOpenChange={(v) => !v && setDeleteModalCustomer(null)}
        title={`Remove Client "${deleteModalCustomer?.full_name}"?`}
        description="Are you sure you want to delete this client profile? All private portal credentials and gallery assignments for this client will be removed."
        confirmText="Delete Client"
        variant="danger"
        loading={busy}
        onConfirm={handleConfirmDeleteCustomer}
      />
    </div>
  );
}

export default CustomersPage;
