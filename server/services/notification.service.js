const supabaseService = require('../config/supabaseClient');

class NotificationService {
  async createNotificationsForNewDrives(drives) {
    if (!drives || drives.length === 0) {
      return { success: true, notificationsCreated: 0, usersNotified: 0 };
    }

    try {
      const supabase = supabaseService.getClient();
      const userProfiles = await supabaseService.getAllUserProfiles();

      if (!userProfiles || userProfiles.length === 0) {
        console.log('No user profiles found for notifications');
        
return { success: true, notificationsCreated: 0, usersNotified: 0 };
      }

      let notificationsCreated = 0;
      const usersNotified = new Set();

      for (const drive of drives) {
        const eligibleUsers = this.findEligibleUsers(userProfiles, drive);

        for (const user of eligibleUsers) {
          const notification = {
            user_profile_id: user.id,
            drive_id: drive.id,
            title: `New ${drive.companies?.name || 'Company'} Drive!`,
            message: `${drive.role} position available. Deadline: ${new Date(drive.deadline).toLocaleDateString()}`,
            is_read: false
          };

          const { error } = await supabase
            .from('notifications')
            .insert(notification);

          if (!error) {
            notificationsCreated++;
            usersNotified.add(user.id);
          }
        }
      }

      return {
        success: true,
        notificationsCreated,
        usersNotified: usersNotified.size
      };
    } catch (error) {
      console.error('Error creating notifications:', error);
      
return { success: false, error: error.message };
    }
  }

  findEligibleUsers(userProfiles, drive) {
    return userProfiles.filter(user => {
      // Check batch
      if (drive.batch && user.batch !== drive.batch) {
        return false;
      }

      // Check CGPA
      if (drive.min_cgpa && user.cgpa < drive.min_cgpa) {
        return false;
      }

      // Check branch
      if (drive.branches && drive.branches.length > 0) {
        const branchMatch = drive.branches.some(branch => 
          branch.toLowerCase().includes(user.branch?.toLowerCase() || '') ||
          (user.branch?.toLowerCase() || '').includes(branch.toLowerCase())
        );
        if (!branchMatch) {
          return false;
        }
      }

      return true;
    });
  }

  async getUserNotifications(userProfileId, limit = 20) {
    const supabase = supabaseService.getClient();

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        drives (
          role,
          deadline,
          companies (
            name,
            logo_url
          )
        )
      `)
      .eq('user_profile_id', userProfileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      
return [];
    }

    return data || [];
  }

  async markAsRead(notificationId, userProfileId) {
    const supabase = supabaseService.getClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_profile_id', userProfileId);

    return !error;
  }

  async markAllAsRead(userProfileId) {
    const supabase = supabaseService.getClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_profile_id', userProfileId)
      .eq('is_read', false);

    return !error;
  }

  async getUnreadCount(userProfileId) {
    const supabase = supabaseService.getClient();

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_profile_id', userProfileId)
      .eq('is_read', false);

    if (error) {
      console.error('Error getting unread count:', error);
      
return 0;
    }

    return count || 0;
  }
}

module.exports = new NotificationService();
