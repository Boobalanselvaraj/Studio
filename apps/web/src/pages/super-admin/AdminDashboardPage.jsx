import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Building2, Plus, Users, HardDrive, Loader2, Edit2 } from 'lucide-react';
import { adminApi } from '../../api/services';

export function AdminDashboardPage() {
  const [studios, setStudios] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [selectedStudio, setSelectedStudio] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Create studio form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [quotaGb, setQuotaGb] = useState(100);
  const [billingPlanId, setBillingPlanId] = useState('');

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
      await adminApi.createStudio({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        subdomain: subdomain.trim() || undefined,
        storage_quota_gb: Number(quotaGb),
        billing_plan_id: billingPlanId || undefined,
      });

      setName('');
      setSlug('');
      setSubdomain('');
      setCreateModal(false);
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

                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-primary" /> {s.name}
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
                    <TableCell colSpan={7} className="text-center py-6 text-muted text-xs">
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
        description="Creates a new multi-tenant organization with its own isolated branding and database storage."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          {error && <p className="form-error">{error}</p>}

          <label>
            Studio Name
            <input
              required
              placeholder="e.g. Lumina Creative Studios"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
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
                placeholder="lumina-studios"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </label>

            <label>
              Subdomain (optional)
              <input
                placeholder="lumina"
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

          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Provision Studio'}
            </Button>
          </div>
        </form>
      </Modal>

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
