const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { cleanupExpiredAvailableDonations } = require('../utils/donationExpiry');

function parseQuantityToMeals(quantityString) {
    if (!quantityString) return 0;
    const clean = String(quantityString).toLowerCase().replace(/,/g, ' ').trim();
    const match = clean.match(/\d+(?:[\.,]\d+)?/);
    if (!match) return 1;

    const value = Number(match[0].replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) return 1;
    return value;
}

// Create NGO profile
const createNgoProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            organizationName,
            registrationNumber,
            website,
            mission,
            impactStatement,
            logoUrl,
            coverImageUrl
        } = req.body;

        const { data, error } = await supabaseAdmin
            .from('ngo_profiles')
            .insert({
                id: uuidv4(),
                ngo_id: userId,
                organization_name: organizationName,
                registration_number: registrationNumber,
                website,
                mission,
                impact_statement: impactStatement,
                logo_url: logoUrl,
                cover_image_url: coverImageUrl,
                verified: false,
                created_at: new Date()
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Create profile failed', details: error.message });
        }

        res.status(201).json({ message: 'NGO profile created', profile: data });
    } catch (error) {
        res.status(500).json({ error: 'Create NGO profile error', details: error.message });
    }
};

// Get NGO profile
const getNgoProfile = async (req, res) => {
    try {
        const { ngoId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('ngo_profiles')
            .select(`
                *,
                users:ngo_id(id, full_name, email, phone, address)
            `)
            .eq('ngo_id', ngoId)
            .single();

        if (error) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get NGO profile error', details: error.message });
    }
};

// Update NGO profile
const updateNgoProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        // Check ownership
        const { data: profile, error: fetchError } = await supabaseAdmin
            .from('ngo_profiles')
            .select('ngo_id')
            .eq('ngo_id', userId)
            .single();

        if (fetchError || profile.ngo_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabaseAdmin
            .from('ngo_profiles')
            .update({ ...updates, updated_at: new Date() })
            .eq('ngo_id', userId)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Update failed', details: error.message });
        }

        res.json({ message: 'NGO profile updated', profile: data });
    } catch (error) {
        res.status(500).json({ error: 'Update NGO profile error', details: error.message });
    }
};

// Get nearby NGOs
const getNearbyNgos = async (req, res) => {
    try {
        const { latitude, longitude, lat, lng, radius } = req.query;
        const queryLat = latitude || lat;
        const queryLng = longitude || lng;

        if (!queryLat || !queryLng) {
            return res.status(400).json({ error: 'Latitude and longitude required' });
        }

        const { data, error } = await supabaseAdmin
            .from('ngo_profiles')
            .select(`
                *,
                users:ngo_id(id, full_name, email, phone, address, latitude, longitude)
            `)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        // Filter by distance (simple distance calculation)
        const filtered = data.filter(ngo => {
            if (!ngo.users?.latitude || !ngo.users?.longitude) return false;
            const dist = calculateDistance(
                queryLat, queryLng,
                ngo.users.latitude, ngo.users.longitude
            );
            return dist <= (parseFloat(radius) || 10);
        });

        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: 'Get nearby NGOs error', details: error.message });
    }
};

const getAllNgos = async (req, res) => {
    try {
        const { latitude, longitude, lat, lng } = req.query;
        const userLat = latitude || lat;
        const userLng = longitude || lng;

        // Fetch all users with user_type = 'ngo' and join with ngo_profiles
        const { data, error } = await supabaseAdmin
            .from('users')
            .select(`
                id,
                full_name,
                email,
                phone,
                address,
                created_at,
                ngo_profiles!left(
                    organization_name,
                    mission,
                    impact_statement,
                    verified
                )
            `)
            .eq('user_type', 'ngo')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Fetch NGOs failed', details: error.message });
        }

        let ngos = (data || []).map((user) => ({
            id: user.id,
            name: user.ngo_profiles?.[0]?.organization_name || user.full_name || 'NGO',
            category: 'NGO',
            city: user.address || 'Not specified',
            email: user.email || 'N/A',
            phone: user.phone || 'N/A',
            description: user.ngo_profiles?.[0]?.mission || user.ngo_profiles?.[0]?.impact_statement || '',
            rating: 4.5,
            mealsDistributed: 0,
            donationsReceived: 0,
            verified: user.ngo_profiles?.[0]?.verified || false,
            latitude: null, // Will be set if we can geocode address
            longitude: null
        }));

        const normalizeCity = (city) => {
            if (!city) return '';
            const normalized = String(city).trim();
            return normalized.toLowerCase() === 'not specified' ? '' : normalized;
        };

        const compareByLocation = (a, b) => {
            const aHasLocation = !!normalizeCity(a.city);
            const bHasLocation = !!normalizeCity(b.city);
            if (aHasLocation !== bHasLocation) {
                return aHasLocation ? -1 : 1;
            }
            if (!aHasLocation && !bHasLocation) {
                return 0;
            }
            return (a.city || '').localeCompare(b.city || '');
        };

        // Sort NGOs with a known location first, then those without
        if (userLat && userLng) {
            ngos = ngos.sort(compareByLocation);
        } else {
            ngos = ngos.sort((a, b) => {
                const locationResult = compareByLocation(a, b);
                if (locationResult !== 0) return locationResult;
                return (a.name || '').localeCompare(b.name || '');
            });
        }

        return res.json({ success: true, data: ngos });
    } catch (error) {
        return res.status(500).json({ error: 'Get NGOs error', details: error.message });
    }
};

