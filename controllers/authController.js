const { supabase, supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

// Temporary flag to disable OTP verification for testing
const OTP_VERIFICATION_DISABLED = true;

const otpStore = new Map();
const resetTokenStore = new Map();
const signupEmailVerificationStore = new Map();

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateVerificationToken() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getEmailVerificationPauseUntil() {
    const raw = String(process.env.EMAIL_VERIFICATION_PAUSED_UNTIL || '').trim();
    if (!raw) return 0;
    const ts = Date.parse(raw);
    return Number.isNaN(ts) ? 0 : ts;
}

function isEmailVerificationPaused() {
    const until = getEmailVerificationPauseUntil();
    return until > Date.now();
}

// Sign up
const signup = async (req, res) => {
    try {
        const {
            email,
            password,
            fullName,
            userType,
            phone,
            address,
            city,
            emailVerificationToken
        } = req.body;

        const normalizedAddress = (address || city || '').trim();

        const emailKey = (email || '').toLowerCase();

        const emailVerification = signupEmailVerificationStore.get(emailKey);

        if (!OTP_VERIFICATION_DISABLED && !isEmailVerificationPaused()) {
            if (
                !emailVerification ||
                emailVerification.token !== emailVerificationToken ||
                Date.now() > emailVerification.expiresAt
            ) {
                return res.status(400).json({ error: 'Email verification required or expired.' });
            }
        }

        let authData = null;
        const listed = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = (listed.data?.users || []).find((u) => u.email?.toLowerCase() === emailKey);

        if (existingAuthUser) {
            const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
                password,
                email_confirm: true
            });
            if (updateErr) {
                return res.status(400).json({ error: 'Signup failed', details: updateErr.message });
            }
            authData = { user: updated.user || updated };
        } else {
            const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (authError) {
                return res.status(400).json({ error: 'Signup failed', details: authError.message });
            }

            authData = created;
        }

        // Create user profile in database
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: authData.user.id,
                email,
                full_name: fullName,
                user_type: userType,
                phone,
                address: normalizedAddress,
                verified: true,
                updated_at: new Date()
            }, { onConflict: 'id' })
            .select()
            .single();

        if (profileError) {
            if (profileError.code === '23505') {
                return res.status(409).json({ error: 'Email already registered. Please login instead.' });
            }
            return res.status(400).json({ error: 'Profile creation failed', details: profileError.message });
        }

        if (userType === 'ngo') {
            const { data: existingNgoProfile } = await supabaseAdmin
                .from('ngo_profiles')
                .select('id')
                .eq('ngo_id', authData.user.id)
                .limit(1)
                .maybeSingle();

            let ngoProfileError = null;

            if (existingNgoProfile?.id) {
                const { error } = await supabaseAdmin
                    .from('ngo_profiles')
                    .update({
                        organization_name: fullName || 'NGO',
                        updated_at: new Date()
                    })
                    .eq('id', existingNgoProfile.id);
                ngoProfileError = error;
            } else {
                const { error } = await supabaseAdmin
                    .from('ngo_profiles')
                    .insert({
                        id: uuidv4(),
                        ngo_id: authData.user.id,
                        organization_name: fullName || 'NGO',
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                ngoProfileError = error;
            }

            if (ngoProfileError) {
                return res.status(400).json({ error: 'NGO profile creation failed', details: ngoProfileError.message });
            }
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError || !signInData?.session?.access_token) {
            return res.status(201).json({
                message: 'Signup successful. Please log in.',
                user: profileData,
                userId: authData.user.id
            });
        }

        signupEmailVerificationStore.delete(emailKey);

        res.status(201).json({
            message: 'Signup successful',
            token: signInData.session.access_token,
            user: profileData,
            userId: authData.user.id
        });
    } catch (error) {
        res.status(500).json({ error: 'Signup error', details: error.message });
    }
};

