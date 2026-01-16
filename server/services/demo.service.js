/**
 * Demo Mode Service
 * Handles automatic DEMO → LIVE switching for Placement Drives
 * 
 * ARCHITECTURE:
 * - Demo mode is ON when no real drives exist
 * - The moment ANY real drive is scraped, demo mode turns OFF permanently
 * - All dummy data is automatically cleaned up
 * - This is a one-way switch (demo → live, never reverse)
 */

const supabaseService = require('../config/supabaseClient');

class DemoService {
  constructor() {
    this.isDemoModeEnabled = null; // Cached state
  }

  /**
   * Check if demo mode is currently active
   * Demo mode = No real drives exist in database
   */
  async isDemoMode() {
    const supabase = supabaseService.getClient();
    
    // Check if any real (non-dummy) drives exist
    const { count, error } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', false);

    if (error) {
      console.error('[DemoService] Error checking demo mode:', error);
      
return true; // Default to demo mode on error
    }

    const isDemo = count === 0;
    this.isDemoModeEnabled = isDemo;
    
    console.log(`[DemoService] Demo mode: ${isDemo ? 'ENABLED' : 'DISABLED'} (${count} real drives found)`);
    
return isDemo;
  }

  /**
   * Initialize demo data if no real drives exist
   * Called on app startup
   */
  async initializeDemoData() {
    const isDemo = await this.isDemoMode();
    
    if (!isDemo) {
      console.log('[DemoService] Real drives exist, skipping demo initialization');
      
return { success: true, action: 'skipped', reason: 'real_data_exists' };
    }

    // Check if dummy data already exists
    const supabase = supabaseService.getClient();
    const { count: dummyCount } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', true);

    if (dummyCount > 0) {
      console.log(`[DemoService] Demo data already exists (${dummyCount} dummy drives)`);
      
return { success: true, action: 'exists', count: dummyCount };
    }

    // Insert demo data
    console.log('[DemoService] Inserting demo placement drives...');
    const result = await this.insertDemoData();
    
    return result;
  }

  /**
   * Insert realistic demo placement drives and notifications
   */
  async insertDemoData() {
    const supabase = supabaseService.getClient();

    // Get company IDs
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');

    if (!companies || companies.length === 0) {
      console.error('[DemoService] No companies found in database');
      
return { success: false, error: 'no_companies' };
    }

    const companyMap = {};
    companies.forEach(c => companyMap[c.name.toLowerCase()] = c.id);

    // Demo drives data - realistic and varied
    const demoDrives = [
      {
        company_id: companyMap['accenture'] || companies[0].id,
        role: 'Associate Software Engineer',
        drive_type: 'off-campus',
        batch: '2025',
        min_cgpa: 6.0,
        branches: ['CSE', 'IT', 'ECE', 'EEE'],
        deadline: this.getFutureDate(15),
        registration_link: 'https://careers.accenture.com/demo',
        source_url: 'https://careers.accenture.com',
        is_active: true,
        is_dummy: true
      },
      {
        company_id: companyMap['tcs'] || companies[0].id,
        role: 'Systems Engineer',
        drive_type: 'on-campus',
        batch: '2025',
        min_cgpa: 6.5,
        branches: ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE'],
        deadline: this.getFutureDate(10),
        registration_link: 'https://careers.tcs.com/demo',
        source_url: 'https://careers.tcs.com',
        is_active: true,
        is_dummy: true
      },
      {
        company_id: companyMap['infosys'] || companies[0].id,
        role: 'Systems Engineer Trainee',
        drive_type: 'virtual',
        batch: '2025',
        min_cgpa: 6.0,
        branches: ['CSE', 'IT', 'ECE'],
        deadline: this.getFutureDate(20),
        registration_link: 'https://careers.infosys.com/demo',
        source_url: 'https://careers.infosys.com',
        is_active: true,
        is_dummy: true
      },
      {
        company_id: companyMap['wipro'] || companies[0].id,
        role: 'Project Engineer',
        drive_type: 'off-campus',
        batch: '2025',
        min_cgpa: 5.5,
        branches: ['CSE', 'IT', 'ECE', 'EEE', 'ME'],
        deadline: this.getFutureDate(7),
        registration_link: 'https://careers.wipro.com/demo',
        source_url: 'https://careers.wipro.com',
        is_active: true,
        is_dummy: true
      },
      {
        company_id: companyMap['cognizant'] || companies[0].id,
        role: 'Programmer Analyst Trainee',
        drive_type: 'on-campus',
        batch: '2025',
        min_cgpa: 6.0,
        branches: ['CSE', 'IT', 'ECE', 'EEE'],
        deadline: this.getFutureDate(12),
        registration_link: 'https://careers.cognizant.com/demo',
        source_url: 'https://careers.cognizant.com',
        is_active: true,
        is_dummy: true
      },
      {
        company_id: companyMap['capgemini'] || companies[0].id,
        role: 'Senior Analyst',
        drive_type: 'virtual',
        batch: '2025',
        min_cgpa: 6.5,
        branches: ['CSE', 'IT'],
        deadline: this.getFutureDate(18),
        registration_link: 'https://careers.capgemini.com/demo',
        source_url: 'https://careers.capgemini.com',
        is_active: true,
        is_dummy: true
      }
    ];

    // Insert demo drives
    const { data: insertedDrives, error: driveError } = await supabase
      .from('drives')
      .insert(demoDrives)
      .select();

    if (driveError) {
      console.error('[DemoService] Error inserting demo drives:', driveError);
      
return { success: false, error: driveError.message };
    }

    console.log(`[DemoService] Inserted ${insertedDrives.length} demo drives`);

    // Create demo notifications for all user profiles
    await this.createDemoNotifications(insertedDrives);

    return { 
      success: true, 
      action: 'inserted',
      drivesInserted: insertedDrives.length 
    };
  }

