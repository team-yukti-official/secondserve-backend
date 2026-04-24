const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const smileController = require('../controllers/smileController');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
});

router.post('/donate', authMiddleware, upload.single('itemImage'), smileController.createSmileDonation);
router.get('/featured', smileController.getFeaturedSmileDonations);
router.get('/all', smileController.getAllSmileDonations);
router.get('/statistics/dashboard', smileController.getSmileDashboardStats);
router.post('/:donationId/request-pickup', authMiddleware, smileController.requestSmilePickup);

module.exports = router;
