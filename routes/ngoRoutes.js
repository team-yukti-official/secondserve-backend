const express = require('express');
const ngoController = require('../controllers/ngoController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/profile', authMiddleware, ngoController.createNgoProfile);
router.get('/all', ngoController.getAllNgos);
router.get('/profile/:ngoId', ngoController.getNgoProfile);
router.put('/profile', authMiddleware, ngoController.updateNgoProfile);
router.get('/nearby', ngoController.getNearbyNgos);
router.get('/search', ngoController.searchNgos);
router.get('/stats', authMiddleware, ngoController.getNgoDashboardStats); // NGO dashboard shortcut
router.get('/requests', authMiddleware, ngoController.getNgoRequests); // NGO modal request listing
router.get('/:ngoId/statistics', ngoController.getNgoStatistics);

module.exports = router;
