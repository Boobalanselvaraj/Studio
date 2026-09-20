const prisma = require('../config/prisma');

class AdminController {
  async listStudios(req, res, next) {
    try {
      const studios = await prisma.studios.findMany({
        include: {
          studio_branding: true,
          studio_billing_profile: {
            include: { billing_plan: true },
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

  async createStudio(req, res, next) {
    try {
      const { name, slug, subdomain, custom_domain, storage_quota_gb = 50, billing_plan_id } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ error: 'Studio name and slug are required' });
      }

      const existing = await prisma.studios.findUnique({ where: { slug } });
      if (existing) {
        return res.status(409).json({ error: 'Studio slug already taken' });
      }

      const studio = await prisma.$transaction(async (tx) => {
        const s = await tx.studios.create({
          data: {
            name,
            slug,
            subdomain,
            custom_domain,
          },
        });

        // Initialize default branding
        await tx.studio_branding.create({
          data: {
            studio_id: s.id,
            brand_name: name,
            primary_color: '#3B82F6',
            secondary_color: '#1E293B',
            accent_color: '#10B981',
          },
        });

        // Initialize default billing profile
        await tx.studio_billing_profile.create({
          data: {
            studio_id: s.id,
            storage_quota_gb,
            billing_plan_id,
            billing_status: 'active',
          },
        });

        return s;
      });

      res.status(201).json(studio);
    } catch (err) {
      next(err);
    }
  }

  async updateStudioBilling(req, res, next) {
    try {
      const { storage_quota_gb, billing_plan_id, custom_price_per_month, billing_status } = req.body;
      const studioId = req.params.id;

      const profile = await prisma.studio_billing_profile.upsert({
        where: { studio_id: studioId },
        create: {
          studio_id: studioId,
          storage_quota_gb: storage_quota_gb || 50,
          billing_plan_id,
          custom_price_per_month,
          billing_status: billing_status || 'active',
        },
        update: {
          storage_quota_gb: storage_quota_gb !== undefined ? storage_quota_gb : undefined,
          billing_plan_id: billing_plan_id !== undefined ? billing_plan_id : undefined,
          custom_price_per_month: custom_price_per_month !== undefined ? custom_price_per_month : undefined,
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

  async createBillingPlan(req, res, next) {
    try {
      const { name, storage_gb_min, storage_gb_max, price_per_month, currency = 'INR' } = req.body;

      if (!name || storage_gb_min === undefined || price_per_month === undefined) {
        return res.status(400).json({ error: 'Name, storage_gb_min, and price_per_month are required' });
      }

      const plan = await prisma.billing_plans.create({
        data: {
          name,
          storage_gb_min,
          storage_gb_max: storage_gb_max || null,
          price_per_month,
          currency,
        },
      });

      res.status(201).json(plan);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
