import React, { useState } from 'react';
import { EventKanban } from '../../../components/event-kanban/EventKanban';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { Plus, LayoutGrid, List } from 'lucide-react';

export function EventsPage() {
  const [events] = useState([
    {
      id: '1',
      title: 'Smith & Jones Wedding',
      event_type: 'wedding',
      status: 'scheduled',
      event_date_start: '2026-09-25T10:00:00Z',
      location: 'Grand Palace Hotel',
      total_tasks: 8,
      completed_tasks: 3,
    },
    {
      id: '2',
      title: 'David Family Portrait',
      event_type: 'portrait',
      status: 'booked',
      event_date_start: '2026-09-28T14:00:00Z',
      location: 'Sunset Beach',
      total_tasks: 5,
      completed_tasks: 1,
    },
    {
      id: '3',
      title: 'TechCorp Summit 2026',
      event_type: 'corporate',
      status: 'editing',
      event_date_start: '2026-09-18T09:00:00Z',
      location: 'Convention Center',
      total_tasks: 6,
      completed_tasks: 4,
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Events & Shoots</h2>
          <p className="text-sm text-muted">Manage shoots, photographer assignments, and workflow statuses.</p>
        </div>

        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Shoot / Event
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="kanban" className="flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4" /> Workflow Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-1.5">
              <List className="w-4 h-4" /> Table View
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban">
          <EventKanban events={events} />
        </TabsContent>

        <TabsContent value="list">
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted">
            Table view representation for bulk event querying and sorting.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
