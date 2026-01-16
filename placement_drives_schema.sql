-- Placement Drives Database Schema
-- Run this in your Supabase SQL editor

-- Create enum types for drive types
CREATE TYPE drive_type AS ENUM ('on-campus', 'off-campus', 'virtual');

-- Companies table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT NOT NULL UNIQUE,
    official_careers_url TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Insert target companies
INSERT INTO companies (name, official_careers_url, logo_url) VALUES
('Accenture', 'https://careers.accenture.com', '/company-logos/accenture.png'),
('Capgemini', 'https://careers.capgemini.com', '/company-logos/capgemini.png'),
('TCS', 'https://careers.tcs.com', '/company-logos/tcs.png'),
('Wipro', 'https://careers.wipro.com', '/company-logos/wipro.png'),
('Cognizant', 'https://careers.cognizant.com', '/company-logos/cognizant.png'),
('Infosys', 'https://careers.infosys.com', '/company-logos/infosys.png');

-- Drives table
CREATE TABLE drives (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    drive_type drive_type NOT NULL,
    batch TEXT NOT NULL,
    min_cgpa DECIMAL(3,2) DEFAULT 0.0,
    branches TEXT[] DEFAULT '{}',
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_link TEXT NOT NULL,
    source_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    -- Prevent duplicate entries
    UNIQUE(company_id, role, deadline)
);

-- Users profile extension for placement drives (links with Clerk)
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    clerk_user_id TEXT NOT NULL UNIQUE,
    email TEXT,
    batch TEXT,
    branch TEXT,
    cgpa DECIMAL(3,2),
    college_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    clerk_user_id TEXT NOT NULL,
    drive_id INTEGER REFERENCES drives(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    notification_type TEXT DEFAULT 'new_drive'
);

-- User registrations tracking (optional - for analytics)
CREATE TABLE drive_registrations (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    clerk_user_id TEXT NOT NULL,
    drive_id INTEGER REFERENCES drives(id) ON DELETE CASCADE,
    registered_via_app BOOLEAN DEFAULT true,
    
    UNIQUE(clerk_user_id, drive_id)
);

-- Indexing for performance
CREATE INDEX idx_drives_deadline ON drives(deadline);
CREATE INDEX idx_drives_company_active ON drives(company_id, is_active);
CREATE INDEX idx_notifications_user_unread ON notifications(clerk_user_id, is_read);
CREATE INDEX idx_user_profiles_clerk_id ON user_profiles(clerk_user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_drives_updated_at BEFORE UPDATE ON drives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_registrations ENABLE ROW LEVEL SECURITY;

-- Allow read access to drives for everyone
CREATE POLICY "Allow read access to drives" ON drives
    FOR SELECT USING (true);

-- Allow users to read their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
    FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Allow users to update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Allow users to manage their own profile
CREATE POLICY "Users can manage own profile" ON user_profiles
    FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Allow users to manage their own registrations
CREATE POLICY "Users can manage own registrations" ON drive_registrations
    FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Grant necessary permissions (adjust based on your Supabase setup)
GRANT ALL ON companies TO authenticated;
GRANT ALL ON drives TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON drive_registrations TO authenticated;
