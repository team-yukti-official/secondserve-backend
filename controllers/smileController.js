const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

const SMILE_IMAGE_BUCKET = 'smile-donation-images';

function sanitizeFileName(name) {
    return String(name || 'image')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120);
}

function parseQuantity(value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) return 1;
    return parsed;
}

function normalizeItemType(itemType) {
    const normalized = String(itemType || '').trim().toLowerCase();
    if (normalized === 'clothes' || normalized === 'books' || normalized === 'toys') {
        return normalized;
    }
    return 'other';
}

async function uploadSmileImage(file, donationId) {
    if (!file) return null;

    const safeName = sanitizeFileName(file.originalname);
    const path = `smile/${donationId}-${Date.now()}-${safeName}`;

    let uploadResult = await supabaseAdmin.storage
        .from(SMILE_IMAGE_BUCKET)
        .upload(path, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false
        });

    if (uploadResult.error && /bucket.*not.*found/i.test(uploadResult.error.message || '')) {
        await supabaseAdmin.storage.createBucket(SMILE_IMAGE_BUCKET, { public: true });
        uploadResult = await supabaseAdmin.storage
            .from(SMILE_IMAGE_BUCKET)
            .upload(path, file.buffer, {
                contentType: file.mimetype || 'application/octet-stream',
                upsert: false
            });
    }

    if (uploadResult.error) {
        return null;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
        .from(SMILE_IMAGE_BUCKET)
        .getPublicUrl(path);

    return publicUrlData?.publicUrl || null;
}

const createSmileDonation = async (req, res) => {
    try {
        const userId = req.user.id;
        const body = req.body || {};

        const itemType = normalizeItemType(body.itemType);
        const itemName = String(body.itemName || '').trim();
        const quantity = parseQuantity(body.quantity);
        const condition = String(body.condition || '').trim() || 'good';
        const description = String(body.description || '').trim();
        const address = String(body.address || '').trim();
        const city = String(body.city || '').trim();
        const pincode = String(body.pincode || '').trim();
        const contactPhone = String(body.contactPhone || '').trim();

        if (!itemName || !address || !city || !pincode || !contactPhone) {
            return res.status(400).json({
                error: 'Missing required fields: itemName, address, city, pincode, contactPhone'
            });
        }

        const donationId = uuidv4();
        const imageUrl = await uploadSmileImage(req.file, donationId);

        const latitude = body.latitude ? Number(body.latitude) : null;
        const longitude = body.longitude ? Number(body.longitude) : null;

        const { data, error } = await supabaseAdmin
            .from('smile_donations')
            .insert({
                id: donationId,
                donor_id: userId,
                item_type: itemType,
                item_name: itemName,
                quantity,
                item_condition: condition,
                description,
                address,
                city,
                pincode,
                latitude,
                longitude,
                contact_phone: contactPhone,
                image_url: imageUrl,
                status: 'available',
                created_at: new Date(),
                updated_at: new Date()
            })
            .select('*')
            .single();

        if (error) {
            return res.status(400).json({ error: 'Create smile donation failed', details: error.message });
        }

        return res.status(201).json({
            message: 'Smile donation created',
            donation: data,
            data
        });
    } catch (error) {
        return res.status(500).json({ error: 'Create smile donation error', details: error.message });
    }
};

const getFeaturedSmileDonations = async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('smile_donations')
            .select(`
                *,
                users:donor_id(id, full_name, profile_image)
            `)
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .limit(12);

        if (String(req.query.featuredOnly || '').toLowerCase() === 'true') {
            query = query.eq('is_featured', true);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: 'Fetch smile donations failed', details: error.message });
        }

        return res.json({ donations: data || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Get smile donations error', details: error.message });
    }
};

const getAllSmileDonations = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('smile_donations')
            .select(`
                *,
                users:donor_id(id, full_name, profile_image)
            `)
            .eq('status', 'available')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: 'Fetch smile donations failed', details: error.message });
        }

        return res.json({ donations: data || [] });
    } catch (error) {
        return res.status(500).json({ error: 'Get all smile donations error', details: error.message });
    }
};

const getSmileDashboardStats = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('smile_donations')
            .select('item_type, quantity, status');

        if (error) {
            return res.status(400).json({ error: 'Fetch smile stats failed', details: error.message });
        }

        const stats = {
            clothes: 0,
            books: 0,
            toys: 0,
            other: 0,
            totalDonations: 0,
            available: 0,
            claimed: 0,
            completed: 0
        };

        (data || []).forEach((row) => {
            const qty = parseQuantity(row.quantity);
            const itemType = normalizeItemType(row.item_type);

            stats.totalDonations += 1;
            stats[itemType] += qty;

            const status = String(row.status || '').toLowerCase();
            if (status === 'available') stats.available += 1;
            if (status === 'claimed') stats.claimed += 1;
            if (status === 'completed') stats.completed += 1;
        });

        return res.json({
            ...stats,
            statistics: {
                clothes: stats.clothes,
                books: stats.books,
                toys: stats.toys,
                totalDonations: stats.totalDonations,
                available: stats.available,
                completed: stats.completed
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Smile stats error', details: error.message });
    }
};

const requestSmilePickup = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { donationId } = req.params;
        const message = String(req.body?.message || '').trim();

        const { data: donation, error: donationError } = await supabaseAdmin
            .from('smile_donations')
            .select('id, donor_id, status')
            .eq('id', donationId)
            .single();

        if (donationError || !donation) {
            return res.status(404).json({ error: 'Smile donation not found' });
        }

        if (donation.donor_id === requesterId) {
            return res.status(400).json({ error: 'You cannot request pickup for your own donation' });
        }

        if (String(donation.status).toLowerCase() !== 'available') {
            return res.status(400).json({ error: 'Donation is not available for pickup' });
        }

        const { data: existing } = await supabaseAdmin
            .from('smile_pickup_requests')
            .select('id, status')
            .eq('smile_donation_id', donationId)
            .eq('requester_id', requesterId)
            .in('status', ['pending', 'accepted'])
            .limit(1);

        if ((existing || []).length > 0) {
            return res.status(409).json({ error: 'You already have an active pickup request for this donation' });
        }

        const { data, error } = await supabaseAdmin
            .from('smile_pickup_requests')
            .insert({
                id: uuidv4(),
                smile_donation_id: donationId,
                requester_id: requesterId,
                message,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date()
            })
            .select('*')
            .single();

        if (error) {
            return res.status(400).json({ error: 'Create smile pickup request failed', details: error.message });
        }

        return res.status(201).json({
            message: 'Smile pickup request sent',
            request: data,
            data
        });
    } catch (error) {
        return res.status(500).json({ error: 'Smile pickup request error', details: error.message });
    }
};

module.exports = {
    createSmileDonation,
    getFeaturedSmileDonations,
    getAllSmileDonations,
    getSmileDashboardStats,
    requestSmilePickup
};
