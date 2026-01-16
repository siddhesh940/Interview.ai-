-- =====================================================
-- DEMO MODE MIGRATION
-- Adds is_dummy column for DEMO → LIVE auto-switch
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 0: Disable Row Level Security (IMPORTANT for backend access)
ALTER TABLE drives DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE drive_registrations DISABLE ROW LEVEL SECURITY;

-- Step 1: Add is_dummy column to drives table
ALTER TABLE drives 
ADD COLUMN IF NOT EXISTS is_dummy BOOLEAN DEFAULT false;

-- Step 2: Add is_dummy column to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS is_dummy BOOLEAN DEFAULT false;

-- Step 3: Create index for faster demo data queries
CREATE INDEX IF NOT EXISTS idx_drives_is_dummy ON drives(is_dummy);
CREATE INDEX IF NOT EXISTS idx_notifications_is_dummy ON notifications(is_dummy);

-- Step 4: Create a function to cleanup all dummy data (can be called manually)
CREATE OR REPLACE FUNCTION cleanup_dummy_data()
RETURNS TABLE(deleted_drives INT, deleted_notifications INT) AS $$
DECLARE
    v_deleted_drives INT;
    v_deleted_notifications INT;
BEGIN
    -- Delete dummy notifications first (foreign key constraint)
    DELETE FROM notifications WHERE is_dummy = true;
    GET DIAGNOSTICS v_deleted_notifications = ROW_COUNT;
    
    -- Delete dummy drives
    DELETE FROM drives WHERE is_dummy = true;
    GET DIAGNOSTICS v_deleted_drives = ROW_COUNT;
    
    RETURN QUERY SELECT v_deleted_drives, v_deleted_notifications;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a function to check demo mode status
CREATE OR REPLACE FUNCTION get_demo_status()
RETURNS TABLE(
    mode TEXT,
    real_drives BIGINT,
    dummy_drives BIGINT,
    real_notifications BIGINT,
    dummy_notifications BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN (SELECT COUNT(*) FROM drives WHERE is_dummy = false) > 0 THEN 'LIVE'
            ELSE 'DEMO'
        END as mode,
        (SELECT COUNT(*) FROM drives WHERE is_dummy = false) as real_drives,
        (SELECT COUNT(*) FROM drives WHERE is_dummy = true) as dummy_drives,
        (SELECT COUNT(*) FROM notifications WHERE is_dummy = false) as real_notifications,
        (SELECT COUNT(*) FROM notifications WHERE is_dummy = true) as dummy_notifications;
END;
$$ LANGUAGE plpgsql;

-- Step 6: View for fetching only active drives (regardless of demo/live)
-- Frontend queries this - it returns dummy in demo mode, real in live mode
CREATE OR REPLACE VIEW active_placement_drives AS
SELECT 
    d.*,
    c.name as company_name,
    c.logo_url as company_logo,
    CASE 
        WHEN (SELECT COUNT(*) FROM drives WHERE is_dummy = false) > 0 
        THEN d.is_dummy = false  -- Live mode: only show real
        ELSE true                 -- Demo mode: show all (which are dummy)
    END as should_display
FROM drives d
JOIN companies c ON d.company_id = c.id
WHERE d.is_active = true
  AND d.deadline > NOW();

-- =====================================================
-- VERIFICATION QUERIES (Run after migration)
-- =====================================================

-- Check if columns were added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'drives' AND column_name = 'is_dummy';

-- Check current demo status:
-- SELECT * FROM get_demo_status();

-- Manual cleanup if needed:
-- SELECT * FROM cleanup_dummy_data();
