const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

// Send message
const sendMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { receiverId, donationId, message } = req.body;

        if (!receiverId || !message) {
            return res.status(400).json({ error: 'Receiver ID and message required' });
        }

        const { data, error } = await supabaseAdmin
            .from('messages')
            .insert({
                id: uuidv4(),
                sender_id: userId,
                receiver_id: receiverId,
                donation_id: donationId || null,
                message,
                is_read: false,
                created_at: new Date()
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Send message failed', details: error.message });
        }

        res.status(201).json({ message: 'Message sent', data });
    } catch (error) {
        res.status(500).json({ error: 'Send message error', details: error.message });
    }
};

// Get conversation
const getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('messages')
            .select(`
                *,
                sender:sender_id(id, full_name, profile_image),
                receiver:receiver_id(id, full_name, profile_image)
            `)
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true });

        if (error) {
            return res.status(400).json({ error: 'Fetch failed', details: error.message });
        }

        // Mark as read
        await supabaseAdmin
            .from('messages')
            .update({ is_read: true })
            .eq('receiver_id', userId)
            .eq('sender_id', otherId);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get conversation error', details: error.message });
    }
};

// Get all conversations
const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabaseAdmin.rpc('get_user_conversations', {
            user_id: userId
        });

        if (error) {
            // Fallback query
            const { data: messages } = await supabaseAdmin
                .from('messages')
                .select('sender_id, receiver_id')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            const conversationMap = new Map();
            messages?.forEach(msg => {
                const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
                if (!conversationMap.has(otherId)) {
                    conversationMap.set(otherId, { other_id: otherId });
                }
            });

            return res.json(Array.from(conversationMap.values()));
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Get conversations error', details: error.message });
    }
};

module.exports = {
    sendMessage,
    getConversation,
    getConversations
};
