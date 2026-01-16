// API Route: /api/placement-drives
// Handles DEMO → LIVE mode automatically

import { createClient } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'eligible';
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = createClient();

    // Get user profile first
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    // Check if we have any REAL (non-dummy) drives
    const { count: realDrivesCount } = await supabase
      .from('drives')
      .select('*', { count: 'exact', head: true })
      .eq('is_dummy', false);

    const isLiveMode = (realDrivesCount || 0) > 0;

    // Get active drives based on mode
    // LIVE MODE: Only fetch real drives (is_dummy = false)
    // DEMO MODE: Fetch dummy drives (is_dummy = true)
    let query = supabase
      .from('drives')
      .select(`
        *,
        companies (
          name,
          logo_url
        )
      `)
      .eq('is_active', true)
      .eq('is_dummy', !isLiveMode) // false in live mode, true in demo mode
      .gte('deadline', new Date().toISOString())
      .order('deadline', { ascending: true })
      .limit(limit);

    const { data: drives, error } = await query;

    if (error) {
      console.error('Error fetching drives:', error);
      
return NextResponse.json({ error: 'Failed to fetch drives' }, { status: 500 });
    }

    // Calculate eligibility for each drive
    const drivesWithEligibility = (drives || []).map(drive => {
      const eligibility = calculateEligibility(userProfile, drive);
      
return { ...drive, eligibility };
    });

    // Filter by type
    let filteredDrives = drivesWithEligibility;
    if (type === 'eligible') {
      filteredDrives = drivesWithEligibility.filter(d => d.eligibility.isEligible);
    }

    return NextResponse.json({
      drives: filteredDrives,
      total: filteredDrives.length,
      userProfile,
      mode: isLiveMode ? 'LIVE' : 'DEMO' // For debugging
    });
  } catch (error) {
    console.error('Error fetching placement drives:', error);
    
return NextResponse.json(
      { error: 'Failed to fetch placement drives' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;
    const supabase = createClient();

    switch (action) {
      case 'register_drive':
        // Record that user clicked to register for a drive
        await supabase
          .from('drive_registrations')
          .upsert({
            clerk_user_id: userId,
            drive_id: data.driveId
          }, {
            onConflict: 'clerk_user_id,drive_id'
          });
        
return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in placement drives POST:', error);
    
return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

function calculateEligibility(userProfile: any, drive: any) {
  if (!userProfile) {
    return { isEligible: true, score: 50, reasons: ['Profile not set - showing all drives'] };
  }

  let score = 0;
  const reasons: string[] = [];

  // Batch check (40%)
  if (!userProfile.batch || !drive.batch || userProfile.batch === drive.batch) {
    score += 40;
  } else {
    reasons.push(`Batch mismatch: Required ${drive.batch}`);
  }

  // CGPA check (35%)
  if (!userProfile.cgpa || !drive.min_cgpa || userProfile.cgpa >= drive.min_cgpa) {
    score += 35;
  } else {
    reasons.push(`CGPA below requirement: Need ${drive.min_cgpa}`);
  }

  // Branch check (25%)
  if (!userProfile.branch || !drive.branches || drive.branches.length === 0 || drive.branches.includes(userProfile.branch)) {
    score += 25;
  } else {
    reasons.push(`Branch not eligible`);
  }

  return {
    isEligible: score >= 75,
    score,
    reasons: score >= 75 ? [] : reasons
  };
}
