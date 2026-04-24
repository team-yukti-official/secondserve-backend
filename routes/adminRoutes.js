const express = require('express');
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.post('/login', adminController.login);
router.get('/overview', adminAuth, adminController.getOverview);
router.get('/users', adminAuth, adminController.getUsers);
router.get('/donations', adminAuth, adminController.getDonations);
router.get('/volunteers', adminAuth, adminController.getVolunteers);
router.get('/messages', adminAuth, adminController.getMessages);
router.get('/ngos', adminAuth, adminController.getNgos);
router.get('/system', adminAuth, adminController.getSystem);
router.post('/cleanup-expired', adminAuth, adminController.cleanupExpired);
router.delete('/users/:id', adminAuth, adminController.deleteUser);
router.delete('/donations/:id', adminAuth, adminController.deleteDonation);
router.delete('/volunteers/:id', adminAuth, adminController.deleteVolunteer);
router.delete('/messages/:id', adminAuth, adminController.deleteMessage);
router.patch('/volunteers/:id/approve', adminAuth, adminController.approveVolunteer);

module.exports = router;
