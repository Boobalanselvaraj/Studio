import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Building2, Plus, Users, HardDrive, Loader2, Edit2, KeyRound, CheckCircle2, Copy, ArrowRight, UserCheck } from 'lucide-react';
import { adminApi } from '../../api/services';

export function AdminDashboardPage() {
  const [studios, setStudios] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [selectedStudio, setSelectedStudio] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Create studio form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [quotaGb, setQuotaGb] = useState(100);
  const [billingPlanId, setBillingPlanId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('studio123456');

  // Manage studio form
  const [editQuotaGb, setEditQuotaGb] = useState(100);
  const [editStatus, setEditStatus] = useState('active');

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
      const res = await adminApi.createStudio({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        subdomain: subdomain.trim() || undefined,
        storage_quota_gb: Number(quotaGb),
        billing_plan_id: billingPlanId || undefined,
        owner_name: ownerName.trim() || `${name.trim()} Owner`,
        owner_email: ownerEmail.trim().toLowerCase() || `owner@${slug.trim().toLowerCase()}.com`,
        owner_password: ownerPassword.trim() || 'studio123456',
      });

      setCreatedResult(res);
      setCreateModal(false);
      setSuccessModal(true);

      setName('');
      setSlug('');
      setSubdomain('');
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
        storage_quota_gb: Number(editQuotaGb),
        billing_status: editStatus,
      });

      setManageModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update billing profile');
    } finally {
      setBusy(false);
    }
  };

  const openManage = (studio) => {
    setSelectedStudio(studio);
    setEditQuotaGb(studio.studio_billing_profile?.storage_quota_gb || 50);
    setEditStatus(studio.studio_billing_profile?.billing_status || 'active');
    setManageModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Studios Directory</h2>
          <p className="text-sm text-muted">Platform super-admin console for provisioning studio tenants.</p>
        </div>

        <Button onClick={() => setCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Provision New Studio
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading tenants…</span>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered Studio Tenants ({studios.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Studio Name</TableHead>
                  <TableHead>Owner Account</TableHead>
                  <TableHead>Slug / Subdomain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Storage Quota</TableHead>
                  <TableHead>Live Counts</TableHead>
                  <TableHead>Billing Plan</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studios.map((s) => {
                  const quota = s.studio_billing_profile?.storage_quota_gb || 50;
                  const plan = s.studio_billing_profile?.billing_plan?.name || 'Custom';
                  const billingStatus = s.studio_billing_profile?.billing_status || 'active';
                  const owner = s.studio_users?.find((su) => su.role === 'studio_owner')?.user;

                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-primary" /> {s.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {owner ? (
                          <div>
                            <span className="font-medium text-foreground">{owner.full_name}</span>
                            <p className="text-muted text-[11px]">{owner.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted">
                        <code>{s.slug}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={billingStatus === 'active' ? 'success' : 'warning'}>
                          {billingStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{quota} GB</TableCell>
                      <TableCell className="text-xs text-muted">
                        {s._count?.events || 0} shoots · {s._count?.customers || 0} clients · {s._count?.cameras || 0} cams
                      </TableCell>
                      <TableCell className="text-xs">{plan}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManage(s)}
                        >
                          <Edit2 size={12} className="mr-1" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {studios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted text-xs">
                      No studio tenants registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Provision Studio Modal */}
      <Modal
        open={createModal}
        onOpenChange={(v) => {
          setCreateModal(v);
          if (!v) setError('');
        }}
        title="Provision New Studio Tenant"
        description="Creates a new studio tenant along with its dedicated Studio Owner login credentials."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          {error && <p className="form-error">{error}</p>}

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mt-1">1. Studio Organization</h3>

          <label>
            Studio Name
            <input
              required
              placeholder="e.g. Aura Photography Studio"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  const autoSlug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  setSlug(autoSlug);
                  if (!ownerEmail) {
                    setOwnerEmail(`owner@${autoSlug || 'studio'}.com`);
                  }
                }
              }}
            />
          </label>

          <div className="form-grid">
            <label>
              Tenant Slug
              <input
                required
                pattern="[a-z0-9-]+"
                placeholder="aura-studio"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </label>

            <label>
              Subdomain (optional)
              <input
                placeholder="aura"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              Storage Quota (GB)
              <input
                type="number"
                min={10}
                required
                value={quotaGb}
                onChange={(e) => setQuotaGb(e.target.value)}
              />
            </label>

            <label>
              Billing Plan Tier
              <select
                value={billingPlanId}
                onChange={(e) => setBillingPlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (₹{p.price_per_month}/mo)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mt-3">2. Studio Owner Login Credentials</h3>

          <label>
            Owner Full Name
            <input
              required
              placeholder="e.g. Rajesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </label>

          <div className="form-grid">
            <label>
              Owner Login Email
              <input
                type="email"
                required
                placeholder="owner@aurastudio.com"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </label>

            <label>
              Owner Login Password
              <input
                type="text"
                required
                placeholder="studio123456"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions mt-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Provision Studio & Owner'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Success Credentials Modal */}
      {createdResult && (
        <Modal
          open={successModal}
          onOpenChange={setSuccessModal}
          title="Studio Provisioned Successfully!"
          description="The studio workspace and owner account have been created. Save these credentials to log in."
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs">
              <p className="font-semibold flex items-center gap-1.5 text-sm mb-1">
                <CheckCircle2 size={16} className="text-emerald-500" />
                {createdResult.studio?.name || 'Studio'} is ready
              </p>
              <p className="text-muted-foreground">
                You can now log in directly with these credentials at <code>/login</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-muted border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted">Studio Slug:</span>
                <span className="font-mono font-semibold">{createdResult.studio?.slug}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Owner Name:</span>
                <span className="font-semibold">{createdResult.owner?.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Login Email:</span>
                <span className="font-mono font-bold text-brand-primary">{createdResult.owner?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Login Password:</span>
                <span className="font-mono font-bold text-foreground">{createdResult.owner?.temporary_password}</span>
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
                  alert('Credentials copied to clipboard!');
                }}
              >
                <Copy size={14} className="mr-1.5" /> Copy Credentials
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSuccessModal(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Studio Modal */}
      <Modal
        open={manageModal}
        onOpenChange={(v) => {
          setManageModal(v);
          if (!v) setError('');
        }}
        title={`Manage ${selectedStudio?.name || 'Studio'}`}
        description="Update storage limits and billing account status for this tenant."
      >
        <form className="form-stack" onSubmit={handleManageSubmit}>
          {error && <p className="form-error">{error}</p>}

          <label>
            Allocated Storage Quota (GB)
            <input
              type="number"
              min={10}
              required
              value={editQuotaGb}
              onChange={(e) => setEditQuotaGb(e.target.value)}
            />
          </label>

          <label>
            Account Billing Status
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="suspended">Suspended</option>
              <option value="comped">Comped (Free Tier)</option>
            </select>
          </label>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setManageModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
