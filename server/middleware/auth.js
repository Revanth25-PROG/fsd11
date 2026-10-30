const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-inventory-secure-secret-key-2026';

// Middleware to authenticate user via JWT or fallback role header (for flexible testing/offline sync)
function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
  }

  // Support x-user-role / x-business-id headers for lightweight integration or development
  const roleHeader = req.headers['x-user-role'];
  const businessHeader = req.headers['x-business-id'];
  const nameHeader = req.headers['x-user-name'];

  if (roleHeader) {
    req.user = {
      id: 'demo-user-id',
      role: roleHeader === 'admin' ? 'admin' : 'staff',
      name: nameHeader || (roleHeader === 'admin' ? 'Shop Admin' : 'Shop Staff'),
      businessId: businessHeader || 'biz_default'
    };
    return next();
  }

  // Default fallback user for backwards compatibility with existing UI if unauthenticated
  req.user = {
    id: 'default-admin-id',
    role: 'admin',
    name: 'Default Admin',
    businessId: 'biz_default'
  };
  next();
}

// Middleware to enforce role requirements (e.g., admin only)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: This action requires [${allowedRoles.join(', ')}] privileges. Current role: ${req.user ? req.user.role : 'unauthorized'}.`
      });
    }
    next();
  };
}

module.exports = {
  verifyAuth,
  requireRole,
  JWT_SECRET
};
