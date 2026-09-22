import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  LifeBuoy,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Building2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  FileText,
  HardDrive,
  Camera,
  MessageSquare,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';
import { adminApi } from '../../api/services';

export function SupportTicketsPage() {
  const [requests, setRequests] = useState([]);
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Create Form State
  const [targetStudioId, setTargetStudioId] = useState('');
  const [requestedQuotaGb, setRequestedQuotaGb] = useState(100);
  const [requestedCameraLimit, setRequestedCameraLimit] = useState(5);
  const [inquiryNotes, setInquiryNotes] = useState('');

  // Edit Form State
  const [editStatus, setEditStatus] = useState('pending');
  const [editQuotaGb, setEditQuotaGb] = useState(100);
  const [editCameraLimit, setEditCameraLimit] = useState(5);
  const [editNotes, setEditNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [requestsData, studiosData] = await Promise.allSettled([
        adminApi.listAllocationRequests(),
        adminApi.listStudios(),
      ]);

      if (requestsData.status === 'fulfilled' && Array.isArray(requestsData.value)) {
        setRequests(requestsData.value);
      }
      if (studiosData.status === 'fulfilled' && Array.isArray(studiosData.value)) {
        setStudios(studiosData.value);
        if (studiosData.value.length > 0 && !targetStudioId) {
          setTargetStudioId(studiosData.value[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load support inquiries:', err);
      toast.error('Failed to load support inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!targetStudioId) {
      toast.warning('Please select a studio tenant');
      return;
    }

    try {
      setBusy(true);
      await adminApi.createAllocationRequest({
        studio_id: targetStudioId,
        requested_quota_gb: Number(requestedQuotaGb),
        requested_camera_limit: Number(requestedCameraLimit),
        notes: inquiryNotes.trim() || 'Direct support inquiry / resource request',
      });

      toast.success('Support inquiry created successfully');
      setCreateModal(false);
      setInquiryNotes('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to file support inquiry');
    } finally {
      setBusy(false);
    }
  };

  const openEditTicket = (t) => {
    setSelectedTicket(t);
    setEditStatus(t.status || 'pending');
    setEditQuotaGb(t.requested_quota_gb || 100);
    setEditCameraLimit(t.requested_camera_limit || 5);
    setEditNotes(t.notes || '');
    setEditModal(true);
  };

  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setBusy(true);
      await adminApi.updateAllocationRequest(selectedTicket.id, {
        status: editStatus,
        notes: editNotes,
        requested_quota_gb: Number(editQuotaGb),
        requested_camera_limit: Number(editCameraLimit),
      });

      toast.success('Support inquiry updated');
      setEditModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update inquiry');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickResolve = async (ticketId, status) => {
    try {
      await adminApi.resolveAllocationRequest(ticketId, { status, apply_quota: true });
      toast.success(
        status === 'approved'
          ? 'Request approved and studio resource quota applied!'
          : 'Request marked as rejected.'
      );
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update request');
    }
  };

  const triggerDelete = (ticket) => {
    setTicketToDelete(ticket);
    setDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!ticketToDelete) return;
    try {
      setDeleteBusy(true);
      await adminApi.deleteAllocationRequest(ticketToDelete.id);
      toast.success('Support inquiry deleted');
      setDeleteModal(false);
      setTicketToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete inquiry');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Metrics
  const totalTickets = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected' || r.status === 'closed').length;

  // Filtered list
  const filteredTickets = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchStudio = r.studio?.name?.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q);
        const matchId = r.id?.toLowerCase().includes(q);
        if (!matchStudio && !matchNotes && !matchId) return false;
      }
      return true;
    });
  }, [requests, statusFilter, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="text-brand-primary" size={26} />
            Support Inquiries & Resource Requests
          </h1>
          <p className="text-sm text-muted">
            Manage studio tenant support tickets, storage quota upgrade requests, and camera limit increases.
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

          <Button
            size="sm"
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-1.5 text-xs bg-brand-primary text-white"
          >
            <Plus size={14} />
            File Support Inquiry
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Total Inquiries
              <Inbox size={16} className="text-brand-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTickets}</div>
            <p className="text-[11px] text-muted mt-0.5">Lifetime tenant requests</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Pending Review
              <Clock size={16} className="text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{pendingCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Awaiting admin review</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Approved & Applied
              <CheckCircle2 size={16} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{approvedCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Quotas upgraded & applied</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-1 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted flex items-center justify-between">
              Rejected / Closed
              <AlertCircle size={16} className="text-muted" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted">{rejectedCount}</div>
            <p className="text-[11px] text-muted mt-0.5">Closed without changes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-1 p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search tickets by studio, note, or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-xs bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            searchable={false}
            className="w-40 text-xs"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </div>
      </div>

      {/* Tickets Table */}
      <Card className="border-border bg-surface-1 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-muted">Ticket Details</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Studio Tenant</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Requested Quotas</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Inquiry Description</TableHead>
                <TableHead className="font-semibold text-xs text-muted">Status</TableHead>
                <TableHead className="font-semibold text-xs text-muted text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted text-xs">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-brand-primary" />
                    Loading support tickets…
                  </TableCell>
                </TableRow>
              ) : filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted text-xs">
                    <Inbox size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No support inquiries found</p>
                    <p className="text-[11px] mt-0.5">Studio quota inquiries and support tickets will appear here.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((t) => (
                  <TableRow key={t.id} className="border-border hover:bg-surface-2/60 transition-colors">
                    <TableCell className="font-medium text-xs text-foreground">
                      <div className="font-mono text-xs font-semibold">#{t.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>

                    <TableCell>
                      {t.studio ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Building2 size={13} className="text-brand-primary" />
                          <span>{t.studio.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted italic">Unknown Studio</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 text-foreground font-mono text-[11px]">
                          <HardDrive size={11} className="text-indigo-500" />
                          {t.requested_quota_gb} GB
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 text-foreground font-mono text-[11px]">
                          <Camera size={11} className="text-emerald-500" />
                          {t.requested_camera_limit} cams
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted max-w-xs truncate">
                      {t.notes || 'No description provided'}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold uppercase ${
                          t.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : t.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => handleQuickResolve(t.id, 'approved')}
                              title="Approve & Apply Quota"
                            >
                              <Check size={12} className="mr-1" /> Approve
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              onClick={() => handleQuickResolve(t.id, 'rejected')}
                              title="Reject Request"
                            >
                              <X size={12} className="mr-1" /> Reject
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={() => openEditTicket(t)}
                          title="Edit ticket details"
                        >
                          <Edit2 size={12} className="mr-1" /> Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 p-1"
                          onClick={() => triggerDelete(t)}
                          title="Delete ticket"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: File Support Inquiry */}
      <Modal
        open={createModal}
        onOpenChange={setCreateModal}
        title={
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-brand-primary" />
            <span>File Studio Support Inquiry / Request</span>
          </div>
        }
        description="Submit a resource upgrade or support request for a studio tenant."
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 pt-2">
          <label className="text-xs font-semibold text-foreground space-y-1 block">
            <span>Studio Tenant *</span>
            <select
              required
              value={targetStudioId}
              onChange={(e) => setTargetStudioId(e.target.value)}
              className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Target Storage Quota (GB) *</span>
              <input
                type="number"
                min="10"
                max="5000"
                value={requestedQuotaGb}
                onChange={(e) => setRequestedQuotaGb(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </label>

            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Target Camera Limit *</span>
              <input
                type="number"
                min="1"
                max="50"
                value={requestedCameraLimit}
                onChange={(e) => setRequestedCameraLimit(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </label>
          </div>

          <label className="text-xs font-semibold text-foreground space-y-1 block">
            <span>Inquiry Reason / Client Request Notes</span>
            <textarea
              rows={3}
              value={inquiryNotes}
              onChange={(e) => setInquiryNotes(e.target.value)}
              placeholder="e.g. Studio requested 250 GB storage for a 3-day multi-camera destination wedding shoot."
              className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
            />
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy} className="bg-brand-primary text-white">
              {busy ? 'Submitting…' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit / Resolve Ticket */}
      <Modal
        open={editModal}
        onOpenChange={setEditModal}
        title={
          <div className="flex items-center gap-2">
            <Edit2 size={18} className="text-brand-primary" />
            <span>Review & Update Support Inquiry #{selectedTicket?.id?.slice(0, 8)}</span>
          </div>
        }
        description="Update ticket status, resolution notes, and resource quota details."
      >
        <form onSubmit={handleUpdateTicket} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Status</span>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              >
                <option value="pending">Pending Review</option>
                <option value="approved">Approved & Applied</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Storage Quota (GB)</span>
              <input
                type="number"
                value={editQuotaGb}
                onChange={(e) => setEditQuotaGb(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </label>

            <label className="text-xs font-semibold text-foreground space-y-1">
              <span>Camera Limit</span>
              <input
                type="number"
                value={editCameraLimit}
                onChange={(e) => setEditCameraLimit(e.target.value)}
                className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
              />
            </label>
          </div>

          <label className="text-xs font-semibold text-foreground space-y-1 block">
            <span>Admin Resolution Notes</span>
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full text-xs bg-surface-1 border border-border rounded-lg px-2.5 py-2 text-foreground"
            />
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy} className="bg-brand-primary text-white">
              {busy ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Ticket Confirm Modal */}
      <ConfirmModal
        open={deleteModal}
        onOpenChange={setDeleteModal}
        title="Delete support inquiry record?"
        description="Are you sure you want to delete this support inquiry record? This action cannot be undone."
        confirmText="Delete Ticket"
        variant="danger"
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default SupportTicketsPage;
