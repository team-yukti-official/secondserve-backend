const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || !serviceRoleKey) {
	throw new Error('Missing Supabase environment variables. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.');
}

// Client for user operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for server-side operations
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

module.exports = { supabase, supabaseAdmin };
