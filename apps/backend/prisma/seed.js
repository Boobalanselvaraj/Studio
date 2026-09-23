const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const IDS = {
  platformStorage: '10000000-0000-0000-0000-000000000001',
  studioOwnedStorage: '10000000-0000-0000-0000-000000000002',
  camera: '20000000-0000-0000-0000-000000000001',
  event: '30000000-0000-0000-0000-000000000001',
  rootFolder: '40000000-0000-0000-0000-000000000001',
  weddingsFolder: '40000000-0000-0000-0000-000000000002',
  eventFolder: '40000000-0000-0000-0000-000000000003',
  album: '50000000-0000-0000-0000-000000000001',
  assetOne: '60000000-0000-0000-0000-000000000001',
  assetTwo: '60000000-0000-0000-0000-000000000002',
  invoice: '70000000-0000-0000-0000-000000000001',
};

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
  const sampleEvent = await prisma.events.upsert({
    where: { id: IDS.event },
    update: {
      status: 'editing',
      location: 'Grand Botanical Conservatory',
      delivery_deadline: new Date(Date.now() + 86400000 * 14),
    },
    create: {
      id: IDS.event,
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

  await prisma.event_customers.upsert({
    where: {
      event_id_customer_id: {
        event_id: sampleEvent.id,
        customer_id: customerRecord.id,
      },
    },
    update: {},
    create: {
      event_id: sampleEvent.id,
      customer_id: customerRecord.id,
    },
  });

  // 9. Sample Tasks
  const existingTasks = await prisma.event_tasks.count({ where: { event_id: sampleEvent.id } });
  if (existingTasks === 0) {
    await prisma.event_tasks.createMany({
      data: [
        { event_id: sampleEvent.id, title: 'Backup SD cards to cold storage', is_done: true },
        { event_id: sampleEvent.id, title: 'Cull raw frames & pick top 250', is_done: true },
        { event_id: sampleEvent.id, title: 'Color grade ceremony & reception shots', is_done: false },
        { event_id: sampleEvent.id, title: 'Export high-res client deliverables', is_done: false },
      ],
    });
  }

  // 10. Sample Folder Tree
  const root2026 = await prisma.folders.upsert({
    where: { id: IDS.rootFolder },
    update: {},
    create: {
      id: IDS.rootFolder,
      studio_id: studio.id,
      name: '2026 Shoots',
      sort_order: 1,
      color: '#3B82F6',
    },
  });

  const weddingsFolder = await prisma.folders.upsert({
    where: { id: IDS.weddingsFolder },
    update: {},
    create: {
      id: IDS.weddingsFolder,
      studio_id: studio.id,
      parent_folder_id: root2026.id,
      name: 'Weddings',
      sort_order: 1,
      color: '#EC4899',
    },
  });

  await prisma.folders.upsert({
    where: { id: IDS.eventFolder },
    update: {},
    create: {
      id: IDS.eventFolder,
      studio_id: studio.id,
      parent_folder_id: weddingsFolder.id,
      name: 'Jenkins-Miller Ceremony & Reception',
      sort_order: 1,
      color: '#10B981',
    },
  });

  // 11. Storage Providers, Camera, Assets, Gallery, Billing
  const platformStorage = await prisma.storage_providers.upsert({
    where: { id: IDS.platformStorage },
    update: { is_default: true },
    create: {
      id: IDS.platformStorage,
      studio_id: studio.id,
      name: 'Managed Platform Storage',
      provider_type: 'platform',
      backend: 'local',
      is_default: true,
    },
  });

  await prisma.storage_providers.upsert({
    where: { id: IDS.studioOwnedStorage },
    update: {},
    create: {
      id: IDS.studioOwnedStorage,
      studio_id: studio.id,
      name: 'Studio-Owned S3 Archive',
      provider_type: 'studio_owned',
      backend: 's3',
      is_default: false,
    },
  });

  await prisma.cameras.upsert({
    where: { id: IDS.camera },
    update: { is_active: true, last_sync_at: new Date() },
    create: {
      id: IDS.camera,
      studio_id: studio.id,
      name: 'Sony A7 IV - Ceremony Cam',
      model: 'ILCE-7M4',
      sftpgo_username: 'lumina_cam_01',
      sftpgo_password_hash: await bcrypt.hash('camera123456', salt),
      is_active: true,
      last_sync_at: new Date(),
    },
  });

  const assetOne = await prisma.assets.upsert({
    where: { id: IDS.assetOne },
    update: {},
    create: {
      id: IDS.assetOne,
      studio_id: studio.id,
      storage_provider_id: platformStorage.id,
      filename: 'JENKINS_WEDDING_001.JPG',
      original_path: '/studios/lumina/2026/weddings/jenkins/001.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: BigInt(8 * 1024 * 1024),
      width: 3000,
      height: 2000,
    },
  });

  const assetTwo = await prisma.assets.upsert({
    where: { id: IDS.assetTwo },
    update: {},
    create: {
      id: IDS.assetTwo,
      studio_id: studio.id,
      storage_provider_id: platformStorage.id,
      filename: 'JENKINS_WEDDING_002.JPG',
      original_path: '/studios/lumina/2026/weddings/jenkins/002.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: BigInt(9 * 1024 * 1024),
      width: 3000,
      height: 2000,
    },
  });

  const album = await prisma.albums.upsert({
    where: { id: IDS.album },
    update: { is_published: true },
    create: {
      id: IDS.album,
      studio_id: studio.id,
      event_id: sampleEvent.id,
      title: 'Jenkins & Miller Wedding Highlights',
      description: 'Curated wedding gallery for client review.',
      is_published: true,
    },
  });

  await prisma.album_assets.upsert({
    where: { album_id_asset_id: { album_id: album.id, asset_id: assetOne.id } },
    update: {},
    create: { album_id: album.id, asset_id: assetOne.id, sort_order: 1 },
  });

  await prisma.album_assets.upsert({
    where: { album_id_asset_id: { album_id: album.id, asset_id: assetTwo.id } },
    update: {},
    create: { album_id: album.id, asset_id: assetTwo.id, sort_order: 2 },
  });

  await prisma.album_customers.upsert({
    where: { album_id_customer_id: { album_id: album.id, customer_id: customerRecord.id } },
    update: { can_download: true, can_favorite: true },
    create: {
      album_id: album.id,
      customer_id: customerRecord.id,
      can_download: true,
      can_favorite: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.storage_usage_snapshots.upsert({
    where: {
      storage_provider_id_snapshot_date: {
        storage_provider_id: platformStorage.id,
        snapshot_date: today,
      },
    },
    update: { bytes_used: BigInt(17 * 1024 * 1024) },
    create: {
      studio_id: studio.id,
      storage_provider_id: platformStorage.id,
      snapshot_date: today,
      bytes_used: BigInt(17 * 1024 * 1024),
    },
  });

  await prisma.invoices.upsert({
    where: { id: IDS.invoice },
    update: {},
    create: {
      id: IDS.invoice,
      studio_id: studio.id,
      period_start: new Date('2026-09-01'),
      period_end: new Date('2026-09-30'),
      line_items: [
        { label: 'One-time application access fee', amount: 4999 },
        { label: 'Managed platform storage - Pro Studio Plan', amount: 2499 },
      ],
      total_amount: 7498,
      currency: 'INR',
      status: 'issued',
      issued_at: new Date(),
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
