import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar, CheckSquare, MapPin } from 'lucide-react';

const COLUMNS = [
  { id: 'lead', label: 'Lead', color: 'default' },
  { id: 'booked', label: 'Booked', color: 'info' },
  { id: 'scheduled', label: 'Scheduled', color: 'primary' },
  { id: 'shooting', label: 'Shooting', color: 'warning' },
  { id: 'editing', label: 'Editing', color: 'warning' },
  { id: 'review', label: 'Review', color: 'info' },
  { id: 'delivered', label: 'Delivered', color: 'success' },
];

export function EventKanban({ events = [], onStatusChange }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
      {COLUMNS.map((col) => {
        const colEvents = events.filter((e) => e.status === col.id);

        return (
          <div key={col.id} className="min-w-[280px] w-[280px] flex-shrink-0 bg-surface-2 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="font-semibold text-sm flex items-center gap-2">
                {col.label}
                <span className="text-xs bg-surface px-2 py-0.5 rounded text-muted">
                  {colEvents.length}
                </span>
              </span>
            </div>

            <div className="flex flex-col gap-2 min-h-[400px]">
              {colEvents.map((event) => (
                <Card key={event.id} className="p-4 shadow-sm hover:border-brand-primary transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-sm text-foreground">{event.title}</h4>
                    <Badge variant={col.color}>{event.event_type}</Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted">
                    {event.event_date_start && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(event.event_date_start).toLocaleDateString()}</span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 pt-1 text-foreground/80">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{event.completed_tasks || 0}/{event.total_tasks || 0} tasks</span>
                    </div>
                  </div>
                </Card>
              ))}

              {colEvents.length === 0 && (
                <div className="h-24 border-2 border-dashed border-border rounded flex items-center justify-center text-xs text-muted">
                  No events
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
