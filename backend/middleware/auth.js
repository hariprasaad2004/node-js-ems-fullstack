function getRoleSession(req, role) { // Fetch role-specific session data.
  return req.session?.roles?.[role] || null;
}

function requireAuth(req, res, next) { // Enforce at least one authenticated role.
  const roles = req.session?.roles || {};
  const hasRole = Object.values(roles).some((entry) => entry && entry.userId);
  if (!hasRole) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return next();
}

function requireRole(role) { // Enforce a specific user role.
  return (req, res, next) => {
    const roleSession = getRoleSession(req, role);
    if (!roleSession?.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.userId = roleSession.userId;
    req.userRole = role;
    return next();
  };
}

module.exports = { requireAuth, requireRole, getRoleSession };

