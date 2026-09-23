import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCheck,
  Image,
  Clock,
  MapPin,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { photos, formatDate } from '../../../data/workspace';
import { PageHeading, NewEventButton, Status, Photo } from '../../../components/workspace/shared';
import { studioApi, eventsApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function StudioDashboardPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({
    activeEventsCount: 0,
    totalCustomersCount: 0,
    totalCamerasCount: 0,
    pendingTasksCount: 0,
    upcomingTasks: [],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, evRes] = await Promise.allSettled([
        studioApi.getDashboard(),
        eventsApi.list(),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value) {
        setSummary(sumRes.value);
      }
      if (evRes.status === 'fulfilled' && Array.isArray(evRes.value)) {
        setEvents(evRes.value);
      }
    } catch (err) {
      console.warn('Dashboard load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStudio?.id]);

  const toggleTaskStatus = async (taskId, currentStatus) => {
    try {
      // Optimistic update
      setSummary((prev) => ({
        ...prev,
        upcomingTasks: prev.upcomingTasks.map((t) =>
          t.id === taskId ? { ...t, is_done: !currentStatus } : t
        ),
      }));

      await eventsApi.updateTask(taskId, { is_done: !currentStatus });
    } catch (err) {
      console.error('Failed to update task:', err);
      loadData(); // Revert on failure
    }
  };

  const active = events.filter((e) => !['delivered', 'archived', 'cancelled'].includes(e.status));
  const upcoming = events
    .filter((e) => ['scheduled', 'booked', 'lead', 'shooting', 'editing'].includes(e.status))
    .sort((a, b) => new Date(a.event_date_start || 0) - new Date(b.event_date_start || 0))
    .slice(0, 3);

  const pendingTasks = summary.upcomingTasks || [];
  const doneTasks = pendingTasks.filter((t) => t.is_done).length;
  const totalTasks = pendingTasks.length || 1;

  const stats = [
    {
      label: 'Active projects',
      value: String(summary.activeEventsCount ?? active.length).padStart(2, '0'),
      note: 'Across your studio workflow',
      icon: Camera,
      tone: 'green',
      bars: [30, 48, 42, 65, 54, 82, 70, 95],
    },
    {
      label: 'Upcoming shoots',
      value: String(upcoming.length).padStart(2, '0'),
      note: 'Your next moments to capture',
      icon: CalendarDays,
      tone: 'blue',
      bars: [55, 32, 56, 45, 75, 55, 78, 85],
    },
    {
      label: 'Pending tasks',
      value: String(summary.pendingTasksCount ?? pendingTasks.length).padStart(2, '0'),
      note: 'Focus items awaiting review',
      icon: CheckCheck,
      tone: 'amber',
      bars: [20, 40, 35, 55, 45, 70, 65, 85],
    },
    {
      label: 'Ready for review',
      value: String(events.filter((e) => e.status === 'review').length).padStart(2, '0'),
      note: 'One step closer to delivery',
      icon: Image,
      tone: 'purple',
      bars: [20, 30, 45, 35, 60, 65, 55, 85],
    },
  ];

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="YOUR STUDIO, AT A GLANCE"
        title="A little focus. A lot of possibility."
        description="Welcome back. Let’s make room for your best work."
      >
        <Link className="button-outline" to="/studio/calendar">
          <CalendarDays size={16} />
          View calendar
        </Link>
        <NewEventButton onCreated={loadData} />
      </PageHeading>

      {loading && events.length === 0 ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Opening your workspace…</span>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            {stats.map(({ label, value, note, icon: Icon, tone, bars }) => (
              <section className="stat-card" key={label}>
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={`stat-icon ${tone}`}>
                    <Icon size={17} />
                  </span>
                </div>
                <div className="stat-value-row">
                  <strong>{value}</strong>
                  <div className={`spark-bars ${tone}`} aria-hidden="true">
                    {bars.map((height, i) => (
                      <i key={i} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <p>{note}</p>
              </section>
            ))}
          </div>

          <div className="dashboard-main">
            <section className="panel upcoming-panel">
              <div className="panel-heading">
                <div>
                  <h2>On the horizon</h2>
                  <p>Your upcoming shoots, all in one place.</p>
                </div>
                <Link className="text-link" to="/studio/events">
                  All events
                  <ArrowUpRight size={15} />
                </Link>
              </div>

              {upcoming.length === 0 ? (
                <div className="empty-state py-8">
                  <CalendarDays size={28} className="text-muted mb-2" />
                  <h3>No upcoming shoots scheduled</h3>
                  <p className="text-xs text-muted mb-4">
                    Create a new event to get started with your pipeline.
                  </p>
                  <NewEventButton onCreated={loadData} />
                </div>
              ) : (
                <div className="shoot-cards">
                  {upcoming.map((e) => {
                    const eventDate = e.event_date_start ? new Date(e.event_date_start) : new Date();
                    return (
                      <Link to={`/studio/events/${e.id}`} className="shoot-card" key={e.id}>
                        <div className="shoot-cover">
                          <Photo src={e.cover || photos.wedding} alt={e.title} />
                          <span className="date-chip">
                            <b>{eventDate.getDate()}</b>
                            {formatDate(e.event_date_start, { month: 'short' })}
                          </span>
                          <span className="shoot-type">{e.event_type}</span>
                        </div>
                        <div className="shoot-info">
                          <h3>{e.title}</h3>
                          <p>
                            <MapPin size={12} />
                            {e.location || 'Location to be confirmed'}
                          </p>
                          <div className="shoot-bottom">
                            <Status value={e.status} />
                            <ArrowUpRight size={17} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel task-panel">
              <div className="panel-heading">
                <div>
                  <h2>Your focus list</h2>
                  <p>Small steps, beautiful results.</p>
                </div>
                <span className="count-circle">
                  {pendingTasks.filter((t) => !t.is_done).length}
                </span>
              </div>

              {pendingTasks.length === 0 ? (
                <div className="empty-state py-8">
                  <CheckCheck size={28} className="text-muted mb-2" />
                  <p className="text-sm">All clear! No pending tasks right now.</p>
                </div>
              ) : (
                <div className="task-list">
                  {pendingTasks.map((t) => (
                    <label
                      className={`task-row ${t.is_done ? 'is-done' : ''}`}
                      key={t.id}
                    >
                      <input
                        type="checkbox"
                        checked={!!t.is_done}
                        onChange={() => toggleTaskStatus(t.id, !!t.is_done)}
                      />
                      <div>
                        <strong>{t.title}</strong>
                        <span>{t.event?.title || 'Studio Shoot'}</span>
                        <small className={!t.is_done ? 'priority-high' : ''}>
                          {t.is_done
                            ? 'Completed'
                            : t.due_date
                            ? formatDate(t.due_date)
                            : 'Priority'}
                        </small>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {pendingTasks.length > 0 && (
                <div className="task-progress">
                  <span>
                    {doneTasks} of {pendingTasks.length} completed
                  </span>
                  <div className="progress-track">
                    <i style={{ width: `${(doneTasks / pendingTasks.length) * 100}%` }} />
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="dashboard-bottom">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>In the making</h2>
                  <p>A clear view of your creative pipeline.</p>
                </div>
                <Link className="text-link" to="/studio/events">
                  Open workflow
                  <ArrowUpRight size={15} />
                </Link>
              </div>

              <div className="pipeline">
                {[
                  'lead',
                  'booked',
                  'scheduled',
                  'shooting',
                  'editing',
                  'review',
                  'delivered',
                ].map((status, i) => (
                  <Link
                    to={`/studio/events?status=${status}`}
                    className="pipeline-item"
                    key={status}
                  >
                    <div className="pipeline-track" style={{ opacity: 0.3 + i * 0.1 }} />
                    <strong>{events.filter((e) => e.status === status).length}</strong>
                    <span>{status}</span>
                  </Link>
                ))}
              </div>

              <div className="panel-divider" />
              <div className="activity-heading">
                <span className="activity-icon">
                  <Clock size={17} />
                </span>
                <div>
                  <strong>Keep every detail in the picture</strong>
                  <p>Plan shoots, track progress, and deliver a memorable experience.</p>
                </div>
                <Link className="icon-button" aria-label="Browse events" to="/studio/events">
                  <ArrowRight size={20} />
                </Link>
              </div>
            </section>

            <section className="library-promo">
              <Photo
                src={photos.landscape}
                alt="Mountain landscape in a photography collection"
              />
              <div className="promo-shade" />
              <div className="promo-content">
                <span>
                  <FolderOpen size={16} />
                  YOUR CREATIVE ARCHIVE
                </span>
                <h2>
                  Great work deserves
                  <br />a beautiful home.
                </h2>
                <p>
                  Every frame. Every collection.
                  <br />
                  Right where you need it.
                </p>
                <Link to="/studio/folders">
                  Explore photo library
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
