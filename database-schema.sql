-- FeedLink Database Schema - Run this in Supabase SQL Editor

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('donor', 'ngo', 'admin')),
    phone VARCHAR(20),
    address TEXT,
    bio TEXT,
    profile_image TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Donations table
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    quantity VARCHAR(100),
    condition VARCHAR(50),
    latitude FLOAT,
    longitude FLOAT,
    address TEXT,
    is_perishable BOOLEAN DEFAULT FALSE,
    expiry_date TIMESTAMP,
    contact_phone VARCHAR(20),
    images TEXT[],
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'completed', 'cancelled')),
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Pickup Requests table
CREATE TABLE pickup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- NGO Profiles table
CREATE TABLE ngo_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    cover_image_url TEXT,
    mission TEXT,
    impact_statement TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Messages table for chat
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_donations_donor_id ON donations(donor_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_location ON donations(latitude, longitude);
CREATE INDEX idx_pickup_requests_donation_id ON pickup_requests(donation_id);
CREATE INDEX idx_pickup_requests_requester_id ON pickup_requests(requester_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_ngo_profiles_ngo_id ON ngo_profiles(ngo_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can read their own profile" 
ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON users FOR UPDATE USING (auth.uid() = id);

-- Policies for donations table
CREATE POLICY "Anyone can read available donations" 
ON donations FOR SELECT USING (status = 'available');

CREATE POLICY "Donors can read their own donations" 
ON donations FOR SELECT USING (auth.uid() = donor_id);

CREATE POLICY "Donors can insert donations" 
ON donations FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Donors can update their own donations" 
ON donations FOR UPDATE USING (auth.uid() = donor_id);

CREATE POLICY "Donors can delete their own donations" 
ON donations FOR DELETE USING (auth.uid() = donor_id);

-- Policies for pickup requests
CREATE POLICY "NGOs can see pickup requests for their donations" 
ON pickup_requests FOR SELECT USING (
    donation_id IN (SELECT id FROM donations WHERE auth.uid() = donor_id)
    OR auth.uid() = requester_id
);

CREATE POLICY "NGOs can insert pickup requests" 
ON pickup_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Donors can update pickup requests for their donations" 
ON pickup_requests FOR UPDATE USING (
    donation_id IN (SELECT id FROM donations WHERE auth.uid() = donor_id)
);

-- Policies for messages
CREATE POLICY "Users can read their own messages" 
ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- =========================================================
-- Second Smile tables (separate from food donation flow)
-- =========================================================

CREATE TABLE smile_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('clothes', 'books', 'toys', 'other')),
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    item_condition VARCHAR(50),
    latitude FLOAT,
    longitude FLOAT,
    address TEXT NOT NULL,
    city VARCHAR(120) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    contact_phone VARCHAR(20),
    image_url TEXT,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'completed', 'cancelled')),
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE smile_pickup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smile_donation_id UUID NOT NULL REFERENCES smile_donations(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_smile_donations_donor_id ON smile_donations(donor_id);
CREATE INDEX idx_smile_donations_item_type ON smile_donations(item_type);
CREATE INDEX idx_smile_donations_status ON smile_donations(status);
CREATE INDEX idx_smile_pickup_requests_donation_id ON smile_pickup_requests(smile_donation_id);
CREATE INDEX idx_smile_pickup_requests_requester_id ON smile_pickup_requests(requester_id);

ALTER TABLE smile_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smile_pickup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read available smile donations"
ON smile_donations FOR SELECT USING (status = 'available');

CREATE POLICY "Donors can read their own smile donations"
ON smile_donations FOR SELECT USING (auth.uid() = donor_id);

CREATE POLICY "Donors can insert smile donations"
ON smile_donations FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Donors can update their own smile donations"
ON smile_donations FOR UPDATE USING (auth.uid() = donor_id);

CREATE POLICY "Donors can delete their own smile donations"
ON smile_donations FOR DELETE USING (auth.uid() = donor_id);

CREATE POLICY "Users can read their smile pickup requests"
ON smile_pickup_requests FOR SELECT USING (
    auth.uid() = requester_id
    OR smile_donation_id IN (
        SELECT id FROM smile_donations WHERE donor_id = auth.uid()
    )
);

CREATE POLICY "Users can create smile pickup requests"
ON smile_pickup_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Donors can update smile pickup requests for their donations"
ON smile_pickup_requests FOR UPDATE USING (
    smile_donation_id IN (
        SELECT id FROM smile_donations WHERE donor_id = auth.uid()
    )
);
