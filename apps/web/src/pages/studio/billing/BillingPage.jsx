import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { HardDrive, CreditCard, ArrowUpRight } from 'lucide-react';

export function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Billing & Metered Storage</h2>
          <p className="text-sm text-muted">Review storage usage against quotas and previous billing statements.</p>
        </div>

        <Button variant="outline" className="flex items-center gap-1.5">
          <ArrowUpRight className="w-4 h-4" /> Request Quota Upgrade
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-primary" /> Platform Storage Metering
            </CardTitle>
            <CardDescription>Daily measured bytes for platform-hosted NVMe storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5 font-medium">
                <span>38.4 GB Used</span>
                <span className="text-muted">100 GB Quota (38.4%)</span>
              </div>
              <div className="w-full bg-surface-2 rounded-full h-2.5 overflow-hidden">
                <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: '38.4%' }}></div>
              </div>
            </div>
            <p className="text-xs text-muted">
              Note: Studio-owned custom NAS and S3 buckets are excluded from storage charges.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-primary" /> Current Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-2xl font-bold">₹1,499<span className="text-xs font-normal text-muted">/month</span></div>
            <p className="text-xs text-muted">Growth Plan (Up to 100 GB)</p>
            <Badge variant="success" className="mt-2">Active</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Period</TableHead>
                <TableHead>Line Items</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">Aug 01, 2026 – Aug 31, 2026</TableCell>
                <TableCell className="text-xs text-muted">Platform Storage (Tier 1)</TableCell>
                <TableCell className="font-bold">₹1,499</TableCell>
                <TableCell><Badge variant="success">Paid</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost">Download PDF</Button></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