// Search NGOs
const searchNgos = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const { data, error } = await supabaseAdmin
            .from('ngo_profiles')
            .select(`
                *,
                users:ngo_id(id, full_name, email)
            `)
            .or(`organization_name.ilike.%${q}%,mission.ilike.%${q}%`)
            .limit(20);

        if (error) {
            return res.status(400).json({ error: 'Search failed', details: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Search NGOs error', details: error.message });
    }
};

// Get NGO statistics
const getNgoStatistics = async (req, res) => {
    try {
        const { ngoId } = req.params;

        // Get donations claimed
        const { data: donations, error: donError } = await supabaseAdmin
            .from('donations')
            .select('id')
            .eq('claimed_by', ngoId);

        // Get pickup requests accepted
        const { data: requests, error: reqError } = await supabaseAdmin
            .from('pickup_requests')
            .select('id')
            .eq('status', 'accepted')
            .eq('requester_id', ngoId);

        const stats = {
            totalDonationsReceived: donations?.length || 0,
            totalPickupsAccepted: requests?.length || 0,
            totalBenitsServed: (donations?.length || 0) * 5 // Estimate
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Get statistics error', details: error.message });
    }
};
// Get logged-in NGO dashboard stats (for ngo-dashboard.html)
const getNgoDashboardStats = async (req, res) => {
    try {
        const ngoId = req.user.id;
        await cleanupExpiredAvailableDonations();

        const { data: requests = [], error: reqError } = await supabaseAdmin
            .from('pickup_requests')
            .select('id,status,donation_id')
            .eq('requester_id', ngoId);

        if (reqError) {
            return res.status(400).json({ error: 'Failed to fetch NGO requests', details: reqError.message });
        }

        const accepted = requests.filter((r) => r.status === 'accepted' || r.status === 'completed').length;
        const completed = requests.filter((r) => r.status === 'completed').length;

        const acceptedDonationIds = [...new Set(
            requests.filter((r) => r.status === 'accepted' || r.status === 'completed').map((r) => r.donation_id)
        )].filter(Boolean);
        const { data: donations = [], error: donError } = await supabaseAdmin
            .from('donations')
            .select('id,donor_id,quantity')
            .in('id', acceptedDonationIds);

        if (donError) {
            return res.status(400).json({ error: 'Failed to fetch related donations', details: donError.message });
        }

        const meals = donations.reduce((sum, d) => sum + parseQuantityToMeals(d.quantity), 0);
        const volunteers = new Set(donations.map((d) => d.donor_id)).size;

        res.json({
            requests: requests.length,
            accepted,
            meals,
            volunteers,
            completionRate: requests.length > 0 ? Math.round((completed / requests.length) * 100) : 0,
            mealsGoal: 500
        });
    } catch (error) {
        return res.status(500).json({ error: 'NGO dashboard stats error', details: error.message });
    }
};

// Get NGO pickup request list for logged-in NGO (for ngo-dashboard.html)
const getNgoRequests = async (req, res) => {
    try {
        const ngoId = req.user.id;
        await cleanupExpiredAvailableDonations();

        const { data: incomingRequests, error } = await supabaseAdmin
            .from('pickup_requests')
            .select(`
                *,
                requester:requester_id(id, full_name, profile_image, phone)
            `)
            .eq('requester_id', ngoId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Failed to fetch NGO pickup requests', details: error.message });
        }

        // Fetch donation details separately to ensure address is included
        const donationIds = [...new Set((incomingRequests || []).map(req => req.donation_id).filter(Boolean))];
        let donationMap = new Map();

        if (donationIds.length) {
            const { data: donations, error: donError } = await supabaseAdmin
                .from('donations')
                .select('id, title, description, category, status, donor_id, address, latitude, longitude, contact_phone')
                .in('id', donationIds);

            if (!donError && Array.isArray(donations)) {
                donationMap = new Map(donations.map(d => [d.id, d]));
            }
        }

        // Fetch donor details
        const donorIds = [...new Set((incomingRequests || []).map(req => {
            const donation = donationMap.get(req.donation_id);
            return donation?.donor_id;
        }).filter(Boolean))];
        let donorMap = new Map();

        if (donorIds.length) {
            const { data: donors, error: donorError } = await supabaseAdmin
                .from('users')
                .select('id, full_name, email, phone')
                .in('id', donorIds);

            if (!donorError && Array.isArray(donors)) {
                donorMap = new Map(donors.map(d => [d.id, d]));
            }
        }

        const normalizedRequests = (incomingRequests || []).map((req) => {
            const donation = donationMap.get(req.donation_id);
            const donor = donorMap.get(donation?.donor_id);
            return {
                ...req,
                donor: donor || null,
                donor_name: donor?.full_name || 'Nearby donor',
                donationAddress: donation?.address || null,
                donationLatitude: donation?.latitude || null,
                donationLongitude: donation?.longitude || null,
                donationPhone: donation?.contact_phone || null,
                pickupAddress: donation?.address || null,
                pickupLatitude: donation?.latitude || null,
                pickupLongitude: donation?.longitude || null,
                pickupPhone: donation?.contact_phone || null,
                address: donation?.address || null,
                latitude: donation?.latitude || null,
                longitude: donation?.longitude || null,
                contact_phone: donation?.contact_phone || null,
            };
        });

        res.json(normalizedRequests);
    } catch (error) {
        return res.status(500).json({ error: 'Get NGO requests error', details: error.message });
    }
};
// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = {
    createNgoProfile,
    getNgoProfile,
    updateNgoProfile,
    getNearbyNgos,
    getAllNgos,
    searchNgos,
    getNgoStatistics,
    getNgoDashboardStats,
    getNgoRequests
};
