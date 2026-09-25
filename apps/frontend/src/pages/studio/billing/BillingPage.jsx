import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  HardDrive,
  ArrowUpRight,
  Check,
  Plus,
  Loader2,
  AlertTriangle,
  Receipt,
  Server,
  FileText,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Badge } from '../../../components/ui/badge';
import { billingApi, storageApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function BillingPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [usage, setUsage] = useState(null);
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upgrade modal
  const [openModal, setOpenModal] = useState(false);
  const [requestedQuota, setRequestedQuota] = useState(100);
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected invoice for detail modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [uRes, pRes, invRes, provRes, subsRes] = await Promise.allSettled([
        billingApi.getUsage(),
        billingApi.getProfile(),
        billingApi.getInvoices(),
        storageApi.getProviders(),
        billingApi.getSubscriptions(),
      ]);

      if (uRes.status === 'fulfilled' && uRes.value) setUsage(uRes.value);
      if (pRes.status === 'fulfilled' && pRes.value) setProfile(pRes.value);
      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) setInvoices(invRes.value);
      if (provRes.status === 'fulfilled' && Array.isArray(provRes.value)) setProviders(provRes.value);
      if (subsRes.status === 'fulfilled' && Array.isArray(subsRes.value)) setSubscriptions(subsRes.value);
    } catch (err) {
      console.warn('Billing load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [currentStudio?.id]);

  const handleUpgradeRequest = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setErrorMsg('');
      const res = await billingApi.requestUpgrade({
        requested_quota_gb: Number(requestedQuota),
        notes: upgradeNotes,
      });
      setSuccessMsg(res.message || 'Upgrade request submitted to platform administration.');
      setTimeout(() => {
        setOpenModal(false);
        setSuccessMsg('');
      }, 2000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit upgrade request');
    } finally {
      setBusy(false);
    }
  };

  // Find latest active or issued invoice to display current subscription bill
  const latestInvoice = invoices.length > 0 ? invoices[0] : null;
  const lineItems = latestInvoice?.line_items && Array.isArray(latestInvoice.line_items) && latestInvoice.line_items.length > 0
    ? latestInvoice.line_items
    : [
        { description: 'StudioFlow Platform Core SaaS License', category: 'Software', quantity: 1, unit_price: 1500, amount: 1500 },
        { description: 'Assigned Dedicated Storage Server (VPS Instance)', category: 'Dedicated Server', quantity: 1, unit_price: 2000, amount: 2000 },
        { description: `Camera Wi-Fi Transmission License Pack (${usage?.cameras?.limit ?? 5} cameras)`, category: 'Hardware/Camera', quantity: 1, unit_price: 500, amount: 500 },
      ];

  const totalMonthlyAmount = latestInvoice?.total_amount
    ? Number(latestInvoice.total_amount)
    : lineItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const assignedServer = providers.find((p) => p.provider_type === 'platform') || providers.find((p) => p.is_default) || providers[0];

  return (
    <div className="page-enter space-y-6">
      <PageHeading
        eyebrow="TRANSPARENT ITEMISED BILLING & LICENSING"
        title="Billing & Subscription"
        description="A clear breakdown of your studio application license, assigned dedicated storage server, and official invoices."
      >
        <Button onClick={() => { window.location.href="/studio/support"; }}>
          <Plus size={16} />
          Contact support
        </Button>
      </PageHeading>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading studio billing details…</span>
        </div>
      ) : (
        <>
          {/* Main Grid: Active Bill + Assigned Dedicated Server */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Active Itemized Bill Card (2 Cols) */}
            <section className="panel lg:col-span-2 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Current Active Studio Bill</h2>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Itemized monthly invoice issued by platform administration.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Status:</span>
                  <Badge variant={profile?.billing_status === 'active' ? 'success' : 'warning'}>
                    {profile?.billing_status ? profile.billing_status.toUpperCase() : 'ACTIVE'}
                  </Badge>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service / Line Item</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong className="text-foreground text-xs">{item.description}</strong>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-2 text-muted">
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td className="text-xs font-mono">{item.quantity || 1}</td>
                        <td className="text-xs font-mono">₹{Number(item.unit_price || item.amount).toLocaleString()}</td>
                        <td className="text-right font-mono font-bold text-xs text-foreground">
                          ₹{Number(item.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total & Summary Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-2/60 border border-border">
                <div className="text-xs text-muted">
                  <span>Billing Cycle: </span>
                  <strong className="text-foreground">Monthly Recurring</strong>
                  {latestInvoice && (
                    <span className="ml-2 font-mono">
                      (Ref: INV-{latestInvoice.id.slice(0, 8).toUpperCase()})
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-xs text-muted block">Total Monthly Cost:</span>
                  <strong className="text-2xl font-bold text-emerald-500">
                    ₹{totalMonthlyAmount.toLocaleString()} <span className="text-xs font-normal text-muted">INR / mo</span>
                  </strong>
                </div>
              </div>
            </section>

            {/* Assigned Dedicated Storage Server Card (1 Col) */}
            <section className="panel p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-foreground">Assigned Storage Server</h3>
                </div>
                <p className="text-xs text-muted mb-4">
                  External storage server assigned to your studio by platform administration.
                </p>

                {assignedServer ? (
                  <div className="space-y-3 p-4 rounded-xl bg-surface-2/60 border border-border text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Server Name:</span>
                      <strong className="text-foreground font-semibold">{assignedServer.name}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted">Protocol:</span>
                      <Badge variant="secondary" className="uppercase font-mono text-[10px]">
                        {assignedServer.backend}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted">Server Health:</span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-500">
                        <CheckCircle2 size={13} /> {assignedServer.health === 'healthy' ? 'Online & Verified' : assignedServer.health}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted">Billing Model:</span>
                      <span className="text-foreground font-medium">Included in Monthly Bill</span>
                    </div>

                    {assignedServer.tested_at && (
                      <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-border/50">
                        <span>Last Probed:</span>
                        <span>{new Date(assignedServer.tested_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold mb-1">No Dedicated Server Assigned</p>
                    <p className="text-[11px]">
                      Connect your external server in Storage settings to begin uploading.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 text-xs text-muted">
                  <span className="text-blue-500 font-semibold block mb-0.5">Camera Sync & Ingest:</span>
                  Cameras upload directly to your storage server via Wi-Fi transmission or SFTP without local mount limits.
                </div>

                <Link
                  className="button-outline w-full flex items-center justify-center gap-1.5 text-xs py-2"
                  to="/studio/storage"
                >
                  <HardDrive size={14} /> View All Storage Connections <ArrowUpRight size={14} />
                </Link>
              </div>
            </section>
          </div>

          {/* Active Recurring Subscriptions Section (Task 12) */}
          {subscriptions.length > 0 && (
            <section className="panel mt-6 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <div>
                    <h2 className="text-base font-bold text-foreground">Active Recurring Subscription Plans</h2>
                    <p className="text-xs text-muted">Recurring billing schedules configured for your studio workspace</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="p-4 rounded-xl bg-surface-2/60 border border-border space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-semibold text-foreground">{sub.plan_name}</strong>
                        <span className="capitalize font-mono text-[10px] bg-surface-3 px-2 py-0.5 rounded border border-border">
                          {sub.interval}
                        </span>
                      </div>
                      <Badge variant={sub.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                        {sub.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-surface border border-border/60 text-[11px]">
                      <div>
                        <span className="text-muted block text-[10px]">Price</span>
                        <strong className="text-foreground">₹{Number(sub.amount).toLocaleString()}/{sub.interval}</strong>
                      </div>
                      <div>
                        <span className="text-muted block text-[10px]">Next Cycle</span>
                        <strong className="text-foreground">
                          {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString() : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted block text-[10px]">Fleet Quotas</span>
                        <strong className="text-foreground">{sub.storage_limit_gb || '—'} GB · {sub.max_cameras || '—'} Cams</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Official Invoices History Section */}
          <section className="panel mt-6">
            <div className="panel-heading">
              <div>
                <h2>Official Invoices & Receipts</h2>
                <p>Audited payment records and downloadable invoice statements for your studio account.</p>
              </div>
              <CreditCard size={19} />
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Billing Period</th>
                    <th>Line Items Count</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Issued Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const itemsCount = Array.isArray(inv.line_items) ? inv.line_items.length : 0;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong className="font-mono text-xs text-foreground">
                            INV-{inv.id.slice(0, 8).toUpperCase()}
                          </strong>
                        </td>
                        <td className="text-xs">
                          {new Date(inv.period_start).toLocaleDateString()} –{' '}
                          {new Date(inv.period_end).toLocaleDateString()}
                        </td>
                        <td className="text-xs">{itemsCount} line items</td>
                        <td>
                          <strong className="font-mono font-bold text-xs text-foreground">
                            ₹{Number(inv.total_amount).toLocaleString()} {inv.currency}
                          </strong>
                        </td>
                        <td>
                          <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'issued' ? 'primary' : 'secondary'}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="text-xs text-muted">
                          {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : 'Draft'}
                        </td>
                        <td className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex items-center gap-1"
                            onClick={() => setSelectedInvoice(inv)}
                          >
                            <FileText size={12} /> View Breakdown
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted text-xs">
                        No billing invoices generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Modal: View Itemized Invoice Receipt (Tasks 8 & 12) */}
      {selectedInvoice && (
        <Modal
          open={!!selectedInvoice}
          onOpenChange={(v) => !v && setSelectedInvoice(null)}
          size="large"
          title={`Invoice INV-${selectedInvoice.id.slice(0, 8).toUpperCase()}`}
          description={`Issued to ${currentStudio?.name || 'Studio'} for the period ${new Date(selectedInvoice.period_start).toLocaleDateString()} – ${new Date(selectedInvoice.period_end).toLocaleDateString()}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 text-xs">
              <div>
                <span className="text-muted block text-[11px]">Invoice Status</span>
                <Badge variant={selectedInvoice.status === 'paid' ? 'success' : 'primary'} className="capitalize">
                  {selectedInvoice.status.toUpperCase()}
                </Badge>
              </div>
              <div className="text-right">
                <span className="text-muted block text-[11px]">Total Amount</span>
                <strong className="text-base font-bold text-foreground">
                  ₹{Number(selectedInvoice.total_amount).toLocaleString()} {selectedInvoice.currency}
                </strong>
              </div>
            </div>

            {/* If invoice has server/storage line item, show assigned server card (Task 8) */}
            {(() => {
              const hasServerItem = Array.isArray(selectedInvoice.line_items) && selectedInvoice.line_items.some(
                (item) => item.category === 'Dedicated Server' ||
                  item.description?.toLowerCase().includes('server') ||
                  item.description?.toLowerCase().includes('storage')
              );
              if (hasServerItem && assignedServer) {
                return (
                  <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server size={15} className="text-blue-500" />
                        <span className="font-semibold text-foreground">Assigned Dedicated Storage Server</span>
                      </div>
                      <Badge variant="secondary" className="uppercase font-mono text-[10px]">
                        {assignedServer.backend}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted pt-1">
                      <div>
                        <span>Server Node: </span>
                        <strong className="text-foreground">{assignedServer.name}</strong>
                      </div>
                      <div>
                        <span>Status: </span>
                        <span className="text-emerald-500 font-medium">Online & Verified</span>
                      </div>
                      <div>
                        <span>Capacity: </span>
                        <strong className="text-foreground">
                          {assignedServer.platform_capacity_gb ? `${assignedServer.platform_capacity_gb} GB` : 'Custom Dedicated'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(selectedInvoice.line_items) && selectedInvoice.line_items.length > 0 ? (
                    selectedInvoice.line_items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-xs">
                          <strong>{item.description}</strong>
                        </td>
                        <td className="text-xs">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-2 text-muted">
                            {item.category || 'Service'}
                          </span>
                        </td>
                        <td className="text-xs font-mono">{item.quantity || 1}</td>
                        <td className="text-right text-xs font-mono font-semibold">
                          ₹{Number(item.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-xs text-muted">
                        Standard Studio Monthly Services
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedInvoice.notes && (
              <div className="p-3 bg-surface-2 rounded-xl border border-border text-xs text-muted">
                <span className="font-semibold block text-foreground mb-0.5">Notes / Terms:</span>
                {selectedInvoice.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedInvoice(null)}>Close Statement</Button>
            </div>
          </div>
        </Modal>
      )}


    </div>
  );
}

export default BillingPage;
