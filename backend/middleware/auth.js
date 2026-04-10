function getRoleSession(req, role) { // Fetch role-specific session data.
  return req.session?.roles?.[role] || null;
}

function requireAuth(req, res, next) { // Enforce at least one authenticated role.
  const roles = req.session?.roles || {};
  const first = Object.entries(roles).find(([, entry]) => entry && entry.userId);
  if (!first) return res.status(401).json({ message: 'Unauthorized' });
  req.userRole = first[0];
  req.userId = first[1].userId;
  return next();
}

function requireRole(role) { // Enforce one or more user roles.
  const allowed = Array.isArray(role) ? role : [role];
  return (req, res, next) => {
    const preferred = req.session?.lastRole;
    if (preferred && allowed.includes(preferred)) { // Honor the most recently logged-in role first.
      const roleSession = getRoleSession(req, preferred);
      if (roleSession?.userId) {
        req.userId = roleSession.userId;
        req.userRole = preferred;
        return next();
      }
    }

    for (const candidate of allowed) { // Fallback: first matching allowed role.
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

