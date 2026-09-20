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
} from 'lucide-react';
import { transitions, formatDate, photos } from '../../../data/workspace';
import { PageHeading, Status, Photo } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
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
      loadEventDetails();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status transition');
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
    } catch (err) {
      console.error('Failed to create task:', err);
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

        {allowedTransitions.length > 0 && (
          <select
            aria-label="Update event status"
            value={event.status}
            onChange={(e) => handleStatusSelect(e.target.value)}
            className="text-xs bg-surface border border-border rounded px-2 py-1"
          >
            <option value={event.status}>Current: {event.status}</option>
            {allowedTransitions.map((s) => (
              <option key={s} value={s}>
                Transition to {s}
              </option>
            ))}
          </select>
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
    </div>
  );
}
