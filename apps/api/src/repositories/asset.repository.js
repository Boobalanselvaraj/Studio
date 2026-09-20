const BaseRepository = require('./base.repository');
const prisma = require('../config/prisma');

class AssetRepository extends BaseRepository {
  constructor() {
    super('assets');
  }

  async findByAlbum(studio_id, album_id) {
    const albumAssets = await prisma.album_assets.findMany({
      where: {
        album_id,
        album: {
          studio_id,
        },
        asset: {
          is_soft_deleted: false,
        },
      },
      include: {
        asset: true,
      },
      orderBy: {
        sort_order: 'asc',
      },
    });

    return albumAssets.map((aa) => ({
      ...aa.asset,
      sort_order: aa.sort_order,
      is_favorite: aa.is_favorite,
    }));
  }

  async create(studio_id, assetData) {
    const {
      storage_provider_id,
      immich_asset_id,
      filename,
      original_path,
      mime_type,
      file_size_bytes = 0,
      width,
      height,
      exif_data = {},
    } = assetData;

    return prisma.assets.create({
      data: {
        studio_id,
        storage_provider_id,
        immich_asset_id,
        filename,
        original_path,
        mime_type,
        file_size_bytes: BigInt(file_size_bytes),
        width,
        height,
        exif_data,
      },
    });
  }

  async softDelete(studio_id, asset_id) {
    return prisma.assets.updateMany({
      where: {
        id: asset_id,
        studio_id,
      },
      data: {
        is_soft_deleted: true,
        deleted_at: new Date(),
      },
    });
  }
}

module.exports = new AssetRepository();
