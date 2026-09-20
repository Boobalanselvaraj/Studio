import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Building2, Plus, Users, HardDrive } from 'lucide-react';

export function AdminDashboardPage() {
  const studios = [
    { id: '1', name: 'Aurora Fine Art Studio', slug: 'aurora-studio', status: 'Active', quota: '100 GB', plan: 'Growth' },
    { id: '2', name: 'Vibrant Moments Photography', slug: 'vibrant-moments', status: 'Active', quota: '500 GB', plan: 'Pro Custom' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Studios Directory</h2>
          <p className="text-sm text-muted">Platform super-admin console for provisioning studio tenants.</p>
        </div>

        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Provision New Studio
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Studio Name</TableHead>
                <TableHead>Slug / Subdomain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Storage Quota</TableHead>
                <TableHead>Billing Plan</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studios.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-brand-primary" /> {s.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted"><code>{s.slug}</code></TableCell>
                  <TableCell><Badge variant="success">{s.status}</Badge></TableCell>
                  <TableCell className="text-xs">{s.quota}</TableCell>
                  <TableCell className="text-xs">{s.plan}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">Manage</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
