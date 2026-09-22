process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SESSION_SECRET = 'test_session_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
  cameras: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  storage_providers: {
    findFirst: jest.fn(),
  },
  storage_credentials: {},
  assets: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../services/sftpgoService',()=>({provisionCameraUser:jest.fn().mockResolvedValue({status:'provisioned'}),setCameraActive:jest.fn(),retireCameraUser:jest.fn()}));

jest.mock('../config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn(),
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const createApp = require('../app');
const { handleMediaSyncMessage } = require('../queues/mediaSyncWorker');

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

describe('camera, storage, and media pipeline contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hashes camera SFTP passwords before storing them', async () => {
    mockStudioUser('studio_owner');
    prisma.storage_providers.findFirst.mockResolvedValue({id:'provider-1'});
    prisma.cameras.update.mockResolvedValue({id:'camera-1',sftpgo_username:'lumina_cam_01',lifecycle:'ready',is_active:true});
    prisma.cameras.findUnique.mockResolvedValue(null);
    prisma.cameras.create.mockImplementation(async ({ data, select }) => ({
      id: 'camera-1',
      studio_id: data.studio_id,
      name: data.name,
      model: data.model,
      sftpgo_username: data.sftpgo_username,
      is_active: true,
      created_at: new Date(),
      _storedHash: select ? undefined : data.sftpgo_password_hash,
    }));

    const response = await studioRequest('post', '/api/studio/cameras')
      .send({
        name: 'Sony A7 IV',
        model: 'A7 IV',
        sftpgo_username: 'lumina_cam_01',
        sftpgo_password: 'plain-camera-password',
      });

    expect(response.status).toBe(201);
    const createArg = prisma.cameras.create.mock.calls[0][0];
    expect(createArg.data.sftpgo_password_hash).not.toBe('plain-camera-password');
    await expect(bcrypt.compare('plain-camera-password', createArg.data.sftpgo_password_hash)).resolves.toBe(true);
    expect(response.body).not.toHaveProperty('sftpgo_password_hash');
  });

  it('does not toggle cameras outside the active studio', async () => {
    mockStudioUser('studio_owner');
    prisma.cameras.findFirst.mockResolvedValue(null);

    const response = await studioRequest('patch', '/api/studio/cameras/camera-foreign/status')
      .send({ is_active: false });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/Camera not found/i);
    expect(prisma.cameras.update).not.toHaveBeenCalled();
  });

  it('rejects invalid storage backends before creating providers', async () => {
    mockStudioUser('studio_owner');

    const response = await studioRequest('post', '/api/studio/storage/providers')
      .send({ name: 'Bad Provider', backend: 'dropbox' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid storage backend/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires credentials for remote storage providers', async () => {
    mockStudioUser('studio_owner');

    const response = await studioRequest('post', '/api/studio/storage/providers')
      .send({ name: 'Studio S3', provider_type: 'studio_owned', backend: 's3' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Credentials are required/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records SFTP uploads as assets and updates the camera sync timestamp', async () => {
    prisma.storage_providers.findFirst.mockResolvedValue({ id: 'storage-1' });
    prisma.assets.create.mockResolvedValue({
      id: 'asset-1',
      studio_id: studioId,
      filename: 'DSC0001.JPG',
      original_path: '/uploads/DSC0001.JPG',
    });
    prisma.cameras.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleMediaSyncMessage({
      action: 'sftp_upload_detected',
      studioId,
      storageProviderId: 'storage-1',
      cameraUsername: 'lumina_cam_01',
      filename: 'DSC0001.JPG',
      originalPath: '/uploads/DSC0001.JPG',
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
    });

    expect(result.id).toBe('asset-1');
    expect(prisma.assets.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studio_id: studioId,
        storage_provider_id: 'storage-1',
        filename: 'DSC0001.JPG',
        original_path: '/uploads/DSC0001.JPG',
        mime_type: 'image/jpeg',
        file_size_bytes: BigInt(2048),
      }),
    });
    expect(prisma.cameras.updateMany).toHaveBeenCalledWith({
      where: {
        studio_id: studioId,
        sftpgo_username: 'lumina_cam_01',
      },
      data: { last_sync_at: expect.any(Date) },
    });
  });

  it('indexes only assets that belong to the supplied studio', async () => {
    prisma.assets.findFirst.mockResolvedValue({ id: 'asset-1' });
    prisma.assets.update.mockResolvedValue({
      id: 'asset-1',
      immich_asset_id: 'immich-asset-1',
    });

    const result = await handleMediaSyncMessage({
      action: 'index_asset',
      studioId,
      assetId: 'asset-1',
      immichAssetId: 'immich-asset-1',
    });

    expect(result.immich_asset_id).toBe('immich-asset-1');
    expect(prisma.assets.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'asset-1',
        studio_id: studioId,
      },
      select: { id: true },
    });
    expect(prisma.assets.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { immich_asset_id: 'immich-asset-1' },
    });
  });
});
