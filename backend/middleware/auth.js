// prizeversity/backend/middleware/auth.js


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
}

// Only allow teachers
function ensureTeacher(req, res, next) {
    if (
        req.isAuthenticated && req.isAuthenticated() &&
        req.user && req.user.role === 'teacher'
    ) {
        return next();
    }
    return res.status(403).json({ error: 'Teacher role required' });
}

module.exports = { ensureAuthenticated, ensureTeacher };