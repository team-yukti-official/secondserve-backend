require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const donationRoutes = require('./routes/donationRoutes');
const pickupRoutes = require('./routes/pickupRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const smileRoutes = require('./routes/smileRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const errorHandler = require('./middleware/errorHandler');
const { cleanupExpiredAvailableDonations } = require('./utils/donationExpiry');

const app = express();

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const corsOptions = configuredCorsOrigins.length
    ? {
        origin(origin, callback) {
            if (!origin || configuredCorsOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(null, false);
        }
    }
    : { origin: true };

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/food', donationRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/smile', smileRoutes);
app.use('/api/volunteers', volunteerRoutes);

// Aliases to support legacy frontend route names (/api/ngo/...)
const ngoController = require('./controllers/ngoController');
const authMiddleware = require('./middleware/auth');
app.get('/api/ngo/stats', authMiddleware, ngoController.getNgoDashboardStats);
app.get('/api/ngo/requests', authMiddleware, ngoController.getNgoRequests);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'FeedLink Backend is running' });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

async function runExpiredDonationCleanup() {
    try {
        const result = await cleanupExpiredAvailableDonations();
        if (result.deletedCount > 0) {
            console.log(`Expired donation cleanup removed ${result.deletedCount} item(s).`);
        }
    } catch (error) {
        console.warn('Expired donation cleanup failed:', error.message);
    }
}

const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
    // Start local server only outside serverless environments.
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        void runExpiredDonationCleanup();
        setInterval(runExpiredDonationCleanup, Number(process.env.EXPIRED_DONATION_CLEANUP_MS) || 15 * 60 * 1000);
    });
}

module.exports = app;
