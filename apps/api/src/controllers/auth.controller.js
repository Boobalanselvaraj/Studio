const authService = require('../services/auth/auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ user, message: 'User registered successfully' });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      if (req.session) {
        req.session.userId = result.user.id;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      if (req.session) {
        req.session.destroy();
      }
      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      res.json({ user: req.user });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
