// middleware function that works as a gate keeper which will protect certain routes that only users with 'admin' roles can access.

module.exports = function (req, res, next ) {
    // check if a user is authenticated AND if is admin
    if (req.user?.role === 'admin') {
        return next();
    }
    // 403 -> Forbidden (not allowed access)
    return res.status(403).json({ error: 'Access denied: Admins only'});
};