const prisma = require('../../config/prisma');

class SharingService {
  async shareAlbumWithCustomer(album_id, customer_id, permissions = { canDownload: true, canFavorite: true }) {
    return prisma.album_customers.upsert({
      where: {
        album_id_customer_id: {
          album_id,
          customer_id,
        },
      },
      create: {
        album_id,
        customer_id,
        can_download: permissions.canDownload ?? true,
        can_favorite: permissions.canFavorite ?? true,
      },
      update: {
        can_download: permissions.canDownload,
        can_favorite: permissions.canFavorite,
      },
    });
  }
}

module.exports = new SharingService();
