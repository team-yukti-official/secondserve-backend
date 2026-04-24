const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/signup/send-email-otp', authController.sendSignupEmailOtp);
router.get('/signup/email-verification-status', authController.getSignupEmailVerificationStatus);
router.post('/signup/verify-email-otp', authController.verifySignupEmailOtp);
router.post('/signup/verify-email-link', authController.verifySignupEmailLink);
router.post('/signup/verify-email-session', authController.verifySignupEmailSession);
router.post('/check-email', authController.checkEmailExists);
router.post('/check-email-exists', authController.checkEmailExists);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.get('/validate-token', authController.validateToken);
router.post('/refresh-token', authController.refreshToken);
router.post('/verify-email', authController.verifyEmail);

module.exports = router;
