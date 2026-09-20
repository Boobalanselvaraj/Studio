const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123456', salt);
  const studioPasswordHash = await bcrypt.hash('studio123456', salt);
  const customerPasswordHash = await bcrypt.hash('customer123456', salt);

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

  // 7. Customer User
  const customerUser = await prisma.users.upsert({
    where: { email: 'sarah.client@example.com' },
    update: {},
    create: {
      email: 'sarah.client@example.com',
      password_hash: customerPasswordHash,
      full_name: 'Sarah Jenkins',
      phone: '+1-555-0199',
      is_super_admin: false,
    },
  });

  const customerRecord = await prisma.customers.upsert({
    where: {
      studio_id_user_id: {
        studio_id: studio.id,
        user_id: customerUser.id,
      },
    },
    update: {},
    create: {
      studio_id: studio.id,
      user_id: customerUser.id,
      notes: 'VIP Wedding Client',
    },
  });

  // 8. Sample Event
  const sampleEvent = await prisma.events.create({
    data: {
      studio_id: studio.id,
      title: 'Jenkins & Miller Wedding Shoot',
      event_type: 'wedding',
      status: 'editing',
      event_date_start: new Date(Date.now() + 86400000 * 2),
      location: 'Grand Botanical Conservatory',
      delivery_deadline: new Date(Date.now() + 86400000 * 14),
      notes: 'Focus on natural light shots during golden hour.',
      created_by: studioOwner.id,
    },
  });

  await prisma.event_customers.create({
    data: {
      event_id: sampleEvent.id,
      customer_id: customerRecord.id,
    },
  });

  // 9. Sample Tasks
  await prisma.event_tasks.createMany({
    data: [
      { event_id: sampleEvent.id, title: 'Backup SD cards to cold storage', is_done: true },
      { event_id: sampleEvent.id, title: 'Cull raw frames & pick top 250', is_done: true },
      { event_id: sampleEvent.id, title: 'Color grade ceremony & reception shots', is_done: false },
      { event_id: sampleEvent.id, title: 'Export high-res client deliverables', is_done: false },
    ],
  });

  // 10. Sample Folder Tree
  const root2026 = await prisma.folders.create({
    data: {
      studio_id: studio.id,
      name: '2026 Shoots',
      sort_order: 1,
      color: '#3B82F6',
    },
  });

  const weddingsFolder = await prisma.folders.create({
    data: {
      studio_id: studio.id,
      parent_folder_id: root2026.id,
      name: 'Weddings',
      sort_order: 1,
      color: '#EC4899',
    },
  });

  await prisma.folders.create({
    data: {
      studio_id: studio.id,
      parent_folder_id: weddingsFolder.id,
      name: 'Jenkins-Miller Ceremony & Reception',
      sort_order: 1,
      color: '#10B981',
    },
  });

  console.log('[Seed] Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
