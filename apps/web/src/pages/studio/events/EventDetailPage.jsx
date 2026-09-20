import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, CheckCircle2, Folder, Clock } from 'lucide-react';

export function EventDetailPage() {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <Link to="/studio/events" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Smith & Jones Wedding</h2>
            <Badge variant="primary">Scheduled</Badge>
          </div>
          <p className="text-sm text-muted mt-1">Wedding Shoot • Grand Palace Hotel • Sep 25, 2026</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline">Change Status</Button>
          <Button>Open Folder Tree</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shoot Tasks & Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['Confirm shot list with couple', 'Pack dual cameras & 35mm/85mm lenses', 'Shoot Ceremony & Reception', 'Cull raw files', 'Upload to Immich gallery'].map((task, i) => (
                  <label key={i} className="flex items-center gap-3 p-3 rounded-md bg-surface-2 border border-border cursor-pointer text-sm">
                    <input type="checkbox" className="rounded text-brand-primary" defaultChecked={i < 2} />
                    <span className={i < 2 ? 'line-through text-muted' : 'text-foreground'}>{task}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted mt-0.5" />
                  <div>
                    <p className="font-semibold">Moved to Scheduled</p>
                    <p className="text-muted">By Sarah (Owner) • Sep 10, 2026</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted mt-0.5" />
                  <div>
                    <p className="font-semibold">Moved to Booked</p>
                    <p className="text-muted">Deposit confirmed • Sep 02, 2026</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
