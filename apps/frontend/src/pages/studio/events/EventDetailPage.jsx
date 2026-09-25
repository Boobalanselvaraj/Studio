import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  FolderOpen,
  ArrowUpRight,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  History,
  User,
  Loader2,
  Edit2,
} from 'lucide-react';
import { transitions, formatDate, photos } from '../../../data/workspace';
import { PageHeading, Status, Photo } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/toast';
import { Select } from '../../../components/ui/select';
import { eventsApi } from '../../../api/services';

export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [statusModal, setStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [history, setHistory] = useState([]);

  // Edit Event State
  const [editModal, setEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('wedding');
  const [editDate, setEditDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Delete Shoot State
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      const [data, histData] = await Promise.allSettled([
        eventsApi.getById(id),
        eventsApi.getHistory(id),
      ]);

      if (data.status === 'fulfilled' && data.value) {
        setEvent(data.value);
      } else {
        setError('Event not found or access denied');
      }

      if (histData.status === 'fulfilled' && Array.isArray(histData.value)) {
        setHistory(histData.value);
      }
    } catch (err) {
      setError('Could not load shoot details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadEventDetails();
  }, [id]);

  const handleStatusSelect = (newStatus) => {
    setTargetStatus(newStatus);
    setStatusModal(true);
  };

  const openEditModal = () => {
    if (!event) return;
    setEditTitle(event.title || '');
    setEditType(event.event_type || 'wedding');
    setEditDate(event.event_date_start ? new Date(event.event_date_start).toISOString().slice(0, 16) : '');
    setEditLocation(event.location || '');
    setEditDeadline(event.delivery_deadline ? new Date(event.delivery_deadline).toISOString().slice(0, 10) : '');
    setEditNotes(event.notes || '');
    setEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setEditBusy(true);
      const updated = await eventsApi.update(id, {
        title: editTitle.trim(),
        event_type: editType,
        event_date_start: editDate ? new Date(editDate).toISOString() : null,
        location: editLocation.trim() || null,
        delivery_deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
        notes: editNotes.trim() || null,
      });
      setEvent((prev) => ({ ...prev, ...updated }));
      setEditModal(false);
      toast.success('Shoot details updated successfully');
      loadEventDetails();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update shoot details');
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteEvent = async () => {
    try {
      setDeleteBusy(true);
      await eventsApi.delete(id);
      toast.success('Shoot deleted successfully');
      navigate('/studio/events');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete shoot');
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmStatusChange = async (e) => {
    e.preventDefault();
    if (!targetStatus) return;

    try {
      const updated = await eventsApi.updateStatus(id, {
        to_status: targetStatus,
        note: statusNote || undefined,
      });
      setEvent((prev) => ({ ...prev, status: updated.status }));
      setStatusModal(false);
      setStatusNote('');
      toast.success(`Status updated to ${updated.status}`);
      loadEventDetails();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status transition');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setAddingTask(true);
      const created = await eventsApi.createTask(id, {
        title: newTaskTitle.trim(),
      });
      setEvent((prev) => ({
        ...prev,
        event_tasks: [...(prev.event_tasks || []), created],
      }));
      setNewTaskTitle('');
      toast.success('Task added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      setEvent((prev) => ({
        ...prev,
        event_tasks: prev.event_tasks.map((t) =>
          t.id === taskId ? { ...t, is_done: !currentStatus } : t
        ),
      }));

      await eventsApi.updateTask(taskId, { is_done: !currentStatus });
    } catch (err) {
      console.error('Failed to toggle task:', err);
      loadEventDetails();
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      setEvent((prev) => ({
        ...prev,
        event_tasks: prev.event_tasks.filter((t) => t.id !== taskId),
      }));

      await eventsApi.deleteTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadEventDetails();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 text-muted">
        <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
        <span>Loading shoot details…</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="empty-state py-16">
        <h1>{error || 'Event not found'}</h1>
        <p className="mb-4">This shoot may have been deleted or moved.</p>
        <Link className="button-outline" to="/studio/events">
          Return to events
        </Link>
      </div>
    );
  }

  const tasks = event.event_tasks || [];
  const completedTasks = tasks.filter((t) => t.is_done).length;
  const allowedTransitions = transitions[event.status] || [];
  const customers = event.event_customers || [];

  return (
    <div className="page-enter">
      <Link className="back-link" to="/studio/events">
        <ArrowLeft size={15} />
        All events
      </Link>

      <PageHeading
        eyebrow={(event.event_type || 'Shoot').toUpperCase()}
        title={event.title}
        description="The details behind a beautiful shoot."
      >
        <Status value={event.status} />

        <Button
          variant="outline"
          size="sm"
          onClick={openEditModal}
          className="flex items-center gap-1.5 text-xs h-7"
        >
          <Edit2 size={12} /> Edit Shoot
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteModal(true)}
          className="flex items-center gap-1.5 text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
        >
          <Trash2 size={12} /> Delete Shoot
        </Button>

        {allowedTransitions.length > 0 && (
          <Select
            aria-label="Update event status"
            value={event.status}
            onChange={(e) => handleStatusSelect(e.target.value)}
            searchable={false}
            className="w-48 text-xs"
            options={[
              { value: event.status, label: `Current: ${event.status}` },
              ...allowedTransitions.map((s) => ({
                value: s,
                label: `Transition to ${s}`,
              })),
            ]}
          />
        )}
      </PageHeading>

      <div className="detail-grid">
        <div className="detail-photo">
          <Photo src={photos[event.event_type] || photos.wedding} alt={event.title} />
        </div>

        <section className="panel detail-summary">
          <h2>Shoot details</h2>

          <div>
            <CalendarDays size={19} />
            <p>
              <small>DATE & TIME</small>
              <strong>
                {formatDate(event.event_date_start, { dateStyle: 'long' })}
              </strong>
              <span>
                {event.event_date_start
                  ? new Date(event.event_date_start).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'To be confirmed'}
              </span>
            </p>
          </div>

          <div>
            <MapPin size={19} />
            <p>
              <small>LOCATION</small>
              <strong>{event.location || 'To be confirmed'}</strong>
            </p>
          </div>

          <div>
            <FolderOpen size={19} />
            <p>
              <small>PRODUCTION PROGRESS</small>
              <strong>
                {completedTasks} of {tasks.length} tasks complete
              </strong>
            </p>
          </div>

          {customers.length > 0 && (
            <div>
              <User size={19} />
              <p>
                <small>CLIENT</small>
                <strong>{customers[0].customer?.user?.full_name || 'Assigned Client'}</strong>
                <span>{customers[0].customer?.user?.email}</span>
              </p>
            </div>
          )}

          <Link className="button-outline mt-2" to="/studio/folders">
            Open photo library
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Tasks Section */}
        <section className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2>Checklist & Tasks</h2>
              <p className="text-xs text-muted">
                Track deliverables and production milestones.
              </p>
            </div>
            <span className="count-circle">
              {tasks.length - completedTasks}
            </span>
          </div>

          <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Add a checklist item…"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 text-sm bg-surface-2 border border-border rounded px-3 py-1.5"
            />
            <Button type="submit" size="sm" disabled={addingTask || !newTaskTitle.trim()}>
              <Plus size={14} /> Add
            </Button>
          </form>

          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between p-2.5 rounded border transition-colors ${
                  t.is_done ? 'bg-surface-2/50 border-border/50 text-muted' : 'bg-surface border-border'
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={!!t.is_done}
                    onChange={() => handleToggleTask(t.id, !!t.is_done)}
                  />
                  <span className={t.is_done ? 'line-through' : 'font-medium'}>
                    {t.title}
                  </span>
                </label>

                <button
                  type="button"
                  className="icon-button text-muted hover:text-red-500"
                  onClick={() => handleDeleteTask(t.id)}
                  title="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {tasks.length === 0 && (
              <p className="text-xs text-muted text-center py-4">
                No tasks created yet for this shoot.
              </p>
            )}
          </div>
        </section>

        {/* Notes & Workflow History */}
        <div className="space-y-6">
          <section className="panel p-6">
            <h2>Creative notes</h2>
            <p className="text-sm text-muted mt-3">
              {event.notes ||
                'No notes yet. Add shoot requirements, client preferences, and creative direction.'}
            </p>
          </section>

          <section className="panel p-6">
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-brand-primary" />
              <h2>Status History</h2>
            </div>

            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="text-xs border-l-2 border-brand-primary/40 pl-3 py-0.5">
                  <div className="font-semibold text-foreground">
                    {h.from_status ? `${h.from_status} → ` : ''}{h.to_status}
                  </div>
                  <div className="text-muted">
                    {h.user_changed?.full_name || 'System'} · {formatDate(h.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  {h.note && <div className="italic text-muted mt-0.5">"{h.note}"</div>}
                </div>
              ))}

              {history.length === 0 && (
                <p className="text-xs text-muted">No status transitions recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Status Transition Modal */}
      <Modal
        open={statusModal}
        onOpenChange={setStatusModal}
        title={`Transition shoot to ${targetStatus}`}
        description="Advance this shoot to the next stage in your workflow."
      >
        <form onSubmit={confirmStatusChange} className="form-stack">
          <label>
            Transition Note (optional)
            <textarea
              placeholder="e.g. Completed initial culling, moving to Lightroom color grade…"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
            />
          </label>
          <div className="modal-actions">
            <Button variant="outline" type="button" onClick={() => setStatusModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Transition</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Shoot Details Modal */}
      <Modal
        open={editModal}
        onOpenChange={setEditModal}
        title="Edit Shoot Details"
        description="Update dates, shoot location, delivery deadline, and creative direction."
      >
        <form onSubmit={handleEditSubmit} className="form-stack">
          <label>
            Shoot Title
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Smith-Jones Wedding Ceremony"
            />
          </label>

          <div className="form-grid">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">Shoot Type</label>
              <Select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                searchable={false}
                options={[
                  { value: 'wedding', label: 'Wedding' },
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'corporate', label: 'Corporate' },
                  { value: 'event', label: 'Event / Party' },
                  { value: 'product', label: 'Product' },
                  { value: 'family', label: 'Family' },
                  { value: 'fashion', label: 'Fashion' },
                ]}
              />
            </div>

            <label>
              Shoot Date & Time
              <input
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              Shoot Location
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g. Grand Vista Resort, Hall A"
              />
            </label>

            <label>
              Final Delivery Deadline
              <input
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
              />
            </label>
          </div>

          <label>
            Creative & Production Notes
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Shot list, lighting requirements, client preferences…"
            />
          </label>

          <div className="modal-actions">
            <Button variant="outline" type="button" disabled={editBusy} onClick={() => setEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editBusy}>
              {editBusy ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Shoot Confirm Modal */}
      <ConfirmModal
        open={deleteModal}
        onOpenChange={setDeleteModal}
        title={`Delete shoot "${event?.title || ''}"?`}
        description="Are you sure you want to permanently delete this shoot/event? This will remove all associated tasks, customer assignments, and shoot history. Photos in your library will not be deleted."
        confirmText="Delete Shoot"
        variant="danger"
        loading={deleteBusy}
        onConfirm={handleDeleteEvent}
      />
    </div>
  );
}
