import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { CalendarCheck, CheckSquare, HardDrive, UploadCloud } from 'lucide-react';

export function StudioDashboardPage() {
  const stats = [
    { title: "Today's Tasks", value: '4 due', icon: CheckSquare, desc: '2 high priority' },
    { title: 'Active Shoots', value: '12', icon: CalendarCheck, desc: '3 upcoming this week' },
    { title: 'Storage Usage', value: '38.4 GB', icon: HardDrive, desc: '38% of 100 GB quota' },
    { title: 'Recent Uploads', value: '1,420 files', icon: UploadCloud, desc: 'Synced via SFTPGo' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Studio Overview</h2>
        <p className="text-sm text-muted">Welcome back. Here is your shoot and task activity for today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-5">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted">{stat.title}</span>
                <Icon className="h-4 w-4 text-brand-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted mt-1">{stat.desc}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Shoots (Next 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-2 border border-border">
                <div>
                  <h4 className="text-sm font-semibold">Smith & Jones Wedding</h4>
                  <p className="text-xs text-muted">Saturday, 10:00 AM • Grand Palace Hotel</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-brand-primary/20 text-brand-primary font-medium">Scheduled</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-2 border border-border">
                <div>
                  <h4 className="text-sm font-semibold">David Family Portrait</h4>
                  <p className="text-xs text-muted">Sunday, 3:30 PM • Sunset Beach</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-status-warning/20 text-status-warning font-medium">Booked</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Checklist Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['Backup SD Cards for Smith Wedding', 'Cull preview favorites for David Family', 'Export high-res album to client gallery'].map((task, i) => (
                <label key={i} className="flex items-center gap-3 p-2.5 rounded hover:bg-surface-2 cursor-pointer border border-border/50 text-sm">
                  <input type="checkbox" className="rounded text-brand-primary" defaultChecked={i === 0} />
                  <span className={i === 0 ? 'line-through text-muted' : 'text-foreground'}>{task}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
