const customerService = require('../services/customer/customer.service');

class CustomerController {
  async listStudioCustomers(req, res, next) {
    try {
      const customers = await customerService.getCustomers(req.studioId);
      res.json(customers);
    } catch (err) {
      next(err);
    }
  }

  async getMyGalleries(req, res, next) {
    try {
      // In customer portal, req.user holds customer identity
      const albums = await customerService.getCustomerAlbums(req.user.id);
      res.json(albums);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();
