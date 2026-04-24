const jwt = require('jsonwebtoken');

function getAdminJwtSecret() {
    return process.env.ADMIN_JWT_SECRET || process.env.ADMIN_SECRET || 'feedlink-admin-dev-secret';
}

module.exports = function adminAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing admin token' });
        }

        const token = authHeader.slice(7);
        const payload = jwt.verify(token, getAdminJwtSecret());

        if (!payload || payload.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        req.admin = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired admin token' });
    }
};
