const { supabaseAdmin } = require('../config/supabase');

function getDonationExpiryValue(donation) {
    if (!donation) return null;

    if (donation.expiry_date) return donation.expiry_date;
    if (donation.expiresAt) return donation.expiresAt;
    if (donation.expiryDate && donation.expiryTime) {
        return `${donation.expiryDate}T${donation.expiryTime}:00`;
    }
    if (donation.expiryDate) return donation.expiryDate;
    if (donation.expiryTime) return donation.expiryTime;

    return null;
}

function isDonationExpired(donation, now = new Date()) {
    const expiryValue = getDonationExpiryValue(donation);
    if (!expiryValue) return false;

    const expiry = new Date(expiryValue);
    if (Number.isNaN(expiry.getTime())) return false;

    return expiry.getTime() <= now.getTime();
}

async function cleanupExpiredAvailableDonations(client = supabaseAdmin) {
    const nowIso = new Date().toISOString();
    let deletedCount = 0;
    let expiredCount = 0;
    const batchSize = 200;
    const maxBatches = 10;

    for (let i = 0; i < maxBatches; i += 1) {
        const { data, error } = await client
            .from('donations')
            .select('id, expiry_date')
            .eq('status', 'available')
            .not('expiry_date', 'is', null)
            .lt('expiry_date', nowIso)
            .order('expiry_date', { ascending: true })
            .limit(batchSize);

        if (error) {
            throw error;
        }

        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        const ids = [...new Set(data.map((donation) => donation.id).filter(Boolean))];
        if (!ids.length) {
            break;
        }

        expiredCount += ids.length;

        const { error: deleteError } = await client
            .from('donations')
            .delete()
            .in('id', ids);

        if (deleteError) {
            throw deleteError;
        }

        deletedCount += ids.length;

        if (ids.length < batchSize) {
            break;
        }
    }

    return { expiredCount, deletedCount };
}

module.exports = {
    getDonationExpiryValue,
    isDonationExpired,
    cleanupExpiredAvailableDonations
};
