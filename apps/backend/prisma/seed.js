const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123456', salt);
  const studioPasswordHash = await bcrypt.hash('studio123456', salt);

  // 1. Super Admin User
  const superAdmin = await prisma.users.upsert({
    where: { email: 'admin@photostudio.io' },
    update: {},
    create: {
      email: 'admin@photostudio.io',
      password_hash: adminPasswordHash,
      full_name: 'Platform Super Admin',
      phone: '+1-555-0100',
      is_super_admin: true,
    },
  });
  console.log('[Seed] Created Super Admin:', superAdmin.email);

  // 2. Global Billing Plans
  const starterPlan = await prisma.billing_plans.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Starter Plan (50 GB)',
      storage_gb_min: 0,
      storage_gb_max: 50,
      price_per_month: 999,
      currency: 'INR',
    },
  });

  const proPlan = await prisma.billing_plans.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Pro Studio Plan (200 GB)',
      storage_gb_min: 51,
      storage_gb_max: 200,
      price_per_month: 2499,
      currency: 'INR',
    },
  });

  // 3. Sample Studio Tenant
  const studio = await prisma.studios.upsert({
    where: { slug: 'lumina-studios' },
    update: {},
    create: {
      name: 'Lumina Creative Studios',
      slug: 'lumina-studios',
      subdomain: 'lumina',
      is_active: true,
    },
  });
  console.log('[Seed] Created Studio:', studio.name);

  // 4. Studio Branding
  await prisma.studio_branding.upsert({
    where: { studio_id: studio.id },
    update: {},
    create: {
      studio_id: studio.id,
      brand_name: 'Lumina Studios',
      primary_color: '#3B82F6',
      secondary_color: '#1E293B',
      accent_color: '#10B981',
      logo_url: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=120&auto=format&fit=crop&q=80',
    },
  });

  // 5. Studio Billing Profile
  await prisma.studio_billing_profile.upsert({
    where: { studio_id: studio.id },
    update: {},
    create: {
      studio_id: studio.id,
      storage_quota_gb: 100,
      billing_plan_id: proPlan.id,
      billing_status: 'active',
      platform_access_fee: 4999,
      platform_access_paid_at: new Date(),
    },
  });

  // 6. Studio Owner User
  const studioOwner = await prisma.users.upsert({
    where: { email: 'owner@lumina.com' },
    update: {},
    create: {
      email: 'owner@lumina.com',
      password_hash: studioPasswordHash,
      full_name: 'Alex Rivera (Studio Owner)',
      phone: '+1-555-0101',
      is_super_admin: false,
    },
  });

  await prisma.studio_users.upsert({
    where: {
      studio_id_user_id: {
        studio_id: studio.id,
        user_id: studioOwner.id,
      },
    },
    update: {},
    create: {
      studio_id: studio.id,
      user_id: studioOwner.id,
      role: 'studio_owner',
    },
  });
  console.log('[Seed] Database seeded successfully (pure production state, no mock data)!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

