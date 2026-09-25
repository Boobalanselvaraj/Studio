import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import {
  Building2,
  Plus,
  Users,
  HardDrive,
  Camera,
  Loader2,
  Edit2,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  Server,
  Trash2,
  Receipt,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Zap,
  Clock,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { adminApi } from '../../api/services';
import { toast } from '../../components/ui/toast';

export function AdminDashboardPage() {
  const [studios, setStudios] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [invoicesModal, setInvoicesModal] = useState(false);
  const [createInvoiceModal, setCreateInvoiceModal] = useState(false);

  const [createdResult, setCreatedResult] = useState(null);
  const [selectedStudio, setSelectedStudio] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Create studio form state (slug removed, auto-generated)
  const [name, setName] = useState('');
  const [billingPlanId, setBillingPlanId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('studio123456');

  // Manage studio form state
  const [editStatus, setEditStatus] = useState('active');

  // Invoices & Subscriptions management state
  const [billingTab, setBillingTab] = useState('invoices');
  const [studioInvoices, setStudioInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [studioSubscriptions, setStudioSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState(null);
  const [deleteInvoiceLoading, setDeleteInvoiceLoading] = useState(false);

  const [editInvoiceTarget, setEditInvoiceTarget] = useState(null);
  const [editInvoiceStatus, setEditInvoiceStatus] = useState('issued');
  const [editInvoiceNotes, setEditInvoiceNotes] = useState('');
  const [editInvoiceBusy, setEditInvoiceBusy] = useState(false);

  const [createSubModal, setCreateSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    plan_name: 'Studio Pro Tier',
    interval: 'monthly',
    amount: 2500,
    storage_limit_gb: 500,
    max_cameras: 5,
  });
  const [subBusy, setSubBusy] = useState(false);

  const [invoiceStatus, setInvoiceStatus] = useState('issued');
  const [invoicePeriodDays, setInvoicePeriodDays] = useState(30);
  const [lineItems, setLineItems] = useState([
    { description: 'StudioFlow Platform Software License (Monthly)', category: 'Software', quantity: 1, unit_price: 1500, amount: 1500 },
    { description: 'Dedicated Cloud Storage Server 500GB (VPS Instance)', category: 'Dedicated Server', quantity: 1, unit_price: 2000, amount: 2000 },
    { description: 'Camera Direct Wi-Fi Transmission License Pack (5 cameras)', category: 'Hardware/Camera', quantity: 1, unit_price: 500, amount: 500 },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studiosData, plansData] = await Promise.allSettled([
        adminApi.listStudios(),
        adminApi.getBillingPlans(),
      ]);

      if (studiosData.status === 'fulfilled' && Array.isArray(studiosData.value)) {
        setStudios(studiosData.value);
      }
      if (plansData.status === 'fulfilled' && Array.isArray(plansData.value)) {
        setPlans(plansData.value);
        if (plansData.value.length > 0 && !billingPlanId) {
          setBillingPlanId(plansData.value[0].id);
        }
      }
    } catch (err) {
      console.warn('Admin load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');

      const cleanName = name.trim();
      const derivedSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'studio';
      const cleanEmail = ownerEmail.trim().toLowerCase() || `owner@${derivedSlug}.com`;

      const res = await adminApi.createStudio({
        name: cleanName,
        slug: derivedSlug,
        billing_plan_id: billingPlanId || undefined,
        owner_name: ownerName.trim() || `${cleanName} Owner`,
        owner_email: cleanEmail,
        owner_password: ownerPassword.trim() || 'studio123456',
      });


      setCreatedResult(res);
      setCreateModal(false);
      setSuccessModal(true);

      setName('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPassword('studio123456');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to provision studio');
    } finally {
      setBusy(false);
    }
  };

  const handleManageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudio) return;

    try {
      setBusy(true);
      setError('');
      await adminApi.updateStudioBilling(selectedStudio.id, {
        billing_status: editStatus,
      });


      setManageModal(false);
      toast.success(`Studio settings for "${selectedStudio.name}" updated successfully`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update studio settings');
    } finally {
      setBusy(false);
    }
  };

  const openManage = (studio) => {
    setSelectedStudio(studio);
    setEditStatus(studio.studio_billing_profile?.billing_status || 'active');
    setManageModal(true);
  };


  // --- Invoicing & Subscription Handlers ---
  const openInvoices = async (studio) => {
    setSelectedStudio(studio);
    setInvoicesModal(true);
    setBillingTab('invoices');
    setLoadingInvoices(true);
    setLoadingSubscriptions(true);
    try {
      const [invs, subs] = await Promise.allSettled([
        adminApi.listStudioInvoices(studio.id),
        adminApi.listSubscriptions(studio.id),
      ]);
      if (invs.status === 'fulfilled' && Array.isArray(invs.value)) {
        setStudioInvoices(invs.value);
      }
      if (subs.status === 'fulfilled' && Array.isArray(subs.value)) {
        setStudioSubscriptions(subs.value);
      }
    } catch (err) {
      console.warn('Failed to load studio invoices/subs:', err);
    } finally {
      setLoadingInvoices(false);
      setLoadingSubscriptions(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedStudio || !deleteInvoiceTarget) return;
    try {
      setDeleteInvoiceLoading(true);
      await adminApi.deleteStudioInvoice(selectedStudio.id, deleteInvoiceTarget.id);
      setStudioInvoices((prev) => prev.filter((i) => i.id !== deleteInvoiceTarget.id));
      setDeleteInvoiceTarget(null);
      toast.success('Invoice deleted successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete invoice');
    } finally {
      setDeleteInvoiceLoading(false);
    }
  };

  const handleUpdateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedStudio || !editInvoiceTarget) return;
    try {
      setEditInvoiceBusy(true);
      const updated = await adminApi.updateStudioInvoice(selectedStudio.id, editInvoiceTarget.id, {
        status: editInvoiceStatus,
        notes: editInvoiceNotes,
      });
      setStudioInvoices((prev) =>
        prev.map((inv) => (inv.id === editInvoiceTarget.id ? { ...inv, ...updated } : inv))
      );
      setEditInvoiceTarget(null);
      toast.success('Invoice updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update invoice');
    } finally {
      setEditInvoiceBusy(false);
    }
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedStudio) return;
    try {
      setSubBusy(true);
      const newSub = await adminApi.createSubscription(selectedStudio.id, subForm);
      setStudioSubscriptions((prev) => [newSub, ...prev]);
      setCreateSubModal(false);
      toast.success('Recurring subscription created successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create subscription');
    } finally {
      setSubBusy(false);
    }
  };

  const handleCancelSubscription = async (subId) => {
    if (!selectedStudio) return;
    try {
      await adminApi.cancelSubscription(selectedStudio.id, subId);
      setStudioSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: 'canceled' } : s))
      );
      toast.success('Subscription canceled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel subscription');
    }
  };

  const handleTriggerSubInvoice = async (subId) => {
    if (!selectedStudio) return;
    try {
      const inv = await adminApi.triggerSubscriptionInvoice(selectedStudio.id, subId);
      setStudioInvoices((prev) => [inv, ...prev]);
      setBillingTab('invoices');
      toast.success('Next cycle invoice generated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to trigger subscription invoice');
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: 'Additional Custom Service / Add-on', category: 'Custom', quantity: 1, unit_price: 500, amount: 500 },
    ]);
  };

  const handleRemoveLineItem = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLineItem = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          const qty = Number(field === 'quantity' ? value : updated.quantity) || 0;
          const price = Number(field === 'unit_price' ? value : updated.unit_price) || 0;
          updated.amount = qty * price;
        }
        return updated;
      })
    );
  };

  const totalInvoiceAmount = lineItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const handleCreateInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudio) return;
    try {
      setBusy(true);
      setError('');
      const periodStart = new Date();
      const periodEnd = new Date(Date.now() + invoicePeriodDays * 24 * 60 * 60 * 1000);

      await adminApi.generateStudioInvoice(selectedStudio.id, {
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_amount: totalInvoiceAmount,
        currency: 'INR',
        line_items: lineItems,
        status: invoiceStatus,
      });

      setCreateInvoiceModal(false);
      // Reload studio invoices
      const invs = await adminApi.listStudioInvoices(selectedStudio.id);
      setStudioInvoices(Array.isArray(invs) ? invs : []);
      toast.success('Invoice generated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate studio bill');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    if (!selectedStudio) return;
    try {
      await adminApi.recordManualPayment(selectedStudio.id, invoiceId, {
        notes: 'Manual payment verified by Super Admin',
      });
      const invs = await adminApi.listStudioInvoices(selectedStudio.id);
      setStudioInvoices(Array.isArray(invs) ? invs : []);
      toast.success('Payment recorded successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="text-brand-primary" size={26} />
            Studios Directory & Fleet Console
          </h2>
          <p className="text-sm text-muted">
            Manage studio tenant accounts, manage external server connections and camera access, and issue transparent sales bills.
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

          <Button onClick={() => setCreateModal(true)} className="flex items-center gap-2 bg-brand-primary text-white text-xs">
            <Plus className="w-4 h-4" /> Provision New Studio
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading studio tenants…</span>
        </div>
      ) : (
        <Card className="border-border bg-surface-1 shadow-sm overflow-hidden">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Registered Studio Tenants ({studios.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-muted">Studio Name</TableHead>
                  <TableHead className="font-semibold text-xs text-muted">Owner Account</TableHead>
                  <TableHead className="font-semibold text-xs text-muted">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-muted">Cameras</TableHead>
                  <TableHead className="font-semibold text-xs text-muted">Customers</TableHead>
                  <TableHead className="font-semibold text-xs text-muted">Connected Servers</TableHead>
                  <TableHead className="font-semibold text-xs text-muted text-right">Management Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studios.map((s) => {
                  const billingStatus = s.studio_billing_profile?.billing_status || 'active';
                  const owner = s.studio_users?.find((su) => su.role === 'studio_owner')?.user;
                  const reservedCams = s.liveMetrics?.reservedCameras || s._count?.cameras || 0;
                  const customersCount = s._count?.customers || 0;
                  const serversCount = s._count?.storage_providers || 0;

                  return (
                    <TableRow key={s.id} className="border-border hover:bg-surface-2/60 transition-colors">
                      <TableCell className="font-semibold text-sm flex items-center gap-2 text-foreground">
                        <Building2 className="w-4 h-4 text-brand-primary shrink-0" /> {s.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {owner ? (
                          <div>
                            <span className="font-medium text-foreground">{owner.full_name}</span>
                            <p className="text-muted text-[11px]">{owner.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={billingStatus === 'active' ? 'success' : 'warning'} className="capitalize">
                          {billingStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Camera size={14} className="text-brand-primary" />
                          <span>{reservedCams} Camera{reservedCams === 1 ? '' : 's'}</span>
                        </div>
                        <span className="text-[11px] text-muted block">Registered ingest profiles</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Users size={14} className="text-indigo-500" />
                          <span>{customersCount} Customer{customersCount === 1 ? '' : 's'}</span>
                        </div>
                        <span className="text-[11px] text-muted block">Client accounts</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Server size={14} className="text-emerald-500" />
                          <span>{serversCount} Server{serversCount === 1 ? '' : 's'}</span>
                        </div>
                        <span className="text-[11px] text-muted block">Direct Storage Fleet</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs flex items-center gap-1"
                            onClick={() => openInvoices(s)}
                            title="Manage itemized invoices & bills"
                          >
                            <Receipt size={13} className="text-emerald-500" /> Invoices & Bill
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs flex items-center gap-1"
                            onClick={() => openManage(s)}
                            title="Edit camera limits and account status"
                          >
                            <Edit2 size={13} /> Edit Studio
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {studios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted text-xs">
                      No studio tenants registered yet. Click "Provision New Studio" to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal: Provision Studio (No slug input, auto-generated) */}
      <Modal
        open={createModal}
        onOpenChange={(v) => {
          setCreateModal(v);
          if (!v) setError('');
        }}
        title="Provision New Studio Tenant"
        description="Registers a new studio tenant and provisions initial owner credentials."
      >
        <form className="form-stack space-y-4" onSubmit={handleCreate}>
          {error && <p className="form-error">{error}</p>}

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">1. Studio Information</h3>

          <label className="text-xs font-medium">
            Studio Name
            <input
              required
              className="mt-1"
              placeholder="e.g. Lumina Creative Studios"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!ownerEmail && e.target.value.trim()) {
                  const autoSlug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '');
                  setOwnerEmail(`owner@${autoSlug || 'studio'}.com`);
                }
              }}
            />
          </label>

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted pt-2 border-t border-border">
            2. Studio Owner Credentials
          </h3>

          <div className="form-grid">
            <label className="text-xs font-medium">
              Owner Full Name
              <input
                required
                className="mt-1"
                placeholder="Jane Doe"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </label>

            <label className="text-xs font-medium">
              Owner Login Email
              <input
                type="email"
                required
                className="mt-1"
                placeholder="jane@luminastudio.com"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </label>
          </div>

          <label className="text-xs font-medium">
            Temporary Login Password
            <input
              type="text"
              required
              className="mt-1"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
            />
          </label>

          <div className="modal-actions pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-primary text-white">
              {busy ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
              Provision Studio
            </Button>
          </div>
        </form>
      </Modal>

      {/* Success Modal */}
      {createdResult && (
        <Modal
          open={successModal}
          onOpenChange={setSuccessModal}
          title="Studio Provisioned Successfully"
          description="Studio tenant is live. Share these credentials with the studio owner."
        >
          <div className="space-y-4">
            <div className="p-4 bg-surface-2 rounded-xl border border-border space-y-2 text-xs font-mono">
              <div>
                <span className="text-muted">Studio:</span>{' '}
                <strong className="text-foreground">{createdResult.studio?.name}</strong>
              </div>
              <div>
                <span className="text-muted">Owner Login Email:</span>{' '}
                <strong className="text-foreground">{createdResult.owner?.email}</strong>
              </div>
              <div>
                <span className="text-muted">Temporary Password:</span>{' '}
                <strong className="text-emerald-500">{createdResult.owner?.temporary_password}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Studio: ${createdResult.studio?.name}\nEmail: ${createdResult.owner?.email}\nPassword: ${createdResult.owner?.temporary_password}`
                  );
                  toast.success('Credentials copied to clipboard!');
                }}
              >
                <Copy size={14} className="mr-1.5" /> Copy Credentials
              </Button>
              <Button size="sm" onClick={() => setSuccessModal(false)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Edit Studio Quotas & Operational Limits */}
      <Modal
        open={manageModal}
        onOpenChange={(v) => {
          setManageModal(v);
          if (!v) setError('');
        }}
        title={`Edit Studio Settings — ${selectedStudio?.name || 'Studio'}`}
        description="Update camera connections and account status. Media stays on studio external servers."
      >
        <form className="form-stack space-y-4" onSubmit={handleManageSubmit}>
          {error && <p className="form-error">{error}</p>}

          <label className="text-xs font-medium">
            Account Operational Status
            <div className="mt-1">
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                searchable={false}
                options={[
                  {
                    value: 'active',
                    label: 'Active (Full Access)',
                    description: 'Normal studio operation with full storage & live ingest access',
                    badge: 'pill-emerald',
                  },
                  {
                    value: 'past_due',
                    label: 'Past Due (Warning Notice)',
                    description: 'Payment grace period with billing warning banner shown to studio',
                    badge: 'pill-amber',
                  },
                  {
                    value: 'suspended',
                    label: 'Suspended (Blocks Ingest & New Shares)',
                    description: 'Locked write access; historical shares remain read-only',
                    badge: 'pill-rose',
                  },
                  {
                    value: 'comped',
                    label: 'Comped (Free Administrative Access)',
                    description: 'Special administrative or promotional waiver without billing charges',
                    badge: 'pill-purple',
                  },
                ]}
              />
            </div>
          </label>

          <div className="modal-actions pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setManageModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-primary text-white">
              {busy ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Invoices & Subscriptions Manager */}
      <Modal
        open={invoicesModal}
        onOpenChange={setInvoicesModal}
        title={`Billing, Invoices & Subscriptions — ${selectedStudio?.name || 'Studio'}`}
        description="Manage itemized invoices, recurring multi-cycle subscriptions, and financial records."
      >
        <div className="space-y-4">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setBillingTab('invoices')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                billingTab === 'invoices'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Itemized Invoices ({studioInvoices.length})
            </button>
            <button
              type="button"
              onClick={() => setBillingTab('subscriptions')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                billingTab === 'subscriptions'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Recurring Subscriptions ({studioSubscriptions.length})
            </button>
          </div>

          {/* TAB 1: INVOICES */}
          {billingTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Studio Invoices</h4>
                <Button
                  size="sm"
                  onClick={() => setCreateInvoiceModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus size={14} /> Create Itemized Bill
                </Button>
              </div>

              {loadingInvoices ? (
                <div className="py-8 text-center text-muted text-xs">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-brand-primary" />
                  Loading invoices…
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {studioInvoices.map((inv) => (
                    <div key={inv.id} className="p-3.5 rounded-xl border border-border bg-surface-2/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground">INV-{inv.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-muted ml-2">
                            {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">₹{Number(inv.total_amount).toLocaleString()}</span>
                          <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'issued' ? 'primary' : 'secondary'} className="capitalize">
                            {inv.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Line Items Preview */}
                      {Array.isArray(inv.line_items) && inv.line_items.length > 0 && (
                        <div className="border-t border-border/60 pt-2 space-y-1">
                          {inv.line_items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] text-muted">
                              <span>{item.description} (x{item.quantity})</span>
                              <span className="font-mono">₹{Number(item.amount).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {inv.notes && (
                        <p className="text-[11px] text-muted italic bg-surface-3/50 px-2 py-1 rounded">
                          {inv.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                        {inv.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                            onClick={() => handleMarkPaid(inv.id)}
                          >
                            <Check size={11} /> Mark Paid
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] flex items-center gap-1"
                          onClick={() => {
                            setEditInvoiceTarget(inv);
                            setEditInvoiceStatus(inv.status);
                            setEditInvoiceNotes(inv.notes || '');
                          }}
                        >
                          <Edit2 size={11} /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                          onClick={() => setDeleteInvoiceTarget(inv)}
                          title="Delete this invoice"
                        >
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {studioInvoices.length === 0 && (
                    <p className="text-center py-6 text-muted text-xs">No invoices created for this studio yet.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECURRING SUBSCRIPTIONS */}
          {billingTab === 'subscriptions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Recurring Plans</h4>
                  <p className="text-[11px] text-muted">Automated billing cycles for this studio</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setCreateSubModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-brand-primary text-white"
                >
                  <Plus size={14} /> Add Subscription
                </Button>
              </div>

              {loadingSubscriptions ? (
                <div className="py-8 text-center text-muted text-xs">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-brand-primary" />
                  Loading subscriptions…
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {studioSubscriptions.map((sub) => (
                    <div key={sub.id} className="p-3.5 rounded-xl border border-border bg-surface-2/40 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground text-sm">{sub.plan_name}</span>
                          <span className="text-muted ml-2 capitalize font-mono text-[11px] bg-surface-3 px-2 py-0.5 rounded border border-border">
                            {sub.interval}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">₹{Number(sub.amount).toLocaleString()}</span>
                          <Badge variant={sub.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                            {sub.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] py-1.5 px-2.5 rounded-lg bg-surface border border-border/60">
                        <div>
                          <span className="block text-muted text-[10px]">Next Billing Date</span>
                          <strong className="text-foreground">
                            {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString() : '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-muted text-[10px]">Storage Quota</span>
                          <strong className="text-foreground">{sub.storage_limit_gb || '—'} GB</strong>
                        </div>
                        <div>
                          <span className="block text-muted text-[10px]">Max Cameras</span>
                          <strong className="text-foreground">{sub.max_cameras || '—'} Cameras</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                        {sub.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                              onClick={() => handleTriggerSubInvoice(sub.id)}
                              title="Immediately generate itemized invoice for this cycle"
                            >
                              <Zap size={11} /> Generate Cycle Invoice
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                              onClick={() => handleCancelSubscription(sub.id)}
                            >
                              Cancel Plan
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {studioSubscriptions.length === 0 && (
                    <p className="text-center py-6 text-muted text-xs">No active subscription schedule configured for this studio.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Create Itemized Invoice (Sales Order Style) */}
      <Modal
        open={createInvoiceModal}
        onOpenChange={setCreateInvoiceModal}
        title={`New Itemized Bill for ${selectedStudio?.name || 'Studio'}`}
        description="Add multiple line items like an order system. This bill is transparently visible to the studio owner."
      >
        <form onSubmit={handleCreateInvoiceSubmit} className="form-stack space-y-3">
          {error && <p className="form-error">{error}</p>}

          <div className="form-grid">
            <label className="text-xs font-medium">
              Billing Period (Days)
              <input
                type="number"
                min={1}
                className="mt-1"
                value={invoicePeriodDays}
                onChange={(e) => setInvoicePeriodDays(Number(e.target.value))}
              />
            </label>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">
                Initial Invoice Status
              </label>
              <Select
                value={invoiceStatus}
                onChange={(e) => setInvoiceStatus(e.target.value)}
                searchable={false}
                options={[
                  { value: 'draft', label: 'Draft (Private to Super Admin)', status: 'warning' },
                  { value: 'issued', label: 'Issued (Sent to Studio)', status: 'pending' },
                  { value: 'paid', label: 'Paid (Payment Already Collected)', status: 'active' },
                ]}
              />
            </div>
          </div>

          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Bill Line Items (Itemized Order)</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs flex items-center gap-1" onClick={handleAddLineItem}>
                <Plus size={12} /> Add Item
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {lineItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-surface-2/60 rounded-xl border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 text-xs bg-surface border border-border rounded px-2.5 py-1.5 font-medium"
                      placeholder="Line item description (e.g. Dedicated Server VPS 500GB)"
                      value={item.description}
                      onChange={(e) => handleUpdateLineItem(idx, 'description', e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-muted hover:text-red-500 p-1"
                      onClick={() => handleRemoveLineItem(idx)}
                      disabled={lineItems.length === 1}
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex-1">
                      <span className="text-[10px] text-muted uppercase">Qty</span>
                      <input
                        type="number"
                        min={1}
                        className="w-full text-xs bg-surface border border-border rounded px-2 py-1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateLineItem(idx, 'quantity', e.target.value)}
                      />
                    </label>
                    <label className="flex-1">
                      <span className="text-[10px] text-muted uppercase">Unit Price (₹)</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full text-xs bg-surface border border-border rounded px-2 py-1"
                        value={item.unit_price}
                        onChange={(e) => handleUpdateLineItem(idx, 'unit_price', e.target.value)}
                      />
                    </label>
                    <div className="flex-1 text-right">
                      <span className="text-[10px] text-muted uppercase block">Subtotal</span>
                      <span className="font-bold text-foreground">₹{Number(item.amount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bill Summary Footer */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border mt-3">
              <span className="font-semibold text-xs">Total Bill Amount:</span>
              <strong className="text-base font-bold text-emerald-500">₹{totalInvoiceAmount.toLocaleString()} INR</strong>
            </div>
          </div>

          <div className="modal-actions pt-4 border-t border-border">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCreateInvoiceModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {busy ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
              Generate & Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Invoice Status & Notes */}
      <Modal
        open={Boolean(editInvoiceTarget)}
        onOpenChange={(open) => !open && setEditInvoiceTarget(null)}
        title={editInvoiceTarget ? `Edit Invoice INV-${editInvoiceTarget.id.slice(0, 8).toUpperCase()}` : 'Edit Invoice'}
        description="Update status or internal notes for this invoice."
      >
        {editInvoiceTarget && (
          <form onSubmit={handleUpdateInvoice} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Invoice Status
              </label>
              <Select
                value={editInvoiceStatus}
                onChange={(e) => setEditInvoiceStatus(e.target.value)}
                searchable={false}
                options={[
                  { value: 'draft', label: 'Draft', status: 'warning' },
                  { value: 'issued', label: 'Issued', status: 'pending' },
                  { value: 'paid', label: 'Paid', status: 'active' },
                  { value: 'canceled', label: 'Canceled', status: 'danger' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Billing Notes / Terms
              </label>
              <textarea
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-brand-primary"
                rows={3}
                placeholder="Optional notes or payment instructions..."
                value={editInvoiceNotes}
                onChange={(e) => setEditInvoiceNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditInvoiceTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-brand-primary text-white"
                disabled={editInvoiceBusy}
              >
                {editInvoiceBusy ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Add Recurring Subscription Schedule */}
      <Modal
        open={createSubModal}
        onOpenChange={setCreateSubModal}
        title={`Add Recurring Subscription — ${selectedStudio?.name || 'Studio'}`}
        description="Configure a recurring billing plan that auto-cycles (monthly, quarterly, or yearly)."
      >
        <form onSubmit={handleCreateSubscription} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Plan / Package Name *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-brand-primary"
              placeholder="e.g. Studio Pro Annual Fleet"
              value={subForm.plan_name}
              onChange={(e) => setSubForm({ ...subForm, plan_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Billing Cycle Interval
              </label>
              <Select
                value={subForm.interval}
                onChange={(e) => setSubForm({ ...subForm, interval: e.target.value })}
                searchable={false}
                options={[
                  { value: 'monthly', label: 'Monthly (Every 30 Days)' },
                  { value: 'quarterly', label: 'Quarterly (Every 90 Days)' },
                  { value: 'yearly', label: 'Yearly (Every 365 Days)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Recurring Price (₹ INR) *
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-brand-primary"
                value={subForm.amount}
                onChange={(e) => setSubForm({ ...subForm, amount: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Included Storage (GB)
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-brand-primary"
                placeholder="500"
                value={subForm.storage_limit_gb}
                onChange={(e) => setSubForm({ ...subForm, storage_limit_gb: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Max Allowed Cameras
              </label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-brand-primary"
                placeholder="5"
                value={subForm.max_cameras}
                onChange={(e) => setSubForm({ ...subForm, max_cameras: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateSubModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand-primary text-white"
              disabled={subBusy}
            >
              {subBusy ? 'Creating…' : 'Create Subscription'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Invoice Modal */}
      <ConfirmModal
        open={Boolean(deleteInvoiceTarget)}
        onOpenChange={(open) => !open && setDeleteInvoiceTarget(null)}
        title="Delete Studio Invoice?"
        description={`Are you sure you want to permanently delete invoice INV-${deleteInvoiceTarget?.id.slice(0, 8).toUpperCase()}? This will remove all associated line items.`}
        confirmText="Delete Invoice"
        variant="danger"
        loading={deleteInvoiceLoading}
        onConfirm={handleDeleteInvoice}
      />
    </div>
  );
}

export default AdminDashboardPage;
