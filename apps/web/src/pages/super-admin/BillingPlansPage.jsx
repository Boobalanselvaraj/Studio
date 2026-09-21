import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { adminApi } from '../../api/services';

export function BillingPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [minGb, setMinGb] = useState(0);
  const [maxGb, setMaxGb] = useState(100);
  const [price, setPrice] = useState(999);
  const [currency, setCurrency] = useState('INR');

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getBillingPlans();
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch (err) {
      console.warn('Billing plans load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      await adminApi.createBillingPlan({
        name: name.trim(),
        storage_gb_min: Number(minGb),
        storage_gb_max: maxGb ? Number(maxGb) : null,
        price_per_month: Number(price),
        currency,
      });

      setName('');
      setOpenModal(false);
      loadPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create plan tier');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Global Storage Billing Plans
          </h2>
          <p className="text-sm text-muted">
            Configure default metered storage tiers across the platform.
          </p>
        </div>

        <Button onClick={() => setOpenModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Tier
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading plans…</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">
                  ₹{Number(p.price_per_month).toLocaleString()}/mo
                </div>
                <p className="text-xs text-muted">
                  Quota: {p.storage_gb_min} – {p.storage_gb_max ? `${p.storage_gb_max} GB` : 'Unlimited'}
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] bg-surface-2 font-medium">
                  {p.currency} Billing
                </span>
              </CardContent>
            </Card>
          ))}

          {plans.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted text-xs">
              No global billing plans configured.
            </div>
          )}
        </div>
      )}

      {/* Add Plan Tier Modal */}
      <Modal
        open={openModal}
        onOpenChange={(v) => {
          setOpenModal(v);
          if (!v) setError('');
        }}
        title="Add Storage Billing Plan"
        description="Creates a platform-wide storage tier with metered quota bounds."
      >
        <form className="form-stack" onSubmit={handleCreatePlan}>
          {error && <p className="form-error">{error}</p>}

          <label>
            Plan Name
            <input
              required
              placeholder="e.g. Pro Studio Tier (500 GB)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="form-grid">
            <label>
              Min Storage (GB)
              <input
                type="number"
                min={0}
                required
                value={minGb}
                onChange={(e) => setMinGb(e.target.value)}
              />
            </label>
            <label>
              Max Storage (GB)
              <input
                type="number"
                min={1}
                placeholder="Leave empty for unlimited"
                value={maxGb}
                onChange={(e) => setMaxGb(e.target.value)}
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              Monthly Price
              <input
                type="number"
                min={0}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              Currency
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: 'INR', label: 'INR (₹)', description: 'Indian Rupee' },
                  { value: 'USD', label: 'USD ($)', description: 'United States Dollar' },
                  { value: 'EUR', label: 'EUR (€)', description: 'Euro' },
                ]}
              />
            </label>
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Create Plan Tier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
