const prisma = require('../config/prisma');

function getNextBillingDate(from, cycle) {
  const d = new Date(from);
  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (cycle === 'annually') d.setFullYear(d.getFullYear() + 1);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (cycle === 'one_time') return d;
  return d;
}

async function listSubscriptions(req, res, next) {
  try {
    const studioId = req.params.id || req.studioId;
    const subscriptions = await prisma.billing_subscriptions.findMany({
      where: { studio_id: studioId },
      orderBy: { created_at: 'desc' },
    });
    res.json(subscriptions);
  } catch (err) {
    next(err);
  }
}

async function createSubscription(req, res, next) {
  try {
    const studioId = req.params.id;
    const {
      service_type = 'custom',
      resource_id,
      label,
      description,
      unit_price,
      currency = 'INR',
      billing_cycle = 'monthly',
      started_at = new Date(),
      auto_generate_invoice = false,
      notes,
    } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'Subscription label is required' });
    }
    if (unit_price === undefined || unit_price === null) {
      return res.status(400).json({ error: 'Unit price is required' });
    }

    const start = new Date(started_at);
    const nextDate = getNextBillingDate(start, billing_cycle);

    const sub = await prisma.billing_subscriptions.create({
      data: {
        studio_id: studioId,
        service_type,
        resource_id: resource_id || null,
        label: label.trim(),
        description: description ? description.trim() : null,
        unit_price: Number(unit_price),
        currency,
        billing_cycle,
        started_at: start,
        current_period_start: start,
        current_period_end: nextDate,
        next_billing_date: nextDate,
        status: 'active',
        auto_generate_invoice: Boolean(auto_generate_invoice),
        notes: notes ? notes.trim() : null,
      },
    });

    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
}

async function updateSubscription(req, res, next) {
  try {
    const { id: studioId, subId } = req.params;
    const {
      label,
      description,
      unit_price,
      billing_cycle,
      status,
      auto_generate_invoice,
      notes,
      next_billing_date,
    } = req.body;

    const existing = await prisma.billing_subscriptions.findFirst({
      where: { id: subId, studio_id: studioId },
    });
    if (!existing) return res.status(404).json({ error: 'Subscription not found' });

    const data = {};
    if (label !== undefined) data.label = label.trim();
    if (description !== undefined) data.description = description;
    if (unit_price !== undefined) data.unit_price = Number(unit_price);
    if (billing_cycle !== undefined) data.billing_cycle = billing_cycle;
    if (status !== undefined) data.status = status;
    if (auto_generate_invoice !== undefined) data.auto_generate_invoice = Boolean(auto_generate_invoice);
    if (notes !== undefined) data.notes = notes;
    if (next_billing_date !== undefined) data.next_billing_date = new Date(next_billing_date);

    const updated = await prisma.billing_subscriptions.update({
      where: { id: subId },
      data,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function cancelSubscription(req, res, next) {
  try {
    const { id: studioId, subId } = req.params;
    const existing = await prisma.billing_subscriptions.findFirst({
      where: { id: subId, studio_id: studioId },
    });
    if (!existing) return res.status(404).json({ error: 'Subscription not found' });

    const updated = await prisma.billing_subscriptions.update({
      where: { id: subId },
      data: { status: 'cancelled' },
    });

    res.json({ message: 'Subscription cancelled successfully', subscription: updated });
  } catch (err) {
    next(err);
  }
}

async function triggerSubscriptionInvoice(req, res, next) {
  try {
    const { id: studioId, subId } = req.params;
    const sub = await prisma.billing_subscriptions.findFirst({
      where: { id: subId, studio_id: studioId },
    });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const periodStart = sub.next_billing_date || sub.current_period_start || new Date();
    const periodEnd = getNextBillingDate(periodStart, sub.billing_cycle);

    const categoryMap = {
      platform_license: 'Software License',
      dedicated_server: 'Dedicated Server',
      camera_pack: 'Camera Add-on Pack',
      custom: 'Custom Subscription',
    };

    const lineItem = {
      description: sub.label,
      category: categoryMap[sub.service_type] || 'Subscription',
      quantity: 1,
      unit_price: Number(sub.unit_price),
      amount: Number(sub.unit_price),
    };

    const invoice = await prisma.invoices.create({
      data: {
        studio_id: studioId,
        period_start: periodStart,
        period_end: periodEnd,
        total_amount: Number(sub.unit_price),
        currency: sub.currency,
        line_items: [lineItem],
        status: 'issued',
        issued_at: new Date(),
      },
    });

    const nextDate = getNextBillingDate(periodStart, sub.billing_cycle);
    await prisma.billing_subscriptions.update({
      where: { id: sub.id },
      data: {
        last_invoiced_at: new Date(),
        current_period_start: periodStart,
        current_period_end: periodEnd,
        next_billing_date: sub.billing_cycle === 'one_time' ? periodEnd : nextDate,
        status: sub.billing_cycle === 'one_time' ? 'expired' : sub.status,
      },
    });

    res.status(201).json({ message: 'Invoice generated successfully', invoice });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  triggerSubscriptionInvoice,
  getNextBillingDate,
};
