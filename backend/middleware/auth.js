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

function requireRole(role) { // Enforce one or more user roles.
  const allowed = Array.isArray(role) ? role : [role];
  return (req, res, next) => {
    for (const candidate of allowed) {
      const roleSession = getRoleSession(req, candidate);
      if (roleSession?.userId) {
        req.userId = roleSession.userId;
        req.userRole = candidate;
        return next();
      }
    }
    return res.status(403).json({ message: 'Forbidden' });
  };
}

module.exports = { requireAuth, requireRole, getRoleSession };

