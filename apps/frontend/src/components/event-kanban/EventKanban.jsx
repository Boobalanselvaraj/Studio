import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, CheckCheck, GripVertical } from 'lucide-react';
import { statuses, transitions, formatDate } from '../../data/workspace';

export function EventKanban({ events = [], onStatusChange }) {
  const [dragged, setDragged] = useState(null);
  const [message, setMessage] = useState('');

  async function move(id, targetStatus) {
    const event = events.find((e) => e.id === id);
    if (!event || event.status === targetStatus) return;

    const allowed = transitions[event.status] || [];
    if (!allowed.includes(targetStatus)) {
      setMessage(`Cannot move ${event.title} to ${targetStatus}. Allowed: ${allowed.join(', ') || 'none'}.`);
      return;
    }

    try {
      await onStatusChange?.(id, targetStatus);
      setMessage(`${event.title} moved to ${targetStatus}.`);
    } catch (err) {
      setMessage(`Failed to update status: ${err.message || 'Error'}`);
    }
  }

  return (
    <>
      <p className="sr-only" role="status">
        {message}
      </p>
      {message && <p className="workflow-message">{message}</p>}

      <div className="kanban-board">
        {statuses.map((status) => {
          const columnEvents = events.filter((e) => e.status === status);
          const isAllowedDrop =
            dragged && transitions[events.find((e) => e.id === dragged)?.status]?.includes(status);

          return (
            <section
              className={`kanban-column ${isAllowedDrop ? 'drop-allowed' : ''}`}
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) move(id, status);
                setDragged(null);
              }}
            >
              <div className="kanban-heading">
                <span className={`stage-dot stage-${status}`} />
                <h2>{status}</h2>
                <span>{columnEvents.length}</span>
              </div>

              <div className="kanban-items">
                {columnEvents.map((e) => {
                  const allowedNext = transitions[e.status] || [];
                  const initials = e.title
                    ? e.title
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'EV';

                  const totalTasks = e.total_tasks ?? e.event_tasks?.length ?? 0;
                  const completedTasks =
                    e.completed_tasks ??
                    (e.event_tasks ? e.event_tasks.filter((t) => t.is_done).length : 0);

                  return (
                    <article
                      key={e.id}
                      className="event-card"
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData('text/plain', e.id);
                        setDragged(e.id);
                      }}
                      onDragEnd={() => setDragged(null)}
                    >
                      <div className="event-card-top">
                        <span className={`category-tag category-${e.event_type}`}>
                          {e.event_type}
                        </span>
                        <GripVertical size={15} aria-hidden="true" />
                      </div>

                      <Link className="event-title" to={`/studio/events/${e.id}`}>
                        {e.title}
                      </Link>

                      <p>
                        <Calendar size={13} />
                        {formatDate(e.event_date_start)}
                      </p>

                      <p>
                        <MapPin size={13} />
                        {e.location || 'Location to be confirmed'}
                      </p>

                      <div className="event-progress">
                        <i
                          style={{
                            width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`,
                          }}
                        />
                      </div>

                      <div className="event-card-footer">
                        <span>
                          <CheckCheck size={14} />
                          {completedTasks}/{totalTasks} tasks
                        </span>
                        <span className="mini-avatar">{initials}</span>
                      </div>

                      {allowedNext.length > 0 && onStatusChange && (
                        <select
                          className="status-select"
                          aria-label={`Change status for ${e.title}`}
                          value={e.status}
                          onChange={(ev) => move(e.id, ev.target.value)}
                        >
                          <option value={e.status}>{e.status}</option>
                          {allowedNext.map((s) => (
                            <option value={s} key={s}>
                              Move to {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </article>
                  );
                })}

                {columnEvents.length === 0 && (
                  <div className="kanban-empty">A little room for what's next</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
