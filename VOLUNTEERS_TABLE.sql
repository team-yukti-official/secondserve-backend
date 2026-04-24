-- Volunteers Table for Second Serve

-- Create the volunteers table
CREATE TABLE volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    city VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    availability VARCHAR(100) NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_volunteers_city ON volunteers(city);
CREATE INDEX idx_volunteers_role ON volunteers(role);
CREATE INDEX idx_volunteers_email ON volunteers(email);
CREATE INDEX idx_volunteers_created_at ON volunteers(created_at);
CREATE INDEX idx_volunteers_status ON volunteers(status);

-- Enable Row Level Security
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

-- Policies for volunteers table (Public can see approved volunteers, anyone can submit)
CREATE POLICY "Allow public read access to approved volunteers" 
ON volunteers FOR SELECT 
USING (status IS NULL OR status = 'approved');

CREATE POLICY "Allow anyone to create volunteer entries" 
ON volunteers FOR INSERT 
WITH CHECK (true);