const sendSignupEmailOtp = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const redirectTo = String(req.body.redirectTo || '').trim();

        if (isEmailVerificationPaused()) {
            return res.status(503).json({
                error: 'Email verification is temporarily paused. Please continue signup and verify later.',
                resumeAt: new Date(getEmailVerificationPauseUntil()).toISOString()
            });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        const { data: exists } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (exists) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const otpOptions = { shouldCreateUser: true };
        const hasRedirect = /^https?:\/\//i.test(redirectTo);
        if (hasRedirect) {
            otpOptions.emailRedirectTo = redirectTo;
        }

        let { error: otpErr } = await supabase.auth.signInWithOtp({
            email,
            options: otpOptions
        });

        // Common failure: redirect URL not present in Supabase allow-list.
        // Retry without redirect so OTP/link can still be sent.
        if (otpErr && hasRedirect) {
            const retry = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true }
            });
            otpErr = retry.error;
        }

        if (otpErr) {
            if (/rate limit/i.test(otpErr.message || '')) {
                return res.status(429).json({
                    error: 'Too many OTP requests. Please wait a minute and try again.',
                    details: otpErr.message
                });
            }
            return res.status(400).json({ error: 'Failed to send email OTP', details: otpErr.message });
        }

        return res.json({ message: 'Email OTP sent' });
    } catch (error) {
        return res.status(500).json({ error: 'Send email OTP error', details: error.message });
    }
};

const verifySignupEmailOtp = async (req, res) => {
    try {
        if (isEmailVerificationPaused()) {
            return res.status(503).json({
                error: 'Email verification is temporarily paused.',
                resumeAt: new Date(getEmailVerificationPauseUntil()).toISOString()
            });
        }

        const email = (req.body.email || '').trim().toLowerCase();
        const otp = String(req.body.otp || '').trim();

        if (OTP_VERIFICATION_DISABLED) {
            // Skip verification and directly generate token
            const verificationToken = generateVerificationToken();
            signupEmailVerificationStore.set(email, { token: verificationToken, expiresAt: Date.now() + 20 * 60 * 1000 });
            return res.json({ message: 'Email verified (OTP disabled)', verificationToken });
        }

        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
        });

        if (verifyErr || !data?.user) {
            return res.status(400).json({ error: 'Invalid or expired email OTP' });
        }

        const verificationToken = generateVerificationToken();
        signupEmailVerificationStore.set(email, { token: verificationToken, expiresAt: Date.now() + 20 * 60 * 1000 });

        return res.json({ message: 'Email verified', verificationToken });
    } catch (error) {
        return res.status(500).json({ error: 'Verify email OTP error', details: error.message });
    }
};

const verifySignupEmailLink = async (req, res) => {
    try {
        if (isEmailVerificationPaused()) {
            return res.status(503).json({
                error: 'Email verification is temporarily paused.',
                resumeAt: new Date(getEmailVerificationPauseUntil()).toISOString()
            });
        }

        const tokenHash = String(req.body.tokenHash || '').trim();
        const rawType = String(req.body.type || 'email').trim();
        const allowedTypes = new Set(['email', 'magiclink', 'signup']);
        const type = allowedTypes.has(rawType) ? rawType : 'email';

        if (!tokenHash) {
            return res.status(400).json({ error: 'tokenHash is required' });
        }

        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type
        });

        if (verifyErr || !data?.user?.email) {
            return res.status(400).json({ error: 'Invalid or expired verification link' });
        }

        const email = data.user.email.toLowerCase();
        const verificationToken = generateVerificationToken();
        signupEmailVerificationStore.set(email, { token: verificationToken, expiresAt: Date.now() + 20 * 60 * 1000 });

        return res.json({ message: 'Email verified', email, verificationToken });
    } catch (error) {
        return res.status(500).json({ error: 'Verify email link error', details: error.message });
    }
};

