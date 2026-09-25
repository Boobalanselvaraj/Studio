process.env.NODE_ENV = 'test';
jest.mock('../config/prisma', () => ({
  storage_providers: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  storage_credentials: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  assets: {
    groupBy: jest.fn(),
  },
  studios: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}));
jest.mock('../services/storageAdapters', () => ({
  testConnection: jest.fn().mockResolvedValue({ success: true }),
  getStorageUsage: jest.fn().mockResolvedValue({ used_bytes: 1048576, total_bytes: 10737418240, free_bytes: 10736369664 }),
}));

const prisma = require('../config/prisma');
const adminController = require('../controllers/adminController');
const { encryptStorageCredentials, decryptStorageCredentials } = require('../config/storage');

const mockRes = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('Admin Storage Server Controller', () => {
  test('createStorageServer accepts capacity_gb and normalizes SFTP credentials', async () => {
    prisma.studios.findUnique.mockResolvedValue({ id: 'std-1', name: 'Test Studio' });
    const tx = {
      storage_providers: {
        create: jest.fn().mockResolvedValue({
          id: 'srv-1',
          name: 'Gsample',
          backend: 'sftp',
          capacity_gb: 500,
          platform_capacity_gb: 500,
        }),
      },
      storage_credentials: {
        create: jest.fn().mockResolvedValue({ id: 'cred-1' }),
      },
    };
    prisma.$transaction.mockImplementation((fn) => fn(tx));

    const req = {
      body: {
        name: 'Gsample',
        backend: 'sftp',
        studio_id: 'std-1',
        capacity_gb: 500,
        credentials: {
          host: 'sb-ftpgcam.rtsiot.com',
          port: 20222,
          username: 'ftpuser',
          password: 'securePassword123',
          root: '/ftp/sample',
        },
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await adminController.createStorageServer(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);

    const createdCredCall = tx.storage_credentials.create.mock.calls[0][0];
    const decrypted = decryptStorageCredentials(createdCredCall.data.encrypted_config);
    expect(decrypted.host).toBe('sb-ftpgcam.rtsiot.com');
    expect(decrypted.port).toBe(20222);
    expect(decrypted.username).toBe('ftpuser');
    expect(decrypted.root).toBe('/ftp/sample');
  });

  test('listAllStorageServers computes live used_bytes, total_bytes and normalized credentials', async () => {
    prisma.storage_providers.findMany.mockResolvedValue([
      {
        id: 'srv-1',
        name: 'Gsample',
        backend: 'sftp',
        capacity_gb: 500,
        platform_capacity_gb: 500,
        storage_credentials: [
          {
            encrypted_config: encryptStorageCredentials({
              host: 'sb-ftpgcam.rtsiot.com',
              port: 20222,
              username: 'ftpuser',
              root: '/ftp/sample',
            }),
          },
        ],
        _count: { assets: 5, cameras: 1 },
      },
    ]);
    prisma.assets.groupBy.mockResolvedValue([
      { storage_provider_id: 'srv-1', _sum: { file_size_bytes: BigInt(524288000) } },
    ]);

    const req = { query: {} };
    const res = mockRes();
    const next = jest.fn();

    await adminController.listAllStorageServers(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();

    const output = res.json.mock.calls[0][0][0];
    expect(output.name).toBe('Gsample');
    expect(output.used_bytes).toBe(524288000);
    expect(output.total_bytes).toBe(500 * 1024 * 1024 * 1024);
    expect(output.credentials.host).toBe('sb-ftpgcam.rtsiot.com');
    expect(output.credentials.port).toBe(20222);
    expect(output.credentials.root).toBe('/ftp/sample');
  });

  test('getStorageServerStats probes storage and returns usage and capacity', async () => {
    prisma.storage_providers.findUnique.mockResolvedValue({
      id: 'srv-1',
      name: 'Gsample',
      backend: 'sftp',
      capacity_gb: 500,
      platform_capacity_gb: 500,
      storage_credentials: [
        {
          encrypted_config: encryptStorageCredentials({
            host: 'sb-ftpgcam.rtsiot.com',
            port: 20222,
            username: 'ftpuser',
            password: 'pwd',
          }),
        },
      ],
    });
    prisma.assets.groupBy.mockResolvedValue([
      { storage_provider_id: 'srv-1', _sum: { file_size_bytes: BigInt(1048576) } },
    ]);

    const req = { params: { id: 'srv-1' } };
    const res = mockRes();
    const next = jest.fn();

    await adminController.getStorageServerStats(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const stats = res.json.mock.calls[0][0];
    expect(stats.capacity_gb).toBe(500);
    expect(stats.total_bytes).toBe(10737418240);
  });
});
