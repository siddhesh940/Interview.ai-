// API Route: /api/user-profile

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
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
      
return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: profile || null });
  } catch (error) {
    console.error('Error in user profile GET:', error);
    
return NextResponse.json(
      { error: 'Failed to fetch user profile' },
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
    const { batch, branch, cgpa, college_name, email } = body;

    // Validate required fields
    if (!batch || !branch || cgpa === undefined) {
      return NextResponse.json(
        { error: 'Batch, branch, and CGPA are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    const profileData = {
      clerk_user_id: userId,
      batch,
      branch,
      cgpa: parseFloat(cgpa),
      college_name,
      email
    };

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(profileData, { 
        onConflict: 'clerk_user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      
return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error in user profile POST:', error);
    
return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
