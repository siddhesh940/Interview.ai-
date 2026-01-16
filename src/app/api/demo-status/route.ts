// API Route: /api/demo-status
// Admin endpoint to check and manage demo mode

import { createClient } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    // Get real drives count
    const { count: realDrives } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', false);

    // Get dummy drives count
    const { count: dummyDrives } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', true);

    // Get real notifications count
    const { count: realNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', false);

    // Get dummy notifications count
    const { count: dummyNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', true);

    const mode = (realDrives || 0) > 0 ? 'LIVE' : 'DEMO';

    return NextResponse.json({
      mode,
      drives: {
        real: realDrives || 0,
        dummy: dummyDrives || 0
      },
      notifications: {
        real: realNotifications || 0,
        dummy: dummyNotifications || 0
      },
      message: mode === 'LIVE' 
        ? 'System is running in LIVE mode with real data' 
        : 'System is running in DEMO mode with sample data'
    });
  } catch (error) {
    console.error('Error checking demo status:', error);

    return NextResponse.json(
      { error: 'Failed to check demo status' },
      { status: 500 }
    );
  }
}

// POST: Initialize demo data (only works if no real data exists)
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const supabase = createClient();

    if (action === 'init_demo') {
      // Check if real data exists
      const { count: realDrives } = await supabase
        .from('drives')
        .select('*', { count: 'exact', head: true })
        .eq('is_dummy', false);

      if ((realDrives || 0) > 0) {
        return NextResponse.json({
          success: false,
          error: 'Cannot initialize demo mode - real data already exists'
        }, { status: 400 });
      }

      // Check if dummy data already exists
      const { count: dummyDrives } = await supabase
        .from('drives')
        .select('*', { count: 'exact', head: true })
        .eq('is_dummy', true);

      if ((dummyDrives || 0) > 0) {
        return NextResponse.json({
          success: true,
          message: 'Demo data already exists',
          dummyDrives
        });
      }

      // Get companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name');

      if (!companies || companies.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No companies found in database'
        }, { status: 400 });
      }

      // Create demo drives
      const demoDrives = createDemoDrives(companies);
      
      const { data: insertedDrives, error: driveError } = await supabase
        .from('drives')
        .insert(demoDrives)
        .select();

      if (driveError) {
        return NextResponse.json({
          success: false,
          error: driveError.message
        }, { status: 500 });
      }

      // Create demo notifications for current user
      const demoNotifications = (insertedDrives || []).slice(0, 3).map(drive => ({
        clerk_user_id: userId,
        drive_id: drive.id,
        title: `New ${drive.role} opportunity!`,
        message: `A new placement drive is available. Apply before the deadline!`,
        is_read: false,
        is_dummy: true
      }));

      await supabase.from('notifications').insert(demoNotifications);

      return NextResponse.json({
        success: true,
        message: 'Demo data initialized successfully',
        drivesCreated: insertedDrives?.length || 0,
        notificationsCreated: demoNotifications.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
  } catch (error) {
    console.error('Error in demo action:', error);

    return NextResponse.json(
      { error: 'Failed to perform demo action' },
      { status: 500 }
    );
  }
}

function createDemoDrives(companies: { id: number; name: string }[]) {
  const companyMap: Record<string, number> = {};
  companies.forEach(c => companyMap[c.name.toLowerCase()] = c.id);

  const getFutureDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    
return date.toISOString();
  };

  return [
    {
      company_id: companyMap['accenture'] || companies[0].id,
      role: 'Associate Software Engineer',
      drive_type: 'off-campus',
      batch: '2025',
      min_cgpa: 6.0,
      branches: ['CSE', 'IT', 'ECE', 'EEE'],
      deadline: getFutureDate(15),
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
      deadline: getFutureDate(10),
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
      deadline: getFutureDate(20),
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
      deadline: getFutureDate(7),
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
      deadline: getFutureDate(12),
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
      deadline: getFutureDate(18),
      registration_link: 'https://careers.capgemini.com/demo',
      source_url: 'https://careers.capgemini.com',
      is_active: true,
      is_dummy: true
    }
  ];
}
