-- Add new onboarding fields for customers and drivers to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_rc_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_as_customer NUMERIC(2,1) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_trips_as_customer INT DEFAULT 0;

-- Update reviews table to allow reviews from both driver and customer for the same booking
-- 1. Drop the unique constraint on booking_id if it exists
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_key;

-- 2. Add reviewer_role column
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_role TEXT CHECK (reviewer_role IN ('customer', 'driver')) DEFAULT 'customer';

-- 3. Add composite unique constraint so each role can review once per booking
ALTER TABLE reviews ADD CONSTRAINT reviews_booking_id_reviewer_role_key UNIQUE (booking_id, reviewer_role);

-- 4. Add index for customer rating searches
CREATE INDEX IF NOT EXISTS idx_reviews_customer_role ON reviews(customer_id, reviewer_role);
