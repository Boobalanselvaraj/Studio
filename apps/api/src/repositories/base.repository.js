const prisma = require('../config/prisma');

class BaseRepository {
  constructor(modelName) {
    this.modelName = modelName;
    this.prisma = prisma;
  }

  get model() {
    return this.prisma[this.modelName];
  }

  async findById(studio_id, id) {
    return this.model.findFirst({
      where: {
        id,
        studio_id,
      },
    });
  }

  async findAll(studio_id, limit = 50, offset = 0) {
    return this.model.findMany({
      where: {
        studio_id,
      },
      take: limit,
      skip: offset,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async deleteById(studio_id, id) {
    return this.model.deleteMany({
      where: {
        id,
        studio_id,
      },
    });
  }
}

module.exports = BaseRepository;
