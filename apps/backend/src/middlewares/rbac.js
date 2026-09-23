const prisma = require('../config/prisma');

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }
  next();
}

function requireStudioRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: User authentication required' });
      }

      if (req.user.is_super_admin) {
        return next(); // Platform owner bypasses
      }

      const studioId = req.studioId || (req.studio && req.studio.id);
      if (!studioId) {
        return res.status(400).json({ error: 'Studio context missing for RBAC evaluation' });
      }

      const studioUser = await prisma.studio_users.findUnique({
        where: {
          studio_id_user_id: {
            studio_id: studioId,
            user_id: req.user.id,
          },
        },
        select: { role: true },
      });

      if (!studioUser) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this studio' });
      }

      const userRole = studioUser.role;
      req.userStudioRole = userRole;

      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: `Forbidden: Requires one of the following roles: [${allowedRoles.join(', ')}]` 
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  requireSuperAdmin,
  requireStudioRole,
};
