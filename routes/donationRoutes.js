const express = require('express');
const multer = require('multer');
const donationController = require('../controllers/donationController');
const pickupController = require('../controllers/pickupController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 8 * 1024 * 1024 }
});

router.post('/create', authMiddleware, upload.single('foodImage'), donationController.createDonation);
router.post('/donate', authMiddleware, upload.single('foodImage'), donationController.createDonation);
router.get('/stats', authMiddleware, donationController.getDonorDashboardStats); // donor dashboard stats
router.get('/impact', authMiddleware, donationController.getDonorImpact); // donor impact data
router.get('/top-donors', donationController.getTopDonors); // top donors leaderboard
router.get('/featured', donationController.getFeaturedDonations);
router.get('/all', donationController.getAllAvailableDonations);
router.get('/nearby', donationController.getNearbyDonations);
router.get('/statistics/dashboard', donationController.getDashboardStats);
router.get('/my-donations', authMiddleware, donationController.getMyDonations);
router.post('/:donationId/request-pickup', authMiddleware, pickupController.requestPickup);
router.get('/:donationId/requests', authMiddleware, pickupController.getDonationRequests);
router.get('/:id', donationController.getDonationDetail);
router.put('/:id', authMiddleware, donationController.updateDonation);
router.delete('/:id', authMiddleware, donationController.deleteDonation);
router.post('/upload-image', donationController.uploadImage);

module.exports = router;
