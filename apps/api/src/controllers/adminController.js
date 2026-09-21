const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { checkCameraLimit, checkStorageQuota } = require('../services/allocationService');

const VALID_BILLING_STATUSES = new Set(['active', 'past_due', 'suspended', 'comped']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function listStudios(req, res, next) {
  try {
    const studios = await prisma.studios.findMany({
      include: {
        studio_branding: true,
        studio_billing_profile: {
          include: { billing_plan: true },
        },
        studio_users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                full_name: true,
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            events: true,
            customers: true,
            cameras: true,
            assets: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Augment with live platform usage and reserved cameras
    const augmented = await Promise.all(
      studios.map(async (st) => {
        const platformBytesAgg = await prisma.assets.aggregate({
          where: {
            studio_id: st.id,
            is_soft_deleted: false,
            OR: [
              { storage_provider_id: null },
              { storage_provider: { provider_type: 'platform' } },
            ],
          },
          _sum: { file_size_bytes: true },
        });

        const reservedCams = await prisma.cameras.count({
          where: {
            studio_id: st.id,
            lifecycle: { not: 'retired' },
          },
        });

        const bytes = platformBytesAgg._sum.file_size_bytes
          ? Number(platformBytesAgg._sum.file_size_bytes)
          : 0;

        return {
          ...st,
          liveMetrics: {
            platformUsedBytes: bytes,
            platformUsedGb: parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2)),
            reservedCameras: reservedCams,
          },
        };
      })
    );

    res.json(augmented);
  } catch (err) {
    next(err);
  }
}

async function createStudio(req, res, next) {
  try {
    const {
      name,
      slug,
      subdomain,
      custom_domain,
      storage_quota_gb = 50,
      camera_limit = 5,
      features = {},
      billing_plan_id,
      owner_email,
      owner_name,
      owner_password = 'studio123456',
    } = req.body;

    const normalizedSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    const quotaGb = Number(storage_quota_gb);
    const camLimit = parseInt(camera_limit, 10);

    if (!name || !normalizedSlug) {
      return res.status(400).json({ error: 'Studio name and slug are required' });
    }

    if (!SLUG_PATTERN.test(normalizedSlug)) {
      return res.status(400).json({ error: 'Studio slug must use lowercase letters, numbers, and hyphens only' });
    }

    if (!Number.isFinite(quotaGb) || quotaGb < 0) {
      return res.status(400).json({ error: 'storage_quota_gb must be zero or greater' });
    }

    if (isNaN(camLimit) || camLimit < 0) {
      return res.status(400).json({ error: 'camera_limit must be zero or greater' });
    }

    const existing = await prisma.studios.findUnique({ where: { slug: normalizedSlug } });
    if (existing) {
      return res.status(409).json({ error: 'Studio slug already taken' });
    }

    const targetOwnerEmail =
      owner_email && owner_email.trim()
        ? owner_email.trim().toLowerCase()
        : `owner@${normalizedSlug}.com`;
    const targetOwnerName =
      owner_name && owner_name.trim() ? owner_name.trim() : `${name} Owner`;
    const targetOwnerPass = owner_password || 'studio123456';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Studio
      const s = await tx.studios.create({
        data: {
          name,
          slug: normalizedSlug,
          subdomain,
          custom_domain,
        },
      });

      // 2. Create Branding
      await tx.studio_branding.create({
        data: {
          studio_id: s.id,
          brand_name: name,
          primary_color: '#3B82F6',
          secondary_color: '#1E293B',
          accent_color: '#10B981',
        },
      });

      // 3. Create Authoritative Billing & Allocation Profile
      await tx.studio_billing_profile.create({
        data: {
          studio_id: s.id,
          storage_quota_gb: quotaGb,
          camera_limit: camLimit,
          features: typeof features === 'object' ? features : {},
          config_version: 1,
          billing_plan_id: billing_plan_id || null,
          billing_status: 'active',
        },
      });

      // 4. Provision Platform Storage Provider
      if (tx.storage_providers?.create) {
        await tx.storage_providers.create({
          data: {
            studio_id: s.id,
            name: 'Platform Managed Storage',
            provider_type: 'platform',
            backend: 'local',
            is_default: true,
            is_enabled: true,
            health: 'healthy',
          },
        });
      }

      // 5. Create or Find Studio Owner User Account
      let ownerInfo = {
        email: targetOwnerEmail,
        full_name: targetOwnerName,
        role: 'studio_owner',
        temporary_password: targetOwnerPass,
      };

      if (tx.users?.findUnique) {
        let user = await tx.users.findUnique({
          where: { email: targetOwnerEmail },
        });

        if (!user && tx.users?.create) {
          const salt = await bcrypt.genSalt(10);
          const password_hash = await bcrypt.hash(targetOwnerPass, salt);
          user = await tx.users.create({
            data: {
              email: targetOwnerEmail,
              full_name: targetOwnerName,
              password_hash,
              is_super_admin: false,
            },
          });
        }

        if (user && tx.studio_users?.create) {
          await tx.studio_users.create({
            data: {
              studio_id: s.id,
              user_id: user.id,
              role: 'studio_owner',
            },
          });
        }

        if (user) {
          ownerInfo.email = user.email;
          ownerInfo.full_name = user.full_name;
        }
      }

      return {
        ...s,
        studio: s,
        owner: ownerInfo,
      };
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateStudioBilling(req, res, next) {
  try {
    const {
      storage_quota_gb,
      camera_limit,
      features,
      billing_plan_id,
      custom_price_per_month,
      billing_status,
    } = req.body;
    const studioId = req.params.id;

    const studio = await prisma.studios.findUnique({
      where: { id: studioId },
      select: { id: true },
    });

    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    if (billing_status !== undefined && !VALID_BILLING_STATUSES.has(billing_status)) {
      return res.status(400).json({ error: 'Invalid billing status' });
    }

    // Allocation validation
    if (camera_limit !== undefined) {
      const limit = parseInt(camera_limit, 10);
      const camCheck = await checkCameraLimit(studioId);
      if (limit < camCheck.reserved) {
        return res.status(400).json({
          error: `Cannot reduce camera limit below currently reserved slots (${camCheck.reserved} slots in use). Studio must retire cameras first.`,
          reserved: camCheck.reserved,
        });
      }
    }

    if (storage_quota_gb !== undefined) {
      const quota = Number(storage_quota_gb);
      if (!Number.isFinite(quota) || quota < 0) {
        return res.status(400).json({ error: 'storage_quota_gb must be zero or greater' });
      }
    }

    const profile = await prisma.studio_billing_profile.upsert({
      where: { studio_id: studioId },
      create: {
        studio_id: studioId,
        storage_quota_gb: storage_quota_gb !== undefined ? Number(storage_quota_gb) : 50,
        camera_limit: camera_limit !== undefined ? parseInt(camera_limit, 10) : 5,
        features: features || {},
        billing_plan_id,
        custom_price_per_month: custom_price_per_month !== undefined ? Number(custom_price_per_month) : undefined,
        billing_status: billing_status || 'active',
        config_version: 1,
      },
      update: {
        storage_quota_gb: storage_quota_gb !== undefined ? Number(storage_quota_gb) : undefined,
        camera_limit: camera_limit !== undefined ? parseInt(camera_limit, 10) : undefined,
        features: features !== undefined ? features : undefined,
        billing_plan_id: billing_plan_id !== undefined ? billing_plan_id : undefined,
        custom_price_per_month: custom_price_per_month !== undefined ? Number(custom_price_per_month) : undefined,
        billing_status: billing_status !== undefined ? billing_status : undefined,
        config_version: { increment: 1 },
        updated_at: new Date(),
      },
      include: { billing_plan: true },
    });

    // Record audit log
    await prisma.audit_logs.create({
      data: {
        user_id: req.user.id,
        studio_id: studioId,
        action: 'UPDATE_STUDIO_ALLOCATIONS',
        resource_type: 'studio_billing_profile',
        resource_id: profile.id,
        details: {
          storage_quota_gb: profile.storage_quota_gb,
          camera_limit: profile.camera_limit,
          billing_status: profile.billing_status,
          config_version: profile.config_version,
        },
      },
    });

    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function getStudioAllocations(req, res, next) {
  try {
    const studioId = req.params.id;
    const profile = await prisma.studio_billing_profile.findUnique({
      where: { studio_id: studioId },
      include: { billing_plan: true },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Billing profile not found' });
    }

    const camCheck = await checkCameraLimit(studioId);
    const storageCheck = await checkStorageQuota(studioId, 0);

    res.json({
      studio_id: studioId,
      storage_quota_gb: profile.storage_quota_gb,
      camera_limit: profile.camera_limit,
      features: profile.features,
      config_version: profile.config_version,
      billing_status: profile.billing_status,
      reservedCameras: camCheck.reserved,
      usedPlatformBytes: storageCheck.committedBytes.toString(),
      remainingPlatformBytes: storageCheck.remainingBytes.toString(),
    });
  } catch (err) {
    next(err);
  }
}

async function listAllocationRequests(req, res, next) {
  try {
    const requests = await prisma.allocation_requests.findMany({
      orderBy: { created_at: 'desc' },
    });

    const studios = await prisma.studios.findMany({
      where: { id: { in: requests.map((r) => r.studio_id) } },
      select: { id: true, name: true, slug: true },
    });
    const studioMap = new Map(studios.map((s) => [s.id, s]));

    res.json(
      requests.map((r) => ({
        ...r,
        studio: studioMap.get(r.studio_id) || null,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function resolveAllocationRequest(req, res, next) {
  try {
    const requestId = req.params.id;
    const { status, apply_quota } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }

    const request = await prisma.allocation_requests.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      return res.status(404).json({ error: 'Allocation request not found' });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const reqUpdated = await tx.allocation_requests.update({
        where: { id: requestId },
        data: { status },
      });

      if (status === 'approved' && apply_quota !== false) {
        await tx.studio_billing_profile.update({
          where: { studio_id: request.studio_id },
          data: {
            storage_quota_gb: request.requested_quota_gb,
            config_version: { increment: 1 },
          },
        });
      }

      return reqUpdated;
    });

    res.json(updatedRequest);
  } catch (err) {
    next(err);
  }
}

async function listBillingComponents(req, res, next) {
  try {
    const studioId = req.params.id;
    const components = await prisma.billing_components.findMany({
      where: { studio_id: studioId },
      orderBy: { effective_from: 'desc' },
    });
    res.json(components);
  } catch (err) {
    next(err);
  }
}

async function createBillingComponent(req, res, next) {
  try {
    const studioId = req.params.id;
    const { code, label, kind, meter, unit_price, included_quantity = 0, currency = 'INR', effective_from } = req.body;

    if (!code || !label || !kind || unit_price === undefined) {
      return res.status(400).json({ error: 'code, label, kind, and unit_price are required' });
    }

    const component = await prisma.billing_components.create({
      data: {
        studio_id: studioId,
        code: code.trim(),
        label: label.trim(),
        kind: kind.trim(),
        meter: meter ? meter.trim() : null,
        unit_price: Number(unit_price),
        included_quantity: Number(included_quantity),
        currency,
        effective_from: effective_from ? new Date(effective_from) : new Date(),
      },
    });

    res.status(201).json(component);
  } catch (err) {
    next(err);
  }
}

async function createBillingPlan(req, res, next) {
  try {
    const { name, storage_gb_min, storage_gb_max, price_per_month, currency = 'INR' } = req.body;

    if (!name || storage_gb_min === undefined || price_per_month === undefined) {
      return res.status(400).json({ error: 'Name, storage_gb_min, and price_per_month are required' });
    }

    const minGb = Number(storage_gb_min);
    const maxGb = storage_gb_max === undefined || storage_gb_max === null ? null : Number(storage_gb_max);
    const monthlyPrice = Number(price_per_month);

    const plan = await prisma.billing_plans.create({
      data: {
        name,
        storage_gb_min: minGb,
        storage_gb_max: maxGb,
        price_per_month: monthlyPrice,
        currency,
      },
    });

    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
}

async function listStudioStorageConnections(req, res, next) {
  try {
    const studioId = req.params.id;
    const providers = await prisma.storage_providers.findMany({
      where: { studio_id: studioId },
      include: { storage_credentials: { select: { id: true, created_at: true } } },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
    res.json(providers);
  } catch (err) {
    next(err);
  }
}

async function provisionPlatformStorage(req, res, next) {
  try {
    const studioId = req.params.id;
    const { name = 'Platform Managed Storage', backend = 'local', is_default = true } = req.body;

    const studio = await prisma.studios.findUnique({ where: { id: studioId } });
    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    const provider = await prisma.storage_providers.create({
      data: {
        studio_id: studioId,
        name: name.trim(),
        provider_type: 'platform',
        backend,
        is_default: !!is_default,
        is_enabled: true,
        health: 'healthy',
      },
    });

    res.status(201).json(provider);
  } catch (err) {
    next(err);
  }
}

async function listStudioInvoices(req, res, next) {
  try {
    const studioId = req.params.id;
    const invoices = await prisma.invoices.findMany({
      where: { studio_id: studioId },
      orderBy: { period_end: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

async function generateStudioInvoice(req, res, next) {
  try {
    const studioId = req.params.id;
    const { period_start, period_end, total_amount = 0, currency = 'INR', line_items = [] } = req.body;

    const invoice = await prisma.invoices.create({
      data: {
        studio_id: studioId,
        period_start: new Date(period_start || Date.now()),
        period_end: new Date(period_end || Date.now()),
        total_amount: Number(total_amount),
        currency,
        line_items,
        status: 'draft',
      },
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

async function recordManualPayment(req, res, next) {
  try {
    const { id: studioId, invoiceId } = req.params;
    const { amount, notes, payment_reference } = req.body;

    const invoice = await prisma.invoices.findFirst({
      where: { id: invoiceId, studio_id: studioId },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found for studio' });
    }

    const updated = await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    await prisma.audit_logs.create({
      data: {
        user_id: req.user.id,
        studio_id: studioId,
        action: 'RECORD_MANUAL_PAYMENT',
        resource_type: 'invoices',
        resource_id: invoiceId,
        details: {
          amount: amount || invoice.total_amount,
          payment_reference,
          notes,
          manual: true,
          recorded_at: new Date().toISOString(),
        },
      },
    });

    res.json({ message: 'Manual payment recorded successfully', invoice: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStudios,
  createStudio,
  updateStudioBilling,
  getStudioAllocations,
  listAllocationRequests,
  resolveAllocationRequest,
  listBillingComponents,
  createBillingComponent,
  createBillingPlan,
  listStudioStorageConnections,
  provisionPlatformStorage,
  listStudioInvoices,
  generateStudioInvoice,
  recordManualPayment,
};