  /**
   * Create demo notifications for all users
   */
  async createDemoNotifications(drives) {
    const supabase = supabaseService.getClient();

    // Get all user profiles
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id');

    if (!users || users.length === 0) {
      console.log('[DemoService] No user profiles found, skipping demo notifications');
      
return;
    }

    const notifications = [];
    
    // Create 2-3 notifications per user for demo
    for (const user of users) {
      const randomDrives = drives.sort(() => 0.5 - Math.random()).slice(0, 3);
      
      for (const drive of randomDrives) {
        notifications.push({
          user_profile_id: user.id,
          drive_id: drive.id,
          title: `New ${drive.role} opportunity!`,
          message: `A new placement drive is available. Deadline: ${new Date(drive.deadline).toLocaleDateString()}`,
          is_read: false,
          is_dummy: true
        });
      }
    }

    if (notifications.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('[DemoService] Error creating demo notifications:', error);
      } else {
        console.log(`[DemoService] Created ${notifications.length} demo notifications`);
      }
    }
  }

  /**
   * CRITICAL: Auto-switch from DEMO to LIVE mode
   * Called when real drives are scraped successfully
   * This is a ONE-WAY switch - never goes back to demo
   */
  async switchToLiveMode(realDrives) {
    if (!realDrives || realDrives.length === 0) {
      return { success: false, reason: 'no_real_drives' };
    }

    const supabase = supabaseService.getClient();
    
    console.log('\n🔄 [DemoService] SWITCHING FROM DEMO TO LIVE MODE...');
    console.log(`   Real drives detected: ${realDrives.length}`);

    try {
      // Step 1: Delete ALL dummy notifications
      const { data: deletedNotifications, error: notifError } = await supabase
        .from('notifications')
        .delete()
        .eq('is_dummy', true)
        .select('id');

      if (notifError) {
        console.error('[DemoService] Error deleting dummy notifications:', notifError);
      } else {
        console.log(`   ✓ Deleted ${deletedNotifications?.length || 0} dummy notifications`);
      }

      // Step 2: Delete ALL dummy drives
      const { data: deletedDrives, error: driveError } = await supabase
        .from('drives')
        .delete()
        .eq('is_dummy', true)
        .select('id');

      if (driveError) {
        console.error('[DemoService] Error deleting dummy drives:', driveError);
      } else {
        console.log(`   ✓ Deleted ${deletedDrives?.length || 0} dummy drives`);
      }

      // Step 3: Update cached state
      this.isDemoModeEnabled = false;

      console.log('✅ [DemoService] LIVE MODE ACTIVATED - Demo data purged');
      
      return {
        success: true,
        action: 'switched_to_live',
        deletedDrives: deletedDrives?.length || 0,
        deletedNotifications: deletedNotifications?.length || 0
      };

    } catch (error) {
      console.error('[DemoService] Error during mode switch:', error);
      
return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup any stale dummy data (safety check)
   * Should be called periodically
   */
  async cleanupDummyData() {
    const isDemo = await this.isDemoMode();
    
    if (isDemo) {
      console.log('[DemoService] Still in demo mode, keeping dummy data');
      
return { success: true, action: 'kept', reason: 'demo_mode_active' };
    }

    // Real data exists, clean up any remaining dummy data
    const supabase = supabaseService.getClient();

    const { data: deletedNotifications } = await supabase
      .from('notifications')
      .delete()
      .eq('is_dummy', true)
      .select('id');

    const { data: deletedDrives } = await supabase
      .from('drives')
      .delete()
      .eq('is_dummy', true)
      .select('id');

    const totalDeleted = (deletedNotifications?.length || 0) + (deletedDrives?.length || 0);
    
    if (totalDeleted > 0) {
      console.log(`[DemoService] Cleanup: Removed ${totalDeleted} stale dummy records`);
    }

    return {
      success: true,
      action: 'cleaned',
      deletedDrives: deletedDrives?.length || 0,
      deletedNotifications: deletedNotifications?.length || 0
    };
  }

  /**
   * Helper: Get future date for demo deadlines
   */
  getFutureDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    
return date.toISOString();
  }

  /**
   * Get current mode status for debugging/monitoring
   */
  async getStatus() {
    const supabase = supabaseService.getClient();
    
    const { count: realDrives } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', false);

    const { count: dummyDrives } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', true);

    const { count: realNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', false);

    const { count: dummyNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', true);

    return {
      mode: realDrives > 0 ? 'LIVE' : 'DEMO',
      drives: {
        real: realDrives || 0,
        dummy: dummyDrives || 0
      },
      notifications: {
        real: realNotifications || 0,
        dummy: dummyNotifications || 0
      }
    };
  }
}

module.exports = new DemoService();