const verifySignupEmailSession = async (req, res) => {
    try {
        if (isEmailVerificationPaused()) {
            return res.status(503).json({
                error: 'Email verification is temporarily paused.',
                resumeAt: new Date(getEmailVerificationPauseUntil()).toISOString()
            });
        }

        const accessToken = String(req.body.accessToken || '').trim();
        if (!accessToken) {
            return res.status(400).json({ error: 'accessToken is required' });
        }

        const { data, error } = await supabase.auth.getUser(accessToken);
        if (error || !data?.user?.email) {
            return res.status(400).json({ error: 'Invalid or expired email session' });
        }

        const email = data.user.email.toLowerCase();
        const verificationToken = generateVerificationToken();
        signupEmailVerificationStore.set(email, { token: verificationToken, expiresAt: Date.now() + 20 * 60 * 1000 });

        return res.json({ message: 'Email verified', email, verificationToken });
    } catch (error) {
        return res.status(500).json({ error: 'Verify email session error', details: error.message });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get user profile
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            return res.status(400).json({ error: 'User not found' });
        }

        res.json({
            message: 'Login successful',
            token: authData.session.access_token,
            user: user
        });
    } catch (error) {
        res.status(500).json({ error: 'Login error', details: error.message });
    }
};

// Check if email exists
const checkEmailExists = async (req, res) => {
    try {
        const { email } = req.body;

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ exists: !!data });
    } catch (error) {
        res.status(500).json({ error: 'Check email error', details: error.message });
    }
};

// Forgot password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        // Do not leak account existence; always return success-style response.
        if (!userRow) {
            return res.json({ message: 'If the email exists, a reset code was sent.' });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = Date.now() + 10 * 60 * 1000;
        otpStore.set(email.toLowerCase(), { otp, expiresAt });

        const responsePayload = { message: 'Reset code generated.' };
        if (process.env.NODE_ENV !== 'production') {
            responsePayload.devOtp = otp;
        }

        res.json(responsePayload);
    } catch (error) {
        res.status(500).json({ error: 'Forgot password error', details: error.message });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const key = (email || '').toLowerCase();

        if (OTP_VERIFICATION_DISABLED) {
            // Skip verification and directly generate reset token
            const resetToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            resetTokenStore.set(key, { resetToken, expiresAt: Date.now() + 15 * 60 * 1000 });
            return res.json({ resetToken });
        }

        const record = otpStore.get(key);

        if (!record || Date.now() > record.expiresAt || record.otp !== String(otp || '')) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        otpStore.delete(key);
        const resetToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        resetTokenStore.set(key, { resetToken, expiresAt: Date.now() + 15 * 60 * 1000 });

        res.json({ resetToken });
    } catch (error) {
        res.status(500).json({ error: 'Verify OTP error', details: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;
        const key = (email || '').toLowerCase();
        const tokenRow = resetTokenStore.get(key);

        if (!tokenRow || tokenRow.resetToken !== resetToken || Date.now() > tokenRow.expiresAt) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const { data: userRow, error: userErr } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userErr || !userRow) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userRow.id, {
            password: newPassword
        });

        if (updateErr) {
            return res.status(400).json({ error: 'Reset password failed', details: updateErr.message });
        }

        resetTokenStore.delete(key);
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ error: 'Reset password error', details: error.message });
    }
};

const validateToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false });
        }

        const token = authHeader.slice(7);
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({ valid: false });
        }

        return res.json({ valid: true, userId: data.user.id });
    } catch (error) {
        return res.status(500).json({ valid: false, error: 'Token validation failed' });
    }
};

const refreshToken = async (req, res) => {
    // Frontend currently only checks that this route exists.
    // Return a clear message to re-login if token lifecycle is expired.
    return res.status(501).json({
        error: 'Refresh token is not enabled in this build. Please login again.'
    });
};

const verifyEmail = async (req, res) => {
    return res.status(501).json({
        error: 'Email verification endpoint is not enabled in this build.'
    });
};

const getSignupEmailVerificationStatus = (req, res) => {
    const paused = isEmailVerificationPaused();
    return res.json({
        required: !paused,
        paused,
        resumeAt: paused ? new Date(getEmailVerificationPauseUntil()).toISOString() : null
    });
};

// Logout
const logout = (req, res) => {
    res.json({ message: 'Logout successful' });
};

module.exports = {
    signup,
    login,
    sendSignupEmailOtp,
    verifySignupEmailOtp,
    verifySignupEmailLink,
    verifySignupEmailSession,
    getSignupEmailVerificationStatus,
    checkEmailExists,
    forgotPassword,
    verifyOtp,
    resetPassword,
    validateToken,
    refreshToken,
    verifyEmail,
    logout
};
