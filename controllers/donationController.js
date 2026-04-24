const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { cleanupExpiredAvailableDonations } = require('../utils/donationExpiry');

const DONATION_IMAGE_BUCKET = 'donation-images';

function sanitizeFileName(name) {
    return String(name || 'image')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120);
}

function parseQuantityToMeals(quantityString) {
    if (!quantityString) return 0;
    const clean = String(quantityString).toLowerCase().replace(/,/g, ' ').trim();
    const match = clean.match(/\d+(?:[\.,]\d+)?/);
    if (!match) return 1;

    const value = Number(match[0].replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) return 1;
    return value;
}

async function uploadDonationImage(file, donationId) {
    if (!file) return null;

    const safeName = sanitizeFileName(file.originalname);
    const path = `donations/${donationId}-${Date.now()}-${safeName}`;

    let uploadResult = await supabaseAdmin.storage
        .from(DONATION_IMAGE_BUCKET)
        .upload(path, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false
        });

    if (uploadResult.error && /bucket.*not.*found/i.test(uploadResult.error.message || '')) {
        await supabaseAdmin.storage.createBucket(DONATION_IMAGE_BUCKET, { public: true });
        uploadResult = await supabaseAdmin.storage
            .from(DONATION_IMAGE_BUCKET)
            .upload(path, file.buffer, {
                contentType: file.mimetype || 'application/octet-stream',
                upsert: false
            });
    }

    if (uploadResult.error) {
        return null;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
        .from(DONATION_IMAGE_BUCKET)
        .getPublicUrl(path);

    return publicUrlData?.publicUrl || null;
}

