const prisma = require('../../config/prisma');

class AlbumService {
  async getStudioAlbums(studio_id) {
    const albums = await prisma.albums.findMany({
      where: { studio_id },
      include: {
        album_assets: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return albums.map((a) => ({
      ...a,
      total_assets: a.album_assets.length,
    }));
  }

  async createAlbum(studio_id, data) {
    const { title, description, event_id, is_published = false } = data;
    return prisma.albums.create({
      data: {
        studio_id,
        title,
        description,
        event_id: event_id || null,
        is_published,
      },
    });
  }
}

module.exports = new AlbumService();
