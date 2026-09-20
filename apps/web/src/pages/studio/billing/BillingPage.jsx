import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  HardDrive,
  ArrowUpRight,
  Check,
  Plus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { billingApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function BillingPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [usage, setUsage] = useState(null);
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [requestedQuota, setRequestedQuota] = useState(100);
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [uRes, pRes, invRes, plansRes] = await Promise.allSettled([
        billingApi.getUsage(),
        billingApi.getProfile(),
        billingApi.getInvoices(),
        billingApi.getPlans(),
      ]);

      if (uRes.status === 'fulfilled' && uRes.value) setUsage(uRes.value);
      if (pRes.status === 'fulfilled' && pRes.value) setProfile(pRes.value);
      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) setInvoices(invRes.value);
      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value)) setPlans(plansRes.value);
    } catch (err) {
      console.warn('Billing load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [currentStudio?.id]);

  const handleUpgradeRequest = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setErrorMsg('');
      const res = await billingApi.requestUpgrade({
        requested_quota_gb: Number(requestedQuota),
        notes: upgradeNotes,
      });
      setSuccessMsg(res.message || 'Upgrade request submitted.');
      setTimeout(() => {
        setOpenModal(false);
        setSuccessMsg('');
      }, 2000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit upgrade request');
    } finally {
      setBusy(false);
    }
  };

  const usedGb = usage?.usedGb ?? 0;
  const quotaGb = usage?.quotaGb ?? 50;
  const percentUsed = Math.min(usage?.percentUsed ?? 0, 100);
  const strokeDash = `${(percentUsed / 100) * 409} 409`;

  const activePlan = profile?.billing_plan?.name || usage?.plan || 'Starter Plan (50 GB)';
  const planPrice = profile?.billing_plan?.price_per_month
    ? `₹${profile.billing_plan.price_per_month}`
    : '₹999';

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="SPACE FOR YOUR NEXT CHAPTER"
        title="Billing & usage"
        description="A clear picture of your plan, storage, and billing history."
      >
        <Button onClick={() => setOpenModal(true)}>
          <Plus size={16} />
          Request Storage Upgrade
        </Button>
      </PageHeading>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading billing & metering data…</span>
        </div>
      ) : (
        <>
          <div className="billing-grid">
            {/* Current Plan Card */}
            <section className="panel billing-plan">
              <span className="eyebrow">ACTIVE PLAN</span>
              <h2>{activePlan}</h2>
              <p>Tailored storage tier for high-resolution studio assets.</p>

              <div className="plan-price">
                {planPrice}
                <span>/ month</span>
              </div>

              <div className="plan-features">
                <span>
                  <Check size={15} /> {quotaGb} GB managed storage
                </span>
                <span>
                  <Check size={15} /> Private client galleries
                </span>
                <span>
                  <Check size={15} /> Studio workflow & camera sync
                </span>
              </div>

              <div className="mt-4">
                <span
                  className={`status-pill ${
                    usage?.billingStatus === 'active' ? 'status-delivered' : 'status-review'
                  }`}
                >
                  <i /> Status: {usage?.billingStatus || 'Active'}
                </span>
              </div>
            </section>

            {/* Live Usage Meter */}
            <section className="panel billing-usage">
              <div className="panel-heading">
                <h2>Your storage, at a glance</h2>
                <HardDrive size={19} />
              </div>

              <div className="usage-ring">
                <svg viewBox="0 0 160 160" aria-hidden="true">
                  <circle cx="80" cy="80" r="65" />
                  <circle
                    className="ring-fill"
                    cx="80"
                    cy="80"
                    r="65"
                    strokeDasharray={strokeDash}
                  />
                </svg>
                <div>
                  <strong>
                    {usedGb}
                    <span>GB</span>
                  </strong>
                  <small>of {quotaGb} GB used</small>
                </div>
              </div>

              <p>
                {Math.max(quotaGb - usedGb, 0).toFixed(2)} GB of room for what comes next.
              </p>

              {usage?.isApproachingQuota && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded text-xs mt-2">
                  <AlertTriangle size={14} />
                  <span>Approaching storage limit. Consider upgrading your quota.</span>
                </div>
              )}

              <Link className="text-link mt-3 inline-block" to="/studio/storage">
                Explore storage options
                <ArrowUpRight size={15} />
              </Link>
            </section>
          </div>

          {/* Billing Invoices History */}
          <section className="panel mt-6">
            <div className="panel-heading">
              <div>
                <h2>Billing history</h2>
                <p>Official invoices and payment records for your studio account.</p>
              </div>
              <CreditCard size={19} />
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Billing Period</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Issued At</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <strong>{inv.id.slice(0, 13).toUpperCase()}</strong>
                      </td>
                      <td>
                        {new Date(inv.period_start).toLocaleDateString()} –{' '}
                        {new Date(inv.period_end).toLocaleDateString()}
                      </td>
                      <td>
                        ₹{Number(inv.total_amount).toLocaleString()} {inv.currency}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            inv.status === 'paid' ? 'status-delivered' : 'status-booked'
                          }`}
                        >
                          <i />
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.issued_at
                          ? new Date(inv.issued_at).toLocaleDateString()
                          : 'Pending'}
                      </td>
                    </tr>
                  ))}

                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted text-xs">
                        No billing invoices issued yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Request Upgrade Modal */}
      <Modal
        open={openModal}
        onOpenChange={(v) => {
          setOpenModal(v);
          if (!v) {
            setErrorMsg('');
            setSuccessMsg('');
          }
        }}
        title="Request Storage Quota Upgrade"
        description="Submit a quota upgrade request to the platform administration."
      >
        <form className="form-stack" onSubmit={handleUpgradeRequest}>
          {errorMsg && <p className="form-error">{errorMsg}</p>}
          {successMsg && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              {successMsg}
            </p>
          )}

          <label>
            Desired Storage Quota (GB)
            <input
              type="number"
              min={Number(quotaGb) + 10}
              step={10}
              required
              value={requestedQuota}
              onChange={(e) => setRequestedQuota(Number(e.target.value))}
            />
          </label>

          <label>
            Upgrade Notes (Optional)
            <textarea
              rows={3}
              placeholder="e.g. Upcoming wedding season requiring 300 GB additional storage…"
              value={upgradeNotes}
              onChange={(e) => setUpgradeNotes(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
