const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

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
    res.json(studios);
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
      billing_plan_id,
      owner_email,
      owner_name,
      owner_password = 'studio123456',
    } = req.body;

    const normalizedSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    const quotaGb = Number(storage_quota_gb);

    if (!name || !normalizedSlug) {
      return res.status(400).json({ error: 'Studio name and slug are required' });
    }

    if (!SLUG_PATTERN.test(normalizedSlug)) {
      return res.status(400).json({ error: 'Studio slug must use lowercase letters, numbers, and hyphens only' });
    }

    if (!Number.isFinite(quotaGb) || quotaGb <= 0) {
      return res.status(400).json({ error: 'storage_quota_gb must be a positive number' });
    }

    const existing = await prisma.studios.findUnique({ where: { slug: normalizedSlug } });
    if (existing) {
      return res.status(409).json({ error: 'Studio slug already taken' });
    }

    const targetOwnerEmail = (owner_email && owner_email.trim()) 
      ? owner_email.trim().toLowerCase() 
      : `owner@${normalizedSlug}.com`;
    const targetOwnerName = (owner_name && owner_name.trim()) 
      ? owner_name.trim() 
      : `${name} Owner`;
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
      if (tx.studio_branding?.create) {
        await tx.studio_branding.create({
          data: {
            studio_id: s.id,
            brand_name: name,
            primary_color: '#3B82F6',
            secondary_color: '#1E293B',
            accent_color: '#10B981',
          },
        });
      }

      // 3. Create Billing Profile
      if (tx.studio_billing_profile?.create) {
        await tx.studio_billing_profile.create({
          data: {
            studio_id: s.id,
            storage_quota_gb: quotaGb,
            billing_plan_id,
            billing_status: 'active',
          },
        });
      }

      // 4. Create or Find Studio Owner User Account
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
    const { storage_quota_gb, billing_plan_id, custom_price_per_month, billing_status } = req.body;
    const studioId = req.params.id;

    const studio = await prisma.studios.findUnique({
      where: { id: studioId },
      select: { id: true },
    });

    if (!studio) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    if (storage_quota_gb !== undefined) {
      const quotaGb = Number(storage_quota_gb);
      if (!Number.isFinite(quotaGb) || quotaGb <= 0) {
        return res.status(400).json({ error: 'storage_quota_gb must be a positive number' });
      }
    }

    if (custom_price_per_month !== undefined) {
      const customPrice = Number(custom_price_per_month);
      if (!Number.isFinite(customPrice) || customPrice < 0) {
        return res.status(400).json({ error: 'custom_price_per_month must be zero or greater' });
      }
    }

    if (billing_status !== undefined && !VALID_BILLING_STATUSES.has(billing_status)) {
      return res.status(400).json({ error: 'Invalid billing status' });
    }

    const profile = await prisma.studio_billing_profile.upsert({
      where: { studio_id: studioId },
      create: {
        studio_id: studioId,
        storage_quota_gb: storage_quota_gb !== undefined ? Number(storage_quota_gb) : 50,
        billing_plan_id,
        custom_price_per_month: custom_price_per_month !== undefined ? Number(custom_price_per_month) : undefined,
        billing_status: billing_status || 'active',
      },
      update: {
        storage_quota_gb: storage_quota_gb !== undefined ? Number(storage_quota_gb) : undefined,
        billing_plan_id: billing_plan_id !== undefined ? billing_plan_id : undefined,
        custom_price_per_month: custom_price_per_month !== undefined ? Number(custom_price_per_month) : undefined,
        billing_status: billing_status !== undefined ? billing_status : undefined,
        updated_at: new Date(),
      },
      include: { billing_plan: true },
    });

    res.json(profile);
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

    if (!Number.isFinite(minGb) || minGb < 0) {
      return res.status(400).json({ error: 'storage_gb_min must be zero or greater' });
    }

    if (maxGb !== null && (!Number.isFinite(maxGb) || maxGb <= minGb)) {
      return res.status(400).json({ error: 'storage_gb_max must be greater than storage_gb_min' });
    }

    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      return res.status(400).json({ error: 'price_per_month must be zero or greater' });
    }

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

module.exports = {
  listStudios,
  createStudio,
  updateStudioBilling,
  createBillingPlan,
};
