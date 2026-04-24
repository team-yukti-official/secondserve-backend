const express = require('express');
const pickupController = require('../controllers/pickupController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/:donationId/request', authMiddleware, pickupController.requestPickup);
router.get('/:donationId/requests', authMiddleware, pickupController.getDonationRequests);
router.get('/requests', authMiddleware, pickupController.getIncomingRequests);
router.put('/:requestId/accept', authMiddleware, pickupController.acceptPickupRequest);
router.put('/:requestId/reject', authMiddleware, pickupController.rejectPickupRequest);

module.exports = router;
