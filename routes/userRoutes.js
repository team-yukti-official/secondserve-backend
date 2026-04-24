const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.get('/public/:id', userController.getPublicProfileById);
router.get('/public/:id/stats', userController.getPublicProfileStats);
router.post('/nearby-donors', userController.getNearbyDonors);
router.get('/:id', userController.getUserById);

module.exports = router;
