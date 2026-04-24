const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { cleanupExpiredAvailableDonations, isDonationExpired } = require('../utils/donationExpiry');

// Request pickup
const requestPickup = async (req, res) => {
    try {
        const userId = req.user.id;
        const { donationId } = req.params;
        const { message } = req.body;

        await cleanupExpiredAvailableDonations();

        const { data: donation, error: donationError } = await supabaseAdmin
            .from('donations')
            .select('id, title, donor_id, status, expiry_date')
            .eq('id', donationId)
            .single();

        if (donationError || !donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        if (donation.status !== 'available' || isDonationExpired(donation)) {
            return res.status(410).json({ error: 'This food donation has expired and is no longer available.' });
        }

        const { data, error } = await supabaseAdmin
            .from('pickup_requests')
            .insert({
                id: uuidv4(),
                donation_id: donationId,
                requester_id: userId,
                message,
                status: 'pending',
                created_at: new Date()
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Request failed', details: error.message });
        }

        // Notify donor that an NGO requested pickup for their donation
        if (donation && donation.donor_id) {
            const ngoUser = await supabaseAdmin
                .from('users')
                .select('id, full_name')
                .eq('id', userId)
                .single();

            const ngoName = ngoUser?.data?.full_name || 'NGO Partner';
            const notificationText = `NGO ${ngoName} requested pickup for your donation "${donation.title || 'food item'}". Please accept or reject the request.`;

            await supabaseAdmin
                .from('messages')
                .insert({
                    id: uuidv4(),
                    sender_id: userId,
                    receiver_id: donation.donor_id,
                    donation_id: donation.id,
                    message: notificationText,
                    is_read: false,
                    created_at: new Date()
                });
        }

        res.status(201).json({ message: 'Pickup request submitted', request: data });
    } catch (error) {
        res.status(500).json({ error: 'Request pickup error', details: error.message });
    }
};

// Get pickup requests for a donation
const getDonationRequests = async (req, res) => {
    try {
        const { donationId } = req.params;
        await cleanupExpiredAvailableDonations();

        const { data, error } = await supabaseAdmin
            .from('pickup_requests')
            .select(`
                *,
                users:requester_id(id, full_name, profile_image, phone)
            `)
            .eq('donation_id', donationId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get requests error', details: error.message });
    }
};

// Get incoming pickup requests for donor-owned donations
const getIncomingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        await cleanupExpiredAvailableDonations();

        const { data: donations, error: donationsError } = await supabaseAdmin
            .from('donations')
            .select('id,title')
            .eq('donor_id', userId);

        if (donationsError) {
            return res.status(400).json({ error: 'Unable to fetch donations', details: donationsError.message });
        }

        const donationIds = (donations || []).map(d => d.id);
        if (!donationIds.length) {
            return res.json([]);
        }

        const { data, error } = await supabaseAdmin
            .from('pickup_requests')
            .select(`
                id,
                donation_id,
                requester_id,
                status,
                message,
                created_at,
                updated_at,
                users:requester_id(id, full_name, profile_image, phone)
            `)
            .in('donation_id', donationIds)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        const lookup = (donations || []).reduce((acc, d) => ({ ...acc, [d.id]: d.title }), {});
        const mapped = (data || []).map(r => ({
            ...r,
            donation_title: lookup[r.donation_id] || '',
            requester_name: r.users?.full_name || 'NGO Partner'
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Get incoming requests error', details: error.message });
    }
};

const rejectPickupRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        const { data: request, error: fetchError } = await supabaseAdmin
            .from('pickup_requests')
            .select('donation_id, requester_id')
            .eq('id', requestId)
            .single();

        if (fetchError || !request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const { data: donation } = await supabaseAdmin
            .from('donations')
            .select('donor_id, title')
            .eq('id', request.donation_id)
            .single();

        if (!donation || donation.donor_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabaseAdmin
            .from('pickup_requests')
            .update({ status: 'rejected', updated_at: new Date() })
            .eq('id', requestId)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Update failed', details: error.message });
        }

        await supabaseAdmin
            .from('messages')
            .insert({
                id: uuidv4(),
                sender_id: userId,
                receiver_id: request.requester_id,
                donation_id: request.donation_id,
                message: `Your pickup request for donation "${donation.title || 'food'}" was rejected by the donor.`,
                is_read: false,
                created_at: new Date()
            });

        res.json({ message: 'Pickup request rejected', request: data });
    } catch (error) {
        res.status(500).json({ error: 'Reject request error', details: error.message });
    }
};

// Accept pickup request
const acceptPickupRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        // Get the request
        const { data: request, error: fetchError } = await supabaseAdmin
            .from('pickup_requests')
            .select('donation_id')
            .eq('id', requestId)
            .single();

        if (fetchError) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check ownership of donation
        const { data: donation } = await supabaseAdmin
            .from('donations')
            .select('donor_id')
            .eq('id', request.donation_id)
            .single();

        if (donation.donor_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update request status
        const { data, error } = await supabaseAdmin
            .from('pickup_requests')
            .update({ status: 'accepted', updated_at: new Date() })
            .eq('id', requestId)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Update failed', details: error.message });
        }

        // Optionally mark donation as claimed
        await supabaseAdmin
            .from('donations')
            .update({ status: 'claimed', updated_at: new Date() })
            .eq('id', request.donation_id);

        await supabaseAdmin
            .from('messages')
            .insert({
                id: uuidv4(),
                sender_id: userId,
                receiver_id: request.requester_id,
                donation_id: request.donation_id,
                message: `Your pickup request for donation "${donation.title || 'food'}" was accepted by the donor. Please collect the food soon.`,
                is_read: false,
                created_at: new Date()
            });

        res.json({ message: 'Pickup request accepted', request: data });
    } catch (error) {
        res.status(500).json({ error: 'Accept request error', details: error.message });
    }
};

module.exports = {
    requestPickup,
    getDonationRequests,
    getIncomingRequests,
    acceptPickupRequest,
    rejectPickupRequest
};
