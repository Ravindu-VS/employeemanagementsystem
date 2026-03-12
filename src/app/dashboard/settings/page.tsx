'use client';

/**
 * =====================================================
 * SETTINGS PAGE
 * =====================================================
 * Application and system settings.
 */

import { useState } from 'react';
import { 
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  Clock,
  DollarSign,
  Save,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Globe,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRequireRole, useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { PAYROLL_CONFIG, ATTENDANCE_CONFIG } from '@/constants';

// Settings tabs
const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, profile } = useAuth();
  const { isAuthorized } = useRequireRole(['owner', 'ceo', 'manager']);
  
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: profile?.phone || '',
  });

  const [companyData, setCompanyData] = useState({
    name: 'Construction Company Ltd.',
    address: '123 Main Street, Colombo',
    phone: '+94 11 234 5678',
    email: 'info@company.lk',
    website: 'www.company.lk',
  });

  const [payrollSettings, setPayrollSettings] = useState({
    weekStartDay: PAYROLL_CONFIG.WEEK_START_DAY as number,
    workingDaysPerWeek: 6,
    regularHoursPerDay: ATTENDANCE_CONFIG.STANDARD_WORK_HOURS as number,
    otMultiplier: PAYROLL_CONFIG.OVERTIME_MULTIPLIER as number,
    maxAdvancePercent: PAYROLL_CONFIG.MAX_ADVANCE_PERCENTAGE as number,
    maxLoanEmis: PAYROLL_CONFIG.MAX_LOAN_EMIS as number,
    defaultInterestRate: PAYROLL_CONFIG.DEFAULT_INTEREST_RATE as number,
  });

  const [attendanceSettings, setAttendanceSettings] = useState({
    autoCloseTime: ATTENDANCE_CONFIG.AUTO_CLOSE_AFTER_HOURS as number,
    minSessionMinutes: 30,
    allowMultipleSessions: false,
    requireGeolocation: true,
    geofenceRadius: ATTENDANCE_CONFIG.DEFAULT_GEOFENCE_RADIUS as number,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    advanceRequests: true,
    loanRequests: true,
    payrollGenerated: true,
    attendanceAlerts: true,
  });

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: 'Settings Saved',
      description: 'Your settings have been updated successfully.',
    });
    
    setIsSaving(false);
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application settings
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <Card className="bg-card/50 lg:w-64 lg:shrink-0">
          <CardContent className="p-2">
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-3xl font-bold text-primary">
                    {profileData.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Button variant="outline" size="sm">Change Photo</Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      value={profileData.displayName}
                      onChange={(e) => setProfileData(prev => ({ 
                        ...prev, 
                        displayName: e.target.value 
                      }))}
                      icon={<User className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={profileData.email}
                      disabled
                      className="bg-muted/50"
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ 
                        ...prev, 
                        phone: e.target.value 
                      }))}
                      icon={<Phone className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Settings */}
          {activeTab === 'company' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Update your company details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Company Name</Label>
                    <Input
                      value={companyData.name}
                      onChange={(e) => setCompanyData(prev => ({ 
                        ...prev, 
                        name: e.target.value 
                      }))}
                      icon={<Building2 className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={companyData.address}
                      onChange={(e) => setCompanyData(prev => ({ 
                        ...prev, 
                        address: e.target.value 
                      }))}
                      icon={<MapPin className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={companyData.phone}
                      onChange={(e) => setCompanyData(prev => ({ 
                        ...prev, 
                        phone: e.target.value 
                      }))}
                      icon={<Phone className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={companyData.email}
                      onChange={(e) => setCompanyData(prev => ({ 
                        ...prev, 
                        email: e.target.value 
                      }))}
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={companyData.website}
                      onChange={(e) => setCompanyData(prev => ({ 
                        ...prev, 
                        website: e.target.value 
                      }))}
                      icon={<Globe className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payroll Settings */}
          {activeTab === 'payroll' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Payroll Configuration</CardTitle>
                <CardDescription>
                  Configure salary and payment settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Week Start Day</Label>
                    <select
                      value={payrollSettings.weekStartDay}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        weekStartDay: parseInt(e.target.value) 
                      }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Working Days per Week</Label>
                    <Input
                      type="number"
                      value={payrollSettings.workingDaysPerWeek}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        workingDaysPerWeek: parseInt(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Regular Hours per Day</Label>
                    <Input
                      type="number"
                      value={payrollSettings.regularHoursPerDay}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        regularHoursPerDay: parseInt(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>OT Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={payrollSettings.otMultiplier}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        otMultiplier: parseFloat(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Advance (% of salary)</Label>
                    <Input
                      type="number"
                      value={payrollSettings.maxAdvancePercent}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        maxAdvancePercent: parseInt(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Loan EMIs</Label>
                    <Input
                      type="number"
                      value={payrollSettings.maxLoanEmis}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        maxLoanEmis: parseInt(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={payrollSettings.defaultInterestRate}
                      onChange={(e) => setPayrollSettings(prev => ({ 
                        ...prev, 
                        defaultInterestRate: parseFloat(e.target.value) 
                      }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance Settings */}
          {activeTab === 'attendance' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Attendance Configuration</CardTitle>
                <CardDescription>
                  Configure attendance tracking settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Auto-Close After (hours)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.autoCloseTime}
                      onChange={(e) => setAttendanceSettings(prev => ({ 
                        ...prev, 
                        autoCloseTime: parseInt(e.target.value) || 0
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Active sessions will be auto-closed after this many hours
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Session Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.minSessionMinutes}
                      onChange={(e) => setAttendanceSettings(prev => ({ 
                        ...prev, 
                        minSessionMinutes: parseInt(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Geofence Radius (meters)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.geofenceRadius}
                      onChange={(e) => setAttendanceSettings(prev => ({ 
                        ...prev, 
                        geofenceRadius: parseInt(e.target.value) 
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Allow Multiple Sessions</p>
                      <p className="text-sm text-muted-foreground">
                        Allow employees to have multiple check-in/out per day
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={attendanceSettings.allowMultipleSessions}
                      onChange={(e) => setAttendanceSettings(prev => ({ 
                        ...prev, 
                        allowMultipleSessions: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require Geolocation</p>
                      <p className="text-sm text-muted-foreground">
                        Employees must be within site geofence to check-in
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={attendanceSettings.requireGeolocation}
                      onChange={(e) => setAttendanceSettings(prev => ({ 
                        ...prev, 
                        requireGeolocation: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings(prev => ({ 
                        ...prev, 
                        emailNotifications: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive browser push notifications
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.pushNotifications}
                      onChange={(e) => setNotificationSettings(prev => ({ 
                        ...prev, 
                        pushNotifications: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Notify me about:</p>
                  
                  <div className="flex items-center justify-between">
                    <span>Advance Requests</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.advanceRequests}
                      onChange={(e) => setNotificationSettings(prev => ({ 
                        ...prev, 
                        advanceRequests: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Loan Requests</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.loanRequests}
                      onChange={(e) => setNotificationSettings(prev => ({ 
                        ...prev, 
                        loanRequests: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Payroll Generated</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.payrollGenerated}
                      onChange={(e) => setNotificationSettings(prev => ({ 
                        ...prev, 
                        payrollGenerated: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Attendance Alerts</span>
                    <input
                      type="checkbox"
                      checked={notificationSettings.attendanceAlerts}
                      onChange={(e) => setNotificationSettings(prev => ({ 
                        ...prev, 
                        attendanceAlerts: e.target.checked 
                      }))}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                        theme === 'light' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <Sun className="h-6 w-6" />
                      <span className="text-sm">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                        theme === 'dark' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <Moon className="h-6 w-6" />
                      <span className="text-sm">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={cn(
                        'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                        theme === 'system' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <Monitor className="h-6 w-6" />
                      <span className="text-sm">System</span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Manage your account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Change Password</p>
                        <p className="text-sm text-muted-foreground">
                          Update your account password
                        </p>
                      </div>
                      <Button variant="outline">Change</Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security
                        </p>
                      </div>
                      <Button variant="outline">Enable</Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Active Sessions</p>
                        <p className="text-sm text-muted-foreground">
                          Manage your active login sessions
                        </p>
                      </div>
                      <Button variant="outline">View</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
