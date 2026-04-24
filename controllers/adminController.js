const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const { cleanupExpiredAvailableDonations, getDonationExpiryValue, isDonationExpired } = require('../utils/donationExpiry');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_CREDENTIAL_HASH = process.env.ADMIN_CREDENTIAL_HASH || '';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || ADMIN_SECRET || 'feedlink-admin-dev-secret';
const ADMIN_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashCredentials(username, secretKey) {
    return crypto
        .createHash('sha256')
        .update(`${username}:${secretKey}`)
        .digest('hex');
}

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatRole(role) {
    return String(role || 'unknown').toLowerCase();
}

function mapUser(user, donationCount = 0) {
    return {
        id: user.id,
        fullName: user.full_name || user.fullName || 'Unknown User',
        email: user.email || '',
        phone: user.phone || '',
        role: formatRole(user.user_type || user.role),
        city: user.address || user.city || 'Not specified',
        verified: Boolean(user.verified),
        created_at: user.created_at,
        updated_at: user.updated_at,
        donationCount
    };
}

function mapVolunteer(volunteer) {
    return {
        id: volunteer.id,
        fullName: volunteer.full_name || volunteer.fullName || 'Volunteer',
        email: volunteer.email || '',
        phone: volunteer.phone || '',
        city: volunteer.city || 'Not specified',
        role: volunteer.role || 'Volunteer',
        availability: volunteer.availability || '',
        message: volunteer.message || '',
        status: (volunteer.status || 'approved').toLowerCase(),
        reviewed_at: volunteer.reviewed_at || null,
        reviewed_by: volunteer.reviewed_by || null,
        created_at: volunteer.created_at,
        updated_at: volunteer.updated_at
    };
}

function mapDonation(donation, usersById) {
    const donor = usersById.get(donation.donor_id) || {};
    const expiryValue = getDonationExpiryValue(donation);
    const isExpired = isDonationExpired(donation);
    const expiryDate = expiryValue ? new Date(expiryValue) : null;

    return {
        id: donation.id,
        foodName: donation.title || donation.foodName || 'Donation',
        donorId: donation.donor_id,
        donorName: donor.full_name || donation.donor_name || 'Unknown Donor',
        donorEmail: donor.email || '',
        donorPhone: donor.phone || '',
        quantity: donation.quantity || '',
        category: donation.category || 'Other',
        status: donation.status || 'available',
        city: donation.address || '',
        address: donation.address || '',
        created_at: donation.created_at,
        updated_at: donation.updated_at,
        expiry_date: donation.expiry_date || null,
        expiresAt: expiryValue,
        isExpired,
        expiresSoon: !isExpired && expiryDate ? (expiryDate.getTime() - Date.now()) <= 6 * 60 * 60 * 1000 : false,
        imageUrl: Array.isArray(donation.images) ? donation.images[0] || null : donation.imageUrl || null
    };
}

function mapMessage(message, usersById, donationsById) {
    const sender = usersById.get(message.sender_id) || {};
    const receiver = usersById.get(message.receiver_id) || {};
    const donation = donationsById.get(message.donation_id) || {};

    return {
        id: message.id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        senderName: sender.full_name || 'Unknown Sender',
        senderRole: formatRole(sender.user_type),
        receiverName: receiver.full_name || 'Unknown Receiver',
        receiverRole: formatRole(receiver.user_type),
        donationId: message.donation_id,
        donationTitle: donation.title || donation.foodName || '',
        message: message.message || '',
        isRead: Boolean(message.is_read),
        created_at: message.created_at,
        updated_at: message.updated_at
    };
}

function buildRecentActivity(items) {
    return items
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0))
        .slice(0, 12);
}

