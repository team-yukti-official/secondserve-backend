const { supabaseAdmin } = require('../config/supabase');

function parseQuantityToMeals(quantityString) {
    if (!quantityString) return 0;
    const clean = String(quantityString).toLowerCase().replace(/,/g, ' ').trim();
    const match = clean.match(/\d+(?:[\.,]\d+)?/);
    if (!match) return 1;

    const value = Number(match[0].replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) return 1;
    return value;
}

// Get user profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get profile error', details: error.message });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullName, phone, address, bio, profileImage } = req.body;

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                full_name: fullName,
                phone,
                address,
                bio,
                profile_image: profileImage,
                updated_at: new Date()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Update failed', details: error.message });
        }

        res.json({ message: 'Profile updated', user: data });
    } catch (error) {
        res.status(500).json({ error: 'Update profile error', details: error.message });
    }
};

// Get user by ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, full_name, email, user_type, phone, address, bio, profile_image, created_at')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get user error', details: error.message });
    }
};

// Get nearby donors (fallback to all donors when location fields are not stored)
const getNearbyDonors = async (req, res) => {
    try {
        const { latitude, longitude, lat, lng } = req.body || {};
        const queryLat = latitude || lat;
        const queryLng = longitude || lng;

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, full_name, phone, address, user_type, created_at')
            .eq('user_type', 'donor')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            return res.status(400).json({ error: 'Fetch nearby donors failed', details: error.message });
        }

        // Since coordinates are not persisted in the users schema yet, return donor list.
        // If coords are provided, keep them on response objects for compatibility.
        const donors = (data || []).map((u) => ({
            id: u.id,
            name: u.full_name || 'Donor',
            fullName: u.full_name || 'Donor',
            donorType: 'Food donor',
            phone: u.phone || 'N/A',
            address: u.address || 'Location not provided',
            city: u.address || 'Location not provided',
            latitude: queryLat || null,
            longitude: queryLng || null
        }));

        return res.json(donors);
    } catch (error) {
        return res.status(500).json({ error: 'Nearby donors error', details: error.message });
    }
};

