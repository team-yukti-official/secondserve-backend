-- FeedLink Database Testing & Debugging Queries
-- Run these in Supabase SQL Editor to test and debug your database

-- =====================================================
-- VIEW ALL DATA
-- =====================================================

-- See all users
SELECT id, email, full_name, user_type, created_at FROM users;

-- See all donations
SELECT id, donor_id, title, status, created_at FROM donations;

-- See all pickup requests
SELECT id, donation_id, requester_id, status, created_at FROM pickup_requests;

-- See all NGO profiles
SELECT id, ngo_id, organization_name, verified FROM ngo_profiles;

-- See all messages
SELECT id, sender_id, receiver_id, message, created_at FROM messages;

-- =====================================================
-- COUNT STATISTICS
-- =====================================================

-- Total users by type
SELECT user_type, COUNT(*) as total FROM users GROUP BY user_type;

-- Total donations by status
SELECT status, COUNT(*) as total FROM donations GROUP BY status;

-- Donations per donor
SELECT d.donor_id, u.full_name, COUNT(*) as total_donations 
FROM donations d 
JOIN users u ON d.donor_id = u.id 
GROUP BY d.donor_id, u.full_name;

-- Pickup requests by status
SELECT status, COUNT(*) as total FROM pickup_requests GROUP BY status;

-- =====================================================
-- FIND SPECIFIC DATA
-- =====================================================

-- Find donations in a specific category
SELECT * FROM donations WHERE category = 'Food' AND status = 'available';

-- Find recent donations (last 7 days)
SELECT * FROM donations 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Find all donations by a specific donor
SELECT * FROM donations WHERE donor_id = 'user-id-here';

-- Find perishable donations
SELECT * FROM donations WHERE is_perishable = true AND status = 'available';

-- Find donations expiring soon
SELECT * FROM donations 
WHERE expiry_date <= NOW() + INTERVAL '3 days'
AND status = 'available'
ORDER BY expiry_date ASC;

-- Find pending pickup requests
SELECT pr.*, d.title, u.full_name 
FROM pickup_requests pr
JOIN donations d ON pr.donation_id = d.id
JOIN users u ON pr.requester_id = u.id
WHERE pr.status = 'pending';

-- Find conversations with unread messages
SELECT sender_id, receiver_id, COUNT(*) as unread_count
FROM messages
WHERE is_read = false
GROUP BY sender_id, receiver_id;

-- =====================================================
-- DELETE/CLEANUP OPERATIONS
-- =====================================================

-- Delete a specific user (cascades to donations and requests)
DELETE FROM users WHERE id = 'user-id-here';

-- Delete all pending donations from a user
DELETE FROM donations 
WHERE donor_id = 'user-id-here' 
AND status = 'available';

-- Delete all messages in a conversation
DELETE FROM messages 
WHERE (sender_id = 'user1-id' AND receiver_id = 'user2-id')
OR (sender_id = 'user2-id' AND receiver_id = 'user1-id');

-- =====================================================
-- UPDATE OPERATIONS
-- =====================================================

-- Mark all donations as claimed by an NGO
UPDATE donations 
SET status = 'claimed', updated_at = NOW()
WHERE donor_id = 'donor-id-here' AND status = 'available'
LIMIT 5;

-- Accept a specific pickup request
UPDATE pickup_requests 
SET status = 'accepted', updated_at = NOW()
WHERE id = 'request-id-here';

-- Verify an NGO
UPDATE ngo_profiles 
SET verified = true, updated_at = NOW()
WHERE ngo_id = 'ngo-id-here';

-- Mark messages as read
UPDATE messages
SET is_read = true
WHERE receiver_id = 'your-user-id' AND is_read = false;

-- =====================================================
-- RELATIONSHIP QUERIES
-- =====================================================

-- Get donation with donor details
SELECT d.*, u.full_name, u.profile_image, u.phone
FROM donations d
JOIN users u ON d.donor_id = u.id
WHERE d.id = 'donation-id-here';

-- Get pickup requests with all details
SELECT 
    pr.id,
    pr.status,
    d.title as donation_title,
    d.is_perishable,
    d.expiry_date,
    donor.full_name as donor_name,
    requester.full_name as requester_name,
    pr.created_at
FROM pickup_requests pr
JOIN donations d ON pr.donation_id = d.id
JOIN users donor ON d.donor_id = donor.id
JOIN users requester ON pr.requester_id = requester.id
ORDER BY pr.created_at DESC;

-- Get NGO profile with user details
SELECT np.*, u.email, u.phone, u.address
FROM ngo_profiles np
JOIN users u ON np.ngo_id = u.id
WHERE np.ngo_id = 'ngo-id-here';

-- =====================════========================
-- TEST ROW LEVEL SECURITY
-- =====================================================

-- This query tests if RLS is working properly
-- Run this as a specific user (via auth.uid())
SELECT * FROM donations 
WHERE status = 'available'
OR donor_id = auth.uid();

-- Test user can only see their own profile
SELECT * FROM users WHERE id = auth.uid();

-- =====================================================
-- BACKUP QUERIES
-- =====================================================

-- Export donations data (copy results to CSV)
SELECT 
    id, donor_id, title, description, category, 
    quantity, condition, address, status, created_at
FROM donations
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Export user statistics
SELECT 
    id, email, full_name, user_type, created_at,
    (SELECT COUNT(*) FROM donations WHERE donor_id = users.id) as donations_created,
    (SELECT COUNT(*) FROM pickup_requests WHERE requester_id = users.id) as pickups_requested
FROM users
ORDER BY created_at DESC;

-- =====================================================
-- PERFORMANCE QUERIES
-- =====================================================

-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM donations WHERE status = 'available' LIMIT 10;

-- Check database size
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

-- Check if auth is working
SELECT * FROM auth.users;

-- Verify email was confirmed
SELECT id, email, confirmed_at FROM auth.users;

-- List all tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check column names in a table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'donations';

-- View all indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Check active database connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
