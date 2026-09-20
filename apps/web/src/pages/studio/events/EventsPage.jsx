import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useOutletContext } from 'react-router-dom';
import { Search, LayoutGrid, List, Calendar, ArrowUpRight, Loader2 } from 'lucide-react';
import { EventKanban } from '../../../components/event-kanban/EventKanban';
import { PageHeading, NewEventButton, Status } from '../../../components/workspace/shared';
import { statuses, formatDate } from '../../../data/workspace';
import { eventsApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const currentStudio = useAuthStore((s) => s.currentStudio);
  const outletContext = useOutletContext();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('board');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(params.get('status') || 'all');

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await eventsApi.list();
      if (Array.isArray(data)) {
        setEvents(data);
      }
    } catch (err) {
      console.warn('Events load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentStudio?.id]);

  useEffect(() => {
    const pStatus = params.get('status');
    if (pStatus) setStatus(pStatus);
  }, [params]);

  const handleStatusFilterChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'all') {
      params.delete('status');
    } else {
      params.set('status', newStatus);
    }
    setParams(params);
  };

  const handleStatusChange = async (id, to_status) => {
    // Optimistic update
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: to_status } : e))
    );

    try {
      await eventsApi.updateStatus(id, { to_status });
      outletContext?.refreshLayoutData?.();
    } catch (err) {
      console.error('Failed to change status:', err);
      loadEvents(); // Revert on failure
      throw err;
    }
  };

  const filtered = events.filter((e) => {
    const matchesStatus = status === 'all' || e.status === status;
    const searchTarget = `${e.title || ''} ${e.location || ''} ${e.event_type || ''}`.toLowerCase();
    const matchesQuery = searchTarget.includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="FROM FIRST HELLO TO FINAL DELIVERY"
        title="Events & shoots"
        description="A thoughtful workflow for every story you capture."
      >
        <NewEventButton
          onCreated={() => {
            loadEvents();
            outletContext?.refreshLayoutData?.();
          }}
        />
      </PageHeading>

      <div className="filter-toolbar">
        <div className="view-switch" role="group" aria-label="Event view">
          <button
            className={view === 'board' ? 'selected' : ''}
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
          >
            <LayoutGrid size={15} />
            Board
          </button>
          <button
            className={view === 'list' ? 'selected' : ''}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <List size={16} />
            List
          </button>
        </div>

        <div className="filter-controls">
          <label className="inline-search">
            <Search size={16} />
            <input
              aria-label="Search events"
              placeholder="Search events by title, type, location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="results-summary">
        <span>{filtered.length} shoots in pipeline</span>
        <span>Move events using the status menu or drag to the next stage.</span>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading studio shoots…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Calendar size={32} />
          <h2>No events found</h2>
          <p>Try a different search or schedule your first shoot.</p>
        </div>
      ) : view === 'board' ? (
        <EventKanban events={filtered} onStatusChange={handleStatusChange} />
      ) : (
        <div className="panel table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Shoot date</th>
                <th>Location</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>
                  <span className="sr-only">Open event</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const totalTasks = e.total_tasks ?? e.event_tasks?.length ?? 0;
                const completedTasks =
                  e.completed_tasks ??
                  (e.event_tasks ? e.event_tasks.filter((t) => t.is_done).length : 0);

                return (
                  <tr key={e.id}>
                    <td>
                      <Link className="font-semibold" to={`/studio/events/${e.id}`}>
                        {e.title}
                      </Link>
                      <small>{e.event_type}</small>
                    </td>
                    <td>{formatDate(e.event_date_start)}</td>
                    <td>{e.location || 'Not set'}</td>
                    <td>
                      <Status value={e.status} />
                    </td>
                    <td>
                      {completedTasks}/{totalTasks}
                    </td>
                    <td>
                      <Link aria-label={`Open ${e.title}`} to={`/studio/events/${e.id}`}>
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
