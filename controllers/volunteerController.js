const { supabaseAdmin } = require('../config/supabase');

function isApprovedVolunteer(volunteer) {
  const status = String(volunteer?.status || '').toLowerCase();
  return !status || status === 'approved';
}

// Get all volunteers
const getAllVolunteers = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('volunteers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch volunteers', details: error.message });
    }

    const publicVolunteers = (data || []).filter(isApprovedVolunteer);

    res.json({
      success: true,
      data: publicVolunteers,
      count: publicVolunteers.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Get volunteers error', details: error.message });
  }
};

// Get volunteer by ID
const getVolunteerById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('volunteers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    if (!isApprovedVolunteer(data)) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ error: 'Get volunteer error', details: error.message });
  }
};

// Create volunteer entry
const createVolunteer = async (req, res) => {
  try {
    const { fullName, email, phone, city, role, availability, message } = req.body;

    // Validation
    if (!fullName || !email || !phone || !city || !role || !availability) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabaseAdmin
      .from('volunteers')
      .insert([
        {
          full_name: fullName,
          email,
          phone,
          city,
          role,
          availability,
          message: message || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      if (String(error.message || '').toLowerCase().includes('status')) {
        return res.status(500).json({
          error: 'Volunteer approval schema is missing',
          details: 'Run backend/VOLUNTEERS_APPROVAL_MIGRATION.sql to add volunteer approval support.'
        });
      }
      return res.status(500).json({ error: 'Failed to create volunteer', details: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Volunteer submitted successfully',
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Create volunteer error', details: error.message });
  }
};

// Update volunteer
const updateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, city, role, availability, message } = req.body;

    const updateData = {};
    if (fullName) updateData.full_name = fullName;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (city) updateData.city = city;
    if (role) updateData.role = role;
    if (availability) updateData.availability = availability;
    if (message !== undefined) updateData.message = message;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('volunteers')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      return res.status(500).json({ error: 'Failed to update volunteer', details: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    res.json({
      success: true,
      message: 'Volunteer updated successfully',
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Update volunteer error', details: error.message });
  }
};

// Delete volunteer
const deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('volunteers')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete volunteer', details: error.message });
    }

    res.json({
      success: true,
      message: 'Volunteer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Delete volunteer error', details: error.message });
  }
};

// Get volunteers by city
const getVolunteersByCity = async (req, res) => {
  try {
    const { city } = req.params;

    const { data, error } = await supabaseAdmin
      .from('volunteers')
      .select('*')
      .ilike('city', `%${city}%`)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch volunteers by city', details: error.message });
    }

    const publicVolunteers = (data || []).filter(isApprovedVolunteer);

    res.json({
      success: true,
      data: publicVolunteers,
      count: publicVolunteers.length,
      city
    });
  } catch (error) {
    res.status(500).json({ error: 'Get volunteers by city error', details: error.message });
  }
};

// Get volunteers by role
const getVolunteersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    const { data, error } = await supabaseAdmin
      .from('volunteers')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch volunteers by role', details: error.message });
    }

    const publicVolunteers = (data || []).filter(isApprovedVolunteer);

    res.json({
      success: true,
      data: publicVolunteers,
      count: publicVolunteers.length,
      role
    });
  } catch (error) {
    res.status(500).json({ error: 'Get volunteers by role error', details: error.message });
  }
};

module.exports = {
  getAllVolunteers,
  getVolunteerById,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
  getVolunteersByCity,
  getVolunteersByRole
};
