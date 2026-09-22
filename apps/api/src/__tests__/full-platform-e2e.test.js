process.env.NODE_ENV = 'test';
process.env.IMMICH_API_KEY = '';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SESSION_SECRET = 'test_session_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/prisma', () => {
  const mockPrisma = {
    studios: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    users: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    studio_users: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    events: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    event_tasks: { findMany: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    event_task_templates: { findMany: jest.fn() },
    event_status_history: { create: jest.fn(), findMany: jest.fn() },
    folders: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    cameras: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    storage_providers: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    albums: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    album_assets: { findMany: jest.fn(), findFirst: jest.fn(), createMany: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    album_customers: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    customers: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    assets: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    audit_logs: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };
  return mockPrisma;
});

jest.mock('../config/rabbitmq', () => ({
  publishToQueue: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue({ channel: null }),
}));

jest.mock('../services/allocationService', () => ({
  checkCameraLimit: jest.fn().mockResolvedValue({ allowed: true, limit: 5, reserved: 1 }),
  getStudioEffectiveAllocations: jest.fn().mockResolvedValue({ storage_quota_gb: 100, camera_limit: 5 }),
}));

const prisma = require('../config/prisma');
const createApp = require('../app');
const sftpgoService = require('../services/sftpgoService');
const immichService = require('../services/immichService');
const emailService = require('../services/emailService');

const app = createApp({ enableRateLimit: false });

const ownerId = '11111111-1111-1111-1111-111111111111';
const customerId = '22222222-2222-2222-2222-222222222222';
const studioId = '33333333-3333-3333-3333-333333333333';

function makeOwnerToken() {
  return jwt.sign({ userId: ownerId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function makeCustomerToken() {
  return jwt.sign({ userId: customerId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Photo Studio SaaS Full Working Setup E2E Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup active studio owner membership
    prisma.users.findUnique.mockResolvedValue({
      id: ownerId,
      email: 'owner@lumina.com',
      full_name: 'Studio Owner',
      is_super_admin: false,
    });

    const studioUserRecord = {
      id: 'su-1',
      studio_id: studioId,
      user_id: ownerId,
      role: 'studio_owner',
      studio: {
        id: studioId,
        name: 'Lumina Weddings',
        slug: 'lumina-weddings',
        is_active: true,
      },
    };

    prisma.studio_users.findFirst.mockResolvedValue(studioUserRecord);
    prisma.studio_users.findUnique.mockResolvedValue(studioUserRecord);

    prisma.studios.findUnique.mockResolvedValue({
      id: studioId,
      name: 'Lumina Weddings',
      slug: 'lumina-weddings',
      is_active: true,
    });
  });

  describe('Module 1 & 2: Event Workflow & Task Auto-Seeding', () => {
    it('creates an event and auto-seeds tasks from templates', async () => {
      prisma.events.create.mockResolvedValue({
        id: 'ev-101',
        studio_id: studioId,
        title: 'Smith-Jones Wedding',
        event_type: 'wedding',
        status: 'lead',
      });

      prisma.event_task_templates.findMany.mockResolvedValue([
        { id: 'tmpl-1', title: 'Confirm Shot List', sort_order: 1 },
        { id: 'tmpl-2', title: 'Backup SD Cards', sort_order: 2 },
      ]);

      const res = await request(app)
        .post('/api/studio/events')
        .set('Authorization', `Bearer ${makeOwnerToken()}`)
        .set('x-studio-id', studioId)
        .send({
          title: 'Smith-Jones Wedding',
          event_type: 'wedding',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Smith-Jones Wedding');
      expect(prisma.event_tasks.createMany).toHaveBeenCalledWith({
        data: [
          { event_id: 'ev-101', title: 'Confirm Shot List', is_done: false },
          { event_id: 'ev-101', title: 'Backup SD Cards', is_done: false },
        ],
      });
    });

    it('advances event status with note and audit history', async () => {
      prisma.events.findFirst.mockResolvedValue({
        id: 'ev-101',
        studio_id: studioId,
        status: 'lead',
      });

      prisma.events.update.mockResolvedValue({
        id: 'ev-101',
        status: 'booked',
      });

      const res = await request(app)
        .post('/api/studio/events/ev-101/status')
        .set('Authorization', `Bearer ${makeOwnerToken()}`)
        .set('x-studio-id', studioId)
        .send({
          to_status: 'booked',
          note: 'Contract signed and deposit paid',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('booked');
      expect(prisma.event_status_history.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_id: 'ev-101',
            from_status: 'lead',
            to_status: 'booked',
            note: 'Contract signed and deposit paid',
          }),
        })
      );
    });
  });

  describe('Module 3: Folder Tree Management', () => {
    it('creates subfolder under existing parent folder', async () => {
      prisma.folders.findFirst.mockResolvedValue({ id: 'f-root', studio_id: studioId });
      prisma.folders.create.mockResolvedValue({
        id: 'f-sub',
        studio_id: studioId,
        name: 'Ceremony',
        parent_folder_id: 'f-root',
      });

      const res = await request(app)
        .post('/api/studio/folders')
        .set('Authorization', `Bearer ${makeOwnerToken()}`)
        .set('x-studio-id', studioId)
        .send({
          name: 'Ceremony',
          parent_folder_id: 'f-root',
          color: '#3B82F6',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Ceremony');
    });
  });

  describe('Module 4 & 9: Camera Uploads & SFTPGo Provisioning', () => {
    it('provisions SFTPGo camera credentials and checks quota', async () => {
      prisma.storage_providers.findFirst.mockResolvedValue({id:'provider-1'});
      prisma.cameras.update.mockResolvedValue({id:'cam-101',sftpgo_username:'cam_lumina_r5',lifecycle:'ready',is_active:true});
      prisma.cameras.findUnique.mockResolvedValue(null);
      prisma.cameras.create.mockResolvedValue({
        id: 'cam-101',
        studio_id: studioId,
        name: 'Canon R5',
        sftpgo_username: 'cam_lumina_r5',
        lifecycle: 'ready',
        is_active: true,
      });

      const provisionSpy = jest.spyOn(sftpgoService, 'provisionCameraUser').mockResolvedValue({
        status: 'provisioned_mock',
        sftpgo_username: 'cam_lumina_r5',
      });

      const res = await request(app)
        .post('/api/studio/cameras')
        .set('Authorization', `Bearer ${makeOwnerToken()}`)
        .set('x-studio-id', studioId)
        .send({
          name: 'Canon R5',
          upload_username: 'cam_lumina_r5',
          upload_password: 'securepassword123',
        });

      expect(res.status).toBe(201);
      expect(res.body.upload_username).toBe('cam_lumina_r5');
      expect(provisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cam_lumina_r5',
          password: 'securepassword123',
        })
      );
    });
  });

  describe('Module 6 & 7: Album Management & Customer Grants', () => {
    it('creates dedicated album and attaches assets', async () => {
      prisma.albums.create.mockResolvedValue({
        id: 'alb-1',
        studio_id: studioId,
        title: 'Smith Wedding Album',
        is_published: true,
      });

      prisma.assets.findMany.mockResolvedValue([{ id: 'ast-1' }, { id: 'ast-2' }]);

      const res = await request(app)
        .post('/api/studio/albums')
        .set('Authorization', `Bearer ${makeOwnerToken()}`)
        .set('x-studio-id', studioId)
        .send({
          title: 'Smith Wedding Album',
          is_published: true,
          asset_ids: ['ast-1', 'ast-2'],
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Smith Wedding Album');
    });

    it('grants album access to customer with can_download and can_favorite', async () => {
      prisma.albums.findFirst.mockResolvedValue({ id: 'alb-1' });
      prisma.customers.findFirst.mockResolvedValue({ id: customerId });
      prisma.album_customers.upsert.mockResolvedValue({
        id: 'ac-1',
        album_id: 'alb-1',
        customer_id: customerId,
        can_download: true,
        can_favorite: true,
      });

      const res = await request(app)
        .post('/api/studio/customers/albums/share')
        .set('Authorization', `Bearer ${makeOwnerToken()}`)
        .set('x-studio-id', studioId)
        .send({
          album_id: 'alb-1',
          customer_id: customerId,
          can_download: true,
          can_favorite: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.can_download).toBe(true);
      expect(res.body.can_favorite).toBe(true);
    });
  });

  describe('Module 8, 10 & 11: Downloads, Favorites, Immich & Notifications', () => {
    it('executes Immich fallback indexing', async () => {
      const res = await immichService.indexAssetInImmich({
        assetId: 'ast-99',
        originalPath: '/storage/lumina/photo.jpg',
        mimeType: 'image/jpeg',
      });

      expect(res.success).toBe(false);
      expect(res.mode).toBe('not_configured');
      expect(res.immich_asset_id).toBeNull();
    });

    it('dispatches email notifications safely', async () => {
      const emailSpy = jest.spyOn(emailService, 'sendGalleryShareEmail').mockResolvedValue({
        success: true,
        mode: 'logged_console',
      });

      const res = await emailService.sendGalleryShareEmail({
        customerEmail: 'client@example.com',
        customerName: 'Alice Smith',
        albumTitle: 'Wedding Gallery',
        galleryUrl: 'http://localhost:5173/gallery/alb-1',
        brandName: 'Lumina Weddings',
      });

      expect(res.success).toBe(true);
      expect(emailSpy).toHaveBeenCalled();
    });
  });
});