// Create donation
const createDonation = async (req, res) => {
    try {
        const userId = req.user.id;
        const body = req.body || {};

        const title = body.title || body.foodName;
        const description = body.description || '';
        const category = body.category || body['categories[]'] || body.categories || 'food';
        const quantityValue = body.quantity || '';
        const quantityUnit = body.unit || '';
        const quantity = quantityUnit ? `${quantityValue} ${quantityUnit}`.trim() : String(quantityValue || '');
        const condition = body.condition || (body.vegetarian === 'yes' ? 'vegetarian' : body.vegetarian === 'no' ? 'non-vegetarian' : 'good');
        const latitude = body.latitude ? Number(body.latitude) : null;
        const longitude = body.longitude ? Number(body.longitude) : null;
        const address = [body.address, body.city, body.pincode].filter(Boolean).join(', ');
        const isPerishable = body.isPerishable !== undefined ? Boolean(body.isPerishable) : true;

        let expiryDate = body.expiryDate || null;
        if (body.expiryDate && body.expiryTime) {
            expiryDate = `${body.expiryDate}T${body.expiryTime}:00`;
        }

        const contactPhone = body.contactPhone || body.phone || null;

        let images = [];
        if (req.file && req.file.originalname) {
            const uploadedUrl = await uploadDonationImage(req.file, uuidv4());
            images = uploadedUrl ? [uploadedUrl] : [];
        } else if (Array.isArray(body.images)) {
            images = body.images;
        }

        if (!title || !quantityValue || !address) {
            return res.status(400).json({ error: 'Missing required donation fields (food name, quantity, address).' });
        }

        const { data, error } = await supabaseAdmin
            .from('donations')
            .insert({
                id: uuidv4(),
                donor_id: userId,
                title,
                description,
                category,
                quantity,
                condition,
                latitude,
                longitude,
                address,
                is_perishable: isPerishable,
                expiry_date: expiryDate,
                contact_phone: contactPhone,
                images: images || [],
                status: 'available',
                created_at: new Date()
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Create donation failed', details: error.message });
        }

        res.status(201).json({
            message: 'Donation created',
            donation: data,
            data,
            id: data.id
        });
    } catch (error) {
        res.status(500).json({ error: 'Create donation error', details: error.message });
    }
};

// Get featured donations
const getFeaturedDonations = async (req, res) => {
    try {
        await cleanupExpiredAvailableDonations();

        const { data, error } = await supabaseAdmin
            .from('donations')
            .select(`
                *,
                users:donor_id(id, full_name, profile_image)
            `)
            .eq('status', 'available')
            .eq('is_featured', true)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        let featured = (data || []).map((d) => ({
            ...d,
            imageUrl: d.imageUrl || (Array.isArray(d.images) ? d.images[0] : null)
        }));

        if (!featured.length) {
            const { data: fallbackData, error: fallbackError } = await supabaseAdmin
                .from('donations')
                .select(`
                    *,
                    users:donor_id(id, full_name, profile_image)
                `)
                .eq('status', 'available')
                .order('created_at', { ascending: false })
                .limit(10);

            if (fallbackError) {
                return res.status(400).json({ error: 'Fetch failed', details: fallbackError.message });
            }

            featured = (fallbackData || []).map((d) => ({
                ...d,
                imageUrl: d.imageUrl || (Array.isArray(d.images) ? d.images[0] : null)
            }));
        }

        res.json({ donations: featured });
    } catch (error) {
        res.status(500).json({ error: 'Get featured donations error', details: error.message });
    }
};

// Get all available donations
const getAllAvailableDonations = async (req, res) => {
    try {
        await cleanupExpiredAvailableDonations();

        const { data, error } = await supabaseAdmin
            .from('donations')
            .select(`
                *,
                users:donor_id(id, full_name, profile_image)
            `)
            .eq('status', 'available')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        const donations = (data || []).map((d) => ({
            ...d,
            imageUrl: d.imageUrl || (Array.isArray(d.images) ? d.images[0] : null)
        }));

        res.json({ donations });
    } catch (error) {
        res.status(500).json({ error: 'Get all donations error', details: error.message });
    }
};

// Get nearby donations
const getNearbyDonations = async (req, res) => {
    try {
        await cleanupExpiredAvailableDonations();

        const { latitude, longitude, lat, lng, radius } = req.query;
        const queryLat = latitude || lat;
        const queryLng = longitude || lng;

        if (!queryLat || !queryLng) {
            return res.status(400).json({ error: 'Latitude and longitude required' });
        }

        // Using Supabase PostGIS extension for distance calculation
        const { data, error } = await supabaseAdmin.rpc('get_nearby_donations', {
            user_lat: parseFloat(queryLat),
            user_lng: parseFloat(queryLng),
            distance_km: parseFloat(radius) || 10
        });

        if (error) {
            // Fallback to simple query if PostGIS not available
            const { data: fallbackData, error: fallbackError } = await supabaseAdmin
                .from('donations')
                .select(`
                    *,
                    users:donor_id(id, full_name, profile_image)
                `)
                .eq('status', 'available')
                .order('created_at', { ascending: false })
                .limit(20);

            return res.json(fallbackData || []);
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get nearby donations error', details: error.message });
    }
};

const uploadImage = async (req, res) => {
    // Placeholder to keep frontend integration stable until storage upload is wired.
    return res.status(501).json({
        error: 'Image upload endpoint not configured yet. Submit image URLs in donation payload.'
    });
};

const getDashboardStats = async (req, res) => {
    try {
        await cleanupExpiredAvailableDonations();

        const { data, error } = await supabaseAdmin
            .from('donations')
            .select('category,status');

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch stats', details: error.message });
        }

        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id,user_type');

        if (usersError) {
            return res.status(400).json({ error: 'Failed to fetch user stats', details: usersError.message });
        }

        const { data: ngoProfiles, error: ngoProfilesError } = await supabaseAdmin
            .from('ngo_profiles')
            .select('ngo_id');

        if (ngoProfilesError) {
            return res.status(400).json({ error: 'Failed to fetch NGO stats', details: ngoProfilesError.message });
        }

        const donorIds = new Set(
            (users || [])
                .filter((u) => String(u.user_type || '').toLowerCase() === 'donor')
                .map((u) => u.id)
                .filter(Boolean)
        );

        // Count active NGOs as those with profiles (same as find-ngo page)
        const totalNGOs = (ngoProfiles || []).length;

        const totalDonors = donorIds.size;

        const meals = (data || []).reduce((sum, d) => {
            return sum + parseQuantityToMeals(d.quantity);
        }, 0);

        const summary = {
            total: data.length,
            totalDonations: data.length,
            totalDonors,
            totalNGOs,
            meals,
            available: data.filter((d) => d.status === 'available').length,
            claimed: data.filter((d) => d.status === 'claimed').length,
            completed: data.filter((d) => d.status === 'completed').length
        };

        return res.json({
            ...summary,
            statistics: {
                totalDonations: summary.totalDonations,
                totalDonors: summary.totalDonors,
                totalNGOs: summary.totalNGOs,
                meals: summary.meals
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Dashboard stats error', details: error.message });
    }
};

// Get donor dashboard stats (for donor-dashboard.html)
const getDonorDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        await cleanupExpiredAvailableDonations();

        const { data: donations = [], error: donationErr } = await supabaseAdmin
            .from('donations')
            .select('id,status,quantity')
            .eq('donor_id', userId);

        if (donationErr) {
            return res.status(400).json({ error: 'Failed to fetch donations', details: donationErr.message });
        }

        const donationIds = donations.map((d) => d.id);

        const { data: requests = [], error: requestErr } = await supabaseAdmin
            .from('pickup_requests')
            .select('id, status, donation_id, requester_id')
            .in('donation_id', donationIds);

        if (requestErr) {
            return res.status(400).json({ error: 'Failed to fetch pickup requests', details: requestErr.message });
        }

        const totalDonations = donations.length;
        const meals = donations.reduce((sum, d) => sum + parseQuantityToMeals(d.quantity), 0);
        const ngos = new Set(requests.map((r) => r.requester_id)).size;
        const totalRequests = requests.length;
        const acceptedRequests = requests.filter((r) => r.status === 'accepted' || r.status === 'completed').length;
        const pickupRate = totalRequests > 0 ? Math.round((acceptedRequests / totalRequests) * 100) : 0;

        res.json({
            total: totalDonations,
            meals,
            ngos,
            pickupRate,
            donations: totalDonations,
            mealsGoal: 1000
        });
    } catch (error) {
        return res.status(500).json({ error: 'Donor dashboard stats error', details: error.message });
    }
};
// Get donor impact data (CO2 saved, freshness rate, etc.)
const getDonorImpact = async (req, res) => {
    try {
        const userId = req.user.id;
        await cleanupExpiredAvailableDonations();

        const { data: donations = [], error: donationErr } = await supabaseAdmin
            .from('donations')
            .select('id,status,quantity,created_at')
            .eq('donor_id', userId);

        if (donationErr) {
            return res.status(400).json({ error: 'Failed to fetch donations', details: donationErr.message });
        }

        const donationIds = donations.map((d) => d.id);

        const { data: requests = [], error: requestErr } = await supabaseAdmin
            .from('pickup_requests')
            .select('id, status, donation_id, requester_id')
            .in('donation_id', donationIds);

        if (requestErr) {
            return res.status(400).json({ error: 'Failed to fetch pickup requests', details: requestErr.message });
        }

        // Get total NGO count for coverage calculation
        const { data: totalNgos = [], error: ngoErr } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('user_type', 'ngo');

        if (ngoErr) {
            return res.status(400).json({ error: 'Failed to fetch NGO count', details: ngoErr.message });
        }

        const totalMeals = donations.reduce((sum, d) => sum + parseQuantityToMeals(d.quantity), 0);
        const co2Saved = totalMeals * 0.5; // rough estimate: 0.5 kg CO2 per meal

        const completedDonations = donations.filter((d) => d.status === 'completed').length;
        const freshnessRate = donations.length > 0 ? Math.round((completedDonations / donations.length) * 100) : 0;

        const uniqueNgosReached = new Set(requests.map((r) => r.requester_id)).size;
        const totalNgosCount = totalNgos.length;
        const ngoCoverage = totalNgosCount > 0 ? Math.round((uniqueNgosReached / totalNgosCount) * 100) : 0;

        res.json({
            co2Saved: Math.round(co2Saved),
            freshnessRate,
            totalMeals,
            ngoCoverage,
            ngosReached: uniqueNgosReached,
            totalNgos: totalNgosCount
        });
    } catch (error) {
        return res.status(500).json({ error: 'Donor impact error', details: error.message });
    }
};

// Get top donors leaderboard
const getTopDonors = async (req, res) => {
    try {
        await cleanupExpiredAvailableDonations();

        // Get all users with their donation counts and total meals
        const { data: users = [], error: usersErr } = await supabaseAdmin
            .from('users')
            .select('id, full_name, user_type');

        if (usersErr) {
            return res.status(400).json({ error: 'Failed to fetch users', details: usersErr.message });
        }

        const { data: donations = [], error: donationErr } = await supabaseAdmin
            .from('donations')
            .select('donor_id, quantity, created_at');

        if (donationErr) {
            return res.status(400).json({ error: 'Failed to fetch donations', details: donationErr.message });
        }

        // Calculate donation count per donor
        const donorDonations = {};
        donations.forEach(donation => {
            const donorId = donation.donor_id;
            donorDonations[donorId] = (donorDonations[donorId] || 0) + 1;
        });

        // Create leaderboard by donation count
        const leaderboard = users
            .map(user => ({
                id: user.id,
                name: user.full_name || 'Anonymous Donor',
                donations: donorDonations[user.id] || 0
            }))
            .filter(user => user.donations > 0) // only include users with donations
            .sort((a, b) => b.donations - a.donations);

        res.json(leaderboard);
    } catch (error) {
        return res.status(500).json({ error: 'Top donors error', details: error.message });
    }
};
// Get donation detail
const getDonationDetail = async (req, res) => {
    try {
        const { id } = req.params;
        await cleanupExpiredAvailableDonations();

        const { data, error } = await supabaseAdmin
            .from('donations')
            .select(`
                *,
                users:donor_id(id, full_name, profile_image, phone),
                pickup_requests(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get detail error', details: error.message });
    }
};

// Get my donations
const getMyDonations = async (req, res) => {
    try {
        const userId = req.user.id;
        await cleanupExpiredAvailableDonations();

        const { data, error } = await supabaseAdmin
            .from('donations')
            .select('*')
            .eq('donor_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get my donations error', details: error.message });
    }
};

// Update donation
const updateDonation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const updates = req.body;

        // Check ownership
        const { data: donation, error: fetchError } = await supabaseAdmin
            .from('donations')
            .select('donor_id')
            .eq('id', id)
            .single();

        if (fetchError || donation.donor_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabaseAdmin
            .from('donations')
            .update({ ...updates, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Update failed', details: error.message });
        }

        res.json({ message: 'Donation updated', donation: data });
    } catch (error) {
        res.status(500).json({ error: 'Update donation error', details: error.message });
    }
};

// Delete donation
const deleteDonation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check ownership
        const { data: donation, error: fetchError } = await supabaseAdmin
            .from('donations')
            .select('donor_id')
            .eq('id', id)
            .single();

        if (fetchError || donation.donor_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { error } = await supabaseAdmin
            .from('donations')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: 'Delete failed', details: error.message });
        }

        res.json({ message: 'Donation deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Delete donation error', details: error.message });
    }
};

module.exports = {
    createDonation,
    getFeaturedDonations,
    getAllAvailableDonations,
    getNearbyDonations,
    getDonationDetail,
    getMyDonations,
    updateDonation,
    deleteDonation,
    uploadImage,
    getDashboardStats,
    getDonorDashboardStats,
    getDonorImpact,
    getTopDonors
};
