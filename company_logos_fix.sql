-- =====================================================
-- COMPANY LOGOS FIX
-- Updates logo URLs to match actual PNG files
-- Run this in Supabase SQL Editor
-- =====================================================

-- Update company logo URLs to match actual files in /public/company-logos/
UPDATE companies SET logo_url = '/company-logos/ACN_BIG.png' WHERE name = 'Accenture';
UPDATE companies SET logo_url = '/company-logos/CAP.PA_BIG.png' WHERE name = 'Capgemini';  
UPDATE companies SET logo_url = '/company-logos/TCS.NS_BIG.png' WHERE name = 'TCS';
UPDATE companies SET logo_url = '/company-logos/WIT.png' WHERE name = 'Wipro';
UPDATE companies SET logo_url = '/company-logos/CTSH_BIG.png' WHERE name = 'Cognizant';
UPDATE companies SET logo_url = '/company-logos/INFY_BIG.png' WHERE name = 'Infosys';

-- Verify the updates
SELECT name, logo_url FROM companies ORDER BY name;
