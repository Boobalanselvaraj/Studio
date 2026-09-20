import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Plus, User, Mail, Phone } from 'lucide-react';

export function CustomersPage() {
  const customers = [
    { id: '1', name: 'John & Emily Smith', email: 'smith.wedding@example.com', phone: '+1 (555) 234-5678', events: 1, albums: 2 },
    { id: '2', name: 'Robert David', email: 'robert.david@example.com', phone: '+1 (555) 876-5432', events: 1, albums: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Customer Accounts</h2>
          <p className="text-sm text-muted">Manage client accounts with login-required private gallery access.</p>
        </div>

        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Studio Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Linked Shoots</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-primary" /> {c.name}
                  </TableCell>
                  <TableCell className="text-muted text-xs">{c.email}</TableCell>
                  <TableCell className="text-muted text-xs">{c.phone}</TableCell>
                  <TableCell>{c.events} shoots ({c.albums} galleries)</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">View Galleries</Button>
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
