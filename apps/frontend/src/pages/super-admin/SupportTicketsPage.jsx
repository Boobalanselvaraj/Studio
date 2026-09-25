import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Trash2,
  Edit3,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Building2,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { Modal } from '../../components/ui/modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toast';
import { Select } from '../../components/ui/select';

const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const CATEGORIES = ['general', 'camera', 'upload', 'gallery', 'account', 'billing', 'bug'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const INITIAL_FORM = {
  studio_id: '',
  subject: '',
  description: '',
  category: 'general',
  priority: 'normal',
};

export function SupportTicketsPage({ studio = false }) {
  const [tickets, setTickets] = useState([]);
  const [studios, setStudios] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteTicketTarget, setDeleteTicketTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = useAuthStore((s) => s.user);
  const currentStudio = useAuthStore((s) => s.currentStudio);
  const isSuperAdmin = Boolean(user?.is_super_admin) && !studio;
  const base = studio ? '/studio' : '/admin';

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get(`${base}/support-tickets`);
      setTickets(Array.isArray(data) ? data : []);

      if (!studio) {
        const res = await api.get('/admin/studios');
        setStudios(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load support tickets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [base, currentStudio?.id]);

  function openCreateModal() {
    setForm({
      ...INITIAL_FORM,
      studio_id: studio ? (currentStudio?.id || '') : (studios[0]?.id || ''),
    });
    setCreateModalOpen(true);
  }

  function openEditModal(ticket) {
    setActiveTicket(ticket);
    setEditForm({
      subject: ticket.subject || '',
      description: ticket.description || '',
      category: ticket.category || 'general',
      priority: ticket.priority || 'normal',
      status: ticket.status || 'open',
      resolution: ticket.resolution || '',
    });
  }

  async function handleCreateTicket(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('Subject and description are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        subject: form.subject.trim(),
        description: form.description.trim(),
      };
      if (studio) {
        delete payload.studio_id;
      }
      await api.post(`${base}/support-tickets`, payload);
      setCreateModalOpen(false);
      toast.success('Support ticket submitted successfully');
      await loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not create ticket');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTicket(e) {
    e.preventDefault();
    if (!activeTicket) return;

    try {
      setSaving(true);
      const payload = {
        subject: editForm.subject?.trim(),
        description: editForm.description?.trim(),
        category: editForm.category,
        priority: editForm.priority,
        status: editForm.status,
        resolution: editForm.resolution || '',
      };

      await api.patch(`${base}/support-tickets/${activeTicket.id}`, payload);
      setActiveTicket(null);
      toast.success('Ticket updated successfully');
      await loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not update ticket');
    } finally {
      setSaving(false);
    }
  }

  const canDeleteTicket = (t) => {
    if (!t) return false;
    if (isSuperAdmin) return true;
    // Studio users cannot delete tickets created by Super Admin
    if (t.created_by_super_admin) return false;
    // Studio users can delete tickets they created themselves
    return t.created_by === user?.id;
  };

  async function handleDeleteTicket() {
    if (!deleteTicketTarget) return;

    try {
      setDeleteLoading(true);
      await api.delete(`${base}/support-tickets/${deleteTicketTarget.id}`);
      if (activeTicket?.id === deleteTicketTarget.id) {
        setActiveTicket(null);
      }
      setDeleteTicketTarget(null);
      toast.success('Ticket deleted successfully');
      await loadData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not delete ticket');
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const searchTarget = `${t.subject || ''} ${t.description || ''} ${t.studio?.name || ''} ${t.id || ''}`.toLowerCase();
    const matchQuery = searchTarget.includes(query.toLowerCase());
    return matchStatus && matchQuery;
  });

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'normal':
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      default:
        return 'bg-surface-2 text-muted border border-border';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
      case 'waiting':
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
      case 'resolved':
        return 'bg-purple-500/10 text-purple-600 border border-purple-500/20';
      case 'closed':
        return 'bg-zinc-500/10 text-zinc-500 border border-border';
      default:
        return 'bg-surface-2 text-muted border border-border';
    }
  };

  return (
    <div className="page-enter space-y-5 max-w-none">
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">{studio ? 'STUDIO ASSISTANCE' : 'SUPER ADMIN SUPPORT'}</p>
          <h1>Support Tickets</h1>
          <p className="page-description">
            Track inquiries, technical issues, priorities, and status updates directly with the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin mr-1.5' : 'mr-1.5'} />
            Refresh
          </Button>
          <Button className="bg-brand-primary text-white" onClick={openCreateModal}>
            <Plus size={16} className="mr-1.5" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'open', label: 'Open Inquiries', color: 'text-emerald-500' },
          { key: 'in_progress', label: 'In Progress', color: 'text-blue-500' },
          { key: 'waiting', label: 'Waiting for Reply', color: 'text-amber-500' },
          { key: 'resolved', label: 'Resolved Tickets', color: 'text-purple-500' },
        ].map((item) => {
          const count = tickets.filter((t) => t.status === item.key).length;
          return (
            <button
              key={item.key}
              type="button"
              className={`panel p-4 text-left transition-all ${
                statusFilter === item.key ? 'ring-2 ring-brand-primary bg-surface-2' : 'hover:bg-surface-2'
              }`}
              onClick={() => setStatusFilter(statusFilter === item.key ? 'all' : item.key)}
            >
              <span className="text-xs text-muted block">{item.label}</span>
              <strong className={`block text-2xl font-bold mt-1.5 ${item.color}`}>{count}</strong>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="panel p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-surface-muted rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            All Tickets ({tickets.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                statusFilter === s
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {s.replace('_', ' ')} ({tickets.filter((t) => t.status === s).length})
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
            placeholder="Search issue, studio name, or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center gap-2 text-xs">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="py-20 text-center text-muted flex items-center justify-center gap-2">
          <RefreshCw size={20} className="animate-spin text-brand-primary" />
          <span>Loading support tickets…</span>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <LifeBuoy size={40} className="text-muted mx-auto opacity-40" />
          <h4 className="text-base font-bold text-foreground">No support tickets found</h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {statusFilter !== 'all'
              ? `There are no tickets with status "${statusFilter.replace('_', ' ')}".`
              : 'Everything is running smoothly. Submit a ticket if you need technical help or have inquiries.'}
          </p>
          <Button size="sm" className="bg-brand-primary text-white" onClick={openCreateModal}>
            <Plus size={14} className="mr-1" />
            Open First Ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className="panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-brand-primary/40 transition-colors"
            >
              <div
                className="flex-1 cursor-pointer space-y-1.5"
                onClick={() => openEditModal(t)}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-mono text-[11px] text-foreground font-semibold">
                    #{t.id.slice(0, 8)}
                  </span>
                  {t.studio?.name && (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <Building2 size={12} className="text-muted" />
                      {t.studio.name}
                    </span>
                  )}
                  <span className="capitalize px-2 py-0.5 rounded-full bg-surface-2 text-[10px] font-semibold border border-border">
                    {t.category}
                  </span>
                  {t.created_at && (
                    <span className="text-[11px] text-muted">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {t.created_by_super_admin && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      <ShieldAlert size={11} /> Created by Platform Provider
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-base text-foreground hover:text-brand-primary transition-colors">
                  {t.subject}
                </h3>
                <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                  {t.description}
                </p>

                {t.resolution && (
                  <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-600 flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Resolution Note:</strong>
                      <span className="text-muted-foreground whitespace-pre-wrap">{t.resolution}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex md:flex-col items-center md:items-end justify-between gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-border">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${getPriorityBadgeClass(t.priority)}`}>
                    {t.priority}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${getStatusBadgeClass(t.status)}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => openEditModal(t)}
                  >
                    <Edit3 size={13} className="mr-1" />
                    Edit
                  </Button>
                  {canDeleteTicket(t) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                      onClick={() => setDeleteTicketTarget(t)}
                      title="Delete ticket"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Open Support Ticket"
        description="Describe your request or technical issue clearly."
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          {!studio && studios.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Studio
              </label>
              <Select
                value={form.studio_id}
                onChange={(e) => setForm({ ...form, studio_id: e.target.value })}
                placeholder="Choose studio…"
                searchable={studios.length >= 7}
                options={studios.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Subject *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
              placeholder="Brief summary of the issue..."
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={200}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Category
              </label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                searchable={false}
                options={CATEGORIES.map((c) => ({
                  value: c,
                  label: c.charAt(0).toUpperCase() + c.slice(1),
                }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Priority
              </label>
              <Select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                searchable={false}
                options={PRIORITIES.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                  status: p === 'urgent' ? 'danger' : p === 'high' ? 'warning' : 'info',
                }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Issue Description *
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
              rows={5}
              placeholder="Provide comprehensive details, error messages, or steps to reproduce..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={10000}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand-primary text-white"
              disabled={saving}
            >
              {saving ? 'Submitting…' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit / View Ticket Modal */}
      <Modal
        open={Boolean(activeTicket)}
        onOpenChange={(open) => !open && setActiveTicket(null)}
        title={activeTicket ? `Ticket #${activeTicket.id.slice(0, 8)}` : 'Edit Ticket'}
        description="Update ticket properties or resolution notes."
      >
        {activeTicket && (() => {
          // Studio users can ONLY change status on super-admin-created tickets
          const isReadOnly = studio && activeTicket?.created_by_super_admin;

          return (
            <form onSubmit={handleUpdateTicket} className="space-y-4">
              {/* Read-only notice for studio on admin tickets */}
              {isReadOnly && (
                <div className="flex items-start gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-600 dark:text-indigo-400">
                  <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Platform Provider Ticket</span>
                    <span className="text-muted">This ticket was created by the platform provider. You can only update the <strong>status</strong> field.</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  value={editForm.subject || ''}
                  onChange={(e) => !isReadOnly && setEditForm({ ...editForm, subject: e.target.value })}
                  maxLength={200}
                  required
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Category
                  </label>
                  <Select
                    value={editForm.category || 'general'}
                    onChange={(e) => !isReadOnly && setEditForm({ ...editForm, category: e.target.value })}
                    searchable={false}
                    disabled={isReadOnly}
                    options={CATEGORIES.map((c) => ({
                      value: c,
                      label: c.charAt(0).toUpperCase() + c.slice(1),
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Priority
                  </label>
                  <Select
                    value={editForm.priority || 'normal'}
                    onChange={(e) => !isReadOnly && setEditForm({ ...editForm, priority: e.target.value })}
                    searchable={false}
                    disabled={isReadOnly}
                    options={PRIORITIES.map((p) => ({
                      value: p,
                      label: p.charAt(0).toUpperCase() + p.slice(1),
                      status: p === 'urgent' ? 'danger' : p === 'high' ? 'warning' : 'info',
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Issue Description
                </label>
                <textarea
                  className="w-full px-3 py-2 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  rows={4}
                  value={editForm.description || ''}
                  onChange={(e) => !isReadOnly && setEditForm({ ...editForm, description: e.target.value })}
                  maxLength={10000}
                  required
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
              </div>

              <div className={`pt-3 border-t border-border space-y-3`}>
                <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                  Status {isReadOnly && <span className="text-emerald-600 normal-case font-normal ml-1">(only editable field)</span>}
                </p>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Ticket Status
                  </label>
                  <Select
                    value={editForm.status || 'open'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    searchable={false}
                    options={STATUSES.map((s) => ({
                      value: s,
                      label: s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1),
                      status: s === 'resolved' || s === 'closed' ? 'active' : s === 'in_progress' ? 'pending' : 'warning',
                    }))}
                  />
                </div>

                {!isReadOnly && (
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Resolution / Progress Notes
                    </label>
                    <textarea
                      className="w-full px-3 py-2 text-xs bg-surface-2 rounded-lg border border-border text-foreground focus:outline-none focus:border-brand-primary"
                      rows={4}
                      placeholder="Document progress, corrective findings, or notes..."
                      value={editForm.resolution || ''}
                      onChange={(e) => setEditForm({ ...editForm, resolution: e.target.value })}
                      maxLength={10000}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                {!isReadOnly && canDeleteTicket(activeTicket) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                    onClick={() => setDeleteTicketTarget(activeTicket)}
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Delete Ticket
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted italic">
                    {activeTicket?.created_by_super_admin && studio
                      ? 'Issued by Platform Provider — only status may be changed'
                      : ''}
                  </span>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTicket(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-brand-primary text-white"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : isReadOnly ? 'Update Status' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteTicketTarget)}
        onOpenChange={(open) => !open && setDeleteTicketTarget(null)}
        title="Delete Support Ticket?"
        description={`Are you sure you want to permanently delete ticket #${deleteTicketTarget?.id.slice(0, 8)}? This action cannot be reversed.`}
        confirmText="Delete Ticket"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteTicket}
      />
    </div>
  );
}
