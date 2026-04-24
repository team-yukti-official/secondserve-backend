const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.substring(7);
        
        // Verify with Supabase
        const { data, error } = await supabase.auth.getUser(token);
        
        if (error || !data.user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = data.user;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Authentication error', details: error.message });
    }
};

module.exports = authMiddleware;
