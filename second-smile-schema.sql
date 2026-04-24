-- Second Smile schema extension for existing FeedLink Supabase project
-- Run this in Supabase SQL Editor after database-schema.sql

CREATE TABLE IF NOT EXISTS smile_donations (
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

CREATE TABLE IF NOT EXISTS smile_pickup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smile_donation_id UUID NOT NULL REFERENCES smile_donations(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smile_donations_donor_id ON smile_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_smile_donations_item_type ON smile_donations(item_type);
CREATE INDEX IF NOT EXISTS idx_smile_donations_status ON smile_donations(status);
CREATE INDEX IF NOT EXISTS idx_smile_donations_created_at ON smile_donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smile_pickup_requests_donation_id ON smile_pickup_requests(smile_donation_id);
CREATE INDEX IF NOT EXISTS idx_smile_pickup_requests_requester_id ON smile_pickup_requests(requester_id);

ALTER TABLE smile_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smile_pickup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read available smile donations"
ON smile_donations FOR SELECT
USING (status = 'available');

CREATE POLICY "Donors can read their own smile donations"
ON smile_donations FOR SELECT
USING (auth.uid() = donor_id);

CREATE POLICY "Donors can insert smile donations"
ON smile_donations FOR INSERT
WITH CHECK (auth.uid() = donor_id);

CREATE POLICY "Donors can update their own smile donations"
ON smile_donations FOR UPDATE
USING (auth.uid() = donor_id);

CREATE POLICY "Donors can delete their own smile donations"
ON smile_donations FOR DELETE
USING (auth.uid() = donor_id);

CREATE POLICY "Users can read their smile pickup requests"
ON smile_pickup_requests FOR SELECT
USING (
    auth.uid() = requester_id
    OR smile_donation_id IN (
        SELECT id FROM smile_donations WHERE donor_id = auth.uid()
    )
);

CREATE POLICY "Users can create smile pickup requests"
ON smile_pickup_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Donors can update smile pickup requests for their donations"
ON smile_pickup_requests FOR UPDATE
USING (
    smile_donation_id IN (
        SELECT id FROM smile_donations WHERE donor_id = auth.uid()
    )
);
