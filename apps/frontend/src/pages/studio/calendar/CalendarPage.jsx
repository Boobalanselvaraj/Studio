import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { PageHeading, NewEventButton } from '../../../components/workspace/shared';
import { eventsApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function CalendarPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const year = month.getFullYear();
  const m = month.getMonth();
  const start = (month.getDay() + 6) % 7; // Monday-based week
  const count = new Date(year, m + 1, 0).getDate();

  const loadCalendarEvents = async () => {
    try {
      setLoading(true);
      const data = await eventsApi.getCalendar({ month: m + 1, year });
      if (data && Array.isArray(data.events)) {
        setEvents(data.events);
      } else if (Array.isArray(data)) {
        setEvents(data);
      }
    } catch (err) {
      console.warn('Calendar fetch fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarEvents();
  }, [m, year, currentStudio?.id]);

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="MAKE SPACE FOR GREAT WORK"
        title="Your studio calendar"
        description="A month of stories, sessions, and possibilities."
      >
        <NewEventButton onCreated={loadCalendarEvents} />
      </PageHeading>

      <section className="panel calendar-panel">
        <div className="panel-heading">
          <div className="flex items-center gap-3">
            <h2>
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            {loading && <Loader2 size={16} className="animate-spin text-muted" />}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setMonth(new Date(year, m - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="button-outline"
              onClick={() =>
                setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
              }
            >
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setMonth(new Date(year, m + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="calendar-scroll">
          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div className="calendar-weekday" key={d}>
                {d}
              </div>
            ))}

            {Array.from({ length: Math.ceil((start + count) / 7) * 7 }, (_, i) => {
              const day = i - start + 1;
              const valid = day > 0 && day <= count;
              const date = new Date(year, m, day);
              const dayEvents = valid
                ? events.filter((e) => {
                    if (!e.event_date_start) return false;
                    const eDate = new Date(e.event_date_start);
                    return (
                      eDate.getFullYear() === year &&
                      eDate.getMonth() === m &&
                      eDate.getDate() === day
                    );
                  })
                : [];

              return (
                <div className={`calendar-day ${!valid ? 'outside' : ''}`} key={i}>
                  {valid && (
                    <>
                      <span
                        className={
                          date.toDateString() === new Date().toDateString()
                            ? 'today'
                            : ''
                        }
                      >
                        {day}
                      </span>
                      {dayEvents.map((e) => (
                        <Link
                          to={`/studio/events/${e.id}`}
                          key={e.id}
                          className="calendar-event-chip truncate"
                          title={`${e.title} (${e.status})`}
                        >
                          {e.title}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
