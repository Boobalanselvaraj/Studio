import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import {
  Plus,
  Loader2,
  Receipt,
  Server,
  Camera,
  Layers,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Check,
  X,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  Clock,
  Eye,
  CreditCard,
  Building2,
} from 'lucide-react';
import { adminApi } from '../../api/services';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';

const defaultLineItems = [
  {
    description: 'StudioFlow Platform Software License (Monthly)',
    category: 'Software',
    quantity: 1,
    unit_price: 1500,
    amount: 1500,
  },
  {
    description: 'External Storage Server Integration & Sync Connector',
    category: 'Storage Integration',
    quantity: 1,
    unit_price: 2000,
    amount: 2000,
  },
  {
    description: 'Camera Direct Wi-Fi Transmission License Pack (5 cameras)',
    category: 'Hardware/Camera',
    quantity: 1,
    unit_price: 500,
    amount: 500,
  },
];

export function BillingPlansPage() {
  const [invoices, setInvoices] = useState([]);
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [query, setQuery] = useState('');
  const [selectedStudioFilter, setSelectedStudioFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [deleteInvoiceModal, setDeleteInvoiceModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Create form state
  const [targetStudioId, setTargetStudioId] = useState('');
  const [periodDays, setPeriodDays] = useState(30);
  const [newStatus, setNewStatus] = useState('issued');
  const [lineItems, setLineItems] = useState(defaultLineItems);

  // Edit form state
  const [editStatus, setEditStatus] = useState('issued');

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, stuData] = await Promise.allSettled([
        adminApi.listAllInvoices(),
        adminApi.listStudios(),
      ]);

      if (invData.status === 'fulfilled' && Array.isArray(invData.value)) {
        setInvoices(invData.value);
      }
      if (stuData.status === 'fulfilled' && Array.isArray(stuData.value)) {
        setStudios(stuData.value);
        if (stuData.value.length > 0 && !targetStudioId) {
          setTargetStudioId(stuData.value[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load billing monitor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalInvoiceAmount = lineItems.reduce(
    (sum, it) => sum + Number(it.amount || Number(it.unit_price || 0) * Number(it.quantity || 1)),
    0
  );

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!targetStudioId) {
      setError('Please select a studio');
      return;
    }

    try {
      setBusy(true);
      setError('');

      const periodStart = new Date();
      const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

      await adminApi.generateStudioInvoice(targetStudioId, {
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_amount: totalInvoiceAmount,
        currency: 'INR',
        line_items: lineItems,
        status: newStatus,
      });

      setCreateModal(false);
      setSuccessMsg('Invoice generated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create invoice');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      setBusy(true);
      await adminApi.updateStudioInvoice(selectedInvoice.studio_id, selectedInvoice.id, {
        status: editStatus,
      });
      setEditModal(false);
      setSuccessMsg(`Invoice #${selectedInvoice.id.slice(0, 8)} status updated to ${editStatus}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update invoice');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async (inv) => {
    try {
      setBusy(true);
      await adminApi.recordManualPayment(inv.studio_id, inv.id, {
        notes: 'Manual payment verified by Super Admin',
      });
      toast.success(`Invoice #${inv.id.slice(0, 8)} recorded as Paid.`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setBusy(false);
    }
  };

  const triggerDeleteInvoice = (inv) => {
    setInvoiceToDelete(inv);
    setDeleteInvoiceModal(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      setDeleteBusy(true);
      await adminApi.deleteStudioInvoice(invoiceToDelete.studio_id, invoiceToDelete.id);
      toast.success('Invoice removed successfully.');
      setDeleteInvoiceModal(false);
      setInvoiceToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete invoice');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Calculations
  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
  const totalCollected = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
  const totalPending = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

  const filteredInvoices = invoices.filter((i) => {
    if (selectedStudioFilter !== 'all' && i.studio_id !== selectedStudioFilter) return false;
    if (selectedStatusFilter !== 'all' && i.status !== selectedStatusFilter) return false;
    if (query.trim()) {
      const matchText = `${i.studio?.name || ''} ${i.studio?.slug || ''} ${i.id} ${i.currency}`.toLowerCase();
      if (!matchText.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Platform Billing & Invoicing Monitor
          </h2>
          <p className="text-sm text-muted">
            Monitor studio billing across tenants, issue itemized invoices (licenses, external server services, support), and record audited payments.
          </p>
        </div>

        <Button
          onClick={() => {
            setLineItems(defaultLineItems);
            setCreateModal(true);
          }}
          className="flex items-center gap-2 bg-brand-primary text-white"
        >
          <Plus size={16} /> Create Studio Invoice
        </Button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </span>
          <button onClick={() => setSuccessMsg('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {error && !createModal && !editModal && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </span>
          <button onClick={() => setError('')} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Revenue & Billing Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted uppercase">Total Invoiced</CardTitle>
            <Receipt size={16} className="text-brand-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">₹{totalBilled.toLocaleString()}</div>
            <p className="text-[11px] text-muted mt-1">{invoices.length} total invoices issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted uppercase">Collected / Paid</CardTitle>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{totalCollected.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted mt-1">
              {invoices.filter((i) => i.status === 'paid').length} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted uppercase">Pending / Overdue</CardTitle>
            <Clock size={16} className="text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ₹{totalPending.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted mt-1">
              {invoices.filter((i) => i.status !== 'paid').length} awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted uppercase">Active Tenants</CardTitle>
            <Building2 size={16} className="text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{studios.length}</div>
            <p className="text-[11px] text-muted mt-1">Direct itemized billing</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-1 border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <label className="inline-search">
            <Search size={15} />
            <input
              placeholder="Search invoices by studio or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-xs"
            />
          </label>

          <Select
            value={selectedStudioFilter}
            onChange={(e) => setSelectedStudioFilter(e.target.value)}
            searchable={studios.length >= 7}
            className="w-48 text-xs"
            options={[
              { value: 'all', label: 'All Studios' },
              ...studios.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />

          <Select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            searchable={false}
            className="w-36 text-xs"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'paid', label: 'Paid', status: 'active' },
              { value: 'issued', label: 'Issued', status: 'pending' },
              { value: 'draft', label: 'Draft', status: 'warning' },
            ]}
          />
        </div>

        <span className="text-xs text-muted">
          Showing {filteredInvoices.length} of {invoices.length} invoice
          {invoices.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Invoices List Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading invoices…</span>
        </div>
      ) : (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Tenant Billing & Invoices Ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Studio</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Itemized Items</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => {
                  const itemsCount = Array.isArray(inv.line_items) ? inv.line_items.length : 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        #{inv.id.slice(0, 8)}
                      </TableCell>

                      <TableCell>
                        <strong className="text-xs block text-foreground">
                          {inv.studio?.name || 'Studio'}
                        </strong>
                        <span className="text-[11px] text-muted font-mono">{inv.studio?.slug}</span>
                      </TableCell>

                      <TableCell className="text-xs text-muted">
                        <div>{new Date(inv.period_start).toLocaleDateString()}</div>
                        <div className="text-[11px]">to {new Date(inv.period_end).toLocaleDateString()}</div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-medium block">
                          {itemsCount} line item{itemsCount === 1 ? '' : 's'}
                        </span>
                        {Array.isArray(inv.line_items) && inv.line_items[0] && (
                          <span className="text-[11px] text-muted truncate max-w-xs block">
                            {inv.line_items[0].description}
                            {itemsCount > 1 ? ` (+${itemsCount - 1} more)` : ''}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="font-bold text-xs">
                        {inv.currency || 'INR'} {Number(inv.total_amount).toLocaleString()}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-medium capitalize ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : inv.status === 'issued'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 hover:text-emerald-700 h-7 text-xs flex items-center gap-1"
                              onClick={() => handleMarkPaid(inv)}
                              title="Mark as paid"
                            >
                              <Check size={12} />
                              <span>Paid</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs flex items-center gap-1"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setEditStatus(inv.status);
                              setEditModal(true);
                            }}
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-500 hover:text-red-600 p-1"
                            onClick={() => triggerDeleteInvoice(inv)}
                            title="Delete invoice"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredInvoices.length === 0 && (
              <div className="empty-state py-12 text-center">
                <Receipt size={32} className="text-muted mx-auto mb-2" />
                <h3 className="text-sm font-semibold">No invoices found</h3>
                <p className="text-xs text-muted mb-4">
                  Try another filter or create an itemized invoice for a studio.
                </p>
                <Button onClick={() => setCreateModal(true)} className="bg-brand-primary text-white">
                  <Plus size={16} /> Create Invoice
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Invoice Modal */}
      <Modal
        open={createModal}
        onOpenChange={(v) => {
          setCreateModal(v);
          if (!v) setError('');
        }}
        title="Create Studio Invoice"
        description="Issue an itemized bill for a studio tenant covering software, external server services, and support."
      >
        <form onSubmit={handleCreateInvoice} className="form-stack space-y-3">
          {error && <p className="form-error">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">Target Studio *</label>
            <Select
              value={targetStudioId}
              onChange={(e) => setTargetStudioId(e.target.value)}
              placeholder="Select Studio..."
              searchable={studios.length >= 7}
              options={studios.map((s) => ({
                value: s.id,
                label: `🏢 ${s.name} (${s.slug})`,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              Billing Period (Days)
              <input
                type="number"
                min={1}
                max={365}
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
              />
            </label>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">Initial Status</label>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                searchable={false}
                options={[
                  { value: 'issued', label: 'Issued / Sent', status: 'pending' },
                  { value: 'draft', label: 'Draft', status: 'warning' },
                  { value: 'paid', label: 'Paid', status: 'active' },
                ]}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-muted">Line Items</label>
              <button
                type="button"
                className="text-xs text-brand-primary hover:underline font-medium"
                onClick={() =>
                  setLineItems([
                    ...lineItems,
                    {
                      description: 'Custom Service / Support',
                      category: 'Service',
                      quantity: 1,
                      unit_price: 500,
                      amount: 500,
                    },
                  ])
                }
              >
                + Add Line Item
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-surface-2 rounded-lg border border-border space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[idx].description = e.target.value;
                        setLineItems(updated);
                      }}
                      className="flex-1 text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-600 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[11px] text-muted">
                      Category
                      <input
                        value={item.category}
                        onChange={(e) => {
                          const updated = [...lineItems];
                          updated[idx].category = e.target.value;
                          setLineItems(updated);
                        }}
                        className="text-xs"
                      />
                    </label>

                    <label className="text-[11px] text-muted">
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...lineItems];
                          updated[idx].quantity = Number(e.target.value);
                          updated[idx].amount =
                            Number(e.target.value) * Number(updated[idx].unit_price);
                          setLineItems(updated);
                        }}
                        className="text-xs"
                      />
                    </label>

                    <label className="text-[11px] text-muted">
                      Unit Price (₹)
                      <input
                        type="number"
                        min={0}
                        value={item.unit_price}
                        onChange={(e) => {
                          const updated = [...lineItems];
                          updated[idx].unit_price = Number(e.target.value);
                          updated[idx].amount =
                            Number(updated[idx].quantity) * Number(e.target.value);
                          setLineItems(updated);
                        }}
                        className="text-xs"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-surface-2 rounded-lg flex items-center justify-between font-bold text-sm">
            <span>Total Amount:</span>
            <span className="text-brand-primary">₹{totalInvoiceAmount.toLocaleString()} INR</span>
          </div>

          <div className="modal-actions pt-3 border-t border-border">
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-primary text-white">
              {busy ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
              Generate & Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Status Modal */}
      <Modal
        open={editModal}
        onOpenChange={(v) => {
          setEditModal(v);
          if (!v) setError('');
        }}
        title={`Update Invoice #${selectedInvoice?.id.slice(0, 8)}`}
        description="Change payment state or notes."
      >
        <form onSubmit={handleUpdateStatus} className="form-stack space-y-3">
          {error && <p className="form-error">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">Payment Status</label>
            <Select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              searchable={false}
              options={[
                { value: 'issued', label: 'Issued / Unpaid', status: 'pending' },
                { value: 'paid', label: 'Paid', status: 'active' },
                { value: 'draft', label: 'Draft', status: 'warning' },
                { value: 'cancelled', label: 'Cancelled', status: 'danger' },
              ]}
            />
          </div>

          <div className="modal-actions pt-3 border-t border-border">
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => setEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-brand-primary text-white">
              {busy ? 'Saving…' : 'Save Status'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Invoice Confirm Modal */}
      <ConfirmModal
        open={deleteInvoiceModal}
        onOpenChange={setDeleteInvoiceModal}
        title={`Delete invoice #${invoiceToDelete?.id?.slice(0, 8) || ''}?`}
        description="This action will permanently delete this invoice record from the studio billing ledger. This action cannot be undone."
        confirmText="Delete Invoice"
        variant="danger"
        loading={deleteBusy}
        onConfirm={confirmDeleteInvoice}
      />
    </div>
  );
}

export default BillingPlansPage;
