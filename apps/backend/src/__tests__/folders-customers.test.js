process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SESSION_SECRET = 'test_session_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/prisma', () => ({
  users: {
    findUnique: jest.fn(),
  },
  studios: {
    findUnique: jest.fn(),
  },
  studio_users: {
    findUnique: jest.fn(),
  },
  folders: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  folder_items: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  albums: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  album_assets: {
    deleteMany: jest.fn(),
  },
  asset_tags: {
    deleteMany: jest.fn(),
  },
  assets: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  storage_providers: {
    findFirst: jest.fn(),
  },
  customers: {
    findFirst: jest.fn(),
  },
  album_customers: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
}));


jest.mock('../config/rabbitmq', () => ({
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const { publishToQueue } = require('../config/rabbitmq');
const createApp = require('../app');

const app = createApp({ enableRateLimit: false });

const userId = '11111111-1111-1111-1111-111111111111';
const studioId = '22222222-2222-2222-2222-222222222222';

function authToken() {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockStudioUser(role = 'studio_owner') {
  prisma.users.findUnique.mockResolvedValue({
    id: userId,
    email: 'owner@example.com',
    full_name: 'Studio Owner',
    is_super_admin: false,
  });
  prisma.studios.findUnique.mockResolvedValue({
    id: studioId,
    name: 'Lumina Studio',
    slug: 'lumina',
    is_active: true,
  });
  prisma.studio_users.findUnique.mockResolvedValue({ role });
}

function studioRequest(method, url) {
  return request(app)[method](url)
    .set('Authorization', `Bearer ${authToken()}`)
    .set('x-studio-id', studioId);
}

describe('folder and customer access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents moving a folder inside one of its descendants', async () => {
    mockStudioUser('studio_manager');
    prisma.folders.findFirst
      .mockResolvedValueOnce({ id: 'folder-root', studio_id: studioId })
      .mockResolvedValueOnce({ id: 'folder-child', studio_id: studioId });
    prisma.folders.findMany
      .mockResolvedValueOnce([{ id: 'folder-child' }])
      .mockResolvedValueOnce([]);

    const response = await studioRequest('post', '/api/studio/folders/folder-root/move')
      .send({ target_parent_id: 'folder-child' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/descendants/i);
    expect(prisma.folders.update).not.toHaveBeenCalled();
  });

  it('rejects bulk moves when any item is outside the current studio', async () => {
    mockStudioUser('studio_manager');
    prisma.folders.findFirst.mockResolvedValue({ id: 'target-folder', name: 'Delivery', studio_id: studioId });
    prisma.folder_items.findMany.mockResolvedValue([{ id: 'item-1' }]);

    const response = await studioRequest('post', '/api/studio/folders/bulk-move')
      .send({ item_ids: ['item-1', 'item-2'], target_folder_id: 'target-folder' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/do not belong/i);
    expect(publishToQueue).not.toHaveBeenCalled();
  });

  it('does not expose album sharing from customer routes', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: userId,
      email: 'client@example.com',
      full_name: 'Client',
      is_super_admin: false,
    });

    const response = await request(app)
      .post('/api/customer/albums/share')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ album_id: 'album-1', customer_id: 'customer-1' });

    expect(response.status).toBe(404);
    expect(prisma.album_customers.upsert).not.toHaveBeenCalled();
  });

  it('serializes customer gallery asset BigInt fields safely', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: userId,
      email: 'client@example.com',
      full_name: 'Client',
      is_super_admin: false,
    });
    prisma.album_customers.findMany.mockResolvedValue([
      {
        can_download: true,
        can_favorite: true,
        album: {
          id: 'album-1',
          title: 'Wedding Highlights',
          studio: {
            name: 'Lumina Studio',
            studio_branding: {
              brand_name: 'Lumina',
              logo_url: null,
              primary_color: '#2563EB',
            },
          },
          album_assets: [
            {
              asset: {
                id: 'asset-1',
                filename: 'DSC0001.JPG',
                file_size_bytes: BigInt(2048),
              },
            },
          ],
        },
      },
    ]);

    const response = await request(app)
      .get('/api/customer/albums')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(200);
    expect(response.body[0].album_assets[0].asset.file_size_bytes).toBe('2048');
  });

  it('allows studio managers to share only albums and customers from their own studio', async () => {
    mockStudioUser('studio_manager');
    prisma.albums.findFirst.mockResolvedValue({ id: 'album-1' });
    prisma.customers.findFirst.mockResolvedValue({ id: 'customer-1' });
    prisma.album_customers.upsert.mockResolvedValue({
      id: 'share-1',
      album_id: 'album-1',
      customer_id: 'customer-1',
      can_download: true,
      can_favorite: false,
    });

    const response = await studioRequest('post', '/api/studio/customers/albums/share')
      .send({ album_id: 'album-1', customer_id: 'customer-1', can_favorite: false });

    expect(response.status).toBe(201);
    expect(prisma.albums.findFirst).toHaveBeenCalledWith({
      where: { id: 'album-1', studio_id: studioId },
      select: { id: true },
    });
    expect(prisma.customers.findFirst).toHaveBeenCalledWith({
      where: { id: 'customer-1', studio_id: studioId },
      select: { id: true },
    });
    expect(response.body).toMatchObject({
      album_id: 'album-1',
      customer_id: 'customer-1',
      can_favorite: false,
    });
  });

  it('permanently bulk deletes selected assets from studio and database', async () => {
    mockStudioUser('studio_owner');
    prisma.assets.findMany.mockResolvedValue([
      { id: 'asset-1', filename: 'DSC001.JPG', original_path: 'storage/studios/test/DSC001.JPG', storage_provider_id: null },
      { id: 'asset-2', filename: 'DSC002.JPG', original_path: 'storage/studios/test/DSC002.JPG', storage_provider_id: null },
    ]);
    prisma.folder_items.deleteMany.mockResolvedValue({ count: 2 });
    prisma.albums.updateMany.mockResolvedValue({ count: 0 });
    prisma.album_assets.deleteMany.mockResolvedValue({ count: 2 });
    prisma.asset_tags.deleteMany.mockResolvedValue({ count: 0 });
    prisma.assets.deleteMany.mockResolvedValue({ count: 2 });

    const response = await studioRequest('post', '/api/studio/folders/assets/bulk-delete')
      .send({ asset_ids: ['asset-1', 'asset-2'] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);
    expect(prisma.assets.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['asset-1', 'asset-2'] }, studio_id: studioId },
    });
  });

  it('permanently deletes provider folder and all contained files', async () => {
    mockStudioUser('studio_owner');
    prisma.storage_providers.findFirst.mockResolvedValue({
      id: 'prov-1',
      studio_id: studioId,
      backend: 'local',
      storage_credentials: null,
    });
    prisma.assets.findMany.mockResolvedValue([
      { id: 'asset-10', filename: 'IMG_01.JPG', object_key: 'weddings/2026/IMG_01.JPG', storage_provider_id: 'prov-1' },
    ]);
    prisma.folder_items.deleteMany.mockResolvedValue({ count: 1 });
    prisma.albums.updateMany.mockResolvedValue({ count: 0 });
    prisma.album_assets.deleteMany.mockResolvedValue({ count: 1 });
    prisma.asset_tags.deleteMany.mockResolvedValue({ count: 0 });
    prisma.assets.deleteMany.mockResolvedValue({ count: 1 });

    const response = await studioRequest('post', '/api/studio/folders/provider-folder/delete')
      .send({ provider_id: 'prov-1', folder_path: 'weddings/2026' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.deleted_files_count).toBe(1);
    expect(prisma.assets.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['asset-10'] }, studio_id: studioId },
    });
  });
});

