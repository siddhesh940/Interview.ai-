"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@clerk/nextjs';
import {
    AlertTriangle,
    Award,
    Bell,
    Building,
    Calendar,
    CheckCircle,
    Clock,
    ExternalLink,
    Loader2,
    RefreshCw,
    Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Drive {
  id: number;
  company_id: number;
  role: string;
  drive_type: 'on-campus' | 'off-campus' | 'virtual';
  batch: string;
  min_cgpa: number;
  branches: string[];
  deadline: string;
  registration_link: string;
  source_url: string;
  is_active: boolean;
  created_at: string;
  companies: {
    name: string;
    logo_url: string;
  };
  eligibility?: {
    isEligible: boolean;
    score: number;
    reasons: string[];
  };
}

interface UserProfile {
  id: number;
  clerk_user_id: string;
  email: string;
  batch: string;
  branch: string;
  cgpa: number;
  college_name: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  drives?: Drive;
}

function PlacementDrivesPage() {
  const { user, isLoaded } = useUser();
  const [drives, setDrives] = useState<Drive[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('eligible');
  const [, setShowProfileSetup] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      fetchUserProfile();
      fetchNotifications();
    }
  }, [isLoaded, user]);

  useEffect(() => {
    fetchDrives();
  }, [userProfile, activeTab]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/user-profile');
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data.profile);
        if (!data.profile) {
          setShowProfileSetup(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const fetchDrives = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: activeTab,
        limit: '50'
      });
      
      const response = await fetch(`/api/placement-drives?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDrives(data.drives || []);
      }
    } catch (error) {
      console.error('Failed to fetch drives:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleRegisterClick = async (drive: Drive) => {
    try {
      await fetch('/api/placement-drives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_drive',
          data: { driveId: drive.id }
        })
      });
      window.open(drive.registration_link, '_blank');
    } catch (error) {
      console.error('Failed to record registration:', error);
      window.open(drive.registration_link, '_blank');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchDrives(), fetchNotifications()]);
    setIsRefreshing(false);
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getDriveTypeColor = (type: string) => {
    switch (type) {
      case 'on-campus': return 'bg-green-100 text-green-800';
      case 'virtual': return 'bg-blue-100 text-blue-800';
      case 'off-campus': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      formatted: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      relative: diffDays > 0 ? `${diffDays} days left` : 'Expired',
      isPast: date < now,
      isUrgent: diffDays <= 7 && diffDays > 0
    };
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Placement Drives</h1>
          <p className="text-gray-600 mt-1">
            Discover and apply to live placement opportunities from top companies
          </p>
        </div>
        <Button 
          disabled={isRefreshing} 
          variant="outline"
          onClick={handleRefresh}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Eligible Drives</p>
                <p className="text-2xl font-bold text-gray-900">
                  {drives.filter(d => d.eligibility?.isEligible).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Companies</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(drives.map(d => d.companies?.name).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Urgent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {drives.filter(d => formatDeadline(d.deadline).isUrgent).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bell className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unread</p>
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="eligible">Eligible Drives</TabsTrigger>
          <TabsTrigger value="all">All Drives</TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eligible" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : drives.filter(d => d.eligibility?.isEligible).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Eligible Drives Found</h3>
                <p className="text-gray-600">
                  There are no placement drives matching your profile at the moment. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drives.filter(d => d.eligibility?.isEligible).map((drive) => (
                <DriveCard key={drive.id} drive={drive} getDriveTypeColor={getDriveTypeColor} formatDeadline={formatDeadline} onRegisterClick={handleRegisterClick} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : drives.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Drives Available</h3>
                <p className="text-gray-600">
                  No placement drives are currently available. Check back soon!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {drives.map((drive) => (
                <DriveCard key={drive.id} drive={drive} getDriveTypeColor={getDriveTypeColor} formatDeadline={formatDeadline} onRegisterClick={handleRegisterClick} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllNotificationsAsRead}>
                Mark all as read
              </Button>
            )}
          </div>
          
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Notifications</h3>
                <p className="text-gray-600">
                  You will receive notifications when new placement drives are available.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <NotificationCard 
                  key={notification.id} 
                  notification={notification} 
                  onMarkAsRead={markNotificationAsRead}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface DriveCardProps {
  drive: Drive;
  onRegisterClick: (drive: Drive) => void;
  getDriveTypeColor: (type: string) => string;
  formatDeadline: (deadline: string) => { formatted: string; relative: string; isPast: boolean; isUrgent: boolean };
}

// eslint-disable-next-line react/function-component-definition
const DriveCard: React.FC<DriveCardProps> = ({ drive, onRegisterClick, getDriveTypeColor, formatDeadline }) => {
  const deadline = formatDeadline(drive.deadline);
  
  return (
    <Card className={`hover:shadow-lg transition-shadow ${deadline.isPast ? 'opacity-60' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              {drive.companies?.logo_url ? (
                <img 
                  src={drive.companies.logo_url} 
                  alt={drive.companies.name}
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <Building className="w-6 h-6 text-gray-600" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{drive.role}</CardTitle>
              <p className="text-sm text-gray-600">{drive.companies?.name}</p>
            </div>
          </div>
          <Badge className={getDriveTypeColor(drive.drive_type)}>
            {drive.drive_type.replace('-', ' ')}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {drive.eligibility && (
          <div className={`flex items-center p-3 rounded-lg ${
            drive.eligibility.isEligible 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-orange-50 border border-orange-200'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-3 ${
              drive.eligibility.isEligible ? 'bg-green-500' : 'bg-orange-500'
            }`} />
            <span className={`text-sm font-medium ${
              drive.eligibility.isEligible ? 'text-green-800' : 'text-orange-800'
            }`}>
              {drive.eligibility.isEligible ? 'Eligible' : 'Partially Eligible'}
            </span>
            <span className="text-xs text-gray-600 ml-2">({drive.eligibility.score}% match)</span>
          </div>
        )}
        
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            <span>Deadline: {deadline.formatted}</span>
            <Badge 
              variant={deadline.isUrgent ? "destructive" : "secondary"}
              className="ml-2"
            >
              {deadline.relative}
            </Badge>
          </div>
          
          <div className="flex items-center">
            <Award className="w-4 h-4 mr-2" />
            <span>Min CGPA: {drive.min_cgpa}</span>
          </div>
          
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2" />
            <span>Batch: {drive.batch}</span>
          </div>
        </div>
        
        {drive.branches && drive.branches.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Eligible Branches:</p>
            <div className="flex flex-wrap gap-1">
              {drive.branches.slice(0, 3).map((branch, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {branch}
                </Badge>
              ))}
              {drive.branches.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{drive.branches.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
        
        <Button 
          className="w-full"
          disabled={deadline.isPast}
          onClick={() => onRegisterClick(drive)}
        >
          {deadline.isPast ? 'Registration Closed' : (
            <>
              <ExternalLink className="w-4 h-4 mr-2" />
              Register Now
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
}

// eslint-disable-next-line react/function-component-definition
const NotificationCard: React.FC<NotificationCardProps> = ({ notification, onMarkAsRead }) => {
  const timeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) {return `${diffDays} days ago`;}
    if (diffHours > 0) {return `${diffHours} hours ago`;}
    if (diffMins > 0) {return `${diffMins} minutes ago`;}
    
return 'Just now';
  };

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        !notification.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
      }`}
      onClick={() => !notification.is_read && onMarkAsRead(notification.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`font-medium ${
              !notification.is_read ? 'text-blue-900' : 'text-gray-900'
            }`}>
              {notification.title}
            </h3>
            <p className={`text-sm mt-1 ${
              !notification.is_read ? 'text-blue-700' : 'text-gray-600'
            }`}>
              {notification.message}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {timeAgo(notification.created_at)}
            </p>
          </div>
          {!notification.is_read && (
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlacementDrivesPage;