function createAdminToken(username) {
    return jwt.sign(
        { role: 'admin', username },
        ADMIN_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function fetchUsers() {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email, phone, user_type, address, verified, created_at, updated_at');

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchDonations() {
    const { data, error } = await supabaseAdmin
        .from('donations')
        .select('id, donor_id, title, quantity, category, status, address, images, expiry_date, created_at, updated_at');

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchVolunteers() {
    const { data, error } = await supabaseAdmin
        .from('volunteers')
        .select('id, full_name, email, phone, city, role, availability, message, status, reviewed_at, reviewed_by, created_at, updated_at');

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchMessages() {
    const { data, error } = await supabaseAdmin
        .from('messages')
        .select('id, sender_id, receiver_id, donation_id, message, is_read, created_at, updated_at');

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchPickupRequests() {
    const { data, error } = await supabaseAdmin
        .from('pickup_requests')
        .select('id, donation_id, requester_id, status, message, created_at, updated_at');

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchNgoProfiles() {
    const { data, error } = await supabaseAdmin
        .from('ngo_profiles')
        .select('id, ngo_id, organization_name, verified, mission, impact_statement, created_at, updated_at');

    if (error) {
        throw error;
    }

    return data || [];
}

const login = async (req, res) => {
    try {
        const { username = '', secretKey = '' } = req.body || {};
        const normalizedUsername = String(username).trim();

        if (!normalizedUsername || !secretKey) {
            return res.status(400).json({ error: 'Username and secret key are required' });
        }

        const submittedHash = hashCredentials(normalizedUsername, secretKey);
        const isValid =
            normalizedUsername === ADMIN_USERNAME &&
            (submittedHash === ADMIN_CREDENTIAL_HASH || secretKey === ADMIN_SECRET);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const token = createAdminToken(normalizedUsername);

        return res.json({
            success: true,
            token,
            username: normalizedUsername,
            expiresAt: Date.now() + ADMIN_TOKEN_TTL_MS
        });
    } catch (error) {
        return res.status(500).json({ error: 'Admin login failed', details: error.message });
    }
};

const getOverview = async (req, res) => {
    try {
        const cleanup = await cleanupExpiredAvailableDonations();
        const [users, donations, volunteers, messages, pickupRequests, ngoProfiles] = await Promise.all([
            fetchUsers(),
            fetchDonations(),
            fetchVolunteers(),
            fetchMessages(),
            fetchPickupRequests(),
            fetchNgoProfiles()
        ]);

        const usersById = new Map(users.map((user) => [user.id, user]));
        const donationsById = new Map(donations.map((donation) => [donation.id, donation]));

        const donationCountByUser = donations.reduce((acc, donation) => {
            if (donation.donor_id) {
                acc[donation.donor_id] = (acc[donation.donor_id] || 0) + 1;
            }
            return acc;
        }, {});

        const usersMapped = users.map((user) => mapUser(user, donationCountByUser[user.id] || 0));
        const donationsMapped = donations.map((donation) => mapDonation(donation, usersById));
        const volunteersMapped = volunteers.map(mapVolunteer);
        const messagesMapped = messages.map((message) => mapMessage(message, usersById, donationsById));
        const approvedVolunteers = volunteersMapped.filter((volunteer) => volunteer.status === 'approved');
        const pendingVolunteers = volunteersMapped.filter((volunteer) => volunteer.status === 'pending');

        const stats = {
            totalUsers: usersMapped.length,
            totalDonors: usersMapped.filter((user) => user.role === 'donor').length,
            totalNGOs: usersMapped.filter((user) => user.role === 'ngo').length,
            totalAdmins: usersMapped.filter((user) => user.role === 'admin').length,
            totalDonations: donationsMapped.length,
            availableDonations: donationsMapped.filter((donation) => donation.status === 'available').length,
            claimedDonations: donationsMapped.filter((donation) => donation.status === 'claimed').length,
            completedDonations: donationsMapped.filter((donation) => donation.status === 'completed').length,
            expiringSoon: donationsMapped.filter((donation) => donation.expiresSoon).length,
            volunteerSubmissions: volunteersMapped.length,
            totalVolunteers: approvedVolunteers.length,
            pendingVolunteerApprovals: pendingVolunteers.length,
            pickupRequests: pickupRequests.length,
            pendingRequests: pickupRequests.filter((request) => request.status === 'pending').length,
            totalMessages: messagesMapped.length,
            unreadMessages: messagesMapped.filter((message) => !message.isRead).length,
            ngoProfiles: ngoProfiles.length,
            expiredRemoved: cleanup.deletedCount || 0
        };

        const roleBreakdown = [
            { label: 'Donor', value: stats.totalDonors },
            { label: 'NGO', value: stats.totalNGOs },
            { label: 'Admin', value: stats.totalAdmins }
        ];

        const donationStatusBreakdown = [
            { label: 'Available', value: stats.availableDonations },
            { label: 'Claimed', value: stats.claimedDonations },
            { label: 'Completed', value: stats.completedDonations }
        ];

        const volunteerRoleMap = approvedVolunteers.reduce((acc, volunteer) => {
            const key = volunteer.role || 'Volunteer';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const cityMap = usersMapped.reduce((acc, user) => {
            const city = user.city || 'Unknown';
            acc[city] = (acc[city] || 0) + 1;
            return acc;
        }, {});

        const recentActivity = buildRecentActivity([
            ...usersMapped.map((user) => ({
                type: 'user',
                title: `${user.role.toUpperCase()} joined`,
                text: `${user.fullName} registered from ${user.city}`,
                created_at: user.created_at
            })),
            ...donationsMapped.map((donation) => ({
                type: 'donation',
                title: 'Donation created',
                text: `${donation.foodName} from ${donation.donorName}`,
                created_at: donation.created_at
            })),
            ...volunteersMapped.map((volunteer) => ({
                type: 'volunteer',
                title: 'Volunteer signup',
                text: `${volunteer.fullName} joined as ${volunteer.role}`,
                created_at: volunteer.created_at
            })),
            ...messagesMapped.map((message) => ({
                type: 'message',
                title: 'New message',
                text: `${message.senderName} to ${message.receiverName}`,
                created_at: message.created_at
            }))
        ]);

        return res.json({
            success: true,
            stats,
            users: usersMapped.slice(0, 100),
            donations: donationsMapped.slice(0, 200),
            volunteers: volunteersMapped.slice(0, 100),
            messages: messagesMapped.slice(0, 120),
            ngos: ngoProfiles.slice(0, 100),
            charts: {
                roles: roleBreakdown,
                donationStatuses: donationStatusBreakdown,
                volunteerRoles: Object.entries(volunteerRoleMap).map(([label, value]) => ({ label, value })),
                cities: Object.entries(cityMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
            },
            recentActivity,
            cleanup
        });
    } catch (error) {
        return res.status(500).json({ error: 'Admin overview error', details: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await fetchUsers();
        const donations = await fetchDonations();
        const donationCountByUser = donations.reduce((acc, donation) => {
            if (donation.donor_id) {
                acc[donation.donor_id] = (acc[donation.donor_id] || 0) + 1;
            }
            return acc;
        }, {});

        return res.json({
            success: true,
            data: users.map((user) => mapUser(user, donationCountByUser[user.id] || 0))
        });
    } catch (error) {
        return res.status(500).json({ error: 'Get admin users failed', details: error.message });
    }
};

const getDonations = async (req, res) => {
    try {
        await cleanupExpiredAvailableDonations();
        const users = await fetchUsers();
        const usersById = new Map(users.map((user) => [user.id, user]));
        const donations = await fetchDonations();

        return res.json({
            success: true,
            data: donations.map((donation) => mapDonation(donation, usersById))
        });
    } catch (error) {
        return res.status(500).json({ error: 'Get admin donations failed', details: error.message });
    }
};

const getVolunteers = async (req, res) => {
    try {
        const volunteers = await fetchVolunteers();
        const sortedVolunteers = [...volunteers].sort((a, b) => {
            const aPending = String(a.status || '').toLowerCase() === 'pending' ? 0 : 1;
            const bPending = String(b.status || '').toLowerCase() === 'pending' ? 0 : 1;
            if (aPending !== bPending) return aPending - bPending;
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        return res.json({
            success: true,
            data: sortedVolunteers.map(mapVolunteer)
        });
    } catch (error) {
        return res.status(500).json({ error: 'Get admin volunteers failed', details: error.message });
    }
};

const approveVolunteer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Missing volunteer id' });
        }

        const { data, error } = await supabaseAdmin
            .from('volunteers')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: req.admin?.username || 'admin',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();

        if (error) {
            return res.status(400).json({ error: 'Failed to approve volunteer', details: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Volunteer not found' });
        }

        return res.json({
            success: true,
            message: 'Volunteer approved successfully',
            data: mapVolunteer(data[0])
        });
    } catch (error) {
        return res.status(500).json({ error: 'Approve volunteer failed', details: error.message });
    }
};

const getMessages = async (req, res) => {
    try {
        const users = await fetchUsers();
        const donations = await fetchDonations();
        const usersById = new Map(users.map((user) => [user.id, user]));
        const donationsById = new Map(donations.map((donation) => [donation.id, donation]));
        const messages = await fetchMessages();

        return res.json({
            success: true,
            data: messages.map((message) => mapMessage(message, usersById, donationsById))
        });
    } catch (error) {
        return res.status(500).json({ error: 'Get admin messages failed', details: error.message });
    }
};

const getNgos = async (req, res) => {
    try {
        const users = await fetchUsers();
        const usersById = new Map(users.map((user) => [user.id, user]));
        const profiles = await fetchNgoProfiles();

        return res.json({
            success: true,
            data: profiles.map((profile) => {
                const user = usersById.get(profile.ngo_id) || {};
                return {
                    id: profile.id,
                    ngoId: profile.ngo_id,
                    name: profile.organization_name || user.full_name || 'NGO',
                    email: user.email || '',
                    phone: user.phone || '',
                    city: user.address || 'Not specified',
                    mission: profile.mission || '',
                    impactStatement: profile.impact_statement || '',
                    verified: Boolean(profile.verified),
                    created_at: profile.created_at,
                    updated_at: profile.updated_at
                };
            })
        });
    } catch (error) {
        return res.status(500).json({ error: 'Get admin NGOs failed', details: error.message });
    }
};

const getSystem = async (req, res) => {
    try {
        const [users, donations, volunteers, messages, pickupRequests] = await Promise.all([
            fetchUsers(),
            fetchDonations(),
            fetchVolunteers(),
            fetchMessages(),
            fetchPickupRequests()
        ]);

        const overview = {
            nodeVersion: process.version,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsedMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
            totalRecords: users.length + donations.length + volunteers.length + messages.length + pickupRequests.length,
            lastCleanupAt: new Date().toISOString()
        };

        return res.json({
            success: true,
            data: overview
        });
    } catch (error) {
        return res.status(500).json({ error: 'Get admin system info failed', details: error.message });
    }
};

async function deleteUser(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Missing user id' });
        }

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
            return res.status(400).json({ error: 'Failed to delete auth user', details: authError.message });
        }

        const { error } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: 'Failed to delete user', details: error.message });
        }

        return res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Delete user failed', details: error.message });
    }
}

async function deleteDonation(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Missing donation id' });
        }

        const { error } = await supabaseAdmin
            .from('donations')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: 'Failed to delete donation', details: error.message });
        }

        return res.json({ success: true, message: 'Donation deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Delete donation failed', details: error.message });
    }
}

async function deleteVolunteer(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Missing volunteer id' });
        }

        const { error } = await supabaseAdmin
            .from('volunteers')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: 'Failed to delete volunteer', details: error.message });
        }

        return res.json({ success: true, message: 'Volunteer deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Delete volunteer failed', details: error.message });
    }
}

async function deleteMessage(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Missing message id' });
        }

        const { error } = await supabaseAdmin
            .from('messages')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: 'Failed to delete message', details: error.message });
        }

        return res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: 'Delete message failed', details: error.message });
    }
}

async function cleanupExpired(req, res) {
    try {
        const result = await cleanupExpiredAvailableDonations();
        return res.json({
            success: true,
            message: 'Expired donations cleaned up',
            ...result
        });
    } catch (error) {
        return res.status(500).json({ error: 'Cleanup expired donations failed', details: error.message });
    }
}

module.exports = {
    login,
    getOverview,
    getUsers,
    getDonations,
    getVolunteers,
    getMessages,
    getNgos,
    getSystem,
    deleteUser,
    deleteDonation,
    deleteVolunteer,
    deleteMessage,
    approveVolunteer,
    cleanupExpired
};