const getPublicProfileById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, full_name, user_type, address, bio, profile_image, verified, created_at')
            .eq('id', id)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let ngoProfile = null;
        if (String(user.user_type || '').toLowerCase() === 'ngo') {
            const { data } = await supabaseAdmin
                .from('ngo_profiles')
                .select('organization_name, mission, impact_statement, website, verified')
                .eq('ngo_id', id)
                .maybeSingle();
            ngoProfile = data || null;
        }

        return res.json({
            id: user.id,
            userType: user.user_type,
            displayName: ngoProfile?.organization_name || user.full_name || 'Community Member',
            fullName: user.full_name || null,
            address: user.address || null,
            bio: user.bio || null,
            profileImage: user.profile_image || null,
            verified: Boolean(user.verified || ngoProfile?.verified),
            joinedAt: user.created_at,
            organization: ngoProfile
                ? {
                    name: ngoProfile.organization_name || null,
                    mission: ngoProfile.mission || null,
                    impactStatement: ngoProfile.impact_statement || null,
                    website: ngoProfile.website || null
                }
                : null,
            privacy: {
                email: 'Hidden for privacy',
                phone: 'Hidden for privacy'
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Public profile error', details: error.message });
    }
};

const getPublicProfileStats = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, user_type')
            .eq('id', id)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const type = String(user.user_type || '').toLowerCase();

        if (type === 'donor') {
            const { data: donations = [], error: donationErr } = await supabaseAdmin
                .from('donations')
                .select('id, title, quantity, status, created_at')
                .eq('donor_id', id)
                .order('created_at', { ascending: false });

            if (donationErr) {
                return res.status(400).json({ error: 'Failed to fetch donor stats', details: donationErr.message });
            }

            const donationIds = donations.map((d) => d.id).filter(Boolean);
            let requests = [];
            if (donationIds.length) {
                const { data: reqData = [], error: reqErr } = await supabaseAdmin
                    .from('pickup_requests')
                    .select('status, requester_id, donation_id, created_at')
                    .in('donation_id', donationIds);

                if (reqErr) {
                    return res.status(400).json({ error: 'Failed to fetch donor request stats', details: reqErr.message });
                }
                requests = reqData;
            }

            const totalDonations = donations.length;
            const completedDonations = donations.filter((d) => ['completed', 'claimed'].includes(String(d.status || '').toLowerCase())).length;
            const mealsShared = donations.reduce((sum, d) => sum + parseQuantityToMeals(d.quantity), 0);
            const ngosHelped = new Set(requests.map((r) => r.requester_id).filter(Boolean)).size;
            const successfulPickups = requests.filter((r) => ['accepted', 'completed'].includes(String(r.status || '').toLowerCase())).length;
            const pickupSuccessRate = requests.length ? Math.round((successfulPickups / requests.length) * 100) : 0;

            const recentActivity = donations.slice(0, 6).map((d) => ({
                title: d.title || 'Food donation',
                status: d.status || 'available',
                meta: d.quantity || 'Quantity not specified',
                date: d.created_at
            }));

            return res.json({
                userType: 'donor',
                cards: [
                    { key: 'donations', label: 'Total Donations', value: totalDonations },
                    { key: 'meals', label: 'Meals Shared', value: mealsShared },
                    { key: 'ngos', label: 'NGOs Helped', value: ngosHelped },
                    { key: 'rate', label: 'Pickup Success Rate', value: `${pickupSuccessRate}%` }
                ],
                summary: {
                    totalDonations,
                    completedDonations,
                    mealsShared,
                    ngosHelped,
                    pickupSuccessRate
                },
                recentActivity
            });
        }

        const { data: requests = [], error: reqError } = await supabaseAdmin
            .from('pickup_requests')
            .select('id, donation_id, status, created_at')
            .eq('requester_id', id)
            .order('created_at', { ascending: false });

        if (reqError) {
            return res.status(400).json({ error: 'Failed to fetch NGO request stats', details: reqError.message });
        }

        const acceptedDonationIds = [...new Set(
            (requests || [])
                .filter((r) => ['accepted', 'completed'].includes(String(r.status || '').toLowerCase()))
                .map((r) => r.donation_id)
                .filter(Boolean)
        )];

        let acceptedDonations = [];
        if (acceptedDonationIds.length) {
            const { data: donationData = [], error: donationErr } = await supabaseAdmin
                .from('donations')
                .select('id, donor_id, quantity, title, created_at')
                .in('id', acceptedDonationIds);

            if (donationErr) {
                return res.status(400).json({ error: 'Failed to fetch NGO donation stats', details: donationErr.message });
            }
            acceptedDonations = donationData;
        }

        const totalRequests = requests.length;
        const acceptedPickups = requests.filter((r) => ['accepted', 'completed'].includes(String(r.status || '').toLowerCase())).length;
        const completedPickups = requests.filter((r) => String(r.status || '').toLowerCase() === 'completed').length;
        const mealsDistributed = acceptedDonations.reduce((sum, d) => sum + parseQuantityToMeals(d.quantity), 0);
        const donorsConnected = new Set(acceptedDonations.map((d) => d.donor_id).filter(Boolean)).size;
        const completionRate = totalRequests ? Math.round((completedPickups / totalRequests) * 100) : 0;

        const recentActivity = (requests || []).slice(0, 6).map((r) => ({
            title: 'Pickup request',
            status: r.status || 'pending',
            meta: `Request #${String(r.id || '').slice(0, 8)}`,
            date: r.created_at
        }));

        return res.json({
            userType: 'ngo',
            cards: [
                { key: 'requests', label: 'Total Requests', value: totalRequests },
                { key: 'accepted', label: 'Accepted Pickups', value: acceptedPickups },
                { key: 'meals', label: 'Meals Distributed', value: mealsDistributed },
                { key: 'donors', label: 'Donors Connected', value: donorsConnected }
            ],
            summary: {
                totalRequests,
                acceptedPickups,
                completedPickups,
                mealsDistributed,
                donorsConnected,
                completionRate
            },
            recentActivity
        });
    } catch (error) {
        return res.status(500).json({ error: 'Public profile stats error', details: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getUserById,
    getNearbyDonors,
    getPublicProfileById,
    getPublicProfileStats
};
