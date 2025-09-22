module.exports = function ensureTeacher(req, res, next) {
  const roleRaw = req.user?.role;
  const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : roleRaw;
  const isAdmin = !!req.user?.isAdmin || role === 'admin';

  if (role === 'teacher' || isAdmin) return next();
  return res.status(403).json({ error: 'Access denied: teachers only' });
};


//9/21 this file was created to ensure that only teachers 
// can access certain routes. 
// It checks the user's role and allows access if 
// the user is a teacher or an admin. If not, 
// it returns a 403 Forbidden response.
//used in items.js for updates and deletes of items.
// It can be reused in other routes that require teacher-level access.