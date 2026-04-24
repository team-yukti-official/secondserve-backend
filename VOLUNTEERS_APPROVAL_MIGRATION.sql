-- Volunteer approval workflow migration
-- Run this once on an existing database to add pending/approved support.

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'volunteers_status_check'
    ) THEN
        ALTER TABLE volunteers
        ADD CONSTRAINT volunteers_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

UPDATE volunteers
SET status = 'approved'
WHERE status IS NULL;

DROP POLICY IF EXISTS "Allow public read access to volunteers" ON volunteers;
DROP POLICY IF EXISTS "Allow public read access to approved volunteers" ON volunteers;
DROP POLICY IF EXISTS "Allow anyone to create volunteer entries" ON volunteers;
DROP POLICY IF EXISTS "Allow updates to volunteer entries" ON volunteers;
DROP POLICY IF EXISTS "Allow deletes of volunteer entries" ON volunteers;

CREATE POLICY "Allow public read access to approved volunteers"
ON volunteers FOR SELECT
USING (status IS NULL OR status = 'approved');

CREATE POLICY "Allow anyone to create volunteer entries"
ON volunteers FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status);
