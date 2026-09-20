import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';

export function BillingPlansPage() {
  const plans = [
    { name: 'Starter Plan', storage: '0 – 50 GB', price: '₹799/mo' },
    { name: 'Growth Plan', storage: '50 – 200 GB', price: '₹1,499/mo' },
    { name: 'Pro Enterprise', storage: '200 GB – 1 TB', price: '₹3,999/mo' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Global Storage Billing Plans</h2>
          <p className="text-sm text-muted">Configure default metered storage tiers across the platform.</p>
        </div>

        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Tier
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{p.price}</div>
              <p className="text-xs text-muted">Quota: {p.storage}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
